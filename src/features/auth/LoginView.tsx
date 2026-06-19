import React, { useState } from "react";
import { ArrowRight, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "../../AuthContext";
import { AppButton } from "../../components/ui/AppButton";

type LoginStep = "email" | "code";

export function LoginView({ onClose }: { onClose?: () => void }) {
  const { requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const goToCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setInfo("");
    setStep("code");
  };

  const handleResendCode = async () => {
    setResending(true);
    setError("");
    try {
      const result = await requestCode(email.trim(), { sendMail: true });
      if (result.pending) {
        setInfo("FunniFin ha preso in carico la richiesta. Riceverai il codice dopo l'approvazione.");
      } else {
        setInfo("Codice inviato via email.");
      }
    } catch {
      setInfo("Richiesta presa in carico. Riceverai il codice se l'account è abilitato.");
    } finally {
      setResending(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      await verifyCode(email.trim(), code.trim());
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
          <form className="login-form" onSubmit={goToCode}>
            <p className="login-description">
              Inserisci il tuo indirizzo email e il codice ricevuto da FunniFin.
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
            <button
              type="submit"
              className="login-submit"
              disabled={!email.trim()}
            >
              Continua
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {step === "code" && (
          <form className="login-form" onSubmit={handleCodeSubmit}>
            {info && <p className="login-info">{info}</p>}
            <p className="login-description">
              Inserisci il codice di accesso gia ricevuto per <strong>{email}</strong>.
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
            <AppButton
              type="submit"
              variant="primary"
              className="login-submit"
              disabled={loading || code.length !== 6}
              loading={loading}
              rightIcon={<ArrowRight size={16} />}
            >
              Accedi
            </AppButton>
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
            <AppButton
              type="button"
              variant="ghost"
              className="login-back"
              onClick={handleResendCode}
              disabled={resending}
              loading={resending}
              leftIcon={<RefreshCw size={13} />}
            >
              Non hai il codice? Invialo via email
            </AppButton>
          </form>
        )}
      </div>
    </div>
  );
}
