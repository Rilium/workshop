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
    const requestedBundleId = selections.find((selection) => selection.bundleId)?.bundleId;
    const activeBundle = bundles.find((bundle) => bundle.id === requestedBundleId && bundle.active);
    const bundleComplete = Boolean(
      activeBundle &&
      activeBundle.workshopIds.every((workshopId) =>
        selections.some((selection) => selection.workshopId === workshopId && selection.bundleId === activeBundle.id),
      ),
    );
    const bundleBase = bundleComplete && activeBundle
      ? selectedWorkshops
          .filter(({ selection }) => selection.bundleId === activeBundle.id)
          .reduce((total, { selection, workshop }) => total + getWorkshopSelectionPrice(workshop, selection, commercialConfig).base, 0)
      : 0;
    const quantityDiscount = bundleComplete && activeBundle ? Math.max(0, bundleBase - getBundlePrice(activeBundle, commercialConfig)) : 0;
    const rule: PricingRule = bundleComplete && activeBundle
      ? { id: activeBundle.id, name: activeBundle.title, min: activeBundle.size, max: activeBundle.size, discountPercent: bundleBase > 0 ? Math.round((quantityDiscount / bundleBase) * 100) : 0 }
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
      bundleId: bundleComplete ? activeBundle?.id : undefined,
      bundleTitle: bundleComplete ? activeBundle?.title : undefined,
    };
  }, [bundles, commercialConfig, rules, selections, workshops]);
}
