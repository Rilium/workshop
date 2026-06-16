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
  leftContent,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  backLabel,
  onBack,
  secondaryLabel,
  onSecondary,
}: {
  className?: string;
  context?: string;
  detail?: string;
  priceBefore?: string;
  priceAfter?: string;
  discountLabel?: string;
  caveat?: string;
  leftContent?: React.ReactNode;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  backLabel?: string;
  onBack?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
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
      <div className="bottom-action-buttons">
        {backLabel && onBack && (
          <AppButton variant="ghost" className="bottom-back-btn" onClick={onBack} aria-label={backLabel} title={backLabel}>
            <ChevronLeft size={22} />
          </AppButton>
        )}
        {secondaryLabel && onSecondary && (
          <AppButton variant="ghost" onClick={onSecondary}>
            {secondaryLabel}
          </AppButton>
        )}
        <AppButton variant="primary" onClick={onPrimary} disabled={primaryDisabled}>
          {primaryLabel}
        </AppButton>
      </div>
    </aside>
  );
}
