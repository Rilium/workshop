import React, { useState } from "react";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "../../AuthContext";

type LoginStep = "email" | "code";

export function LoginView({ onClose }: { onClose?: () => void }) {
  const { requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sendMail, setSendMail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await requestCode(email.trim(), { sendMail });
      if (result.pending) {
        setInfo("FunniFin ha preso in carico la richiesta. Riceverai il codice dopo l'approvazione.");
      } else if (sendMail) {
        setInfo("Se l'account è abilitato, riceverai un codice di accesso via email.");
      } else {
        setInfo("Codice generato da FunniFin. L'invio mail è stato lasciato disattivato.");
      }
      setStep("code");
    } catch {
      setInfo("FunniFin ha preso in carico la richiesta. Riceverai il codice dopo l'approvazione.");
      setStep("code");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      await verifyCode(email.trim(), code.trim());
      // Il contesto aggiorna currentUser → App mostrerà la vista corretta
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accesso non riuscito.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        {onClose && (
          <button type="button" className="login-back" style={{ alignSelf: "flex-start" }} onClick={onClose}>
            ← Torna alla vista Cliente
          </button>
        )}
        <div className="login-brand">
          <img src="/Logo.png" alt="FunniFin" className="login-logo" />
          <div>
            <strong>FunniFin Workshop Planner</strong>
            <span>Accesso riservato</span>
          </div>
        </div>

        {step === "email" && (
          <form className="login-form" onSubmit={handleEmailSubmit}>
            <p className="login-description">
              Inserisci il tuo indirizzo email. Se il tuo account è abilitato,
              riceverai un codice di accesso temporaneo.
            </p>
            <label className="login-label" htmlFor="login-email">
              <Mail size={16} />
              Email
            </label>
            <input
              id="login-email"
              className="login-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@azienda.it"
              autoComplete="email"
              required
              disabled={loading}
            />
            <label className="login-toggle" htmlFor="login-send-mail">
              <input
                id="login-send-mail"
                type="checkbox"
                checked={sendMail}
                onChange={(event) => setSendMail(event.target.checked)}
                disabled={loading}
              />
              <span>Manda mail con il codice</span>
            </label>
            <button
              type="submit"
              className="login-submit"
              disabled={loading || !email.trim()}
            >
              {loading ? "Invio in corso…" : "Continua"}
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {step === "code" && (
          <form className="login-form" onSubmit={handleCodeSubmit}>
            {info && <p className="login-info">{info}</p>}
            <p className="login-description">
              Inserisci il codice a 6 cifre ricevuto via email per{" "}
              <strong>{email}</strong>.
            </p>
            <label className="login-label" htmlFor="login-code">
              <ShieldCheck size={16} />
              Codice di accesso
            </label>
            <input
              id="login-code"
              className="login-input login-input-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              autoComplete="one-time-code"
              required
              disabled={loading}
              autoFocus
            />
            {error && <p className="login-error">{error}</p>}
            <button
              type="submit"
              className="login-submit"
              disabled={loading || code.length !== 6}
            >
              {loading ? "Verifica…" : "Accedi"}
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="login-back"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
                setInfo("");
              }}
            >
              ← Cambia email
            </button>
            <p className="login-dev-hint">
              <em>Phase 1 – codice demo: <strong>123456</strong></em>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
