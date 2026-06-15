import React from "react";
import type { ButtonVariant } from "../../types/ui";

export function AppButton({
  variant = "primary",
  children,
  className = "",
  ...props
}: {
  variant?: ButtonVariant;
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`app-btn app-btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
