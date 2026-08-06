'use client';

import type { PassId, Resort } from '@/lib/types';
import { PASSES, PASS_ORDER, countByPass } from '@/lib/passes';

interface PassFilterProps {
  resorts: Resort[];
  selected: PassId[];
  onToggle: (pass: PassId) => void;
  onClear: () => void;
}

/**
 * "Which pass do you hold?" — filters the whole app to resorts a rider can
 * actually use. This is the question that decides where someone skis, so it
 * sits above search rather than behind a settings screen.
 */
export default function PassFilter({
  resorts,
  selected,
  onToggle,
  onClear,
}: PassFilterProps) {
  const counts = countByPass(resorts);
  const available = PASS_ORDER.filter((pass) => counts[pass] > 0);

  if (available.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        My pass
      </span>

      {available.map((pass) => {
        const meta = PASSES[pass];
        const isOn = selected.includes(pass);

        return (
          <button
            key={pass}
            onClick={() => onToggle(pass)}
            aria-pressed={isOn}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
              isOn
                ? `${meta.className} ring-1 ring-inset ring-white/20`
                : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {meta.name}
            <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
              {counts[pass]}
            </span>
          </button>
        );
      })}

      {selected.length > 0 && (
        <button
          onClick={onClear}
          className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-gray-500 underline-offset-2 transition-colors hover:text-white hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
