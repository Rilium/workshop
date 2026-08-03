import type { CommercialConfig, PricingRule } from "../types/domain";

export const LIVE_FORMAT_EXTRA = 500;
export const RECORDING_OPT_OUT_DISCOUNT = 100;
export const DEFAULT_WORKSHOP_PRICE = 1000;
export const BUNDLE_PRICES: Record<3 | 6 | 10, number> = {
  3: 2500,
  6: 4500,
  10: 6900,
};

export const defaultCommercialConfig: CommercialConfig = {
  workshopBasePrice: DEFAULT_WORKSHOP_PRICE,
  inPersonExtra: LIVE_FORMAT_EXTRA,
  customExtra: 500,
  recordingOptOutDiscount: RECORDING_OPT_OUT_DISCOUNT,
  recordingDefault: true,
  bundlePrices: BUNDLE_PRICES,
  outcomeSizes: {
    sensibilizzazione: 3,
    avanzata: 6,
    completa: 10,
  },
};

export const initialRules: PricingRule[] = [
  { id: "a-la-carte", name: "Workshop à-la-carte", min: 1, max: 99, discountPercent: 0 },
];
