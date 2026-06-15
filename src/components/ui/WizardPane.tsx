import React from "react";

export function WizardPane({ children }: { children: React.ReactNode }) {
  return (
    <div className="wizard-pane">
      {children}
    </div>
  );
}
