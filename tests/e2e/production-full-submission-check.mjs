import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const TARGET_URL = String(process.env.TARGET_URL || "https://funnifin-workshop-planner.vercel.app").trim();
const GOOGLE_TIMEOUT_MS = 90_000;

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
      }),
  );
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local"), ...process.env };
const configuredRecipient = String(env.SMOKE_FUNNIFIN_EMAIL || env.INITIAL_FUNNIFIN_EMAIL || "").trim();
let recipient = "";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const company = `Smoke Sheet UI E2E ${suffix}`;
const requestPrefix = company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function postAppsScript(action, payload, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
    try {
      const response = await fetch(env.VITE_APPS_SCRIPT_DEPLOYMENT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, payload }),
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") || "";
      const body = await response.text();
      if (!response.ok || contentType.includes("text/html") || body.trim().startsWith("<!DOCTYPE")) {
        throw new Error(`${action} risposta transitoria HTTP ${response.status}`);
      }
      const result = JSON.parse(body);
      if (!result?.ok) throw new Error(result?.error || `${action} non riuscita`);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(attempt * 1_000);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function readAppsScript(action, params, sessionToken) {
  return postAppsScript("read", {
    readAction: action,
    params: { ...params, sessionToken },
    sessionToken,
  });
}

function cleanupSmokeArtifacts() {
  return postAppsScript("cleanupSmokeTestArtifacts", { setupSecret: env.ADMIN_SETUP_SECRET });
}

async function reachSubmissionStep(page) {
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: /Costruisci il piano formativo/ }).waitFor({ timeout: 30_000 });

  const explore = page.getByRole("button", { name: "Esplora catalogo", exact: true });
  if (await explore.count() === 0) {
    await page.getByRole("button", { name: "Vedi dettagli", exact: true }).nth(1).click();
  }
  await explore.click();
  await page.getByRole("heading", { name: "Scegli workshop", exact: true }).waitFor({ timeout: 10_000 });
  await page.locator('button[aria-label^="Aggiungi "][aria-label$=" al percorso"]').first().click();

  const personalize = page.getByRole("button", { name: "Personalizza percorso", exact: true });
  if (await personalize.count()) {
    await personalize.click();
    await page.getByRole("heading", { name: "Personalizzazione su misura", exact: true }).waitFor({ timeout: 10_000 });
  }
  await page.getByRole("button", { name: "Procedi", exact: true }).click();
  await page.getByRole("heading", { name: "Quando vuoi definire le date?", exact: true }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: /Le definirò in seguito/ }).click();
  await page.getByRole("button", { name: "Materiali opzionali", exact: true }).click();
  await page.getByRole("heading", { name: /Logo e note cliente facoltativi/ }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Salta e vai all'invio", exact: true }).click();
  await page.getByRole("heading", { name: "Invio richiesta", exact: true }).waitFor({ timeout: 10_000 });
}

async function submitFromBrowser(page) {
  await page.getByRole("textbox", { name: "Nome", exact: true }).fill("Smoke");
  await page.getByRole("textbox", { name: "Cognome", exact: true }).fill("Automatico");
  await page.getByRole("textbox", { name: "Email aziendale", exact: true }).fill(recipient);
  await page.getByRole("textbox", { name: "Azienda", exact: true }).fill(company);
  await page.getByRole("textbox", { name: "Telefono", exact: true }).fill("+39 0200000000");
  await page.locator('.privacy-consent input[type="checkbox"]').check();

  const submit = page.getByRole("button", { name: "Invia richiesta", exact: true });
  const successCard = page.locator(".request-success-card");
  let attempts = 0;
  while (attempts < 3 && await successCard.count() === 0) {
    attempts += 1;
    await submit.click();
    await Promise.race([
      successCard.waitFor({ timeout: 30_000 }).catch(() => null),
      page.waitForTimeout(30_000),
    ]);
  }
  await successCard.waitFor({ timeout: 5_000 });
  const successCopy = await successCard.innerText();
  if (!successCopy.includes("email inviata al cliente e a FunniFin")) {
    throw new Error(`La UI non conferma l'invio email: ${successCopy}`);
  }
  return attempts;
}

async function verifySheetAndEmailEvent(sessionToken) {
  let request;
  for (let attempt = 0; attempt < 4 && !request; attempt += 1) {
    if (attempt > 0) await wait(attempt * 2_000);
    const listed = await readAppsScript("listWorkshopRequests", {}, sessionToken);
    request = (listed.requests || []).find((item) => item.company === company || String(item.id || "").startsWith(requestPrefix));
  }
  if (!request) throw new Error("Richiesta inviata dalla UI non trovata sullo Sheet");

  const eventsResult = await readAppsScript("listRequestEvents", { requestId: request.id }, sessionToken);
  const emailEvents = (eventsResult.events || []).filter((event) => event.type === "request_email_sent");
  if (emailEvents.length !== 1) throw new Error(`Eventi email attesi=1, trovati=${emailEvents.length}`);
  if (Number(request.quote?.total || 0) <= 0) throw new Error("Prezzo autoritativo mancante sullo Sheet");
  if (!request.privacy?.accepted) throw new Error("Consenso privacy non persistito");
  return { request, emailEvents };
}

let browser;
let verificationSessionToken = "";
const browserErrors = [];
const observedActions = new Set();
try {
  const sessionResult = await postAppsScript("createSmokeTestSession", {
    setupSecret: env.ADMIN_SETUP_SECRET,
    email: configuredRecipient,
    durationMinutes: 15,
  });
  verificationSessionToken = String(sessionResult.session?.token || "");
  recipient = String(sessionResult.user?.email || "").trim();
  if (!verificationSessionToken || !recipient) throw new Error("Sessione o destinatario reale di verifica non disponibile");
  if (/@example\.(com|org|net)$/i.test(recipient)) throw new Error("Il destinatario di verifica non può essere un indirizzo example.*");

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  page.on("pageerror", (error) => browserErrors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console:${message.text()}`);
  });
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    try {
      const body = JSON.parse(request.postData() || "{}");
      if (body.action) observedActions.add(body.action);
    } catch {}
  });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await reachSubmissionStep(page);
  const submitAttempts = await submitFromBrowser(page);
  await page.screenshot({ path: resolve("outputs/production-mobile-client-submitted-email.png"), fullPage: true });
  const { request, emailEvents } = await verifySheetAndEmailEvent(verificationSessionToken);
  if (browserErrors.length) throw new Error(`Errori browser: ${browserErrors.join(" | ")}`);

  console.log(JSON.stringify({
    uiSubmitted: true,
    uiEmailConfirmed: true,
    submitAttempts,
    requestId: request.id,
    sheetRecordFound: true,
    authoritativeTotal: Number(request.quote.total),
    privacyPersisted: true,
    emailSentEvents: emailEvents.length,
    browserErrors: 0,
    observedActions: [...observedActions],
  }));
} finally {
  if (browser) await browser.close();
  const first = await cleanupSmokeArtifacts();
  const second = await cleanupSmokeArtifacts();
  const keys = ["deletedRequests", "deletedEvents", "deletedNotifications", "deletedClientUsers", "deletedSessions", "deletedAssetDraftFolders"];
  const cleanupApplied = Object.fromEntries(keys.map((key) => [key, Number(first[key] || 0)]));
  const residual = Object.fromEntries(keys.map((key) => [key, Number(second[key] || 0)]));
  if (Object.values(residual).some((count) => count !== 0)) throw new Error(`Residui smoke: ${JSON.stringify(residual)}`);
  console.log(JSON.stringify({ cleanupApplied, residual }));
}
