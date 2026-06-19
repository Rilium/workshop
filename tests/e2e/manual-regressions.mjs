import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 5197;
const BASE_URL = `http://127.0.0.1:${PORT}/`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.addInitScript(() => {
      Math.random = () => 0;
    });
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const selectedInterestRemoveButtons = await page.getByLabel(/Rimuovi /).count();
    assert(selectedInterestRemoveButtons === 0, `Client view should start empty, found ${selectedInterestRemoveButtons} selected interest buttons`);

    await page.locator("button:visible").filter({ hasText: "Ambito personale" }).first().click();
    await page.getByRole("button", { name: /Vedi consigli/i }).click();
    await page.getByRole("heading", { name: "Workshop consigliati", exact: true }).waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: /Aggiungi consigliati/i }).click();
    await page.getByRole("heading", { name: "Scegli workshop", exact: true }).waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: /Personalizza percorso/i }).click();
    await page.getByRole("button", { name: /Scegli le date/i }).click();
    await page.getByRole("heading", { name: "Proponi date", exact: true }).waitFor({ timeout: 5000 });

    await page.getByRole("button", { name: /^Scegli$/ }).first().click();
    await page.getByRole("dialog").waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: /^Adesso$/ }).click();
    await page.waitForTimeout(500);

    const activeDay = await page.locator(".day-grid button.active").innerText();
    const expectedDay = String(new Date().getDate());
    assert(activeDay === expectedDay, `Adesso should select today (${expectedDay}), got ${activeDay}`);

    await page.getByRole("button", { name: /Conferma proposta/i }).click();
    await page.waitForTimeout(300);
    const pageText = await page.locator("body").innerText();
    assert(pageText.includes(todayKey()), `Confirmed date should include ${todayKey()}`);
    assert(!errors.some((error) => /same key|duplicate/i.test(error)), `Duplicate-key console error found: ${errors.join(" | ")}`);

    console.log("PASS manual regressions: empty client start, Adesso selects today, no duplicate toast keys");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
