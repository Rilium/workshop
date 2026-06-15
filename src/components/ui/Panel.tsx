import React from "react";

export function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div className="panel-title-main">
          {icon}
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}
