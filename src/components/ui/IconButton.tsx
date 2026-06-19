import React from "react";
import { Loader2 } from "lucide-react";

function IconButtonSpinner({ size = 18 }: { size?: number }) {
  return <Loader2 className="app-btn-spinner" size={size} aria-hidden="true" />;
}

export function ToolIconButton({
  active,
  onClick,
  label,
  children,
  className = "",
  disabled = false,
  loading = false,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      className={`tool-icon-btn ${active ? "active" : ""} ${loading ? "app-btn-loading" : ""} ${className}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <IconButtonSpinner /> : children}
    </button>
  );
}

export function ActionIconButton({
  variant = "neutral",
  onClick,
  label,
  children,
  disabled = false,
  loading = false,
}: {
  variant?: "neutral" | "success" | "danger";
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      className={`action-icon-btn ${variant} ${loading ? "app-btn-loading" : ""}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <IconButtonSpinner /> : children}
    </button>
  );
}
