import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";
import { localUser } from "./localTestSettings.mjs";

const PORT = 5177;
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const GOOGLE_TIMEOUT_MS = 90_000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function loadGoogleEnv() {
  const env = {
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.local"),
    ...process.env,
  };
  if (!env.VITE_APPS_SCRIPT_DEPLOYMENT_URL) {
    throw new Error("Smoke live richiede VITE_APPS_SCRIPT_DEPLOYMENT_URL configurato.");
  }
  if (!env.ADMIN_SETUP_SECRET) {
    throw new Error("Smoke live richiede ADMIN_SETUP_SECRET configurato.");
  }
  return env;
}

async function postAppsScript(env, action, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
  try {
    const response = await fetch(env.VITE_APPS_SCRIPT_DEPLOYMENT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${action} HTTP ${response.status}`);
    const result = await response.json();
    if (!result || result.ok === false) throw new Error(result?.error || `${action} risposta non valida`);
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function assertLiveSheet(env) {
  const lifecycle = await postAppsScript(env, "smokeTestSheetLifecycle", {
    setupSecret: env.ADMIN_SETUP_SECRET,
  });
  for (const key of ["created", "listed", "updated", "deleted"]) {
    if (lifecycle[key] !== true) {
      throw new Error(`Smoke Sheet lifecycle incompleto: ${key}=${lifecycle[key]} (${lifecycle.requestId || "no id"})`);
    }
  }
  if (Number(lifecycle.deletedEvents || 0) < 1) {
    throw new Error(`Smoke Sheet cleanup eventi incompleto: deletedEvents=${lifecycle.deletedEvents}`);
  }

  const sessionResult = await postAppsScript(env, "createSmokeTestSession", {
    setupSecret: env.ADMIN_SETUP_SECRET,
    email: env.SMOKE_FUNNIFIN_EMAIL || env.INITIAL_FUNNIFIN_EMAIL || "",
    durationMinutes: 30,
  });
  if (!sessionResult.session?.token || sessionResult.source !== "google-sheet") {
    throw new Error("Smoke auth session non creata sullo Sheet.");
  }
  return sessionResult.session;
}

async function waitForServer(process) {
  const started = Date.now();
  while (Date.now() - started < 60000) {
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
  const googleEnv = loadGoogleEnv();
  const liveSession = await assertLiveSheet(googleEnv);

  const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(PORT)], {
    env: {
      ...process.env,
      ...googleEnv,
      VITE_ALLOW_LOCAL_FALLBACKS: "false",
      VITE_STRICT_GOOGLE_BACKEND: "true",
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
      window.sessionStorage.setItem(`funnifin_welcome_seen_${session.token}`, "1");
    }, liveSession);
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByLabel(/Esci \(.+\)/).waitFor({ timeout: 30000 });
    await page.getByLabel("Chiudi benvenuto").click().catch(() => {});
    await page.getByText("Visualizza come: FunniFin").click();
    await page.getByRole("button", { name: /^Cliente$/ }).click();

    await page.getByRole("heading", { name: /Costruisci il piano formativo/ }).waitFor({ timeout: 30000 });
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

    console.log("PASS e2e: live Google Sheet lifecycle, real sheet auth session, guided survey back/forward");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
