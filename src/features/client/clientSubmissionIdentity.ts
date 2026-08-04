export const CLIENT_SUBMISSION_STORAGE_KEY = "funnifin_client_submission_v1";

export type ClientSubmissionIdentity = {
  requestId: string;
  clientMutationId: string;
  createdAt: string;
};

let volatileIdentity: ClientSubmissionIdentity | null = null;

function requestSlug(company: string) {
  return company
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "cliente";
}

function loadIdentity(): ClientSubmissionIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CLIENT_SUBMISSION_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ClientSubmissionIdentity>;
    return value.requestId && value.clientMutationId && value.createdAt
      ? value as ClientSubmissionIdentity
      : null;
  } catch {
    return null;
  }
}

export function getOrCreateClientSubmissionIdentity(company: string): ClientSubmissionIdentity {
  const stored = loadIdentity() ?? volatileIdentity;
  if (stored) return stored;
  const clientMutationId = crypto.randomUUID();
  const identity: ClientSubmissionIdentity = {
    requestId: `${requestSlug(company)}-${Date.now()}-${clientMutationId.slice(0, 8)}`,
    clientMutationId,
    createdAt: new Date().toISOString(),
  };
  volatileIdentity = identity;
  try {
    window.sessionStorage.setItem(CLIENT_SUBMISSION_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Mantiene l'identità in memoria quando lo storage del browser non è disponibile.
  }
  return identity;
}

export function clearClientSubmissionIdentity() {
  volatileIdentity = null;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CLIENT_SUBMISSION_STORAGE_KEY);
  } catch {
    // Nessuna azione necessaria.
  }
}
