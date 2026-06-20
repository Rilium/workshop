import React, { useEffect, useRef } from "react";
import { Share2 } from "lucide-react";
import type { Quote, Selection, Workshop } from "../../types/domain";
import { money } from "../../utils/money";
import { getWorkshopSelectionPrice } from "../../utils/workshop";
import { AppButton } from "../ui/AppButton";
import { Line } from "../ui/Line";
import { RemoveWorkshopButton } from "../ui/RemoveWorkshopButton";

export function EcommerceCart({
  rows,
  quote,
  onRemove,
  onShare,
  submitting = false,
}: {
  rows: Array<{ selection: Selection; workshop: Workshop }>;
  quote: Quote;
  onRemove: (workshopId: string) => void;
  onShare: () => void | Promise<void>;
  submitting?: boolean;
}) {
  const cartRef = useRef<HTMLElement | null>(null);

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

  return (
    <aside ref={cartRef} className="ecommerce-cart" aria-label="Carrello workshop">
      <button className="cart-head" type="button">
        <div>
          <span>Carrello</span>
          <strong>{rows.length} workshop</strong>
          {rows.length > 0 && <small>Pronto da condividere</small>}
        </div>
        <div className="cart-head-total">
          <strong>{money(quote.total)}</strong>
        </div>
      </button>

      <>
        <div className="cart-lines">
            {rows.length === 0 && (
              <div className="cart-empty">
                <strong>Il percorso è vuoto</strong>
                <span>Aggiungi workshop dal catalogo per costruire il tuo percorso formativo.</span>
              </div>
            )}
            {rows.map(({ selection, workshop }) => {
              const price = getWorkshopSelectionPrice(workshop, selection);
              return (
                <div className="cart-line" key={workshop.id}>
                  <div>
                    <strong>{workshop.title}</strong>
                    <span>
                      {selection.duration} · {selection.format}
                      {price.liveExtra > 0 ? ` · live +${money(price.liveExtra)}` : ""}
                      {selection.custom ? ` · su misura +${money(workshop.customExtra)}` : ""}
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
            <div className="total-line">
              <span>Totale</span>
              <strong>{money(quote.total)}</strong>
            </div>
            {quote.saved > 0 && <div className="saving">Risparmio: {money(quote.saved)}</div>}
        </div>
      </>

      <div className="cart-submit-row">
        <AppButton
          variant="secondary"
          onClick={onShare}
          disabled={rows.length === 0}
          loading={submitting}
          loadingText="Preparo immagine"
          aria-label="Condividi carrello workshop"
        >
          <Share2 size={17} /> Condividi
        </AppButton>
      </div>
    </aside>
  );
}
