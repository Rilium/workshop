import React from "react";
import { Trash2 } from "../../components/ui/FaIcons";
import { AppButton } from "./AppButton";

export function RemoveWorkshopButton({ onClick, label, compact }: { onClick: () => void; label: string; compact?: boolean }) {
  return (
    <AppButton variant="dangerIcon" className={compact ? "compact" : ""} onClick={onClick} aria-label={`Rimuovi ${label}`} title={`Rimuovi ${label}`}>
      <Trash2 size={compact ? 16 : 18} />
    </AppButton>
  );
}
