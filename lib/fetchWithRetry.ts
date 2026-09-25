interface FetchWithRetryOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 1_000;

function isRetryable(status: number): boolean {
  // 429 is in here because Open-Meteo rate-limits with it, and the comparison
  // view asks for a dozen resorts through a pool of four workers — precisely
  // the shape that earns one. A 4xx that is not 429 will not improve on retry.
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * Combine the caller's signal with our timeout signal.
 *
 * This used to spread the caller's options and then overwrite `signal` with the
 * timeout controller's, which silently discarded it. Both providers thread a
 * signal through carefully and it went nowhere: switching resorts quickly left
 * every abandoned request running to completion, and for NWS that is three
 * upstream calls per resort nobody is looking at any more.
 *
 * AbortSignal.any() is Chrome 116 / Safari 17.4 / Firefox 124, so there is a
 * manual fallback for browsers a season or two behind.
 */
function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1) return signals[0];

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals);
  }

  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    signal,
    ...fetchOptions
  } = options;

  // RequestInit types signal as AbortSignal | null; normalize the null away so
  // the rest of this reads as "have one or don't".
  const callerSignal = signal ?? undefined;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Nobody is waiting for this any more; do not start another attempt.
    if (callerSignal?.aborted) {
      throw abortError(callerSignal);
    }

    const timeout = new AbortController();
    const timeoutId = setTimeout(() => timeout.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: combineSignals(
          callerSignal ? [timeout.signal, callerSignal] : [timeout.signal]
        ),
      });

      clearTimeout(timeoutId);

      if (response.ok || !isRetryable(response.status)) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (err) {
      clearTimeout(timeoutId);

      // A caller abort is a decision, not a failure: retrying it would defeat
      // the point of cancelling. Only our own timeout is worth another go.
      if (callerSignal?.aborted) {
        throw abortError(callerSignal);
      }

      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new Error(`Request timed out after ${timeoutMs}ms`);
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (attempt < maxRetries) {
      const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(backoff, callerSignal);
    }
  }

  throw lastError ?? new Error('fetchWithRetry failed');
}

/** Backoff that a cancelled request does not have to sit through. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(abortError(signal!));
    }

    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

function abortError(signal: AbortSignal): Error {
  const reason = signal.reason;
  if (reason instanceof Error) return reason;
  return new DOMException('The operation was aborted.', 'AbortError');
}
