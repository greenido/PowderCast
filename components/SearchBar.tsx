'use client';

import { Fragment, useState } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useResortSearch } from '@/hooks/useResortSearch';
import type { Resort } from '@/lib/database';

interface SearchBarProps {
  onSelectResort: (resort: Resort | null) => void;
  selectedResort: Resort | null;
}

export default function SearchBar({ onSelectResort, selectedResort }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const { resorts, loading } = useResortSearch(query);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Combobox value={selectedResort} onChange={onSelectResort}>
        <div className="relative">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
            <Combobox.Input
              className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl pl-11 sm:pl-14 pr-3 sm:pr-4 py-3 sm:py-4 text-base sm:text-lg md:text-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
              placeholder="Search for a ski resort..."
              displayValue={(resort: Resort | null) => resort?.name || ''}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Combobox.Options className="absolute mt-2 w-full bg-slate-900/95 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl max-h-96 overflow-auto z-50">
              {loading && (
                <div className="px-4 py-8 text-center text-gray-400">
                  Searching...
                </div>
              )}
              
              {!loading && query.length >= 2 && resorts.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-400">
                  No resorts found for &quot;{query}&quot;
                </div>
              )}

              {resorts.map((resort) => (
                <Combobox.Option
                  key={resort.id}
                  value={resort}
                  className={({ active }) =>
                    `cursor-pointer px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 last:border-b-0 transition-colors ${
                      active ? 'bg-cyan-400/20 text-cyan-400' : 'text-white'
                    }`
                  }
                >
                  {({ active }) => (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <MapPinIcon className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${active ? 'text-cyan-400' : 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm sm:text-base md:text-lg truncate">{resort.name}</div>
                        <div className="text-xs sm:text-sm text-gray-400 truncate">
                          {resort.region}, {resort.state} • Base: {resort.base_elevation}ft • Summit: {resort.summit_elevation}ft
                        </div>
                      </div>
                    </div>
                  )}
                </Combobox.Option>
              ))}
            </Combobox.Options>
          </Transition>
        </div>
      </Combobox>
    </div>
  );
}
