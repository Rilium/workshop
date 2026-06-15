import React from "react";

export function OperatorIdentityCard({
  identity,
}: {
  identity: { name: string; email: string; role: string; note: string };
}) {
  const initials = identity.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <section className="operator-identity-card" aria-label={`Utente ${identity.role}`}>
      <div className="operator-avatar">{initials}</div>
      <div className="operator-main">
        <span>{identity.role}</span>
        <strong>{identity.name}</strong>
        <em>{identity.email}</em>
      </div>
      <p>{identity.note}</p>
    </section>
  );
}
