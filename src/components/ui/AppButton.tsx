import React from "react";
import { Loader2 } from "lucide-react";
import type { ButtonVariant } from "../../types/ui";

export function AppButton({
  variant = "primary",
  children,
  className = "",
  loading = false,
  ...props
}: {
  variant?: ButtonVariant;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`app-btn app-btn-${variant} ${loading ? "app-btn-loading" : ""} ${className}`} disabled={props.disabled || loading} {...props}>
      {loading && <Loader2 size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}
