import type { CatalogBundle, CommercialConfig, SurveyProfile, Workshop } from "../types/domain";
import { getBundlePrice, getWorkshopSelectionPrice } from "./workshop";

const budgetCeilings: Record<string, number> = {
  "under-2000": 2000,
  "2000-5000": 5000,
  "5000-10000": 10000,
  "over-10000": Number.POSITIVE_INFINITY,
  unknown: Number.POSITIVE_INFINITY,
};

function topicIdsForWorkshop(workshop: Workshop) {
  return workshop.topicIds?.length ? workshop.topicIds : [workshop.topicId];
}

function resolveFormat(requestedFormat: string, employees: string, budget: string): "webinar" | "live" {
  if (requestedFormat === "in-person") return "live";
  if (requestedFormat === "online") return "webinar";
  if (budget === "under-2000" || employees === "200+" || employees === "51-200") return "webinar";
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
      workshop.productionStatus !== "draft" &&
      (!topicIds.length || topicIdsForWorkshop(workshop).some((topicId) => topicIds.includes(topicId))),
    );

  const rankedBundles = bundles
    .filter((bundle) => bundle.active)
    .map((bundle) => {
      const matchingCount = bundle.workshopIds.reduce(
        (count, workshopId) => count + (eligibleWorkshop(workshopById.get(workshopId)) ? 1 : 0),
        0,
      );
      const matchingRatio = bundle.size > 0 ? matchingCount / bundle.size : 0;
      return { bundle, matchingCount, matchingRatio, exactSize: bundle.size === desiredCount };
    })
    .filter(({ matchingCount }) => matchingCount > 0)
    .sort((a, b) => Number(b.exactSize) - Number(a.exactSize) || b.matchingRatio - a.matchingRatio || b.matchingCount - a.matchingCount);

  const picks: string[] = [];
  const seen = new Set<string>();
  const recommendedBundle = budget === "under-2000"
    ? undefined
    : rankedBundles.find(({ exactSize, matchingRatio }) => exactSize && matchingRatio >= 0.67)?.bundle;
  if (recommendedBundle) {
    recommendedBundle.workshopIds.forEach((workshopId) => {
      if (!seen.has(workshopId) && workshopById.has(workshopId)) {
        seen.add(workshopId);
        picks.push(workshopId);
      }
    });
  }

  for (const workshop of workshops) {
    if (picks.length >= desiredCount) break;
    if (seen.has(workshop.id) || !eligibleWorkshop(workshop)) continue;
    seen.add(workshop.id);
    picks.push(workshop.id);
  }

  const resolvedFormat = resolveFormat(requestedFormat, employees, budget);
  const workshopExtras = picks.reduce((total, workshopId) => {
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
  const estimatedTotal = recommendedBundle
    ? getBundlePrice(recommendedBundle, commercialConfig) + workshopExtras
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
      ? budgetGap
        ? `${recommendedBundle.title} è il pacchetto più coerente; supera il budget indicato di ${budgetGap} €.`
        : `${recommendedBundle.title} è il pacchetto editoriale più coerente con le priorità indicate.`
      : budget === "under-2000"
        ? "Per il budget indicato proponiamo workshop singoli prioritari, senza vincolare il percorso a un pacchetto."
      : budgetGap
        ? `Nessun pacchetto copre bene questa combinazione: il percorso personalizzato supera il budget indicato di ${budgetGap} €.`
        : `Nessun pacchetto copre bene questa combinazione: abbiamo costruito una proposta sui workshop più coerenti.`,
  };
}
