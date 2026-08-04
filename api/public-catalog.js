const UPSTREAM_ATTEMPT_TIMEOUT_MS = 15_000;
const UPSTREAM_ATTEMPTS = 2;

export const config = {
  maxDuration: 35,
};

function validCatalog(value) {
  return Boolean(
    value &&
    value.ok === true &&
    value.source === "google-sheet" &&
    Array.isArray(value.topics) &&
    value.topics.length > 0 &&
    Array.isArray(value.workshops) &&
    value.workshops.length > 0 &&
    Array.isArray(value.rules) &&
    Array.isArray(value.bundles) &&
    value.commercialConfig,
  );
}

async function fetchOfficialCatalog(scriptUrl) {
  const url = new URL(scriptUrl);
  url.searchParams.set("action", "publicCatalog");
  let lastError;

  for (let attempt = 0; attempt < UPSTREAM_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error("Upstream catalog timeout")), UPSTREAM_ATTEMPT_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Upstream catalog HTTP ${response.status}`);
      const catalog = await response.json();
      if (!validCatalog(catalog)) throw new Error("Upstream catalog contract invalid");
      return catalog;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error("Official catalog unavailable");
}

export default async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const scriptUrl = String(process.env.VITE_APPS_SCRIPT_DEPLOYMENT_URL || "").trim();
  if (!scriptUrl) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).json({ ok: false, error: "Catalog service not configured" });
  }

  try {
    const catalog = await fetchOfficialCatalog(scriptUrl);
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    if (request.method === "HEAD") return response.status(200).end();
    return response.status(200).json(catalog);
  } catch (error) {
    console.error("public-catalog proxy failed", error instanceof Error ? error.message : "Unknown upstream error");
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).json({ ok: false, error: "Catalogo ufficiale temporaneamente non disponibile" });
  }
}
