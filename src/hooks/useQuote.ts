import { useMemo } from "react";
import { defaultCommercialConfig } from "../data/pricing";
import type { CatalogBundle, CommercialConfig, PricingRule, Quote, Selection, Workshop } from "../types/domain";
import { getBundlePrice, getWorkshopSelectionPrice } from "../utils/workshop";

export function useQuote(
  selections: Selection[],
  workshops: Workshop[],
  rules: PricingRule[],
  commercialConfig: CommercialConfig = defaultCommercialConfig,
  bundles: CatalogBundle[] = [],
): Quote {
  return useMemo(() => {
    const selectedWorkshops = selections
      .map((selection) => ({ selection, workshop: workshops.find((workshop) => workshop.id === selection.workshopId)! }))
      .filter(({ workshop }) => Boolean(workshop));
    const gross = selectedWorkshops.reduce((total, { selection, workshop }) => {
      const price = getWorkshopSelectionPrice(workshop, selection, commercialConfig);
      return total + price.base + price.liveExtra;
    }, 0);
    const customTotal = selectedWorkshops.reduce((total, { selection, workshop }) => {
      return total + getWorkshopSelectionPrice(workshop, selection, commercialConfig).customExtra;
    }, 0);
    const recordingDiscount = selectedWorkshops.reduce(
      (total, { selection, workshop }) => total + getWorkshopSelectionPrice(workshop, selection, commercialConfig).recordingDiscount,
      0,
    );
    const requestedBundleIds = Array.from(new Set(selections.flatMap((selection) =>
      selection.bundleIds ?? (selection.bundleId ? [selection.bundleId] : []),
    )));
    const activeBundles = bundles.filter((bundle) =>
      bundle.active &&
      requestedBundleIds.includes(bundle.id) &&
      bundle.workshopIds.every((workshopId) =>
        selections.some((selection) =>
          selection.workshopId === workshopId &&
          (selection.bundleIds ?? (selection.bundleId ? [selection.bundleId] : [])).includes(bundle.id),
        ),
      ),
    );
    const bundleSummaries = activeBundles.map((bundle) => {
      const bundleBase = selectedWorkshops
        .filter(({ selection }) =>
          (selection.bundleIds ?? (selection.bundleId ? [selection.bundleId] : [])).includes(bundle.id),
        )
        .reduce((total, { selection, workshop }) => total + getWorkshopSelectionPrice(workshop, selection, commercialConfig).base, 0);
      return { id: bundle.id, title: bundle.title, discount: Math.max(0, bundleBase - getBundlePrice(bundle, commercialConfig)) };
    });
    const sharedBundleWorkshopCount = selectedWorkshops.filter(({ selection }) => {
      const membershipIds = selection.bundleIds ?? (selection.bundleId ? [selection.bundleId] : []);
      return membershipIds.filter((bundleId) => activeBundles.some((bundle) => bundle.id === bundleId)).length > 1;
    }).length;
    const quantityDiscount = bundleSummaries.reduce((total, bundle) => total + bundle.discount, 0);
    const rule: PricingRule = activeBundles.length > 0
      ? {
          id: activeBundles.map((bundle) => bundle.id).join("+"),
          name: activeBundles.length === 1 ? activeBundles[0].title : `${activeBundles.length} pacchetti selezionati`,
          min: activeBundles.reduce((total, bundle) => total + bundle.size, 0),
          max: activeBundles.reduce((total, bundle) => total + bundle.size, 0),
          discountPercent: gross > 0 ? Math.round((quantityDiscount / gross) * 100) : 0,
        }
      : { id: "a-la-carte", name: "Workshop à-la-carte", min: 1, max: 99, discountPercent: 0 };
    const promoDiscount = selectedWorkshops.reduce((total, { selection, workshop }) => {
      const price = getWorkshopSelectionPrice(workshop, selection, commercialConfig);
      const base = price.base + price.liveExtra;
      return total + (selection.promo ? Math.round(base * 0.05) : 0);
    }, 0);
    return {
      gross,
      customTotal,
      rule,
      catalogTargetPrice: null,
      isBasicBundle: false,
      quantityDiscount,
      promoDiscount,
      total: Math.max(0, gross - quantityDiscount - promoDiscount + customTotal - recordingDiscount),
      saved: quantityDiscount + promoDiscount + recordingDiscount,
      recordingDiscount,
      bundleId: activeBundles[0]?.id,
      bundleTitle: activeBundles.length === 1 ? activeBundles[0].title : activeBundles.length > 1 ? `${activeBundles.length} pacchetti selezionati` : undefined,
      bundleIds: activeBundles.map((bundle) => bundle.id),
      bundleTitles: activeBundles.map((bundle) => bundle.title),
      bundleSummaries,
      sharedBundleWorkshopCount,
    };
  }, [bundles, commercialConfig, rules, selections, workshops]);
}
