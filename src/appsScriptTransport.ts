const TRANSIENT_READ_STATUSES = new Set([404, 408, 425, 429, 500, 502, 503, 504]);
const READ_RETRY_DELAYS_MS = [0, 1000, 2000, 4000, 8000];

type QueuedRequest = {
  input: RequestInfo | URL;
  init?: RequestInit;
  resolve: (response: Response) => void;
  reject: (error: unknown) => void;
};

const readQueue: QueuedRequest[] = [];
const priorityQueue: QueuedRequest[] = [];
let requestActive = false;

function wait(delayMs: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs));
}

async function fetchWithSafeReadRetry(input: RequestInfo | URL, init?: RequestInit) {
  const method = String(init?.method || "GET").toUpperCase();
  const canRetry = method === "GET" && !init?.keepalive;
  const delays = canRetry ? READ_RETRY_DELAYS_MS : [0];
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) await wait(delays[attempt]);
    if (init?.signal?.aborted) throw new DOMException("Request aborted", "AbortError");

    const response = await fetch(input, init);
    lastResponse = response;
    const shouldRetry = canRetry && TRANSIENT_READ_STATUSES.has(response.status) && attempt < delays.length - 1;
    if (!shouldRetry) return response;
    await response.text().catch(() => "");
  }

  if (lastResponse) return lastResponse;
  throw new Error("Apps Script non ha restituito una risposta.");
}

/**
 * Apps Script degrada quando molte sezioni del BO interrogano lo stesso Sheet
 * contemporaneamente. Tutte le chiamate passano da una coda condivisa; soltanto
 * le GET, che non producono effetti, vengono riprovate sui transienti Google.
 */
export function fetchAppsScript(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const task = { input, init, resolve, reject };
    const method = String(init?.method || "GET").toUpperCase();
    const isSafeRead = method === "GET" && !init?.keepalive;
    (isSafeRead ? readQueue : priorityQueue).push(task);
    void runNextRequest();
  });
}

async function runNextRequest(): Promise<void> {
  if (requestActive) return;
  const task = priorityQueue.shift() || readQueue.shift();
  if (!task) return;

  requestActive = true;
  try {
    task.resolve(await fetchWithSafeReadRetry(task.input, task.init));
  } catch (error) {
    task.reject(error);
  } finally {
    requestActive = false;
    void runNextRequest();
  }
}
