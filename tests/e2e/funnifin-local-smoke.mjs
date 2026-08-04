import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { localSession } from "./localTestSettings.mjs";

const PORT = 5177;
const BASE_URL = `http://127.0.0.1:${PORT}/`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(process) {
  const started = Date.now();
  while (Date.now() - started < 20000) {
    if (process.exitCode !== null) throw new Error("Vite exited before becoming ready");
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      await wait(250);
    }
  }
  throw new Error("Timed out waiting for Vite");
}

async function assertIconCentered(page) {
  const metrics = await page.locator(".survey-nav button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const icon = button.querySelector(".fa-icon, svg");
      const buttonRect = button.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      return {
        dx: Math.abs((buttonRect.left + buttonRect.width / 2) - (iconRect.left + iconRect.width / 2)),
        dy: Math.abs((buttonRect.top + buttonRect.height / 2) - (iconRect.top + iconRect.height / 2)),
      };
    }),
  );
  for (const metric of metrics) {
    if (metric.dx > 2 || metric.dy > 2) {
      throw new Error(`Survey nav icon not centered: ${JSON.stringify(metrics)}`);
    }
  }
}

async function answerCurrentQuestion(page, answerName) {
  await page.getByRole("button", { name: answerName }).click();
  await page.locator(".survey-nav").getByRole("button", { name: "Continua" }).click();
}

async function run() {
  const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(PORT)], {
    env: {
      ...process.env,
      VITE_APPS_SCRIPT_DEPLOYMENT_URL: "",
      VITE_ALLOW_LOCAL_FALLBACKS: "true",
      VITE_STRICT_GOOGLE_BACKEND: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let browser;
  try {
    await waitForServer(server);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript((session) => {
      Math.random = () => 0;
      window.localStorage.setItem("funnifin_auth_session", JSON.stringify(session));
      window.localStorage.setItem("funnifin_theme", "dark");
      window.sessionStorage.setItem(`funnifin_welcome_seen_${session.token}`, "1");
    }, localSession("funnifin"));
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    await page.getByLabel(/Esci \(Team FunniFin\)/).waitFor({ timeout: 5000 });
    if ((await page.locator("html").getAttribute("data-theme")) !== "light") {
      throw new Error("Legacy/system theme should not start the app in dark mode");
    }
    await page.getByRole("button", { name: "Attiva modalità scura", exact: true }).click();
    await page.locator('html[data-theme="dark"]').waitFor({ timeout: 3000 });
    if ((await page.evaluate(() => window.localStorage.getItem("funnifin_theme_preference_v2"))) !== "dark") {
      throw new Error("Explicit dark preference was not persisted");
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('html[data-theme="dark"]').waitFor({ timeout: 3000 });
    await page.getByRole("button", { name: "Attiva modalità chiara", exact: true }).click();
    await page.locator('html[data-theme="light"]').waitFor({ timeout: 3000 });
    await page.getByLabel("Chiudi benvenuto").click().catch(() => {});
    await page.getByText("Visualizza come: FunniFin").click();
    await page.getByRole("button", { name: /^Cliente$/ }).click();

    await page.getByRole("heading", { name: /Costruisci il piano formativo/ }).waitFor({ timeout: 8000 });
    const startGuided = page.getByRole("button", { name: "Inizia percorso guidato", exact: true });
    if (await startGuided.count() === 0) {
      await page.getByRole("button", { name: "Vedi dettagli", exact: true }).first().click();
    }
    await startGuided.click();
    await page.getByRole("heading", { name: "Su quali ambiti vuoi generare maggiore impatto?" }).waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: /Retribuzione/ }).click();
    await page.getByRole("button", { name: /Famiglia/ }).click();
    await page.getByRole("button", { name: /Finanziamenti/ }).click();
    const selectedTopicAnswers = await page.locator(".survey-option.selected").count();
    if (selectedTopicAnswers !== 3) {
      throw new Error(`Guided survey should preserve the three selected topics, got ${selectedTopicAnswers}`);
    }
    await assertIconCentered(page);
    await page.locator(".survey-nav").getByRole("button", { name: "Continua" }).click();

    await answerCurrentQuestion(page, /Avanzata/);
    if ((await page.locator(".survey-option").count()) !== 3) {
      throw new Error("Employee survey step should expose exactly three bands");
    }
    await page.getByRole("button", { name: /Fino a 50/ }).click();
    await page.locator(".survey-nav").getByRole("button", { name: "Indietro" }).click();
    await page.getByRole("heading", { name: "Quale risultato vuoi ottenere?" }).waitFor({ timeout: 5000 });
    await page.locator(".survey-nav").getByRole("button", { name: "Continua" }).click();
    await answerCurrentQuestion(page, /Fino a 50/);
    await answerCurrentQuestion(page, /^In presenza/);
    await answerCurrentQuestion(page, /> 10.000 €/);

    await page.getByRole("heading", { name: "Abbiamo trovato il percorso ideale" }).waitFor({ timeout: 10000 });
    await page.locator(".guided-bundle-recommendation .bundle-card").filter({ hasText: "Bundle Educazione Finanziaria Avanzata" }).waitFor({ timeout: 5000 });
    await page.locator(".guided-bundle-extras").filter({ hasText: "Come leggere una busta paga" }).waitFor({ timeout: 5000 });
    await page.getByRole("heading", { name: "Oppure scegli i workshop singoli" }).waitFor({ timeout: 5000 });
    const standaloneAlternatives = await page.locator(".guided-single-alternatives .guided-workshop-card").count();
    if (standaloneAlternatives < 1) {
      throw new Error("Bundle recommendation should also expose coherent standalone workshop alternatives");
    }
    const extraSummary = await page.locator(".guided-bundle-extras .guided-workshop-card").innerText();
    if (!extraSummary.includes("In presenza") || !/1500\s*€/.test(extraSummary)) {
      throw new Error(`In-person recommendation price/format is inconsistent: ${extraSummary}`);
    }
    if ((await page.getByText("Nessun pacchetto copre bene questa combinazione", { exact: false }).count()) !== 0) {
      throw new Error("Valid advanced bundle was incorrectly replaced by the à-la-carte fallback");
    }
    const addRecommendation = page.getByRole("button", { name: "Aggiungi pacchetto e workshop", exact: true });
    await addRecommendation.waitFor({ timeout: 5000 });
    await addRecommendation.click();
    const pathSummary = page.locator('button[aria-label^="Apri il percorso:"]');
    await pathSummary.waitFor({ timeout: 5000 });
    const pathSummaryLabel = await pathSummary.getAttribute("aria-label");
    if (!pathSummaryLabel?.includes("7 workshop") || !/9[.\s]?000/.test(pathSummaryLabel)) {
      throw new Error(`Applied recommendation is inconsistent: ${pathSummaryLabel}`);
    }

    console.log("PASS local e2e: light default, 3 employee bands, balanced advanced bundle, in-person price/format");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

await run().catch((error) => {
  console.error(error);
  process.exit(1);
});
