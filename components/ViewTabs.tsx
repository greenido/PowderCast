'use client';

export interface ViewTab {
  key: string;
  /** Full label for the desktop switcher. */
  label: string;
  /** One word for the phone tab bar. */
  short: string;
  emoji: string;
  active: boolean;
  badge?: number;
  onSelect: () => void;
}

/**
 * The top-level view switcher.
 *
 * On a phone it is a bottom tab bar: four long labels squeezed into one row
 * at the top wrapped onto three lines, sat above the fold on every screen,
 * and were out of thumb reach. From `sm` up it is the inline segmented
 * control it always was.
 */
export default function ViewTabs({ tabs }: { tabs: ViewTab[] }) {
  return (
    <>
      <nav aria-label="Views" className="mb-8 hidden justify-center sm:flex">
        <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 text-sm shadow-inner backdrop-blur-md">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={tab.onSelect}
              aria-current={tab.active ? 'page' : undefined}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2.5 font-bold transition-all sm:px-5 ${
                tab.active
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/10'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.emoji} {tab.label}
              {!!tab.badge && (
                <span className="shrink-0 rounded-full border border-yellow-400/20 bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <nav
        aria-label="Views"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      >
        <div className="grid grid-cols-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={tab.onSelect}
              aria-current={tab.active ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${
                tab.active ? 'text-cyan-400' : 'text-gray-400'
              }`}
            >
              {tab.active && (
                <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-cyan-400" aria-hidden />
              )}
              <span className="text-xl leading-none" aria-hidden>
                {tab.emoji}
              </span>
              {tab.short}
              {!!tab.badge && (
                <span className="absolute right-[22%] top-1 rounded-full bg-yellow-500/30 px-1 text-[9px] font-bold text-yellow-300">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
