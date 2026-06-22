import React from "react";
import { ExternalLink } from "../../components/ui/FaIcons";

export function EventLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="event-link" href={href} target="_blank" rel="noreferrer" title={href}>
      <ExternalLink size={14} />
      <span>{label}</span>
    </a>
  );
}
