import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";

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
    email: "rinaldi.rilio@gmail.com",
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

    await page.locator(".ff-stepper-card").waitFor({ timeout: 30000 });
    const stepper = await page.evaluate(() => {
      const active = document.querySelector(".ff-tab--active");
      const card = document.querySelector(".ff-stepper-card");
      const activeStyle = getComputedStyle(active);
      const cardStyle = getComputedStyle(card);
      const label = active.querySelector(".ff-tab-label");
      const activeRect = active.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return {
        activeHeight: Math.round(activeRect.height),
        activeBottom: Math.round(activeRect.bottom),
        cardTop: Math.round(cardRect.top),
        activeBorderBottom: activeStyle.borderBottomColor,
        cardBorderTopWidth: cardStyle.borderTopWidth,
        labelDisplay: getComputedStyle(label).display,
      };
    });

    if (stepper.activeHeight !== 42) throw new Error(`Mobile active tab height drifted: ${stepper.activeHeight}`);
    if (stepper.activeBottom !== stepper.cardTop) throw new Error(`Mobile tab/card seam drifted: ${JSON.stringify(stepper)}`);
    if (stepper.cardBorderTopWidth !== "0px") throw new Error(`Mobile card top border should be delegated to tabs: ${stepper.cardBorderTopWidth}`);
    if (stepper.labelDisplay !== "block") throw new Error("Active mobile step label must remain visible");

    console.log("PASS e2e: live Google Sheet lifecycle, real sheet auth session, mobile stepper seam");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
