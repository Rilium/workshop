import React from "react";
import { ChevronLeft } from "lucide-react";
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
}) {
  const hasBack = Boolean(backLabel && onBack);
  const hasSecondary = Boolean(secondaryLabel && onSecondary);
  const buttonsClassName = [
    "bottom-action-buttons",
    hasBack ? "bottom-action-buttons--with-back" : "",
    hasSecondary ? "bottom-action-buttons--with-secondary" : "",
  ].filter(Boolean).join(" ");

  return (
    <aside className={`bottom-action-bar ${className ?? ""}`} aria-label="Azione principale">
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
          <AppButton variant="ghost" onClick={onSecondary} loading={secondaryLoading}>
            {secondaryLabel}
          </AppButton>
        )}
        <div className="bottom-primary-group">
          <AppButton variant="primary" onClick={onPrimary} disabled={primaryDisabled} loading={primaryLoading}>
            {primaryLabel}
          </AppButton>
          {primaryDisabled && primaryHint && (
            <small className="bottom-bar-hint">{primaryHint}</small>
          )}
        </div>
      </div>
    </aside>
  );
}
