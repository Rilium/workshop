import React from "react";
import { ChevronLeft } from "../../components/ui/FaIcons";
import { AppButton } from "../ui/AppButton";

export function BottomActionBar({
  className,
  context,
  detail,
  priceBefore,
  priceAfter,
  discountLabel,
  caveat,
  primaryHint,
  leftContent,
  primaryLabel,
  primaryDisabled,
  primaryLoading,
  onPrimary,
  backLabel,
  onBack,
  secondaryLabel,
  onSecondary,
  secondaryLoading,
  secondaryDisabled,
  onSummaryClick,
  summaryAriaLabel,
}: {
  className?: string;
  context?: string;
  detail?: string;
  priceBefore?: string;
  priceAfter?: string;
  discountLabel?: string;
  caveat?: string;
  primaryHint?: string;
  leftContent?: React.ReactNode;
  primaryLabel: string;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  onPrimary: () => void;
  backLabel?: string;
  onBack?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryLoading?: boolean;
  secondaryDisabled?: boolean;
  onSummaryClick?: () => void;
  summaryAriaLabel?: string;
}) {
  const [primaryHintVisible, setPrimaryHintVisible] = React.useState(false);
  const primaryHintId = React.useId();
  const hasBack = Boolean(backLabel && onBack);
  const hasSecondary = Boolean(secondaryLabel && onSecondary);
  const showPrimaryHint = Boolean(primaryDisabled && primaryHint);
  const buttonsClassName = [
    "bottom-action-buttons",
    hasBack ? "bottom-action-buttons--with-back" : "",
    hasSecondary ? "bottom-action-buttons--with-secondary" : "",
  ].filter(Boolean).join(" ");

  React.useEffect(() => {
    if (!primaryHintVisible) return;
    const timeoutId = window.setTimeout(() => setPrimaryHintVisible(false), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [primaryHintVisible]);

  const handlePrimaryClick = () => {
    if (primaryDisabled) {
      if (primaryHint) setPrimaryHintVisible(true);
      return;
    }
    onPrimary();
  };

  return (
    <aside
      className={`bottom-action-bar ${showPrimaryHint ? "bottom-action-bar--with-hint" : ""} ${className ?? ""}`}
      aria-label="Azione principale"
    >
      {leftContent ?? (
        <div className="bottom-action-copy">
          <div>
            <span>{context}</span>
            <strong>{detail}</strong>
          </div>
          {priceAfter && (
            <div className="bottom-price-stack">
              {priceBefore && <del>{priceBefore}</del>}
              <strong>{priceAfter}</strong>
              {discountLabel && <small>{discountLabel}</small>}
            </div>
          )}
          {caveat && <em>{caveat}</em>}
        </div>
      )}
      <div className={buttonsClassName}>
        {hasBack && (
          <AppButton variant="ghost" className="bottom-back-btn" onClick={onBack} aria-label={backLabel} title={backLabel}>
            <ChevronLeft size={22} />
          </AppButton>
        )}
        {hasSecondary && (
          <AppButton variant="ghost" onClick={onSecondary} loading={secondaryLoading} disabled={secondaryDisabled}>
            {secondaryLabel}
          </AppButton>
        )}
        <div className="bottom-primary-group">
          <AppButton
            variant="primary"
            className="bottom-primary-action"
            onClick={handlePrimaryClick}
            disabled={primaryLoading}
            loading={primaryLoading}
            aria-disabled={primaryDisabled || undefined}
            aria-describedby={showPrimaryHint ? primaryHintId : undefined}
          >
            {primaryLabel}
          </AppButton>
          {showPrimaryHint && (
            <small
              id={primaryHintId}
              className={`bottom-bar-hint ${primaryHintVisible ? "is-visible" : ""}`}
              role="tooltip"
            >
              {primaryHint}
            </small>
          )}
        </div>
        {onSummaryClick && (
          <button
            type="button"
            className="bottom-summary-button"
            onClick={onSummaryClick}
            aria-label={summaryAriaLabel ?? "Apri riepilogo"}
            aria-haspopup="dialog"
          >
            Vedi percorso
          </button>
        )}
      </div>
    </aside>
  );
}
