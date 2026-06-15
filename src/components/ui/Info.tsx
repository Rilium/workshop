import React from "react";

export function Info({ label, value }: { label: string; value: React.ReactNode }) {
  const caveatValue = typeof value === "string" && /da assegnare|da scegliere/i.test(value);
  return (
    <div className="info">
      <span>{label}</span>
      <strong className={caveatValue ? "caveat-value" : ""}>{value}</strong>
    </div>
  );
}
