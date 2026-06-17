import { useMemo } from "react";
import { BASIC_BUNDLE_WORKSHOP_IDS } from "../data/catalog";
import { initialRules } from "../data/pricing";
import type { PricingRule, Quote, Selection, Workshop } from "../types/domain";
import { getWorkshopSelectionPrice } from "../utils/workshop";

export function useQuote(selections: Selection[], workshops: Workshop[], rules: PricingRule[]): Quote {
  return useMemo(() => {
    const selectedWorkshops = selections
      .map((selection) => ({ selection, workshop: workshops.find((workshop) => workshop.id === selection.workshopId)! }))
      .filter(({ workshop }) => Boolean(workshop));
    const gross = selectedWorkshops.reduce((total, { selection, workshop }) => {
      const price = getWorkshopSelectionPrice(workshop, selection);
      return total + price.base + price.liveExtra;
    }, 0);
    const customTotal = selectedWorkshops.reduce((total, { selection, workshop }) => {
      return total + getWorkshopSelectionPrice(workshop, selection).customExtra;
    }, 0);
    const baseRule = rules.find((item) => selections.length >= item.min && selections.length <= item.max) ?? rules[0] ?? initialRules[0];
    const selectedIds = selectedWorkshops.map(({ workshop }) => workshop.id).sort();
    const isBasicBundle =
      selectedIds.length === BASIC_BUNDLE_WORKSHOP_IDS.length &&
      BASIC_BUNDLE_WORKSHOP_IDS.every((id, index) => selectedIds[index] === id);
    const allPackageable = selectedWorkshops.every(({ workshop }) => workshop.packageAvailable);
    const trioCustomRule: PricingRule = { id: "custom-trio", name: "Percorso personalizzato", min: 3, max: 3, discountPercent: 10, specialQuote: true };
    const rule = selections.length === 3 && allPackageable && !isBasicBundle ? trioCustomRule : baseRule;
    const catalogTargetPrice = isBasicBundle ? 2400 : selections.length === 3 && allPackageable ? 2700 : null;
    const quantityDiscount = catalogTargetPrice ? Math.max(0, gross - catalogTargetPrice) : Math.round((gross * rule.discountPercent) / 100);
    const promoDiscount = selectedWorkshops.reduce((total, { selection, workshop }) => {
      const price = getWorkshopSelectionPrice(workshop, selection);
      const base = price.base + price.liveExtra;
      return total + (selection.promo ? Math.round(base * 0.05) : 0);
    }, 0);
    return {
      gross,
      customTotal,
      rule,
      catalogTargetPrice,
      isBasicBundle,
      quantityDiscount,
      promoDiscount,
      total: gross - quantityDiscount - promoDiscount + customTotal,
      saved: quantityDiscount + promoDiscount,
    };
  }, [rules, selections, workshops]);
}
