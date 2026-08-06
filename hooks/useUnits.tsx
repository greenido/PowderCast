'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UnitSystem } from '@/lib/units';
import { defaultUnitsForCountry } from '@/lib/units';

const STORAGE_KEY = 'pc_units';

interface UnitsContextValue {
  units: UnitSystem;
  /** True once the stored preference has been read. */
  hydrated: boolean;
  /** True when the rider has chosen explicitly rather than inheriting a default. */
  isExplicit: boolean;
  setUnits: (units: UnitSystem) => void;
  toggle: () => void;
  /** Adopt a resort's country default, unless the rider has chosen already. */
  suggestForCountry: (country: string | undefined) => void;
}

const UnitsContext = createContext<UnitsContextValue | null>(null);

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [units, setUnitsState] = useState<UnitSystem>('imperial');
  const [isExplicit, setIsExplicit] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'metric' || stored === 'imperial') {
        setUnitsState(stored);
        setIsExplicit(true);
      } else if (typeof navigator !== 'undefined') {
        // No stored choice — infer from locale so a European visitor doesn't
        // land on Fahrenheit. Still counts as implicit, so a resort default
        // can override it.
        const locale = navigator.language || '';
        setUnitsState(/-(US)$/i.test(locale) ? 'imperial' : 'metric');
      }
    } catch {
      // Ignore; imperial default stands.
    }
    setHydrated(true);
  }, []);

  const setUnits = useCallback((next: UnitSystem) => {
    setUnitsState(next);
    setIsExplicit(true);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort.
    }
  }, []);

  const toggle = useCallback(() => {
    setUnits(units === 'metric' ? 'imperial' : 'metric');
  }, [units, setUnits]);

  const suggestForCountry = useCallback(
    (country: string | undefined) => {
      if (isExplicit || !country) return;
      setUnitsState(defaultUnitsForCountry(country));
    },
    [isExplicit]
  );

  return (
    <UnitsContext.Provider
      value={{ units, hydrated, isExplicit, setUnits, toggle, suggestForCountry }}
    >
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits(): UnitsContextValue {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error('useUnits must be used within a UnitsProvider');
  return ctx;
}
