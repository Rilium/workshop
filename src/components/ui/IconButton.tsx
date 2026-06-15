import React from "react";

export function ToolIconButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button className={`tool-icon-btn ${active ? "active" : ""}`} onClick={onClick} aria-label={label} title={label}>
      {children}
    </button>
  );
}

export function ActionIconButton({
  variant = "neutral",
  onClick,
  label,
  children,
  disabled = false,
}: {
  variant?: "neutral" | "success" | "danger";
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button className={`action-icon-btn ${variant}`} onClick={onClick} aria-label={label} title={label} disabled={disabled}>
      {children}
    </button>
  );
}
