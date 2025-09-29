// src/state/settings.tsx
// Non-breaking Slice C enhancement.
// - Preserves existing behaviour for Slice A/B
// - Adds myAgendaOnly?: boolean (default false)
// - Exports: useSettings, fmt, pickEventColour (stable names)

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';

type AnyRecord = Record<string, any>;

const LS_SETTINGS = 'fc_settings_v3';
const LS_EVENTS = 'fc_events_v1';

// ---------- Formatting helpers (keep names stable) ----------
export const fmt = {
  day(dt: DateTime) {
    return dt.toFormat('ccc d LLL');
  },
  time(dt: DateTime) {
    return dt.toFormat('HH:mm');
  },
  // Extend as needed, but keep existing names intact
};

// ---------- Settings shape (extend without breaking) ----------
export type Settings = {
  // Existing Slice A/B settings (examples; we preserve unknowns too):
  weekStartMonday?: boolean;
  timeFormat24h?: boolean;
  defaultDurationMins?: number;
  members?: Array<{ id: string; name: string; role?: 'parent' | 'adult' | 'child'; colour?: string }>;

  // NEW (Slice C, optional & safe):
  myAgendaOnly?: boolean;
};

function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (!raw) return { myAgendaOnly: false };
    const parsed = JSON.parse(raw);
    // Do NOT drop unknown keys
    if (typeof parsed.myAgendaOnly === 'undefined') parsed.myAgendaOnly = false;
    return parsed;
  } catch {
    return { myAgendaOnly: false };
  }
}

function writeSettings(next: Settings) {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('fc:settings:changed'));
}

// ---------- Event colour helper (keep name stable) ----------
// Rule: derive event colour from attendees/responsible adult if available,
// otherwise leave as-is. This should match Slice B logic.
export function pickEventColour(evt: any, settings: Settings): string | undefined {
  // Try attendee/member-derived colours first
  const memberColourMap = new Map<string, string>();
  (settings.members || []).forEach((m) => {
    if (m.id && m.colour) memberColourMap.set(m.id, m.colour);
  });

  const attendees: string[] =
    evt?.attendeeIds || evt?.attendees || evt?.members || [];

  // Prefer first attendee with a known colour
  for (const mId of Array.isArray(attendees) ? attendees : []) {
    const c = memberColourMap.get(mId);
    if (c) return c;
  }

  // Responsible adult/member fallback
  const responsible: string | undefined = evt?.responsibleId || evt?.responsibleMemberId;
  if (responsible && memberColourMap.has(responsible)) {
    return memberColourMap.get(responsible);
  }

  // Owner fallback (Slice C sync-ready)
  const owner: string | undefined = evt?.ownerMemberId;
  if (owner && memberColourMap.has(owner)) {
    return memberColourMap.get(owner);
  }

  // Finally, respect any explicit event colour set earlier
  return evt?.colour || evt?.color;
}

// ---------- Settings context & hook (keep name stable) ----------
type Ctx = {
  settings: Settings;
  setSettings: (update: Partial<Settings> | ((s: Settings) => Settings)) => void;

  // Convenience togglers (non-breaking)
  setMyAgendaOnly: (on: boolean) => void;
};

const SettingsContext = createContext<Ctx | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setState] = useState<Settings>(() => readSettings());

  // React to external changes (other tabs, migrations)
  useEffect(() => {
    const handler = () => setState(readSettings());
    window.addEventListener('fc:settings:changed', handler);
    window.addEventListener('storage', (e) => {
      if (e.key === LS_SETTINGS) handler();
    });
    return () => {
      window.removeEventListener('fc:settings:changed', handler);
    };
  }, []);

  const setSettings: Ctx['setSettings'] = (update) => {
    const next =
      typeof update === 'function'
        ? (update as (s: Settings) => Settings)(readSettings())
        : { ...readSettings(), ...update };
    writeSettings(next);
    setState(next);
  };

  const setMyAgendaOnly = (on: boolean) => setSettings({ myAgendaOnly: !!on });

  const value = useMemo<Ctx>(
    () => ({ settings, setSettings, setMyAgendaOnly }),
    [settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>');
  return ctx;
}

// ---------- (Optional) small helper for consumers ----------
export function listMembers(): Array<{ id: string; name: string; role?: string; colour?: string }> {
  const s = readSettings();
  return s.members || [];
}

// ---------- Defensive export for external modules that only need events ----------
export function readEventsRaw(): any[] {
  try {
    const raw = localStorage.getItem(LS_EVENTS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
