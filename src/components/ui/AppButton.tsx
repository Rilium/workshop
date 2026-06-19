import React from "react";
import { Loader2 } from "lucide-react";
import type { ButtonVariant } from "../../types/ui";

type AppButtonSize = "small" | "default" | "large";

function buttonSpinnerSize(size: AppButtonSize) {
  if (size === "small") return 14;
  if (size === "large") return 18;
  return 16;
}

function isIconOnly(children: React.ReactNode) {
  const visibleChildren = React.Children.toArray(children).filter((child) => {
    if (typeof child === "string") return child.trim().length > 0;
    return child !== null && child !== undefined;
  });
  return visibleChildren.length === 1 && React.isValidElement(visibleChildren[0]);
}

function LoadingSpinner({ size }: { size: AppButtonSize }) {
  return <Loader2 className="app-btn-spinner" size={buttonSpinnerSize(size)} aria-hidden="true" />;
}

export function AppButton({
  variant = "primary",
  children,
  className = "",
  loading,
  loadingText,
  size = "default",
  leftIcon,
  rightIcon,
  ...props
}: {
  variant?: ButtonVariant;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  loadingText?: React.ReactNode;
  size?: AppButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const isLoading = Boolean(loading);
  const isLoadable = loading !== undefined;
  const disabled = props.disabled || isLoading;
  const content = loadingText && isLoading ? loadingText : children;
  const explicitIcon = leftIcon || rightIcon;
  const childArray = React.Children.toArray(content);
  const firstChild = childArray[0];
  const firstChildIsIcon = !explicitIcon && React.isValidElement(firstChild);
  const iconOnly = !explicitIcon && isIconOnly(content);
  const buttonClasses = [
    "app-btn",
    `app-btn-${variant}`,
    `app-btn-size-${size}`,
    isLoadable ? "app-btn-loadable" : "",
    isLoading ? "app-btn-loading" : "",
    iconOnly ? "app-btn-icon-only" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button {...props} className={buttonClasses} disabled={disabled} aria-busy={isLoading || undefined}>
      {leftIcon && <span className="app-btn-icon-slot">{isLoading ? <LoadingSpinner size={size} /> : leftIcon}</span>}
      {!leftIcon && isLoadable && !firstChildIsIcon && !iconOnly && (
        <span className="app-btn-icon-slot" aria-hidden={!isLoading}>
          {isLoading ? <LoadingSpinner size={size} /> : <span className="app-btn-spinner-placeholder" />}
        </span>
      )}
      {!leftIcon && firstChildIsIcon && (
        <span className="app-btn-icon-slot">{isLoading ? <LoadingSpinner size={size} /> : firstChild}</span>
      )}
      {!leftIcon && iconOnly ? (
        isLoading ? <LoadingSpinner size={size} /> : content
      ) : firstChildIsIcon ? (
        childArray.slice(1)
      ) : (
        content
      )}
      {rightIcon && <span className="app-btn-icon-slot app-btn-icon-slot-right">{isLoading ? <LoadingSpinner size={size} /> : rightIcon}</span>}
    </button>
  );
}
