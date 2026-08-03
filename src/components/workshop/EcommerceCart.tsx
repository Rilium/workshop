import React, { useEffect, useRef, useState } from "react";
import { Share2, Trash2 } from "../../components/ui/FaIcons";
import type { CommercialConfig, Quote, Selection, Workshop } from "../../types/domain";
import { money } from "../../utils/money";
import { getWorkshopSelectionPrice } from "../../utils/workshop";
import { AppButton } from "../ui/AppButton";
import { Line } from "../ui/Line";
import { RemoveWorkshopButton } from "../ui/RemoveWorkshopButton";

export function EcommerceCart({
  rows,
  quote,
  onRemove,
  onClear,
  onShare,
  submitting = false,
  commercialConfig,
}: {
  rows: Array<{ selection: Selection; workshop: Workshop }>;
  quote: Quote;
  onRemove: (workshopId: string) => void;
  onClear: () => void;
  onShare: () => void | Promise<void>;
  submitting?: boolean;
  commercialConfig: CommercialConfig;
}) {
  const cartRef = useRef<HTMLElement | null>(null);
  const [clearArmed, setClearArmed] = useState(false);

  useEffect(() => {
    const updateCartHeight = () => {
      const node = cartRef.current;
      if (!node) return;
      const top = Math.max(8, Math.round(node.getBoundingClientRect().top));
      node.style.setProperty("--cart-visible-top", `${top}px`);
    };
    updateCartHeight();
    window.addEventListener("resize", updateCartHeight);
    window.addEventListener("scroll", updateCartHeight, { passive: true });
    return () => {
      window.removeEventListener("resize", updateCartHeight);
      window.removeEventListener("scroll", updateCartHeight);
    };
  }, [rows.length]);

  useEffect(() => {
    if (!clearArmed) return;
    const timer = window.setTimeout(() => setClearArmed(false), 2600);
    return () => window.clearTimeout(timer);
  }, [clearArmed]);

  useEffect(() => {
    if (rows.length === 0) setClearArmed(false);
  }, [rows.length]);

  const handleClear = () => {
    if (!clearArmed) {
      setClearArmed(true);
      return;
    }
    onClear();
    setClearArmed(false);
  };

  return (
    <aside ref={cartRef} className="ecommerce-cart" aria-label="Carrello workshop">
      <div className="cart-head">
        <div className="cart-head-copy">
          <div className="cart-title-row">
            <span>Carrello</span>
            <div className="cart-head-actions">
              <AppButton
                variant="secondary"
                size="small"
                className="cart-share-btn"
                onClick={onShare}
                disabled={rows.length === 0}
                loading={submitting}
                loadingText="Preparo"
                aria-label="Condividi carrello workshop"
              >
                <Share2 size={15} /> Condividi
              </AppButton>
              {rows.length > 0 && (
                <button
                  type="button"
                  className={`cart-clear-btn ${clearArmed ? "confirm" : ""}`}
                  onClick={handleClear}
                  aria-label={clearArmed ? "Conferma svuota carrello" : "Svuota carrello"}
                  title={clearArmed ? "Premi di nuovo per confermare" : "Svuota carrello"}
                >
                  <Trash2 size={15} />
                  {clearArmed && <span>Conferma</span>}
                </button>
              )}
            </div>
          </div>
          <strong>{rows.length} workshop</strong>
          {rows.length > 0 && <small>Pronto da condividere</small>}
        </div>
        <div className="cart-head-total">
          <strong>{money(quote.total)}</strong>
        </div>
      </div>

      <>
        {quote.bundleTitle && (
          <div className="cart-bundle-summary">
            <span>Pacchetto selezionato</span>
            <strong>{quote.bundleTitle}</strong>
            <small>Composizione ufficiale · prezzo dedicato applicato</small>
          </div>
        )}
        <div className="cart-lines">
            {rows.length === 0 && (
              <div className="cart-empty">
                <strong>Il percorso è vuoto</strong>
                <span>Aggiungi workshop dal catalogo per costruire il tuo percorso formativo.</span>
              </div>
            )}
            {rows.map(({ selection, workshop }) => {
              const price = getWorkshopSelectionPrice(workshop, selection, commercialConfig);
              return (
                <div className="cart-line" key={workshop.id}>
                  <div>
                    <strong>{workshop.title}</strong>
                    <span>
                      {selection.duration} · {selection.format}
                      {price.liveExtra > 0 ? ` · live +${money(price.liveExtra)}` : ""}
                      {selection.custom ? ` · su misura +${money(commercialConfig.customExtra)}` : ""}
                      {selection.recordingIncluded === false ? ` · senza registrazione -${money(price.recordingDiscount)}` : " · registrazione inclusa"}
                      {selection.promo ? " · promo data" : ""}
                    </span>
                  </div>
                  <div className="cart-line-price">
                    <strong>{money(price.total)}</strong>
                    <RemoveWorkshopButton onClick={() => onRemove(workshop.id)} label={workshop.title} compact />
                  </div>
                </div>
              );
            })}
        </div>

        <div className="cart-totals">
            <Line label="Subtotale workshop" value={money(quote.gross)} />
            {quote.quantityDiscount > 0 && <Line label={quote.rule.name} value={`-${money(quote.quantityDiscount)}`} good />}
            {quote.promoDiscount > 0 && <Line label="Date promo" value={`-${money(quote.promoDiscount)}`} good />}
            {quote.customTotal > 0 && <Line label="Su misura" value={`+${money(quote.customTotal)}`} />}
            {quote.recordingDiscount > 0 && <Line label="Senza registrazione" value={`-${money(quote.recordingDiscount)}`} good />}
            <div className="total-line">
              <span>Totale</span>
              <strong>{money(quote.total)}</strong>
            </div>
            {quote.saved > 0 && <div className="saving">Risparmio: {money(quote.saved)}</div>}
        </div>
      </>

    </aside>
  );
}
