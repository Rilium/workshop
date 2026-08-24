import type { CatalogBundle, CommercialConfig, SurveyProfile, Workshop } from "../types/domain";
import { getBundlePrice, getWorkshopSelectionPrice } from "./workshop";

const budgetCeilings: Record<string, number> = {
  // Valori legacy mantenuti per profili già salvati.
  "under-5000": 5000,
  "under-2000": 2000,
  "2000-5000": 5000,
  "5000-10000": 10000,
  "over-10000": 10000,
  unknown: Number.POSITIVE_INFINITY,
};

function topicIdsForWorkshop(workshop: Workshop) {
  return workshop.topicIds?.length ? workshop.topicIds : [workshop.topicId];
}

function resolveFormat(requestedFormat: string, employees: string, budget: string): "webinar" | "live" {
  if (requestedFormat === "in-person") return "live";
  if (requestedFormat === "online") return "webinar";
  if (budget === "under-5000" || budget === "under-2000" || budget === "2000-5000" || employees === "200+" || employees === "51-200") return "webinar";
  return "live";
}

export function buildSurveyRecommendation({
  topicIds,
  outcome,
  employees,
  requestedFormat,
  budget,
  workshops,
  bundles,
  commercialConfig,
}: {
  topicIds: string[];
  outcome: SurveyProfile["outcome"];
  employees: string;
  requestedFormat: SurveyProfile["requestedFormat"];
  budget: string;
  workshops: Workshop[];
  bundles: CatalogBundle[];
  commercialConfig: CommercialConfig;
}): SurveyProfile {
  const desiredCount = commercialConfig.outcomeSizes[outcome];
  const workshopById = new Map(workshops.map((workshop) => [workshop.id, workshop]));
  const eligibleWorkshop = (workshop?: Workshop) =>
    Boolean(
      workshop &&
      workshop.state !== "nascosto" &&
      (!topicIds.length || topicIdsForWorkshop(workshop).some((topicId) => topicIds.includes(topicId))),
    );

  const bundleOutcomeAffinity = (bundle: CatalogBundle) => {
    const haystack = `${bundle.id} ${bundle.title}`.toLowerCase();
    if (outcome === "avanzata") return haystack.includes("avanzat") ? 1 : 0;
    if (outcome === "completa") return haystack.includes("complet") ? 1 : 0;
    return haystack.includes("base") || haystack.includes("essenzial") ? 1 : 0;
  };

  const rankedBundles = bundles
    .filter((bundle) => bundle.active)
    .map((bundle) => {
      const coveredTopicIds = new Set<string>();
      const matchingCount = bundle.workshopIds.reduce(
        (count, workshopId) => {
          const workshop = workshopById.get(workshopId);
          if (!eligibleWorkshop(workshop)) return count;
          topicIdsForWorkshop(workshop!).forEach((topicId) => {
            if (topicIds.includes(topicId)) coveredTopicIds.add(topicId);
          });
          return count + 1;
        },
        0,
      );
      const matchingRatio = bundle.size > 0 ? matchingCount / bundle.size : 0;
      const topicCoverage = topicIds.length > 0 ? coveredTopicIds.size / topicIds.length : 0;
      return {
        bundle,
        matchingCount,
        matchingRatio,
        topicCoverage,
        coveredTopicIds,
        exactSize: bundle.size === desiredCount,
        outcomeAffinity: bundleOutcomeAffinity(bundle),
      };
    })
    .filter(({ matchingCount }) => matchingCount > 0)
    .sort((a, b) =>
      Number(b.exactSize) - Number(a.exactSize) ||
      b.topicCoverage - a.topicCoverage ||
      b.matchingRatio - a.matchingRatio ||
      b.matchingCount - a.matchingCount ||
      b.outcomeAffinity - a.outcomeAffinity ||
      a.bundle.title.localeCompare(b.bundle.title, "it"),
    );

  const picks: string[] = [];
  const seen = new Set<string>();
  const recommendedBundle = budget === "under-2000"
    ? undefined
    : rankedBundles.find(({ exactSize }) => exactSize)?.bundle;
  if (recommendedBundle) {
    recommendedBundle.workshopIds.forEach((workshopId) => {
      if (!seen.has(workshopId) && workshopById.has(workshopId)) {
        seen.add(workshopId);
        picks.push(workshopId);
      }
    });
  }

  const coveredTopicIds = new Set(
    picks.flatMap((workshopId) => {
      const workshop = workshopById.get(workshopId);
      return workshop ? topicIdsForWorkshop(workshop).filter((topicId) => topicIds.includes(topicId)) : [];
    }),
  );
  const addNextWorkshopForTopic = (topicId: string) => {
    const workshop = workshops.find(
      (candidate) =>
        !seen.has(candidate.id) &&
        eligibleWorkshop(candidate) &&
        topicIdsForWorkshop(candidate).includes(topicId),
    );
    if (!workshop) return false;
    seen.add(workshop.id);
    picks.push(workshop.id);
    topicIdsForWorkshop(workshop).forEach((coveredTopicId) => coveredTopicIds.add(coveredTopicId));
    return true;
  };

  // Un pacchetto mantiene il suo prezzo editoriale; gli ambiti non coperti
  // ricevono un solo workshop mirato, senza sostituire il bundle con una lista casuale.
  topicIds.forEach((topicId) => {
    if (!coveredTopicIds.has(topicId)) addNextWorkshopForTopic(topicId);
  });

  // Nel fallback à-la-carte distribuisce i posti tra gli ambiti prima di riempire
  // il percorso, evitando che l'ordine del catalogo domini la raccomandazione.
  if (!recommendedBundle) {
    let addedInRound = true;
    while (picks.length < desiredCount && addedInRound) {
      addedInRound = false;
      for (const topicId of topicIds) {
        if (picks.length >= desiredCount) break;
        if (addNextWorkshopForTopic(topicId)) addedInRound = true;
      }
    }
  }

  for (const workshop of workshops) {
    if (picks.length >= desiredCount || recommendedBundle) break;
    if (seen.has(workshop.id) || !eligibleWorkshop(workshop)) continue;
    seen.add(workshop.id);
    picks.push(workshop.id);
  }

  const resolvedFormat = resolveFormat(requestedFormat, employees, budget);
  const recommendedBundleMemberIds = new Set(recommendedBundle?.workshopIds ?? []);
  const workshopExtras = picks.reduce((total, workshopId) => {
    if (recommendedBundle && !recommendedBundleMemberIds.has(workshopId)) return total;
    const workshop = workshopById.get(workshopId);
    if (!workshop) return total;
    const price = getWorkshopSelectionPrice(
      workshop,
      {
        duration: workshop.durationOptions[0],
        format: resolvedFormat,
        custom: false,
        recordingIncluded: commercialConfig.recordingDefault,
      },
      commercialConfig,
    );
    return total + price.liveExtra - price.recordingDiscount;
  }, 0);
  const additionalWorkshopTotal = recommendedBundle
    ? picks.reduce((total, workshopId) => {
        if (recommendedBundleMemberIds.has(workshopId)) return total;
        const workshop = workshopById.get(workshopId);
        if (!workshop) return total;
        return total + getWorkshopSelectionPrice(
          workshop,
          {
            duration: workshop.durationOptions[0],
            format: resolvedFormat,
            custom: false,
            recordingIncluded: commercialConfig.recordingDefault,
          },
          commercialConfig,
        ).total;
      }, 0)
    : 0;
  const estimatedTotal = recommendedBundle
    ? getBundlePrice(recommendedBundle, commercialConfig) + workshopExtras + additionalWorkshopTotal
    : picks.reduce((total, workshopId) => total + (workshopById.get(workshopId)?.price1h ?? 0), 0) + workshopExtras;
  const budgetCeiling = budgetCeilings[budget] ?? Number.POSITIVE_INFINITY;
  const budgetGap = Number.isFinite(budgetCeiling) ? Math.max(0, estimatedTotal - budgetCeiling) : 0;

  return {
    topicIds,
    outcome,
    employees,
    requestedFormat,
    resolvedFormat,
    budget,
    bundleIds: rankedBundles.map(({ bundle }) => bundle.id),
    recommendedBundleId: recommendedBundle?.id,
    recommendedWorkshopIds: picks,
    estimatedTotal,
    budgetGap,
    reason: recommendedBundle
      ? `${recommendedBundle.title} è il pacchetto più coerente con il livello richiesto.${picks.length > recommendedBundle.workshopIds.length ? ` Abbiamo aggiunto ${picks.length - recommendedBundle.workshopIds.length} ${picks.length - recommendedBundle.workshopIds.length === 1 ? "workshop mirato" : "workshop mirati"} per coprire gli ambiti non presenti nel pacchetto.` : ""}${budgetGap ? ` La proposta supera il budget indicato di ${budgetGap} €.` : ""}`
      : budget === "under-2000"
        ? "Per il budget indicato proponiamo workshop singoli prioritari, senza vincolare il percorso a un pacchetto."
      : budgetGap
        ? `Nessun pacchetto copre bene questa combinazione: il percorso personalizzato supera il budget indicato di ${budgetGap} €.`
        : `Nessun pacchetto copre bene questa combinazione: abbiamo costruito una proposta sui workshop più coerenti.`,
  };
}
