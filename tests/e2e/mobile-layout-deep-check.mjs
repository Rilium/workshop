import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 5187;
const BASE_URL = `http://127.0.0.1:${PORT}/`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function mobileMetrics(page, label) {
  return page.evaluate((label) => {
    const viewport = { width: innerWidth, height: innerHeight };
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return {
        left: Math.round(box.left),
        right: Math.round(box.right),
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        width: Math.round(box.width),
        height: Math.round(box.height),
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
      };
    };
    const overflow = Array.from(document.querySelectorAll("body *"))
      .map((el) => {
        const box = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          cls: String(el.className || ""),
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
          left: Math.round(box.left),
          right: Math.round(box.right),
        };
      })
      .filter((item) => !item.cls.includes("confetti-piece"))
      .filter((item) => item.left < -1 || item.right > viewport.width + 1)
      .slice(0, 8);

    return {
      label,
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      overflow,
      system: rect(".system-bar"),
      roleArea: rect(".system-role-area"),
      actions: rect(".system-actions"),
      bottom: rect(".bottom-action-bar"),
      activeTab: rect(".ff-tab--active"),
      toast: rect(".feedback-toast"),
      dialog: rect(".calendar-modal, .custom-modal"),
      modalFooter: rect(".modal-footer"),
      modalBody: rect(".modal-body"),
    };
  }, label);
}

function assertNoHorizontalOverflow(metrics) {
  assert(metrics.scrollWidth <= metrics.viewport.width, `${metrics.label}: document overflow ${metrics.scrollWidth}/${metrics.viewport.width}`);
  assert(metrics.overflow.length === 0, `${metrics.label}: elements overflow horizontally ${JSON.stringify(metrics.overflow)}`);
}

function assertWithinViewport(metrics, key) {
  const box = metrics[key];
  assert(box, `${metrics.label}: missing ${key}`);
  assert(box.left >= 0 && box.right <= metrics.viewport.width, `${metrics.label}: ${key} escapes x viewport ${JSON.stringify(box)}`);
  assert(box.top >= 0 && box.bottom <= metrics.viewport.height, `${metrics.label}: ${key} escapes y viewport ${JSON.stringify(box)}`);
}

function overlaps(a, b) {
  return a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.addInitScript(() => {
      Math.random = () => 0;
      const token = "mobile-layout";
      const session = {
        userId: "user-funnifin",
        token,
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
      window.sessionStorage.setItem(`funnifin_welcome_seen_${token}`, "1");
    });

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    const adminHome = await mobileMetrics(page, "admin-home");
    assertNoHorizontalOverflow(adminHome);
    assertWithinViewport(adminHome, "system");
    assertWithinViewport(adminHome, "bottom");
    assert(!overlaps(adminHome.roleArea, adminHome.actions), "admin-home: system role area overlaps action buttons");

    await page.getByText("Visualizza come: FunniFin", { exact: true }).click();
    await page.getByRole("button", { name: "Cliente", exact: true }).click();
    await page.waitForTimeout(500);

    const interests = await mobileMetrics(page, "client-interests");
    assertNoHorizontalOverflow(interests);
    assertWithinViewport(interests, "system");
    assertWithinViewport(interests, "bottom");
    assert(interests.bottom.height <= 130, `client-interests: compact bottom sheet too tall ${interests.bottom.height}`);

    await page.locator("button:visible").filter({ hasText: "Ambito personale" }).first().click();
    await page.getByRole("button", { name: /Vedi consigli/i }).click();
    await page.waitForTimeout(400);
    const recommended = await mobileMetrics(page, "client-recommended");
    assertNoHorizontalOverflow(recommended);
    assertWithinViewport(recommended, "activeTab");
    assert(recommended.bottom.height <= 180, `client-recommended: two-action bottom sheet too tall ${recommended.bottom.height}`);

    await page.getByRole("button", { name: /Aggiungi consigliati/i }).click();
    await page.waitForTimeout(500);
    const workshops = await mobileMetrics(page, "client-workshops");
    assertNoHorizontalOverflow(workshops);
    assertWithinViewport(workshops, "activeTab");
    assert(workshops.bottom.height <= 130, `client-workshops: bottom sheet should collapse without secondary action ${workshops.bottom.height}`);
    if (workshops.toast) {
      assert(workshops.toast.bottom <= workshops.bottom.top - 8, `client-workshops: toast overlaps bottom sheet ${JSON.stringify({ toast: workshops.toast, bottom: workshops.bottom })}`);
    }

    await page.getByLabel("Impostazioni sezione").click();
    await page.waitForTimeout(500);
    const clientSettings = await mobileMetrics(page, "client-settings");
    assertNoHorizontalOverflow(clientSettings);
    assert(clientSettings.activeTab.text.includes("Personalizza"), `client-settings: settings did not open configuration step ${JSON.stringify(clientSettings.activeTab)}`);

    const personalize = await mobileMetrics(page, "client-personalize");
    assertNoHorizontalOverflow(personalize);
    assertWithinViewport(personalize, "activeTab");
    assert(personalize.activeTab.text.includes("Personalizza"), `client-personalize: active tab not visible ${JSON.stringify(personalize.activeTab)}`);

    await page.getByRole("button", { name: /Scegli le date/i }).click();
    await page.waitForTimeout(700);
    const dates = await mobileMetrics(page, "client-dates");
    assertNoHorizontalOverflow(dates);
    assertWithinViewport(dates, "activeTab");
    assert(dates.activeTab.text.includes("Date"), `client-dates: active tab not visible ${JSON.stringify(dates.activeTab)}`);

    await page.getByRole("button", { name: /^Scegli$/ }).first().click();
    await page.getByRole("dialog").waitFor({ timeout: 5000 });
    await page.waitForTimeout(300);
    const calendar = await mobileMetrics(page, "calendar-modal");
    assertNoHorizontalOverflow(calendar);
    assertWithinViewport(calendar, "dialog");
    assert(calendar.modalFooter.left >= calendar.dialog.left && calendar.modalFooter.right <= calendar.dialog.right, `calendar-modal: footer escapes modal ${JSON.stringify(calendar)}`);
    assert(calendar.modalBody.left >= calendar.dialog.left && calendar.modalBody.right <= calendar.dialog.right, `calendar-modal: body escapes modal ${JSON.stringify(calendar)}`);
    assert(!errors.some((error) => /same key|duplicate|hydration|uncaught/i.test(error)), `Mobile layout console/page errors: ${errors.join(" | ")}`);

    await page.getByLabel("Chiudi calendario").click();
    await page.getByText("Visualizza come: Cliente", { exact: true }).click();
    await page.getByRole("button", { name: "FunniFin", exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Apri Google backend").click();
    await page.getByRole("heading", { name: "Google backend", exact: true }).waitFor({ timeout: 5000 });
    const googleSettings = await mobileMetrics(page, "admin-settings");
    assertNoHorizontalOverflow(googleSettings);
    assertWithinViewport(googleSettings, "system");

    console.log("PASS mobile layout deep check: system bar, stepper, bottom sheet, toast, calendar modal");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
