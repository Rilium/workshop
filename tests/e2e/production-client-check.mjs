import { chromium } from "playwright";

const targetUrl = String(process.env.TARGET_URL || "").trim();
if (!/^https:\/\//.test(targetUrl)) {
  throw new Error("TARGET_URL HTTPS obbligatorio per il controllo produzione.");
}

const response = await fetch(targetUrl, { redirect: "follow" });
if (!response.ok) throw new Error(`Frontend non raggiungibile: HTTP ${response.status}`);

const catalogResponse = await fetch(new URL("/api/public-catalog", targetUrl), { redirect: "follow" });
const catalog = await catalogResponse.json().catch(() => null);
if (!catalogResponse.ok || catalog?.ok !== true || catalog?.source !== "google-sheet" || !catalog.workshops?.length) {
  throw new Error(`Proxy catalogo non disponibile: HTTP ${catalogResponse.status}`);
}

const csp = response.headers.get("content-security-policy") || "";
if (!csp.includes("default-src 'self'")) throw new Error("Content-Security-Policy assente o incompleta.");
if (response.headers.get("x-content-type-options") !== "nosniff") throw new Error("X-Content-Type-Options non impostato.");
if (!response.headers.get("referrer-policy")) throw new Error("Referrer-Policy non impostato.");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: /Costruisci il piano formativo/ }).waitFor({ timeout: 30_000 });
  if ((await page.locator("body").innerText()).includes("Catalogo Sheet non disponibile")) {
    throw new Error("Il frontend ha attivato lo stato fail-closed del catalogo.");
  }

  const exploreCatalog = page.getByRole("button", { name: "Esplora catalogo", exact: true });
  if (await exploreCatalog.count() === 0) {
    await page.getByRole("button", { name: "Vedi dettagli", exact: true }).nth(1).click();
  }
  await exploreCatalog.click();
  await page.getByRole("heading", { name: "Scegli workshop", exact: true }).waitFor({ timeout: 10_000 });

  const disabledProceed = page.getByRole("button", { name: "Procedi", exact: true });
  if ((await disabledProceed.getAttribute("aria-disabled")) !== "true") {
    throw new Error("Il percorso vuoto deve impedire di procedere.");
  }
  await disabledProceed.click({ force: true });
  const hint = page.locator(".bottom-bar-hint.is-visible");
  await hint.waitFor({ timeout: 2_000 });
  if (!(await hint.textContent())?.includes("Aggiungi almeno un workshop")) {
    throw new Error("Tooltip mobile del percorso vuoto non visibile.");
  }

  const addWorkshop = page.locator('button[aria-label^="Aggiungi "][aria-label$=" al percorso"]').first();
  await addWorkshop.waitFor({ timeout: 10_000 });
  await addWorkshop.click();
  const nextPrimaryAction = page.locator(".bottom-action-bar .bottom-primary-action");
  await page.waitForFunction(() => {
    const action = document.querySelector(".bottom-action-bar .bottom-primary-action");
    return action && action.getAttribute("aria-disabled") !== "true";
  });
  if ((await nextPrimaryAction.getAttribute("aria-disabled")) === "true") {
    throw new Error("Il percorso resta bloccato dopo aver aggiunto un workshop.");
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`Overflow orizzontale mobile: ${overflow}px.`);
  if (browserErrors.length > 0) throw new Error(`Errori browser: ${browserErrors.join(" | ")}`);

  console.log(`PASS production client: headers, catalogo remoto, tooltip mobile, aggiunta workshop (${new URL(targetUrl).host})`);
} finally {
  await browser.close();
}
