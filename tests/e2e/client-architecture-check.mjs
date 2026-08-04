import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { localSession } from "./localTestSettings.mjs";

const HUNG_BACKEND_PORT = 5195;
const STRICT_APP_PORT = 5196;
const DRAFT_APP_PORT = 5197;
const SESSION_APP_PORT = 5198;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer(process, url) {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    if (process.exitCode !== null) throw new Error(`Vite exited before becoming ready: ${url}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await wait(200);
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startVite(port, env) {
  return spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function stopProcess(process) {
  if (process.exitCode !== null) return;
  process.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => process.once("exit", resolve)),
    wait(2_000),
  ]);
  if (process.exitCode === null) process.kill("SIGKILL");
}

async function verifyCatalogFailsClosed(browser) {
  const hungBackend = createServer(() => {
    // Intenzionalmente nessuna risposta: verifica il deadline AbortController.
  });
  await new Promise((resolve) => hungBackend.listen(HUNG_BACKEND_PORT, "127.0.0.1", resolve));
  const app = startVite(STRICT_APP_PORT, {
    VITE_APPS_SCRIPT_DEPLOYMENT_URL: `http://127.0.0.1:${HUNG_BACKEND_PORT}/exec`,
    VITE_APPS_SCRIPT_TIMEOUT_MS: "500",
    VITE_ALLOW_LOCAL_FALLBACKS: "false",
    VITE_STRICT_GOOGLE_BACKEND: "true",
    VITE_CLIENT_TELEMETRY: "false",
  });
  try {
    const url = `http://127.0.0.1:${STRICT_APP_PORT}/`;
    await waitForServer(app, url);
    const page = await browser.newPage();
    const started = Date.now();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    try {
      await page.getByRole("heading", { name: "Catalogo temporaneamente non disponibile" }).waitFor({ timeout: 5_000 });
    } catch (error) {
      console.error("Strict catalog page state:", (await page.locator("body").innerText()).slice(0, 2_000));
      throw error;
    }
    const elapsed = Date.now() - started;
    assert(elapsed < 4_000, `Il catalogo bloccato non ha rispettato il timeout: ${elapsed} ms`);
    assert(await page.getByRole("heading", { name: /Costruisci il piano formativo/ }).count() === 0, "Il preventivo non deve essere accessibile durante l'errore catalogo");
    assert(await page.getByRole("button", { name: "Riprova" }).count() === 1, "Manca l'azione esplicita di retry catalogo");
    await page.close();
  } finally {
    await stopProcess(app);
    hungBackend.closeAllConnections?.();
    await new Promise((resolve) => hungBackend.close(resolve));
  }
}

async function verifyDraftSurvivesRefresh(browser) {
  const app = startVite(DRAFT_APP_PORT, {
    VITE_APPS_SCRIPT_DEPLOYMENT_URL: "",
    VITE_ALLOW_LOCAL_FALLBACKS: "true",
    VITE_STRICT_GOOGLE_BACKEND: "false",
    VITE_CLIENT_TELEMETRY: "false",
  });
  try {
    const url = `http://127.0.0.1:${DRAFT_APP_PORT}/`;
    await waitForServer(app, url);
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await page.addInitScript((session) => {
      window.localStorage.setItem("funnifin_auth_session", JSON.stringify(session));
      window.sessionStorage.setItem(`funnifin_welcome_seen_${session.token}`, "1");
    }, localSession("funnifin", { token: "architecture-draft", effectiveRole: "Cliente" }));
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /Costruisci il piano formativo/ }).waitFor({ timeout: 8_000 });
    const exploreCatalog = page.getByRole("button", { name: "Esplora catalogo", exact: true });
    if (await exploreCatalog.count() === 0) await page.getByRole("button", { name: "Vedi dettagli", exact: true }).nth(1).click();
    await exploreCatalog.click();
    await page.getByRole("heading", { name: "Scegli workshop", exact: true }).waitFor({ timeout: 5_000 });
    await page.getByRole("button", { name: "Aggiungi Come leggere una busta paga al percorso", exact: true }).click();
    await page.waitForFunction(() => {
      const raw = window.sessionStorage.getItem("funnifin_client_draft_v1");
      if (!raw) return false;
      const draft = JSON.parse(raw);
      return draft.flow?.clientStep === "Workshop" && draft.selections?.length === 1;
    });
    const before = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem("funnifin_client_draft_v1") || "{}"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Scegli workshop", exact: true }).waitFor({ timeout: 8_000 });
    const after = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem("funnifin_client_draft_v1") || "{}"));
    assert(after.version === 1, "Il draft ripristinato deve essere versionato");
    assert(after.selections?.[0]?.workshopId === before.selections?.[0]?.workshopId, "La selezione workshop non è sopravvissuta al refresh");
    assert(after.flow?.clientStep === "Workshop", "Lo step del wizard non è sopravvissuto al refresh");
    assert((await page.getByRole("button", { name: "Rimuovi Come leggere una busta paga", exact: true }).count()) > 0, "La selezione ripristinata non è visibile nella UI");
    await page.close();
  } finally {
    await stopProcess(app);
  }
}

async function verifyTransientAuthFailureKeepsTokenWithoutGrantingAccess(browser) {
  const hungBackend = createServer(() => {
    // La sessione non può essere rivalidata, ma non è stata rifiutata.
  });
  await new Promise((resolve) => hungBackend.listen(HUNG_BACKEND_PORT, "127.0.0.1", resolve));
  const app = startVite(SESSION_APP_PORT, {
    VITE_APPS_SCRIPT_DEPLOYMENT_URL: `http://127.0.0.1:${HUNG_BACKEND_PORT}/exec`,
    VITE_APPS_SCRIPT_TIMEOUT_MS: "500",
    VITE_ALLOW_LOCAL_FALLBACKS: "true",
    VITE_STRICT_GOOGLE_BACKEND: "false",
    VITE_CLIENT_TELEMETRY: "false",
  });
  try {
    const url = `http://127.0.0.1:${SESSION_APP_PORT}/`;
    await waitForServer(app, url);
    const page = await browser.newPage();
    const storedSession = localSession("funnifin", { token: "architecture-transient-auth" });
    await page.addInitScript((session) => {
      window.localStorage.setItem("funnifin_auth_session", JSON.stringify(session));
    }, storedSession);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await wait(1_200);
    const token = await page.evaluate(() => JSON.parse(window.localStorage.getItem("funnifin_auth_session") || "null")?.token);
    assert(token === storedSession.token, "Un timeout transitorio non deve eliminare il token di sessione");
    assert(await page.getByLabel(/Esci \(.+\)/).count() === 0, "Lo snapshot locale non deve concedere accesso senza rivalidazione server");
    await page.close();
  } finally {
    await stopProcess(app);
    hungBackend.closeAllConnections?.();
    await new Promise((resolve) => hungBackend.close(resolve));
  }
}

const browser = await chromium.launch({ headless: true });
try {
  await verifyCatalogFailsClosed(browser);
  await verifyDraftSurvivesRefresh(browser);
  await verifyTransientAuthFailureKeepsTokenWithoutGrantingAccess(browser);
  console.log("PASS client architecture: catalog fail-closed, draft versionato, auth transitoria senza logout o accesso locale");
} finally {
  await browser.close();
}
