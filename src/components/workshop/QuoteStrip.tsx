import React from "react";
import { Send } from "lucide-react";
import type { Quote, Selection } from "../../types/domain";
import { money } from "../../utils/money";
import { AppButton } from "../ui/AppButton";

export function QuoteStrip({
  selections,
  quote,
  coveredTopics,
  coveredThemes,
  totalHours,
  onCta,
  submitting = false,
}: {
  selections: Selection[];
  quote: Quote;
  coveredTopics: number;
  coveredThemes: number;
  totalHours: number;
  onCta?: () => void;
  submitting?: boolean;
}) {
  return (
    <section className="quote-strip">
      <div>
        <span>Workshop</span>
        <strong>{selections.length}</strong>
      </div>
      <div>
        <span>Topic</span>
        <strong>{coveredTopics}</strong>
      </div>
      <div>
        <span>Temi</span>
        <strong>{coveredThemes}</strong>
      </div>
      <div>
        <span>Durata</span>
        <strong>{totalHours}h</strong>
      </div>
      <div className="quote-strip-total">
        <span>{quote.rule.name}</span>
        <strong>{money(quote.total)}</strong>
      </div>
      <AppButton variant="secondary" onClick={onCta} loading={submitting} aria-label="Vai all'invio richiesta">
        <Send size={17} /> Vai all'invio
      </AppButton>
    </section>
  );
}
