import type { PricingRule } from "../types/domain";

export const initialRules: PricingRule[] = [
  { id: "single", name: "Workshop singolo", min: 1, max: 1, discountPercent: 0 },
  { id: "duo", name: "2 workshop a catalogo", min: 2, max: 2, discountPercent: 0 },
  { id: "basic", name: "Bundle Basic", min: 3, max: 3, discountPercent: 20 },
  { id: "advanced", name: "Percorso personalizzato", min: 4, max: 5, discountPercent: 0, specialQuote: true },
  { id: "full", name: "Percorso su preventivo", min: 6, max: 99, discountPercent: 0, specialQuote: true },
];
