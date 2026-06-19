import React, { useEffect, useRef } from "react";
import { Check } from "lucide-react";

export function Stepper({
  steps,
  activeStep,
  onStep,
  completedSteps,
  children,
}: {
  steps: string[];
  activeStep: string;
  onStep: (step: string) => void;
  /** If provided, a past step shows ✓ only if its name is in this set */
  completedSteps?: Set<string>;
  children?: React.ReactNode;
}) {
  const activeIndex = steps.indexOf(activeStep);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeStep]);

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
          const pastActive = index < activeIndex;
          const isDone = pastActive && (completedSteps ? completedSteps.has(step) : true);
          const isActive = index === activeIndex;
          return (
            <button
              key={step}
              ref={isActive ? activeTabRef : undefined}
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
          {children}
        </div>
      )}
    </div>
  );
}
