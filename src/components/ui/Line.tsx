import React from "react";

export function Line({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="line">
      <span>{label}</span>
      <strong className={good ? "good" : ""}>{value}</strong>
    </div>
  );
}
