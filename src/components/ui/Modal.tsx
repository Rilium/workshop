import React from "react";

export function ModalBackdrop({ children, labelledBy, className = "" }: { children: React.ReactNode; labelledBy: string; className?: string }) {
  return (
    <div className={("modal-backdrop " + className).trim()} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      {children}
    </div>
  );
}
