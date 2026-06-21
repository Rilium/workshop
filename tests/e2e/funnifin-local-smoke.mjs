import { spawn } from "node:child_process";
import { chromium } from "playwright";

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
      const icon = button.querySelector("svg");
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
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let browser;
  try {
    await waitForServer(server);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => {
      Math.random = () => 0;
      const session = {
        userId: "user-funnifin",
        token: `local-ui-${Date.now()}`,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        effectiveRole: "FunniFin",
        user: {
          id: "user-funnifin",
          email: "rinaldi.rilio@gmail.com",
          actualRole: "FunniFin",
          displayName: "Team FunniFin",
          createdAt: "2024-01-01T00:00:00",
          disabled: false,
        },
      };
      window.localStorage.setItem("funnifin_auth_session", JSON.stringify(session));
      window.sessionStorage.setItem(`funnifin_welcome_seen_${session.token}`, "1");
    });
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    await page.getByLabel(/Esci \(Team FunniFin\)/).waitFor({ timeout: 5000 });
    await page.getByLabel("Chiudi benvenuto").click().catch(() => {});
    await page.getByText("Visualizza come: FunniFin").click();
    await page.getByRole("button", { name: /^Cliente$/ }).click();

    await page.getByRole("heading", { name: "Come vuoi costruire il tuo percorso?" }).waitFor({ timeout: 8000 });
    await page.getByRole("button", { name: /Inizia/ }).click();
    await page.getByRole("heading", { name: "Su quali temi vuoi generare maggiore impatto?" }).waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: /Retribuzione/ }).click();
    await page.getByRole("button", { name: /Risparmio/ }).click();
    await assertIconCentered(page);
    await page.locator(".survey-nav").getByRole("button", { name: "Continua" }).click();

    await answerCurrentQuestion(page, /Formazione pratica/);
    await page.getByRole("button", { name: /51-200/ }).click();
    await page.locator(".survey-nav").getByRole("button", { name: "Indietro" }).click();
    await page.getByRole("heading", { name: "Quale risultato vuoi ottenere?" }).waitFor({ timeout: 5000 });
    await page.locator(".survey-nav").getByRole("button", { name: "Continua" }).click();
    await answerCurrentQuestion(page, /51-200/);
    await answerCurrentQuestion(page, /Webinar live/);
    await answerCurrentQuestion(page, /2.000 - 5.000 €/);

    await page.getByRole("heading", { name: "Abbiamo trovato il percorso ideale" }).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: /Aggiungi percorso consigliato/ }).waitFor({ timeout: 5000 });

    console.log("PASS local e2e: injected auth session, guided survey back/forward, centered nav icons");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
