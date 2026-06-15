import React from "react";
import { Check } from "lucide-react";

export function Stepper({
  steps,
  activeStep,
  onStep,
  children,
}: {
  steps: string[];
  activeStep: string;
  onStep: (step: string) => void;
  children?: React.ReactNode;
}) {
  const activeIndex = steps.indexOf(activeStep);

  const cardRadius = (() => {
    const r = "12px";
    if (activeIndex === 0) return `0 ${r} ${r} ${r}`;
    if (activeIndex === steps.length - 1) return `${r} 0 ${r} ${r}`;
    return `${r} ${r} ${r} ${r}`;
  })();

  return (
    <div className="ff-stepper">
      <div className="ff-stepper-tabs">
        {steps.map((step, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          const isFuture = index > activeIndex;
          return (
            <button
              key={step}
              className={`ff-tab ${isDone ? "ff-tab--done" : isActive ? "ff-tab--active" : "ff-tab--future"}`}
              onClick={() => onStep(step)}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="ff-tab-indicator">
                {isDone ? <Check size={11} /> : index + 1}
              </span>
              <span className="ff-tab-label">{step}</span>
            </button>
          );
        })}
      </div>
      {children != null && (
        <div className="ff-stepper-card" style={{ borderRadius: cardRadius }}>
          <p className="ff-stepper-eyebrow">Step {activeIndex + 1} — {activeStep}</p>
          {children}
        </div>
      )}
    </div>
  );
}
