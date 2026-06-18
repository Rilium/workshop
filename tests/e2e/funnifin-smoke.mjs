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
    });
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    await page.getByLabel("Accedi all'area riservata").click();
    await page.getByLabel("Email").fill("rinaldi.rilio@gmail.com");
    await page.getByRole("button", { name: /continua/i }).click();
    await page.getByRole("button", { name: /non hai il codice/i }).click();
    await page.getByLabel("Codice di accesso").fill("100000");
    await page.getByRole("button", { name: /^Accedi$/ }).click();
    await page.getByLabel(/Esci \(Team FunniFin\)/).waitFor({ timeout: 5000 });
    await page.getByLabel("Chiudi benvenuto").click().catch(() => {});
    await page.getByText("Visualizza come: FunniFin").click();
    await page.getByRole("button", { name: /^Cliente$/ }).click();

    await page.locator(".ff-stepper-card").waitFor({ timeout: 5000 });
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

    await page.getByLabel(/Esci \(Team FunniFin\)/).click();
    await page.getByLabel("Accedi all'area riservata").click();
    await page.getByLabel("Email").fill("rinaldi.rilio@gmail.com");
    await page.getByRole("button", { name: /continua/i }).click();
    await page.getByLabel("Codice di accesso").fill("100000");
    await page.getByRole("button", { name: /^Accedi$/ }).click();
    await page.getByLabel(/Esci \(Team FunniFin\)/).waitFor({ timeout: 5000 });

    console.log("PASS e2e: reusable auth code and mobile stepper seam");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
