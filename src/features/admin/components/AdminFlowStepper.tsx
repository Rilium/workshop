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
    <nav className="ff-stepper admin-flow-stepper" aria-label="Flusso operativo FunniFin">
      <div className="ff-stepper-tabs">
        {steps.map((step, index) => {
          const isDone = completed[step.id];
          const isActive = activeStep === step.id;
          return (
            <button
              key={step.id}
              className={`ff-tab ${isActive ? "ff-tab--active" : isDone ? "ff-tab--done" : "ff-tab--future"}`}
              onClick={() => onStep(step.id)}
              aria-current={isActive ? "step" : undefined}
              title={step.body}
            >
              <span className="ff-tab-indicator">
                {isDone ? <Check size={11} /> : index + 1}
              </span>
              <span className="ff-tab-label">{step.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
