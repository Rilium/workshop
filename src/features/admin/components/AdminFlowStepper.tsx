import React from "react";
import { Check } from "lucide-react";
import type { AdminWorkspacePanel } from "../../../types/domain";

export function AdminFlowStepper({
  steps,
  activeStep,
  completed,
  onStep,
}: {
  steps: ReadonlyArray<{ id: AdminWorkspacePanel; title: string; body: string }>;
  activeStep: AdminWorkspacePanel;
  completed: Record<AdminWorkspacePanel, boolean>;
  onStep: (step: AdminWorkspacePanel) => void;
}) {
  return (
    <nav className="admin-flow-stepper" aria-label="Flusso operativo FunniFin">
      {steps.map((step, index) => {
        const isDone = completed[step.id];
        const isActive = activeStep === step.id;
        return (
          <button
            key={step.id}
            className={`afs-tab ${isDone ? "afs-tab--done" : isActive ? "afs-tab--active" : "afs-tab--future"}`}
            onClick={() => onStep(step.id)}
          >
            <span className="afs-indicator">
              {isDone ? <Check size={11} /> : index + 1}
            </span>
            <span className="afs-copy">
              <strong>{step.title}</strong>
              <em>{step.body}</em>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
