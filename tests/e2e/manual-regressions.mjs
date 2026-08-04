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

async function cartWorkshopCount(page) {
  const label = await page.locator(".cart-compact-head strong").textContent();
  return Number.parseInt(label || "0", 10);
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

    await page.getByRole("button", { name: /Esplora catalogo/i }).click();
    await page.getByRole("heading", { name: "Scegli workshop", exact: true }).waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: "Aggiungi Le assicurazioni essenziali: quali servono davvero al percorso", exact: true }).click();
    const personalizeAction = page.getByRole("button", { name: /Personalizza percorso/i });
    if (await personalizeAction.count()) {
      await personalizeAction.click();
      await page.getByRole("button", { name: "Procedi", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "Procedi", exact: true }).click();
    }
    await page.getByRole("heading", { name: "Quando vuoi definire le date?", exact: true }).waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: /Le conosco già/ }).click();

    await page.getByRole("button", { name: /^Scegli$/ }).first().click();
    await page.getByRole("dialog").waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);

    const activeDay = await page.locator(".day-grid button.active").innerText();
    const expectedDay = String(new Date().getDate());
    assert(activeDay === expectedDay, `Calendar should select today (${expectedDay}), got ${activeDay}`);

    await page.getByRole("button", { name: /Conferma proposta/i }).click();
    await page.waitForTimeout(300);
    const pageText = await page.locator("body").innerText();
    assert(pageText.includes(todayKey()), `Confirmed date should include ${todayKey()}`);
    assert(!errors.some((error) => /same key|duplicate/i.test(error)), `Duplicate-key console error found: ${errors.join(" | ")}`);

    const bundlePage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await bundlePage.addInitScript(() => {
      Math.random = () => 0;
    });
    await bundlePage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await bundlePage.waitForTimeout(1800);
    await bundlePage.getByRole("button", { name: "Esplora catalogo", exact: true }).click();
    const bundleCards = bundlePage.locator(".bundle-card");
    const firstBundleTitle = await bundleCards.nth(0).locator(".bundle-card-copy > strong").textContent();
    const secondBundleTitle = await bundleCards.nth(1).locator(".bundle-card-copy > strong").textContent();
    const firstBundleTitles = await bundleCards.nth(0).locator(".bundle-member-disclosure li strong").allTextContents();
    const secondBundleTitles = await bundleCards.nth(1).locator(".bundle-member-disclosure li strong").allTextContents();
    const expectedUniqueWorkshopCount = new Set([...firstBundleTitles, ...secondBundleTitles]).size;
    await bundlePage.getByPlaceholder("Cerca nel catalogo").fill(firstBundleTitles[0]);
    await bundlePage.getByRole("button", { name: `Aggiungi ${firstBundleTitles[0]} al percorso`, exact: true }).click();
    assert(await cartWorkshopCount(bundlePage) === 1, "Standalone workshop should be added once");
    await bundlePage.getByLabel("Cancella ricerca").click();
    await bundlePage.locator(".bundle-card").filter({ hasText: firstBundleTitle || "" }).getByRole("button", { name: "Aggiungi il pacchetto" }).click();
    assert(await cartWorkshopCount(bundlePage) === new Set(firstBundleTitles).size, "Bundle should absorb an existing member without duplicating it");
    await bundlePage.getByText("Pacchetto aggiunto senza doppioni", { exact: true }).waitFor();
    await bundlePage.getByPlaceholder("Cerca nel catalogo").fill(firstBundleTitles[0]);
    assert(await bundlePage.getByText("Incluso nel pacchetto", { exact: true }).count() === 1, "Included workshop should be marked as part of the bundle");
    assert(await bundlePage.getByRole("button", { name: `Aggiungi ${firstBundleTitles[0]} al percorso`, exact: true }).count() === 0, "Included workshop must not expose a duplicate add action");
    await bundlePage.getByLabel("Cancella ricerca").click();
    await bundlePage.locator(".bundle-card").filter({ hasText: secondBundleTitle || "" }).getByRole("button", { name: "Aggiungi il pacchetto" }).click();
    await bundlePage.waitForTimeout(200);
    assert(await bundlePage.locator(".bundle-card.selected").count() === 2, "Both selected bundles should remain active");
    assert(
      await cartWorkshopCount(bundlePage) === expectedUniqueWorkshopCount,
      "Shared workshops should appear only once when multiple bundles are selected",
    );
    const sharedWorkshopTitle = firstBundleTitles.find((title) => secondBundleTitles.includes(title));
    assert(Boolean(sharedWorkshopTitle), "Fixture should contain a workshop shared by the first two bundles");
    await bundlePage.getByRole("button", { name: "Vedi riepilogo completo", exact: true }).click();
    assert(await bundlePage.locator(".cart-bundle-list > div").count() === 2, "Cart should summarize both selected bundles");
    assert(await bundlePage.locator(".path-workshop-row").count() === expectedUniqueWorkshopCount, "Il riepilogo completo deve mostrare ogni workshop una sola volta");
    await bundlePage.locator(".path-workshop-row").filter({ hasText: sharedWorkshopTitle }).getByLabel(`Rimuovi ${sharedWorkshopTitle}`).click();
    await bundlePage.getByRole("button", { name: "Chiudi riepilogo", exact: true }).click();
    assert(await bundlePage.locator(".bundle-card.selected").count() === 0, "Removing a shared member should invalidate both bundles");
    await bundlePage.getByText(/2 pacchetti collegati non sono più completi/).waitFor();
    await bundlePage.close();

    console.log("PASS manual regressions: empty start, calendar, multi-bundle cart, sidebar height, no duplicate toast keys");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

await run().catch((error) => {
  console.error(error);
  process.exit(1);
});
