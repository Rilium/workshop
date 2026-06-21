import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 5187;
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

function makeUser(id, email, actualRole, displayName, extra = {}) {
  return {
    id,
    email,
    actualRole,
    displayName,
    createdAt: "2024-01-01T00:00:00",
    disabled: false,
    ...extra,
  };
}

function makeSession(user, effectiveRole = user.actualRole) {
  return {
    userId: user.id,
    token: `deep-${user.id}-${effectiveRole}`,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    effectiveRole,
    user,
  };
}

const users = {
  funnifin: makeUser("user-funnifin", "rinaldi.rilio@gmail.com", "FunniFin", "Team FunniFin"),
  funnifin2: makeUser("user-funnifin-2", "ops2@example.com", "FunniFin", "Ops Due"),
  brand: makeUser("user-brand", "rinaldi.rilio+4@gmail.com", "Brand", "Brand Review"),
  brand2: makeUser("user-brand-2", "brand2@example.com", "Brand", "Brand Due"),
  expert: makeUser("user-esperto-laura", "rinaldi.rilio+3@gmail.com", "Esperto", "Laura Bianchi", { expertId: "laura-bianchi" }),
  expert2: makeUser("user-esperto-altro", "expert2@example.com", "Esperto", "Esperto Due", { expertId: "altro" }),
};

function notification(id, title, body, audience, options = {}) {
  return {
    id,
    title,
    body,
    createdAt: new Date(Date.now() - (options.ageMs ?? 0)).toISOString(),
    updatedAt: new Date(Date.now() - (options.ageMs ?? 0)).toISOString(),
    sourceRole: options.sourceRole ?? "FunniFin",
    audience,
    audienceUserIds: options.audienceUserIds,
    audienceEmails: options.audienceEmails,
    priority: options.priority ?? "task",
    category: options.category ?? "mail",
    status: options.status ?? "open",
    readBy: options.readBy ?? [],
    readByUserIds: options.readByUserIds ?? [],
    action: options.action,
  };
}

const notifications = [
  notification(
    "n-funnifin-outbox-brand",
    "Presentazione assegnata al Brand",
    "Hai assegnato a Brand la revisione materiali per Banca Alfa.",
    ["FunniFin"],
    { audienceUserIds: [users.funnifin.id], action: { label: "Apri progetto", role: "FunniFin", hash: "#funnifin" } },
  ),
  notification(
    "n-funnifin-other-user",
    "Notifica privata altro FunniFin",
    "Non deve comparire al primo operatore.",
    ["FunniFin"],
    { audienceUserIds: [users.funnifin2.id] },
  ),
  notification(
    "n-funnifin-generic-critical",
    "Email non inviata",
    "Verifica Google backend.",
    ["FunniFin"],
    { priority: "critical", category: "mail", action: { label: "Verifica Google", role: "FunniFin", hash: "#funnifin" } },
  ),
  notification(
    "n-brand-specific",
    "FunniFin ti ha assegnato una presentazione",
    "Banca Alfa: controlla deck, note e abilitazione finale per Calendar.",
    ["Brand"],
    { audienceUserIds: [users.brand.id], action: { label: "Apri revisione", role: "Brand", hash: "#brand" } },
  ),
  notification(
    "n-brand-generic",
    "Esperto ti ha inviato una presentazione",
    "Laura Bianchi ha inviato Educazione finanziaria.pptx: apri la revisione Brand.",
    ["Brand"],
    { sourceRole: "Esperto", action: { label: "Apri revisione", role: "Brand", hash: "#brand" } },
  ),
  notification(
    "n-expert-specific",
    "FunniFin ti ha assegnato un workshop",
    "Banca Alfa: trovi incarico, date e materiali nella tua area esperto.",
    ["Esperto"],
    { audienceUserIds: [users.expert.id], action: { label: "Vai all'incarico", role: "Esperto", hash: "#esperto-candidature" } },
  ),
  notification(
    "n-expert-generic",
    "FunniFin ha aperto una candidatura",
    "Banca Alfa: valuta i workshop disponibili e candidati se sei compatibile.",
    ["Esperto"],
    { action: { label: "Vai alle candidature", role: "Esperto", hash: "#esperto-candidature" } },
  ),
  notification(
    "n-brand-to-funnifin",
    "Brand ha approvato il deck",
    "Banca Alfa: stato salvato sul registro.",
    ["FunniFin"],
    { sourceRole: "Brand", action: { label: "Vai alla conferma", role: "FunniFin", hash: "#funnifin" } },
  ),
  notification(
    "n-action-switch-brand",
    "Apri vista Brand da FunniFin",
    "Controllo azione rapida cross-role.",
    ["FunniFin"],
    { audienceUserIds: [users.funnifin.id], action: { label: "Apri Brand", role: "Brand", hash: "#brand" } },
  ),
  notification(
    "n-closed",
    "Notifica archiviata",
    "Deve stare nella tab chiuse.",
    ["FunniFin"],
    { audienceUserIds: [users.funnifin.id], status: "closed" },
  ),
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openWithSession(browser, user, effectiveRole = user.actualRole, seedNotifications = notifications, viewport = { width: 1280, height: 820 }) {
  const page = await browser.newPage({ viewport });
  const session = makeSession(user, effectiveRole);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.addInitScript(({ session, seedNotifications }) => {
    window.localStorage.setItem("funnifin_auth_session", JSON.stringify(session));
    window.localStorage.setItem("funnifin_notifications_v1", JSON.stringify(seedNotifications));
    window.sessionStorage.setItem(`funnifin_welcome_seen_${session.token}`, "1");
  }, { session, seedNotifications });
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  return { page, errors };
}

async function visibleTitles(page) {
  const bellCount = await page.locator(".nc-bell").count();
  if (!bellCount) return [];
  await page.locator(".nc-bell").click();
  await page.locator(".nc-panel").waitFor({ timeout: 5000 });
  return page.locator(".nc-item-title").allTextContents();
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

    {
      const { page, errors } = await openWithSession(browser, users.funnifin, "FunniFin", [], { width: 390, height: 844 });
      await page.getByRole("button", { name: "Visualizza come" }).waitFor({ timeout: 5000 });
      for (const role of ["Brand", "FunniFin", "Esperto", "FunniFin", "Cliente"]) {
        await page.getByRole("button", { name: "Visualizza come" }).click();
        await page.locator(".role-switch").getByRole("button", { name: role, exact: true }).click();
        if (role === "Cliente") {
          await page.getByRole("heading", { name: "Come vuoi costruire il tuo percorso?" }).waitFor({ timeout: 8000 });
        } else {
          await page.getByRole("button", { name: "Visualizza come" }).filter({ hasText: role }).waitFor({ timeout: 5000 });
        }
        const state = await page.evaluate(() => ({
          role: document.querySelector(".role-menu-trigger")?.textContent?.replace("Visualizza come:", "").trim() || "",
          hasClientEntry: document.body.innerText.includes("Come vuoi costruire il tuo percorso?"),
          blank: document.body.innerText.trim().length < 20,
          hasBell: Boolean(document.querySelector(".nc-bell")),
        }));
        assert(role === "Cliente" ? state.hasClientEntry : state.role === role, `Role switch failed: expected ${role}, got ${state.role || "client-entry-missing"}`);
        assert(!state.blank, `Role switch blank page on ${role}`);
        assert(role === "Cliente" ? !state.hasBell : state.hasBell, `Bell visibility wrong for ${role}`);
      }
      assert(errors.length === 0, `Role switch console errors: ${errors.join(" | ")}`);
      await page.close();
    }

    const cases = [
      {
        label: "FunniFin primary",
        user: users.funnifin,
        role: "FunniFin",
        expected: ["Presentazione assegnata al Brand", "Email non inviata", "Brand ha approvato il deck", "Apri vista Brand da FunniFin"],
        forbidden: ["Notifica privata altro FunniFin", "FunniFin ti ha assegnato una presentazione", "FunniFin ti ha assegnato un workshop"],
      },
      {
        label: "FunniFin second user",
        user: users.funnifin2,
        role: "FunniFin",
        expected: ["Notifica privata altro FunniFin", "Email non inviata", "Brand ha approvato il deck"],
        forbidden: ["Presentazione assegnata al Brand", "Apri vista Brand da FunniFin"],
      },
      {
        label: "Brand primary",
        user: users.brand,
        role: "Brand",
        expected: ["FunniFin ti ha assegnato una presentazione", "Esperto ti ha inviato una presentazione"],
        forbidden: ["FunniFin ti ha assegnato un workshop", "Presentazione assegnata al Brand"],
      },
      {
        label: "Brand second user",
        user: users.brand2,
        role: "Brand",
        expected: ["Esperto ti ha inviato una presentazione"],
        forbidden: ["FunniFin ti ha assegnato una presentazione"],
      },
      {
        label: "Expert primary",
        user: users.expert,
        role: "Esperto",
        expected: ["FunniFin ti ha assegnato un workshop", "FunniFin ha aperto una candidatura"],
        forbidden: ["FunniFin ti ha assegnato una presentazione", "Presentazione assegnata al Brand"],
      },
      {
        label: "Expert second user",
        user: users.expert2,
        role: "Esperto",
        expected: ["FunniFin ha aperto una candidatura"],
        forbidden: ["FunniFin ti ha assegnato un workshop"],
      },
      {
        label: "Client impersonation",
        user: users.funnifin,
        role: "Cliente",
        expected: [],
        forbidden: ["Presentazione assegnata al Brand", "Email non inviata"],
      },
    ];

    for (const item of cases) {
      const { page, errors } = await openWithSession(browser, item.user, item.role);
      const titles = await visibleTitles(page);
      for (const title of item.expected) assert(titles.includes(title), `${item.label}: missing "${title}". Got ${JSON.stringify(titles)}`);
      for (const title of item.forbidden) assert(!titles.includes(title), `${item.label}: should not show "${title}". Got ${JSON.stringify(titles)}`);
      assert(errors.length === 0, `${item.label}: console errors ${errors.join(" | ")}`);
      await page.close();
    }

    {
      const { page } = await openWithSession(browser, users.funnifin, "FunniFin");
      await page.locator(".nc-bell").click();
      await page.locator(".nc-tab", { hasText: "Chiuse" }).click();
      await page.getByText("Notifica archiviata").waitFor({ timeout: 5000 });
      await page.locator(".nc-item", { hasText: "Notifica archiviata" }).getByRole("button", { name: "Elimina" }).click();
      await page.getByText("Notifica archiviata").waitFor({ state: "detached", timeout: 5000 });
      await page.waitForFunction(() => {
        const stored = JSON.parse(window.localStorage.getItem("funnifin_notifications_v1") || "[]");
        return !stored.some((item) => item.id === "n-closed");
      }, null, { timeout: 3000 });
      await page.locator(".nc-tab", { hasText: "Da fare" }).click();
      await page.getByText("Apri vista Brand da FunniFin").waitFor({ timeout: 5000 });
      await page.getByRole("button", { name: "Apri Brand" }).click();
      await page.getByRole("button", { name: "Visualizza come" }).filter({ hasText: "Brand" }).waitFor({ timeout: 5000 });
      const role = await page.evaluate(() => document.querySelector(".role-menu-trigger")?.textContent?.replace("Visualizza come:", "").trim() || "");
      assert(role === "Brand", `Action quick switch failed, got ${role}`);
      await page.close();
    }

    {
      const { page } = await openWithSession(browser, users.funnifin, "FunniFin");
      await page.locator(".nc-bell").click();
      await page.locator(".nc-panel").waitFor({ timeout: 5000 });
      await page.waitForFunction(() => {
        const stored = JSON.parse(window.localStorage.getItem("funnifin_notifications_v1") || "[]");
        return stored.some((item) => item.id === "n-funnifin-outbox-brand" && item.readByUserIds?.includes("user-funnifin"));
      }, null, { timeout: 3000 });
      const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem("funnifin_notifications_v1") || "[]"));
      const visibleIds = ["n-funnifin-outbox-brand", "n-funnifin-generic-critical", "n-brand-to-funnifin", "n-action-switch-brand"];
      for (const id of visibleIds) {
        const n = stored.find((item) => item.id === id);
        assert(n?.readByUserIds?.includes("user-funnifin"), `Visible notification ${id} was not marked read for current user`);
      }
      const hidden = stored.find((item) => item.id === "n-funnifin-other-user");
      assert(!hidden?.readByUserIds?.includes("user-funnifin"), "Hidden user-specific notification was marked read by wrong user");
      await page.close();
    }

    console.log("PASS deep notifications: role switch, user filtering, archive tab, action routing, read tracking");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
