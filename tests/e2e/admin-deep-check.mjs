import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const PORT = 5191;
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const TIMEOUT = 60_000;
const OUTPUT_DIR = "outputs/admin-real-test";

function trace(message) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const line = `${new Date().toISOString()} ${message}\n`;
  appendFileSync(`${OUTPUT_DIR}/progress.log`, line);
  console.log(message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function loadEnv() {
  const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local"), ...process.env };
  assert(env.VITE_APPS_SCRIPT_DEPLOYMENT_URL, "VITE_APPS_SCRIPT_DEPLOYMENT_URL mancante");
  assert(env.ADMIN_SETUP_SECRET, "ADMIN_SETUP_SECRET mancante");
  return env;
}

async function post(env, action, payload, { retryTransient = false } = {}) {
  const delays = retryTransient ? [0, 1_000, 2_000, 4_000, 8_000] : [0];
  let lastError;
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(env.VITE_APPS_SCRIPT_DEPLOYMENT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, payload }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok !== false) return result;
      lastError = new Error(`${action}: ${result.error || response.status}`);
      if (!retryTransient || response.status !== 404) throw lastError;
    } catch (error) {
      lastError = error;
      if (!retryTransient || attempt === delays.length - 1) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function get(env, action, session, params = {}) {
  let lastError;
  const retryDelays = [0, 1_000, 2_000, 4_000, 8_000];
  for (let attempt = 1; attempt <= retryDelays.length; attempt += 1) {
    if (retryDelays[attempt - 1]) await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt - 1]));
    const url = new URL(env.VITE_APPS_SCRIPT_DEPLOYMENT_URL);
    url.searchParams.set("action", action);
    url.searchParams.set("sessionToken", session.token);
    url.searchParams.set("sessionRole", session.user.actualRole);
    url.searchParams.set("_testRead", `${Date.now()}-${attempt}-${Math.random().toString(36).slice(2)}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      assert(response.ok && result.ok !== false, `${action}: ${result.error || response.status}`);
      return result;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function waitForServer(server) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT) {
    if (server.exitCode !== null) throw new Error("Vite terminato prima dell’avvio");
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      // server non ancora pronto
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timeout avvio Vite");
}

async function backendAudit(env, session) {
  // Apps Script serializza spesso gli accessi allo stesso foglio: il pre-check non deve
  // creare una contesa artificiale che l'interfaccia admin non genera in questa forma.
  const topicResult = await get(env, "listCatalogConfig", session);
  const workshopResult = await get(env, "listCatalogWorkshops", session);
  const pricingResult = await get(env, "listPricingRules", session);
  const expertResult = await get(env, "listExperts", session);
  const settingsResult = await get(env, "listWorkspaceSettings", session);
  const authUserResult = await get(env, "listAuthUsers", session);
  const accessRequestResult = await get(env, "listAccessRequests", session);
  const workshopRequestResult = await get(env, "listWorkshopRequests", session);
  const topics = topicResult.topics || [];
  const workshops = workshopResult.workshops || [];
  const rules = pricingResult.rules || [];
  const experts = expertResult.experts || [];
  const settings = settingsResult.settings || [];
  const authUsers = authUserResult.users || [];
  const accessRequests = accessRequestResult.requests || [];
  const workshopRequests = workshopRequestResult.requests || [];
  const topicIds = new Set(topics.map((topic) => topic.id));
  const workshopIds = new Set(workshops.map((workshop) => workshop.id));
  const settingMap = new Map(settings.map((setting) => [setting.key, setting]));
  const bundles = JSON.parse(settingMap.get("catalog.bundlesJson")?.value || "[]");

  assert(topics.length === 11, `topic attesi 11, trovati ${topics.length}`);
  assert(workshops.length === 46, `workshop attesi 46, trovati ${workshops.length}`);
  assert(workshops.filter((workshop) => workshop.productionStatus === "published").length === 23, "stati pubblicati non coerenti");
  assert(workshops.filter((workshop) => workshop.productionStatus === "draft").length === 23, "stati da produrre non coerenti");
  assert(rules.length === 1 && rules[0].id === "a-la-carte" && Number(rules[0].discountPercent) === 0, "regole quantità legacy ancora presenti");
  assert(bundles.length === 9, `pacchetti attesi 9, trovati ${bundles.length}`);
  assert(
    workshops.every((workshop) => (workshop.topicIds?.length ? workshop.topicIds : [workshop.topicId]).every((id) => topicIds.has(id))),
    "workshop con topic inesistente",
  );
  assert(
    bundles.every((bundle) => bundle.workshopIds.length === bundle.size && bundle.workshopIds.every((id) => workshopIds.has(id))),
    "pacchetto con composizione o workshop non validi",
  );
  const family = bundles.find((bundle) => bundle.id === "bundle-famiglia");
  const house = bundles.find((bundle) => bundle.id === "bundle-casa");
  assert(JSON.stringify(family?.workshopIds) !== JSON.stringify(house?.workshopIds), "Famiglia e Casa sono ancora duplicati");
  assert(workshops.some((workshop) => workshop.title === "Le assicurazioni essenziali: quali servono davvero"), "workshop assicurazioni mancante");
  assert(Number(settingMap.get("pricing.workshopBasePrice")?.value) === 1000, "prezzo workshop errato");
  assert(Number(settingMap.get("pricing.inPersonExtra")?.value) === 500, "extra presenza errato");
  assert(Number(settingMap.get("pricing.customExtra")?.value) === 500, "extra personalizzazione errato");
  assert(Number(settingMap.get("pricing.recordingOptOutDiscount")?.value) === 100, "riduzione registrazione errata");
  assert(authUsers.length > 0, "nessun utente autorizzato restituito dallo Sheet");

  return { topics, workshops, rules, experts, settings, bundles, settingMap, authUsers, accessRequests, workshopRequests };
}

async function mutationLifecycle(env, session, baseline) {
  const marker = `admin-deep-${Date.now()}`;
  const sessionPayload = { sessionToken: session.token };
  const topic = baseline.topics.find((item) => item.id === "retribuzione");
  const workshop = baseline.workshops.find((item) => item.id === "ws-le-assicurazioni-essenziali-quali-servono-davvero");
  const rule = baseline.rules.find((item) => item.id === "a-la-carte");
  const expert = baseline.experts[0];
  const priceSetting = baseline.settingMap.get("pricing.workshopBasePrice");
  const bundleSetting = baseline.settingMap.get("catalog.bundlesJson");
  const mutatedBundles = baseline.bundles.map((bundle) =>
    bundle.id === "bundle-casa" ? { ...bundle, description: marker } : bundle,
  );

  assert(topic && workshop && rule && expert && priceSetting && bundleSetting, "baseline CRUD incompleta");

  try {
    await post(env, "updateCatalogTopic", { ...topic, description: marker, ...sessionPayload });
    assert((await get(env, "listCatalogConfig", session)).topics.some((item) => item.id === topic.id && item.description === marker), "persistenza topic fallita");

    await post(env, "updateCatalogWorkshop", { ...workshop, adminNotes: marker, ...sessionPayload });
    assert((await get(env, "listCatalogWorkshops", session)).workshops.some((item) => item.id === workshop.id && item.adminNotes === marker), "persistenza workshop fallita");

    await post(env, "updatePricingRule", { ...rule, name: marker, ...sessionPayload });
    assert((await get(env, "listPricingRules", session)).rules.some((item) => item.id === rule.id && item.name === marker), "persistenza regola prezzo fallita");

    await post(env, "updateWorkspaceSetting", { ...priceSetting, value: "1100", ...sessionPayload });
    assert((await get(env, "listWorkspaceSettings", session)).settings.some((item) => item.key === priceSetting.key && item.value === "1100"), "persistenza prezzo centralizzato fallita");

    await post(env, "updateWorkspaceSetting", { ...bundleSetting, value: JSON.stringify(mutatedBundles), ...sessionPayload });
    const liveBundles = JSON.parse(
      (await get(env, "listWorkspaceSettings", session)).settings.find((item) => item.key === bundleSetting.key)?.value || "[]",
    );
    assert(liveBundles.find((bundle) => bundle.id === "bundle-casa")?.description === marker, "persistenza pacchetto fallita");

    await post(env, "updateExpert", { ...expert, availability: marker, ...sessionPayload });
    assert((await get(env, "listExperts", session)).experts.some((item) => item.id === expert.id && item.availability === marker), "persistenza esperto fallita");
  } finally {
    await post(env, "updateCatalogTopic", { ...topic, ...sessionPayload });
    await post(env, "updateCatalogWorkshop", { ...workshop, ...sessionPayload });
    await post(env, "updatePricingRule", { ...rule, ...sessionPayload });
    await post(env, "updateWorkspaceSetting", { ...priceSetting, ...sessionPayload });
    await post(env, "updateWorkspaceSetting", { ...bundleSetting, ...sessionPayload });
    await post(env, "updateExpert", { ...expert, ...sessionPayload });
    await post(env, "clearBackendCaches", sessionPayload);
  }
}

async function clickAdminSection(page, title) {
  const button = page.locator(".admin-section-nav button").filter({ hasText: title });
  assert((await button.count()) === 1, `sezione admin non univoca: ${title}`);
  await button.click({ timeout: 10_000 });
  await page.locator(".admin-section-summary strong").filter({ hasText: title }).waitFor({ timeout: 15_000 });
}

async function closeToasts(page) {
  const buttons = page.getByRole("button", { name: "Chiudi notifica", exact: true });
  while ((await buttons.count()) > 0) {
    const closed = await buttons.first().click().then(() => true).catch(() => false);
    if (!closed) break;
  }
}

async function saveModalAndRequireSuccess(page, { buttonName, headingName, successText }) {
  await page.getByRole("button", { name: buttonName }).click();
  const outcome = await Promise.race([
    page.getByRole("heading", { name: headingName, exact: true }).waitFor({ state: "detached", timeout: TIMEOUT }).then(() => "closed"),
    page.getByText(successText, { exact: true }).waitFor({ timeout: TIMEOUT }).then(() => "success"),
    page.locator(".feedback-toast").filter({ hasText: /non salvato|errore|non disponibile/i }).first().waitFor({ timeout: TIMEOUT }).then(async (toast) => {
      throw new Error(`salvataggio UI fallito: ${await toast.innerText()}`);
    }),
  ]);
  if (outcome === "success") {
    await page.getByRole("heading", { name: headingName, exact: true }).waitFor({ state: "detached", timeout: TIMEOUT });
  }
}

async function uiAudit(env, session, baseline) {
  trace("UI: avvio server reale");
  const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(PORT)], {
    env: {
      ...process.env,
      ...env,
      VITE_ALLOW_LOCAL_FALLBACKS: "false",
      VITE_STRICT_GOOGLE_BACKEND: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let browser;
  const report = { functional: [], responsive: [], errors: [] };
  const sessionPayload = { sessionToken: session.token };
  const baselineTopic = baseline.topics.find((item) => item.id === "retribuzione");
  const baselineWorkshop = baseline.workshops.find((item) => item.id === "ws-le-assicurazioni-essenziali-quali-servono-davvero");
  const baselineExpert = baseline.experts[0];
  const baselinePrice = baseline.settingMap.get("pricing.workshopBasePrice");
  const baselineBundles = baseline.settingMap.get("catalog.bundlesJson");
  mkdirSync(OUTPUT_DIR, { recursive: true });
  try {
    await waitForServer(server);
    trace("UI: server pronto");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15_000);
    const errors = [];
    const requestStartedAt = new Map();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
        trace(`UI console error: ${message.text()}`);
      }
    });
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("script.google.com")) {
        requestStartedAt.set(request, Date.now());
        try {
          const body = JSON.parse(request.postData() || "{}");
          if (body.action === "updateWorkspaceSetting" && String(body.payload?.key || "").startsWith("pricing.")) {
            trace(`UI API payload: ${body.payload.key}=${body.payload.value}`);
          }
        } catch {
          // Diagnostica best effort: il payload reale può non essere JSON in caso di redirect.
        }
      }
    });
    page.on("response", (response) => {
      const request = response.request();
      if (response.status() >= 400) trace(`UI HTTP ${response.status()}: ${response.url()}`);
      if (requestStartedAt.has(request)) {
        trace(`UI API: POST ${response.status()} in ${Date.now() - requestStartedAt.get(request)}ms`);
        requestStartedAt.delete(request);
      }
    });
    page.on("requestfailed", (request) => {
      if (requestStartedAt.has(request)) {
        trace(`UI API: POST fallita in ${Date.now() - requestStartedAt.get(request)}ms: ${request.failure()?.errorText || "errore sconosciuto"}`);
        requestStartedAt.delete(request);
      }
    });
    await page.addInitScript((authSession) => {
      window.localStorage.setItem("funnifin_auth_session", JSON.stringify(authSession));
      window.sessionStorage.setItem(`funnifin_welcome_seen_${authSession.token}`, "1");
    }, session);
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    await page.getByLabel(/Esci \(.+\)/).waitFor({ timeout: 30_000 });
    trace("UI: sessione FunniFin caricata");
    await page.getByLabel("Chiudi benvenuto").click().catch(() => {});

    const sectionTitles = [
      "Richieste cliente",
      "Da fare adesso",
      "Catalogo vendibile",
      "Listino prezzi",
      "Pool esperti",
      "Google backend",
      "Mail template",
      "Manuale utente",
      "Utenti e inviti",
    ];
    for (const title of sectionTitles) assert((await page.locator(".admin-section-nav button").filter({ hasText: title }).count()) === 1, `sezione mancante: ${title}`);

    await clickAdminSection(page, "Richieste cliente");
    if (baseline.workshopRequests.length > 0) {
      const clearRequestsButton = page.locator('button[aria-label^="Svuota "][aria-label$=" richieste cliente"]');
      await clearRequestsButton.waitFor({ timeout: 30_000 });
      assert((await clearRequestsButton.count()) === 1, "comando svuota richieste mancante");
      await clearRequestsButton.click();
      await page.getByRole("heading", { name: "Svuotare tutte le richieste?", exact: true }).waitFor();
      assert((await page.getByText("L’operazione è irreversibile.", { exact: false }).count()) === 1, "avviso irreversibilità richieste mancante");
      await page.getByRole("button", { name: "Annulla", exact: true }).click();
      await page.getByRole("heading", { name: "Svuotare tutte le richieste?", exact: true }).waitFor({ state: "detached" });
    } else {
      const emptyClearButton = page.getByLabel("Nessuna richiesta da svuotare");
      assert((await emptyClearButton.count()) === 1 && (await emptyClearButton.isDisabled()), "stato vuoto svuota richieste non protetto");
    }
    report.functional.push("richieste: comando bulk protetto da conferma");

    await clickAdminSection(page, "Catalogo vendibile");
    trace("UI: catalogo aperto");
    await page.locator(".catalog-map-card").first().waitFor({ timeout: 30_000 });
    assert((await page.locator(".catalog-map-card").count()) === 11, "UI catalogo non mostra 11 topic");
    assert((await page.locator(".bundle-admin-card").count()) === 9, "UI catalogo non mostra 9 pacchetti");
    const healthText = await page.locator(".catalog-health-grid").innerText();
    assert(/Workshop vendibili\s*46/.test(healthText), `conteggio workshop UI errato: ${healthText}`);
    assert(/Topic\s*11/.test(healthText), `conteggio topic UI errato: ${healthText}`);
    assert(/Pacchetti\s*9/.test(healthText), `conteggio pacchetti UI errato: ${healthText}`);
    assert(/Workshop senza topic\s*0/.test(healthText), `orphan UI presenti: ${healthText}`);

    const uiMarker = `ui-real-${Date.now()}`;
    await page.getByLabel("Modifica Retribuzione").click();
    await page.getByRole("heading", { name: "Modifica topic", exact: true }).waitFor();
    assert((await page.getByLabel("Nome topic").count()) === 1, "campo nome topic mancante");
    assert((await page.getByText("Temi associati", { exact: true }).count()) === 0, "residuo temi nel topic");
    await page.getByLabel("Descrizione").fill(uiMarker);
    await page.getByRole("button", { name: "Salva modifiche", exact: true }).click();
    await page.getByRole("heading", { name: "Modifica topic", exact: true }).waitFor({ state: "detached", timeout: TIMEOUT });
    assert(
      (await get(env, "listCatalogConfig", session)).topics.some((item) => item.id === baselineTopic.id && item.description === uiMarker),
      "salvataggio UI topic non persistito",
    );
    report.functional.push("topic: modifica, salvataggio e lettura Sheet");
    trace("UI: CRUD topic verificato");

    await closeToasts(page);
    await page.getByLabel("Modifica Le assicurazioni essenziali: quali servono davvero").click();
    await page.getByRole("heading", { name: "Modifica workshop", exact: true }).waitFor();
    assert((await page.getByLabel("Stato produzione").inputValue()) === "draft", "stato Excel DA PRODURRE non visibile in admin");
    assert((await page.getByLabel("Personalizzabile").isChecked()) === false, "personalizzazione vietata non rispettata");
    await page.getByLabel("Note interne").fill(uiMarker);
    await saveModalAndRequireSuccess(page, {
      buttonName: /Salva workshop/,
      headingName: "Modifica workshop",
      successText: "Workshop salvato",
    });
    assert(
      (await get(env, "listCatalogWorkshops", session)).workshops.some((item) => item.id === baselineWorkshop.id && item.adminNotes === uiMarker),
      "salvataggio UI workshop non persistito",
    );
    report.functional.push("workshop: stato, personalizzazione, note e persistenza");
    trace("UI: CRUD workshop verificato");

    await page.getByRole("button", { name: "Nuovo workshop", exact: true }).click();
    await page.getByRole("heading", { name: "Nuovo workshop", exact: true }).waitFor();
    assert((await page.getByRole("button", { name: /Salva workshop/ }).isDisabled()) === true, "validazione nuovo workshop assente");
    await page.getByRole("button", { name: "Chiudi", exact: true }).click();

    await page.getByLabel("Caricamento bundle dal catalogo Google").waitFor({ state: "detached", timeout: 120_000 });
    const bundleCards = page.locator(".bundle-admin-card");
    await bundleCards.first().waitFor({ timeout: 30_000 });
    const bundleTitles = await bundleCards.evaluateAll((cards) => cards.map((card) => card.querySelector("input")?.value || ""));
    const casaIndex = bundleTitles.indexOf("Bundle Casa");
    const famigliaIndex = bundleTitles.indexOf("Bundle Famiglia");
    assert(casaIndex >= 0 && famigliaIndex >= 0, `card Casa/Famiglia mancanti: ${bundleTitles.join(", ")}`);
    const casaCard = bundleCards.nth(casaIndex);
    const famigliaCard = bundleCards.nth(famigliaIndex);
    const casaSelections = await casaCard.locator(".bundle-member-list select").evaluateAll((items) => items.map((item) => item.value));
    const familySelections = await famigliaCard.locator(".bundle-member-list select").evaluateAll((items) => items.map((item) => item.value));
    assert(
      JSON.stringify(casaSelections) !== JSON.stringify(familySelections),
      `UI Casa/Famiglia ancora duplicata: casa=${JSON.stringify(casaSelections)} famiglia=${JSON.stringify(familySelections)}`,
    );
    const casaSelects = casaCard.locator(".bundle-member-list select");
    await casaSelects.nth(1).selectOption(casaSelections[2]);
    await casaSelects.nth(2).selectOption(casaSelections[1]);
    await closeToasts(page);
    trace("UI: salvo pacchetto modificato");
    await page.getByRole("button", { name: "Salva bundle", exact: true }).click();
    await page.getByText("Setting salvata su Google", { exact: true }).waitFor({ timeout: TIMEOUT });
    trace("UI: toast pacchetto ricevuto");
    await closeToasts(page);
    let storedBundles = JSON.parse(
      (await get(env, "listWorkspaceSettings", session)).settings.find((item) => item.key === "catalog.bundlesJson")?.value || "[]",
    );
    assert(
      JSON.stringify(storedBundles.find((bundle) => bundle.id === "bundle-casa")?.workshopIds) ===
        JSON.stringify([casaSelections[0], casaSelections[2], casaSelections[1]]),
      "salvataggio UI pacchetto non persistito",
    );
    report.functional.push("pacchetto: composizione modificata e persistita");
    trace("UI: CRUD pacchetto verificato");

    await clickAdminSection(page, "Listino prezzi");
    assert((await page.getByLabel("Workshop singolo").inputValue()) === "1000", "prezzo workshop UI errato");
    assert((await page.getByLabel("Pacchetto da 3").inputValue()) === "2500", "prezzo pacchetto 3 UI errato");
    assert((await page.getByLabel("Pacchetto da 6").inputValue()) === "4500", "prezzo pacchetto 6 UI errato");
    assert((await page.getByLabel("Pacchetto da 10").inputValue()) === "6900", "prezzo pacchetto 10 UI errato");
    assert(await page.getByLabel("Registrazione inclusa di default").isChecked(), "default registrazione UI errato");
    await closeToasts(page);
    await page.getByLabel("Workshop singolo").fill("1100");
    assert((await page.getByLabel("Workshop singolo").inputValue()) === "1100", "input listino non accetta 1100");
    await page.getByRole("button", { name: "Salva listino", exact: true }).click();
    await Promise.race([
      page.getByText("Listino salvato", { exact: true }).waitFor({ timeout: TIMEOUT }),
      page.getByText("Listino non salvato", { exact: true }).waitFor({ timeout: TIMEOUT }).then(async () => {
        throw new Error(`salvataggio listino UI fallito: ${await page.locator(".feedback-toast").filter({ hasText: "Listino non salvato" }).innerText()}`);
      }),
    ]);
    const livePriceAfterUiSave = (await get(env, "listWorkspaceSettings", session)).settings.find((item) => item.key === "pricing.workshopBasePrice");
    trace(`UI: listino riletto ${livePriceAfterUiSave?.value || "mancante"} (${livePriceAfterUiSave?.updatedAt || "senza timestamp"})`);
    assert(
      livePriceAfterUiSave?.value === "1100",
      "salvataggio UI listino non persistito",
    );
    report.functional.push("listino: modifica e persistenza");
    trace("UI: CRUD listino verificato");

    await clickAdminSection(page, "Pool esperti");
    assert((await page.locator(".expert-pool-card").count()) > 0, "pool esperti vuoto");
    await page.getByRole("button", { name: "Nuovo esperto", exact: true }).click();
    await page.getByRole("heading", { name: "Modifica profilo", exact: true }).waitFor();
    assert((await page.locator(".catalog-topic-pills button").count()) === 11, "nuovo esperto non espone 11 topic");
    assert((await page.getByText("Temi associati", { exact: true }).count()) === 0, "residuo temi nel profilo esperto");
    await page.getByRole("button", { name: "Chiudi", exact: true }).click();

    const expertName = `${baselineExpert.firstName} ${baselineExpert.lastName}`.trim();
    await page.getByLabel(`Modifica profilo ${expertName}`).click();
    await page.getByLabel("Disponibilita").fill(uiMarker);
    await page.getByRole("button", { name: "Salva profilo", exact: true }).click();
    await page.getByRole("heading", { name: "Modifica profilo", exact: true }).waitFor({ state: "detached", timeout: TIMEOUT });
    assert(
      (await get(env, "listExperts", session)).experts.some((item) => item.id === baselineExpert.id && item.availability === uiMarker),
      "salvataggio UI esperto non persistito",
    );
    report.functional.push("esperto: disponibilità modificata e persistita");
    trace("UI: CRUD esperto verificato");
    await closeToasts(page);

    trace("UI: apro Google backend");
    await clickAdminSection(page, "Google backend");
    await page.getByRole("heading", { name: "Google backend", exact: true }).waitFor();
    assert((await page.locator(".google-health-card").count()) >= 4, "stato Google incompleto");

    trace("UI: apro Mail template");
    await clickAdminSection(page, "Mail template");
    assert((await page.getByRole("heading", { name: "Mail template", exact: true }).count()) === 1, "sezione mail non renderizzata");
    assert((await page.getByLabel("Template mail FunniFin").count()) === 1, "lista template mail non renderizzata");
    assert((await page.getByPlaceholder("Cerca template, oggetto o trigger").count()) === 1, "ricerca template mail non disponibile");
    trace("UI: apro Manuale utente");
    await clickAdminSection(page, "Manuale utente");
    assert((await page.getByRole("heading", { name: "Manuale utente", exact: true }).count()) === 1, "manuale non renderizzato");
    trace("UI: apro Utenti e inviti");
    await clickAdminSection(page, "Utenti e inviti");
    assert((await page.getByRole("heading", { name: "Utenti e inviti", exact: true }).count()) === 1, "utenti non renderizzati");
    await page.locator(".auth-users-table tbody tr").first().waitFor({ timeout: 30_000 });
    assert((await page.locator(".auth-users-table tbody tr").count()) === baseline.authUsers.length, "conteggio utenti UI diverso dallo Sheet");
    assert((await page.locator(".admin-auth-load-error").count()) === 0, "errore di caricamento utenti visibile");
    assert((await page.locator(".pricing-hero-card").filter({ hasText: `${baseline.authUsers.filter((user) => !user.disabled).length} account attivi` }).count()) === 1, "riepilogo utenti non coerente");
    trace("UI: sezioni informative verificate");

    const viewportMatrix = [
      { name: "desktop", width: 1440, height: 1000 },
      { name: "laptop", width: 1024, height: 900 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "mobile", width: 390, height: 844 },
    ];
    for (const viewport of viewportMatrix) {
      trace(`RESPONSIVE: ${viewport.name} ${viewport.width}x${viewport.height}`);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const title of sectionTitles) {
        await closeToasts(page);
        await clickAdminSection(page, title);
        await page.evaluate(() => window.scrollTo(0, 0));
        const metrics = await page.evaluate(() => {
          const rect = (selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const box = element.getBoundingClientRect();
            return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
          };
          return {
            viewportWidth: innerWidth,
            viewportHeight: innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            systemBar: rect(".system-bar"),
            bottomBar: rect(".bottom-action-bar"),
            console: rect(".admin-console"),
          };
        });
        assert(metrics.scrollWidth <= metrics.viewportWidth + 1, `${viewport.name}/${title}: overflow orizzontale ${JSON.stringify(metrics)}`);
        for (const [key, box] of Object.entries({ systemBar: metrics.systemBar, bottomBar: metrics.bottomBar })) {
          if (!box) continue;
          assert(box.left >= -1 && box.right <= metrics.viewportWidth + 1, `${viewport.name}/${title}: ${key} esce dal viewport`);
        }
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const screenshotPath = `${OUTPUT_DIR}/${viewport.name}-${slug}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });
        report.responsive.push({ viewport: viewport.name, width: viewport.width, section: title, screenshot: screenshotPath, metrics });
      }

      await clickAdminSection(page, "Catalogo vendibile");
      await page.getByLabel("Modifica Retribuzione").click();
      const dialogBox = await page.getByRole("dialog").boundingBox();
      assert(dialogBox && dialogBox.x >= -1 && dialogBox.x + dialogBox.width <= viewport.width + 1, `${viewport.name}: modale catalogo fuori viewport`);
      await page.screenshot({ path: `${OUTPUT_DIR}/${viewport.name}-modal-topic.png`, fullPage: false });
      await page.getByRole("button", { name: "Chiudi", exact: true }).click();
    }
    assert(
      !errors.some((message) => /uncaught|hydration|same key|duplicate key|typeerror|referenceerror/i.test(message)),
      `errori console/page admin: ${errors.join(" | ")}`,
    );
    report.errors = errors;
    writeFileSync(`${OUTPUT_DIR}/report.json`, JSON.stringify(report, null, 2));
    trace("UI: report e screenshot completati");
  } finally {
    if (baselineTopic) await post(env, "updateCatalogTopic", { ...baselineTopic, ...sessionPayload }).catch(() => {});
    if (baselineWorkshop) await post(env, "updateCatalogWorkshop", { ...baselineWorkshop, ...sessionPayload }).catch(() => {});
    if (baselineExpert) await post(env, "updateExpert", { ...baselineExpert, ...sessionPayload }).catch(() => {});
    if (baselinePrice) await post(env, "updateWorkspaceSetting", { ...baselinePrice, ...sessionPayload }).catch(() => {});
    if (baselineBundles) await post(env, "updateWorkspaceSetting", { ...baselineBundles, ...sessionPayload }).catch(() => {});
    await post(env, "clearBackendCaches", sessionPayload).catch(() => {});
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

async function run() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  rmSync(`${OUTPUT_DIR}/failure.json`, { force: true });
  rmSync(`${OUTPUT_DIR}/report.json`, { force: true });
  writeFileSync(`${OUTPUT_DIR}/progress.log`, "");
  trace("RUN: creo sessione live");
  const env = loadEnv();
  const sessionResult = await post(env, "createSmokeTestSession", {
    setupSecret: env.ADMIN_SETUP_SECRET,
    email: env.SMOKE_FUNNIFIN_EMAIL || env.INITIAL_FUNNIFIN_EMAIL || "",
    durationMinutes: 45,
  }, { retryTransient: true });
  assert(sessionResult.session?.token, "sessione admin di test non creata");
  const session = sessionResult.session;
  const baseline = await backendAudit(env, session);
  trace("RUN: baseline Sheet verificata");
  await uiAudit(env, session, baseline);
  const finalState = await backendAudit(env, session);
  assert(finalState.topics.length === baseline.topics.length, "ripristino topic incompleto");
  assert(finalState.workshops.length === baseline.workshops.length, "ripristino workshop incompleto");
  assert(
    finalState.topics.find((item) => item.id === "retribuzione")?.description ===
      baseline.topics.find((item) => item.id === "retribuzione")?.description,
    "ripristino contenuto topic incompleto",
  );
  assert(
    finalState.workshops.find((item) => item.id === "ws-le-assicurazioni-essenziali-quali-servono-davvero")?.adminNotes ===
      baseline.workshops.find((item) => item.id === "ws-le-assicurazioni-essenziali-quali-servono-davvero")?.adminNotes,
    "ripristino workshop incompleto",
  );
  assert(
    finalState.settingMap.get("pricing.workshopBasePrice")?.value ===
      baseline.settingMap.get("pricing.workshopBasePrice")?.value,
    "ripristino prezzo centralizzato incompleto",
  );
  assert(
    finalState.settingMap.get("catalog.bundlesJson")?.value ===
      baseline.settingMap.get("catalog.bundlesJson")?.value,
    "ripristino pacchetti incompleto",
  );
  assert(finalState.rules[0]?.name === baseline.rules[0]?.name, "ripristino regola prezzo incompleto");
  assert(finalState.experts[0]?.availability === baseline.experts[0]?.availability, "ripristino esperto incompleto");
  trace("RUN: stato finale ripristinato");
  console.log("PASS admin deep check: dati, CRUD con ripristino, 9 sezioni, modali, listino e mobile");
}

await run().catch((error) => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const payload = { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : "" };
  writeFileSync(`${OUTPUT_DIR}/failure.json`, JSON.stringify(payload, null, 2));
  console.error(error);
  process.exitCode = 1;
});
