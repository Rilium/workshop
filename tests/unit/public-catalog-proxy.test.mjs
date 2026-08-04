import assert from "node:assert/strict";
import test from "node:test";
import handler from "../../api/public-catalog.js";

const officialCatalog = {
  ok: true,
  source: "google-sheet",
  topics: [{ id: "topic-1" }],
  workshops: [{ id: "workshop-1" }],
  rules: [],
  bundles: [],
  commercialConfig: { workshopBasePrice: 1000 },
};

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

test("il proxy espone solo cataloghi ufficiali validi con cache CDN", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.VITE_APPS_SCRIPT_DEPLOYMENT_URL;
  process.env.VITE_APPS_SCRIPT_DEPLOYMENT_URL = "https://example.com/exec";
  globalThis.fetch = async () => new Response(JSON.stringify(officialCatalog), { status: 200 });
  try {
    const response = responseRecorder();
    await handler({ method: "GET" }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.source, "google-sheet");
    assert.match(response.headers["cache-control"], /s-maxage=300/);
    assert.match(response.headers["cache-control"], /stale-while-revalidate=86400/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.VITE_APPS_SCRIPT_DEPLOYMENT_URL;
    else process.env.VITE_APPS_SCRIPT_DEPLOYMENT_URL = originalUrl;
  }
});

test("il proxy ritenta una lettura transitoria prima di fallire", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.VITE_APPS_SCRIPT_DEPLOYMENT_URL;
  process.env.VITE_APPS_SCRIPT_DEPLOYMENT_URL = "https://example.com/exec";
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary network error");
    return new Response(JSON.stringify(officialCatalog), { status: 200 });
  };
  try {
    const response = responseRecorder();
    await handler({ method: "GET" }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.VITE_APPS_SCRIPT_DEPLOYMENT_URL;
    else process.env.VITE_APPS_SCRIPT_DEPLOYMENT_URL = originalUrl;
  }
});
