import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const PORT = 5198;
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const OUT_DIR = resolve("manual-screenshots/client-flow");

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
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

async function capture(page, name) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(450);
  await page.screenshot({ path: resolve(OUT_DIR, name), fullPage: true });
}

async function chooseFirstDate(page) {
  await page.getByRole("button", { name: /^Scegli$/ }).first().click();
  await page.getByRole("dialog").waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /^Adesso$/ }).click();
  await page.getByRole("button", { name: /Conferma proposta/i }).click();
  await page.waitForTimeout(250);
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => {
      Math.random = () => 0;
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    await capture(page, "01-cliente-interessi.png");

    await page.locator("button:visible").filter({ hasText: "Ambito personale" }).first().click();
    await page.getByRole("button", { name: /Vedi consigli/i }).click();
    await page.getByRole("heading", { name: "Workshop consigliati", exact: true }).waitFor({ timeout: 5000 });
    await capture(page, "02-cliente-consigliati.png");

    await page.getByRole("button", { name: /Aggiungi consigliati/i }).click();
    await page.getByRole("heading", { name: "Scegli workshop", exact: true }).waitFor({ timeout: 5000 });
    await capture(page, "03-cliente-workshop.png");

    await page.getByRole("button", { name: /Personalizza percorso/i }).click();
    await page.getByRole("heading", { name: "Personalizzazione su misura", exact: true }).waitFor({ timeout: 5000 });
    await capture(page, "04-cliente-personalizza.png");

    await page.getByRole("button", { name: /Scegli le date/i }).click();
    await page.getByRole("heading", { name: "Proponi date", exact: true }).waitFor({ timeout: 5000 });
    await chooseFirstDate(page);
    await chooseFirstDate(page);
    await chooseFirstDate(page);
    await capture(page, "05-cliente-date.png");

    await page.getByRole("button", { name: /Carica materiali/i }).click();
    await page.getByRole("heading", { name: "Logo e note cliente", exact: true }).waitFor({ timeout: 5000 });
    await capture(page, "06-cliente-materiali.png");

    await page.getByRole("button", { name: /Vai all'invio/i }).click();
    await page.getByRole("heading", { name: "Invio richiesta", exact: true }).waitFor({ timeout: 5000 });
    await page.getByRole("textbox", { name: "Nome", exact: true }).fill("Giulia");
    await page.getByRole("textbox", { name: "Cognome", exact: true }).fill("Rossi");
    await page.getByRole("textbox", { name: "Email aziendale", exact: true }).fill("giulia.rossi@example.com");
    await page.getByRole("textbox", { name: "Azienda", exact: true }).fill("Demo Cliente SpA");
    await page.getByRole("textbox", { name: "Telefono", exact: true }).fill("+39 020000000");
    await capture(page, "07-cliente-invio.png");

    console.log(`Client flow screenshots saved in ${OUT_DIR}`);
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
