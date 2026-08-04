import assert from "node:assert/strict";
import test from "node:test";
import { fallbackCatalogBundles, fallbackCatalogWorkshops } from "../../src/data/clientCatalog";
import { defaultCommercialConfig, initialRules } from "../../src/data/pricing";
import {
  clientFlowReducer,
  createInitialClientFlowState,
} from "../../src/features/client/clientFlowState";
import {
  clearClientSubmissionIdentity,
  getOrCreateClientSubmissionIdentity,
} from "../../src/features/client/clientSubmissionIdentity";
import { calculateQuote } from "../../src/hooks/useQuote";
import type { Selection } from "../../src/types/domain";

test("il reducer ripristina un draft parziale senza perdere i default", () => {
  const initial = createInitialClientFlowState({
    clientStep: "Date",
    workshopFilters: { topics: ["risparmio"], format: "webinar" },
    contact: { company: "Acme" } as never,
  });

  assert.equal(initial.clientStep, "Date");
  assert.deepEqual(initial.workshopFilters, { topics: ["risparmio"], format: "webinar" });
  assert.equal(initial.contact.company, "Acme");
  assert.equal(initial.contact.email, "");
  assert.equal(initial.privacyAccepted, false);
});

test("il reducer applica anche setter funzionali in modo immutabile", () => {
  const initial = createInitialClientFlowState();
  const next = clientFlowReducer(initial, {
    type: "set",
    key: "surveyIndex",
    value: (current) => Number(current) + 1,
  });

  assert.equal(initial.surveyIndex, 0);
  assert.equal(next.surveyIndex, 1);
  assert.notEqual(next, initial);
});

test("il preventivo applica pacchetto, promo e rinuncia registrazione una sola volta", () => {
  const bundle = fallbackCatalogBundles.find((item) => item.size === 3 && item.workshopIds.length === 3);
  assert.ok(bundle, "Serve un pacchetto da tre workshop nel catalogo di test");
  const workshops = bundle.workshopIds.map((id) => fallbackCatalogWorkshops.find((item) => item.id === id)).filter(Boolean);
  assert.equal(workshops.length, 3);
  const selections: Selection[] = workshops.map((workshop, index) => ({
    workshopId: workshop!.id,
    bundleId: bundle.id,
    bundleIds: [bundle.id],
    duration: workshop!.durationOptions[0],
    format: "webinar",
    custom: false,
    recordingIncluded: index !== 1,
    promo: index === 0,
    date: "",
    time: "10:00",
    dateConfirmed: false,
    status: "selezionato",
  }));

  const quote = calculateQuote(selections, workshops as typeof fallbackCatalogWorkshops, initialRules, defaultCommercialConfig, [bundle]);
  assert.equal(quote.gross, 3000);
  assert.equal(quote.quantityDiscount, 500);
  assert.equal(quote.promoDiscount, 50);
  assert.equal(quote.recordingDiscount, 100);
  assert.equal(quote.total, 2350);
  assert.deepEqual(quote.bundleIds, [bundle.id]);
});

test("un pacchetto incompleto viene quotato à-la-carte", () => {
  const bundle = fallbackCatalogBundles.find((item) => item.size === 3 && item.workshopIds.length === 3);
  assert.ok(bundle);
  const workshop = fallbackCatalogWorkshops.find((item) => item.id === bundle.workshopIds[0]);
  assert.ok(workshop);
  const selection: Selection = {
    workshopId: workshop.id,
    bundleId: bundle.id,
    bundleIds: [bundle.id],
    duration: workshop.durationOptions[0],
    format: "webinar",
    custom: false,
    recordingIncluded: true,
    promo: false,
    date: "",
    time: "10:00",
    dateConfirmed: false,
    status: "selezionato",
  };

  const quote = calculateQuote([selection], [workshop], initialRules, defaultCommercialConfig, [bundle]);
  assert.equal(quote.quantityDiscount, 0);
  assert.equal(quote.total, 1000);
  assert.equal(quote.rule.id, "a-la-carte");
});

test("l'identità di invio resta stabile tra tentativi e cambia dopo il completamento", () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  });

  const first = getOrCreateClientSubmissionIdentity("Acme");
  const retry = getOrCreateClientSubmissionIdentity("Acme modificata");
  assert.deepEqual(retry, first);

  clearClientSubmissionIdentity();
  const nextRequest = getOrCreateClientSubmissionIdentity("Acme");
  assert.notEqual(nextRequest.clientMutationId, first.clientMutationId);
  delete (globalThis as { window?: unknown }).window;
});
