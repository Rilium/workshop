const TRANSIENT_READ_STATUSES = new Set([404, 408, 425, 429, 500, 502, 503, 504]);
const READ_RETRY_DELAYS_MS = [0, 750, 1500, 3000];
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const MAX_CONCURRENT_READS = 3;

type QueuedRequest = {
  input: RequestInfo | URL;
  init?: RequestInit;
  resolve: (response: Response) => void;
  reject: (error: unknown) => void;
};

const readQueue: QueuedRequest[] = [];
const priorityQueue: QueuedRequest[] = [];
let activeReads = 0;
let mutationActive = false;

function requestTimeoutMs() {
  const configured = Number(
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_APPS_SCRIPT_TIMEOUT_MS,
  );
  return Number.isFinite(configured) && configured >= 500 ? configured : DEFAULT_REQUEST_TIMEOUT_MS;
}

function timeoutError() {
  return new DOMException("Tempo massimo di risposta di Apps Script superato.", "TimeoutError");
}

function wait(delayMs: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Richiesta annullata.", "AbortError"));
      return;
    }
    const timeoutId = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);
    const handleAbort = () => {
      globalThis.clearTimeout(timeoutId);
      reject(signal.reason ?? new DOMException("Richiesta annullata.", "AbortError"));
    };
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function createRequestDeadline(sourceSignal?: AbortSignal | null) {
  const controller = new AbortController();
  const handleSourceAbort = () => {
    controller.abort(sourceSignal?.reason ?? new DOMException("Richiesta annullata.", "AbortError"));
  };

  if (sourceSignal?.aborted) handleSourceAbort();
  else sourceSignal?.addEventListener("abort", handleSourceAbort, { once: true });

  const timeoutId = globalThis.setTimeout(() => controller.abort(timeoutError()), requestTimeoutMs());
  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeoutId);
      sourceSignal?.removeEventListener("abort", handleSourceAbort);
    },
  };
}

async function fetchWithSafeReadRetry(input: RequestInfo | URL, init: RequestInit | undefined, kind: "read" | "mutation") {
  const canRetry = kind === "read" && !init?.keepalive;
  const delays = canRetry ? READ_RETRY_DELAYS_MS : [0];
  const deadline = createRequestDeadline(init?.signal);
  let lastResponse: Response | null = null;

  try {
    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      if (delays[attempt] > 0) await wait(delays[attempt], deadline.signal);
      if (deadline.signal.aborted) throw deadline.signal.reason;

      const response = await fetch(input, { ...init, signal: deadline.signal });
      lastResponse = response;
      const shouldRetry = canRetry && TRANSIENT_READ_STATUSES.has(response.status) && attempt < delays.length - 1;
      if (!shouldRetry) return response;
      await response.text().catch(() => "");
    }
  } finally {
    deadline.cleanup();
  }

  if (lastResponse) return lastResponse;
  throw new Error("Apps Script non ha restituito una risposta.");
}

function runTask(task: QueuedRequest, kind: "read" | "mutation") {
  if (kind === "read") activeReads += 1;
  else mutationActive = true;

  void fetchWithSafeReadRetry(task.input, task.init, kind)
    .then(task.resolve, task.reject)
    .finally(() => {
      if (kind === "read") activeReads -= 1;
      else mutationActive = false;
      scheduleRequests();
    });
}

function scheduleRequests() {
  if (mutationActive) return;

  // Mutations have priority and run alone, after reads already in flight finish.
  if (priorityQueue.length > 0) {
    if (activeReads === 0) runTask(priorityQueue.shift()!, "mutation");
    return;
  }

  while (activeReads < MAX_CONCURRENT_READS && readQueue.length > 0) {
    runTask(readQueue.shift()!, "read");
  }
}

/**
 * Scheduler condiviso per Apps Script:
 * - fino a tre letture indipendenti in parallelo;
 * - mutazioni prioritarie ed esclusive;
 * - deadline e cancellazione per impedire che una richiesta blocchi la coda.
 */
export function fetchAppsScript(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = String(init?.method || "GET").toUpperCase();
  return enqueueRequest(input, init, method === "GET" && !init?.keepalive ? "read" : "mutation");
}

/** Schedula come lettura una richiesta POST di compatibilità Apps Script. */
export function fetchAppsScriptScheduledRead(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return enqueueRequest(input, init, "read");
}

function enqueueRequest(input: RequestInfo | URL, init: RequestInit | undefined, kind: "read" | "mutation") {
  return new Promise<Response>((resolve, reject) => {
    const task = { input, init, resolve, reject };
    (kind === "read" ? readQueue : priorityQueue).push(task);
    scheduleRequests();
  });
}

export function getAppsScriptTransportState() {
  return {
    activeReads,
    mutationActive,
    queuedReads: readQueue.length,
    queuedMutations: priorityQueue.length,
  };
}
