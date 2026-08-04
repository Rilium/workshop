import React from "react";
import { AppButton } from "./AppButton";

export function EmptyWorkflowState({
  title,
  body,
  cta,
  onClick,
}: {
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-state workflow-empty">
      <strong role="heading" aria-level={2}>{title}</strong>
      <span>{body}</span>
      <AppButton variant="secondary" onClick={onClick}>
        {cta}
      </AppButton>
    </div>
  );
}
