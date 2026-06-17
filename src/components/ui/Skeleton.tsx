type SkeletonProps = {
  className?: string;
  label?: string;
  large?: boolean;
};

export function Skeleton({ className = "", label = "Sto caricando...", large = false }: SkeletonProps) {
  const showLabel = large || className.split(" ").includes("skeleton--large");
  return (
    <span className={`skeleton ${showLabel ? "skeleton--large" : ""} ${className}`.trim()} aria-hidden="true">
      {showLabel && <span className="skeleton-loading-label">{label}</span>}
    </span>
  );
}

export function SkeletonText({ lines = 2, className = "" }: SkeletonProps & { lines?: number }) {
  return (
    <span className={`skeleton-text ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={index === lines - 1 ? "skeleton-line short" : "skeleton-line"} />
      ))}
    </span>
  );
}

export function SkeletonCard({ className = "", lines = 2 }: SkeletonProps & { lines?: number }) {
  return (
    <span className={`skeleton-card ${className}`.trim()} aria-hidden="true">
      <Skeleton className="skeleton-kicker" />
      <Skeleton className="skeleton-title" />
      <SkeletonText lines={lines} />
    </span>
  );
}
