import React from "react";
import { reportClientError } from "../../clientTelemetry";
import { AppButton } from "./AppButton";

type AppErrorBoundaryState = { failed: boolean };

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportClientError(error, {
      boundary: "AppErrorBoundary",
      componentStack: info.componentStack ?? "",
      source: "react.error-boundary",
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="fatal-error-shell" role="alert" aria-labelledby="fatal-error-title">
        <section className="panel fatal-error-card">
          <span className="eyebrow">Errore applicazione</span>
          <h1 id="fatal-error-title">Non riusciamo a mostrare il percorso</h1>
          <p>L’errore è stato registrato senza includere i dati inseriti nel form. Ricarica la pagina per riprendere il draft salvato.</p>
          <AppButton variant="primary" onClick={() => window.location.reload()}>
            Ricarica pagina
          </AppButton>
        </section>
      </main>
    );
  }
}
