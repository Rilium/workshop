import React from "react";

export function OperationalStrip({
  label,
  items,
}: {
  label: string;
  items: Array<{ id: string; label: string; value: number | string; icon: React.ReactNode; active?: boolean; onClick: () => void }>;
}) {
  return (
    <div className="operational-strip" aria-label={label}>
      {items.map((item) => (
        <button key={item.id} className={item.active ? "active" : ""} onClick={item.onClick}>
          {item.icon}
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </button>
      ))}
    </div>
  );
}
