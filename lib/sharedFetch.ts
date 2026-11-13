/**
 * One network request per URL, however many callers ask for it.
 *
 * The resort page asks for the base forecast and, through ResortWeekStrip, the
 * planner's mid-mountain forecast. For a US resort both go to the same NWS grid
 * cell -- elevation is corrected client-side with a lapse rate -- so every page
 * load fetched the same /points, gridpoint and narrative twice. When NWS was
 * slow that doubled the load on it, and the retries with it.
 *
 * Callers share both the in-flight request and, for `ttlMs`, its parsed body.
 * Each caller keeps its own AbortSignal: abandoning a shared request only
 * cancels the network call once every caller has abandoned it, so switching
 * away from one view cannot cancel a fetch another view is still waiting on.
 *
 * Failures are never cached. The next caller gets a fresh attempt.
 */

import { fetchWithRetry, type FetchWithRetryOptions } from '@/lib/fetchWithRetry';

interface Entry {
  promise: Promise<unknown>;
  controller: AbortController;
  subscribers: number;
  /** Epoch ms when the body arrived; null while in flight. */
  settledAt: number | null;
  /** How long this body may be reused once it has arrived. */
  ttlMs: number;
}

/** Bodies run to ~200KB parsed; this caps what a long planner session holds. */
const MAX_SETTLED = 40;

const entries = new Map<string, Entry>();

export class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}

export interface SharedFetchOptions extends Omit<FetchWithRetryOptions, 'signal'> {
  signal?: AbortSignal;
  /** How long a successful body is reused. 0 shares the in-flight request only. */
  ttlMs?: number;
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function fresh(entry: Entry, now: number): boolean {
  return entry.settledAt === null || now - entry.settledAt < entry.ttlMs;
}

function prune(now: number) {
  const settled: Array<[string, Entry]> = [];
  for (const [url, entry] of entries) {
    if (entry.settledAt === null) continue;
    if (!fresh(entry, now)) entries.delete(url);
    else settled.push([url, entry]);
  }
  settled.sort((a, b) => a[1].settledAt! - b[1].settledAt!);
  for (let i = 0; i < settled.length - MAX_SETTLED; i++) entries.delete(settled[i][0]);
}

function start(
  url: string,
  ttlMs: number,
  options: Omit<SharedFetchOptions, 'signal' | 'ttlMs'>
): Entry {
  const controller = new AbortController();
  const entry: Entry = {
    promise: Promise.resolve(),
    controller,
    subscribers: 0,
    settledAt: null,
    ttlMs,
  };

  entry.promise = fetchWithRetry(url, { ...options, signal: controller.signal })
    .then(async (res) => {
      if (!res.ok) throw new HttpError(res.status);
      const body = await res.json();
      entry.settledAt = Date.now();
      // Nothing to keep: later callers should start their own request.
      if (ttlMs <= 0 && entries.get(url) === entry) entries.delete(url);
      return body;
    })
    .catch((err) => {
      if (entries.get(url) === entry) entries.delete(url);
      throw err;
    });
  // Every subscriber attaches its own handlers; this one only stops an
  // abandoned request's rejection from being reported as unhandled.
  entry.promise.catch(() => {});

  entries.set(url, entry);
  return entry;
}

export function sharedFetchJson<T = unknown>(
  url: string,
  { signal, ttlMs = 0, ...options }: SharedFetchOptions = {}
): Promise<T> {
  if (signal?.aborted) return Promise.reject(abortError());

  const now = Date.now();
  prune(now);

  const existing = entries.get(url);
  const entry = existing && fresh(existing, now) ? existing : start(url, ttlMs, options);

  entry.subscribers++;

  return new Promise<T>((resolve, reject) => {
    let done = false;

    const onAbort = () => {
      if (done) return;
      done = true;
      entry.subscribers--;
      // Last one out cancels the request, and forgets it so nobody joins a
      // request that is about to reject with someone else's abort.
      if (entry.subscribers === 0 && entry.settledAt === null) {
        if (entries.get(url) === entry) entries.delete(url);
        entry.controller.abort();
      }
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    entry.promise.then(
      (body) => {
        if (done) return;
        done = true;
        entry.subscribers--;
        signal?.removeEventListener('abort', onAbort);
        resolve(body as T);
      },
      (err) => {
        if (done) return;
        done = true;
        entry.subscribers--;
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

/** Test seam. Not used by the app. */
export function __resetSharedFetch() {
  entries.clear();
}
