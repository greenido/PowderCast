'use client';

import { useEffect } from 'react';

/**
 * Route-level fallback. Catches anything that escapes the per-section
 * boundaries so the worst case is still a readable page, not a blank one.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-card max-w-lg text-center">
        <div className="mb-3 text-4xl">🏔️</div>
        <h1 className="text-xl font-bold text-white">PowderCast hit a snag</h1>
        <p className="mt-2 text-sm text-gray-400">
          Something went wrong while rendering the page. Your saved resorts and
          settings are untouched.
        </p>

        {process.env.NODE_ENV !== 'production' && (
          <pre className="mt-4 overflow-x-auto rounded-lg bg-black/30 p-3 text-left text-[11px] text-red-300">
            {error.message}
          </pre>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-300"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-white/10 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            Reload
          </button>
        </div>
      </div>
    </main>
  );
}
