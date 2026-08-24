import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Check, ChevronDown, SlidersHorizontal, Share2, Trash2, X } from "../../components/ui/FaIcons";
import type { CommercialConfig, Format, Quote, Selection, Workshop } from "../../types/domain";
import { money } from "../../utils/money";
import { formatDuration, getWorkshopSelectionPrice } from "../../utils/workshop";
import { AppButton } from "../ui/AppButton";
import { Line } from "../ui/Line";
import { RemoveWorkshopButton } from "../ui/RemoveWorkshopButton";

export function EcommerceCart({
  rows,
  quote,
  onRemove,
  onChange,
  onClear,
  onShare,
  submitting = false,
  commercialConfig,
  expanded,
  onExpandedChange,
}: {
  rows: Array<{ selection: Selection; workshop: Workshop }>;
  quote: Quote;
  onRemove: (workshopId: string) => void;
  onChange: (workshopId: string, patch: Partial<Selection>) => void;
  onClear: () => void;
  onShare: () => void | Promise<void>;
  submitting?: boolean;
  commercialConfig: CommercialConfig;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const cartRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
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
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExpandedChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded, onExpandedChange]);

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

  const totals = (
    <div className="cart-totals">
      <Line label="Subtotale workshop" value={money(quote.gross)} />
      {quote.bundleSummaries?.map((bundle) => (
        <Line key={bundle.id} label={bundle.title} value={`-${money(bundle.discount)}`} good />
      ))}
      {quote.promoDiscount > 0 && <Line label="Date promo" value={`-${money(quote.promoDiscount)}`} good />}
      {quote.customTotal > 0 && <Line label="Su misura" value={`+${money(quote.customTotal)}`} />}
      {quote.recordingDiscount > 0 && <Line label="Senza registrazione" value={`-${money(quote.recordingDiscount)}`} good />}
      <div className="total-line">
        <span>Totale indicativo</span>
        <strong>{money(quote.total)}</strong>
      </div>
      {quote.saved > 0 && <div className="saving">Risparmio incluso: {money(quote.saved)}</div>}
    </div>
  );

  const bundleSummary = Boolean(quote.bundleSummaries?.length) && (
    <div className="cart-bundle-summary">
      <span>{quote.bundleSummaries?.length === 1 ? "Pacchetto selezionato" : "Pacchetti selezionati"}</span>
      <div className="cart-bundle-list">
        {quote.bundleSummaries?.map((bundle) => (
          <div key={bundle.id}>
            <strong>{bundle.title}</strong>
            <small>-{money(bundle.discount)}</small>
          </div>
        ))}
      </div>
      {Boolean(quote.sharedBundleWorkshopCount) && (
        <small className="cart-bundle-note">
          {quote.sharedBundleWorkshopCount} {quote.sharedBundleWorkshopCount === 1 ? "workshop condiviso" : "workshop condivisi"}: una sola voce, sconti già inclusi.
        </small>
      )}
    </div>
  );

  const expandedDialog = expanded && createPortal(
    <div className="path-summary-backdrop" role="presentation" onMouseDown={() => onExpandedChange(false)}>
      <section
        className="path-summary-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="path-summary-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="path-summary-header">
          <div className="path-summary-heading">
            <span className="path-summary-icon" aria-hidden="true"><BookOpen size={22} /></span>
            <div>
              <span className="eyebrow">Riepilogo proposta</span>
              <h2 id="path-summary-title">Il tuo percorso</h2>
              <p>{rows.length} {rows.length === 1 ? "workshop selezionato" : "workshop selezionati"} · puoi modificarli prima di condividere.</p>
            </div>
          </div>
          <button ref={closeRef} type="button" className="path-summary-close" onClick={() => onExpandedChange(false)} aria-label="Chiudi riepilogo">
            <X size={21} />
          </button>
        </header>

        <div className="path-summary-content">
          <div className="path-summary-main">
            {rows.length === 0 ? (
              <div className="cart-empty path-summary-empty">
                <strong>Il percorso è ancora vuoto</strong>
                <span>Chiudi il riepilogo e aggiungi i workshop che ti interessano dal catalogo.</span>
              </div>
            ) : (
              <div className="path-workshop-list" aria-label="Workshop selezionati">
                {rows.map(({ selection, workshop }, index) => {
                  const price = getWorkshopSelectionPrice(workshop, selection, commercialConfig);
                  return (
                    <article className="path-workshop-row" key={workshop.id}>
                      <span className="path-workshop-index" aria-hidden="true">{index + 1}</span>
                      <div className="path-workshop-copy">
                        <strong>{workshop.title}</strong>
                        <span>{formatDuration(selection.duration)} · {selection.format} · {selection.recordingIncluded === false ? "senza registrazione" : "registrazione inclusa"}</span>
                        <div className="path-workshop-tags">
                          {price.liveExtra > 0 && <small>Live +{money(price.liveExtra)}</small>}
                          {selection.custom && <small>Su misura +{money(commercialConfig.customExtra)}</small>}
                          {selection.promo && <small className="is-saving">Promo data</small>}
                        </div>
                        <details className="path-workshop-config">
                          <summary>
                            <span><SlidersHorizontal size={15} /> Modifica dettagli</span>
                            <ChevronDown size={16} aria-hidden="true" />
                          </summary>
                          <div className="path-workshop-config-body">
                            <label>
                              <span>Durata</span>
                              <select
                                value={selection.duration}
                                onChange={(event) => onChange(workshop.id, { duration: event.target.value as Selection["duration"] })}
                              >
                                {workshop.durationOptions.map((duration) => <option key={duration} value={duration}>{formatDuration(duration)}</option>)}
                              </select>
                            </label>
                            <label>
                              <span>Modalità</span>
                              <select
                                value={selection.format}
                                onChange={(event) => onChange(workshop.id, { format: event.target.value as Format })}
                              >
                                {workshop.formatOptions.map((format) => (
                                  <option key={format} value={format}>
                                    {format === "webinar" ? "Online" : "In presenza"}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="path-workshop-check">
                              <input
                                type="checkbox"
                                checked={selection.recordingIncluded !== false}
                                onChange={(event) => onChange(workshop.id, { recordingIncluded: event.target.checked })}
                              />
                              <span>
                                <strong>Registrazione inclusa</strong>
                                <small>{selection.recordingIncluded === false ? `Esclusa: -${money(commercialConfig.recordingOptOutDiscount)}` : "Inclusa nel prezzo"}</small>
                              </span>
                            </label>
                            {workshop.customAvailable && (
                              <div className={`path-workshop-custom ${selection.custom ? "active" : ""}`}>
                                <button
                                  type="button"
                                  onClick={() => onChange(workshop.id, {
                                    custom: !selection.custom,
                                    ...(selection.custom ? { customNote: "" } : {}),
                                  })}
                                  aria-pressed={selection.custom}
                                >
                                  <span>{selection.custom && <Check size={14} />}</span>
                                  <strong>Rendi su misura</strong>
                                  <em>+{money(commercialConfig.customExtra)}</em>
                                </button>
                                {selection.custom && (
                                  <label>
                                    <span>Note per FunniFin</span>
                                    <textarea
                                      value={selection.customNote ?? ""}
                                      onChange={(event) => onChange(workshop.id, { customNote: event.target.value })}
                                      placeholder="Platea, tono, esempi o obiettivi da considerare…"
                                      rows={2}
                                    />
                                  </label>
                                )}
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                      <div className="path-workshop-price">
                        <strong>{money(price.total)}</strong>
                        <RemoveWorkshopButton onClick={() => onRemove(workshop.id)} label={workshop.title} compact />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="path-summary-aside" aria-label="Totale proposta">
            {bundleSummary}
            {totals}
            <p className="path-summary-note">Non è un acquisto: il totale è una stima della proposta da inviare a FunniFin.</p>
          </aside>
        </div>

        <footer className="path-summary-footer">
          {rows.length > 0 && (
            <button type="button" className={`cart-clear-btn path-clear-btn ${clearArmed ? "confirm" : ""}`} onClick={handleClear}>
              <Trash2 size={16} /> {clearArmed ? "Conferma svuota" : "Svuota percorso"}
            </button>
          )}
          <div>
            <AppButton variant="secondary" onClick={() => onExpandedChange(false)}>Continua a scegliere</AppButton>
            <AppButton onClick={onShare} disabled={rows.length === 0} loading={submitting} loadingText="Preparo">
              <Share2 size={16} /> Condividi proposta
            </AppButton>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );

  return (
    <>
      <aside ref={cartRef} className="ecommerce-cart" aria-label="Riepilogo del percorso workshop">
        <div className="cart-compact-head">
          <span className="cart-compact-icon" aria-hidden="true"><BookOpen size={20} /></span>
          <div>
            <span>Il tuo percorso</span>
            <strong>{rows.length} {rows.length === 1 ? "workshop" : "workshop"}</strong>
          </div>
        </div>

        <div className="cart-compact-total">
          <span>Totale indicativo</span>
          <strong>{money(quote.total)}</strong>
          {quote.saved > 0 && <small>Hai già ottimizzato {money(quote.saved)}</small>}
        </div>

        <div className="cart-compact-preview">
          {rows.length === 0 ? (
            <div className="cart-empty">
              <strong>Inizia il tuo percorso</strong>
              <span>Aggiungi workshop dal catalogo: potrai rivederli tutti qui.</span>
            </div>
          ) : (
            <ol>
              {rows.slice(0, 3).map(({ workshop }) => <li key={workshop.id}>{workshop.title}</li>)}
            </ol>
          )}
          {rows.length > 3 && <small className="cart-more-count">+ altri {rows.length - 3} workshop</small>}
        </div>

        <button type="button" className="cart-expand-button" onClick={() => onExpandedChange(true)} aria-haspopup="dialog">
          <span>Vedi riepilogo completo</span>
          <ChevronDown size={18} />
        </button>

        <AppButton
          variant="secondary"
          className="cart-share-btn"
          onClick={onShare}
          disabled={rows.length === 0}
          loading={submitting}
          loadingText="Preparo"
        >
          <Share2 size={15} /> Condividi proposta
        </AppButton>
      </aside>
      {expandedDialog}
    </>
  );
}
