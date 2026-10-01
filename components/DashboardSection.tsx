'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

interface DashboardSectionProps {
  title: string;
  emoji: string;
  /** One line shown in the header, so a closed section still says something. */
  hint?: string;
  /** Open on a phone. Desktop always starts open: there is room for it. */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * A collapsible group of detail cards on the resort page.
 *
 * On a phone the page was seventeen cards in one column, about five screens,
 * all at the same volume. Grouping them lets the one that matters today start
 * open (snow, or wind on a hold day) while the rest stay one tap away, each
 * with its headline number still visible in the header.
 */
export default function DashboardSection({
  title,
  emoji,
  hint,
  defaultOpen = false,
  children,
}: DashboardSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) setOpen(true);
  }, []);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10 [&::-webkit-details-marker]:hidden">
        <span className="text-lg leading-none" aria-hidden>
          {emoji}
        </span>
        <span className="font-semibold text-white">{title}</span>
        {hint && (
          <span className="ml-auto min-w-0 truncate text-right text-xs text-gray-400">{hint}</span>
        )}
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180 ${
            hint ? '' : 'ml-auto'
          }`}
        />
      </summary>
      {/* Mounted only while open: a closed section costs nothing to render. */}
      {open && <div className="mt-4 space-y-4 sm:space-y-6">{children}</div>}
    </details>
  );
}
