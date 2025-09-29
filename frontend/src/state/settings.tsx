// src/state/settings.tsx
// Non-breaking Slice C enhancement with stronger defaults.
// - Guarantees settings.members is ALWAYS an array (empty by default)
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
};

// ---------- Settings shape (extend without breaking) ----------
export type Settings = {
  weekStartMonday?: boolean;
  timeFormat24h?: boolean;
  defaultDurationMins?: number;
  members: Array<{ id: string; name: string; role?: 'parent' | 'adult' | 'child'; colour?: string }>; // <- ALWAYS array
  myAgendaOnly?: boolean;
};

// Enforce strong defaults & shape on load
function normalizeSettings(input: any): Settings {
  const s = (input && typeof input === 'object') ? input : {};
  return {
    weekStartMonday: s.weekStartMonday,
    timeFormat24h: s.timeFormat24h,
    defaultDurationMins: s.defaultDurationMins,
    members: Array.isArray(s.members) ? s.members : [],  // <- key fix
    myAgendaOnly: typeof s.myAgendaOnly === 'boolean' ? s.myAgendaOnly : false,
    // Preserve any unknown keys transparently:
    // (We don’t drop them; they remain in storage via writeSettings merge below)
  } as Settings;
}

function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (!raw) return normalizeSettings({});
    const parsed = JSON.parse(raw);
    return normalizeSettings(parsed);
  } catch {
    return normalizeSettings({});
  }
}

function writeSettings(next: Partial<Settings> & AnyRecord) {
  // Merge with existing raw to preserve unknown keys, but enforce normalized output
  const existingRaw = (() => {
    try {
      const raw = localStorage.getItem(LS_SETTINGS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();

  const merged = { ...existingRaw, ...next };
  const normalized = normalizeSettings(merged);
  // Keep unknown keys from merged alongside normalized known keys:
  const finalOut = { ...merged, ...normalized, members: normalized.members, myAgendaOnly: normalized.myAgendaOnly };
  localStorage.setItem(LS_SETTINGS, JSON.stringify(finalOut));
  window.dispatchEvent(new CustomEvent('fc:settings:changed'));
}

// ---------- Event colour helper (keep name stable) ----------
export function pickEventColour(evt: any, settings: Settings): string | undefined {
  const memberColourMap = new Map<string, string>();
  (settings.members || []).forEach((m) => {
    if (m.id && m.colour) memberColourMap.set(m.id, m.colour);
  });

  const attendees: string[] =
    evt?.attendeeIds || evt?.attendees || evt?.members || [];

  for (const mId of Array.isArray(attendees) ? attendees : []) {
    const c = memberColourMap.get(mId);
    if (c) return c;
  }

  const responsible: string | undefined = evt?.responsibleId || evt?.responsibleMemberId;
  if (responsible && memberColourMap.has(responsible)) {
    return memberColourMap.get(responsible);
  }

  const owner: string | undefined = evt?.ownerMemberId;
  if (owner && memberColourMap.has(owner)) {
    return memberColourMap.get(owner);
  }

  return evt?.colour || evt?.color;
}

// ---------- Settings context & hook (keep name stable) ----------
type Ctx = {
  settings: Settings;
  setSettings: (update: Partial<Settings> | ((s: Settings) => Settings)) => void;
  setMyAgendaOnly: (on: boolean) => void;
};

const SettingsContext = createContext<Ctx | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setState] = useState<Settings>(() => readSettings());

  useEffect(() => {
    const handler = () => setState(readSettings());
    window.addEventListener('fc:settings:changed', handler);
    const storageHandler = (e: StorageEvent) => {
      if (e.key === LS_SETTINGS) handler();
    };
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('fc:settings:changed', handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  const setSettings: Ctx['setSettings'] = (update) => {
    const current = readSettings();
    const next = typeof update === 'function'
      ? (update as (s: Settings) => Settings)(current)
      : { ...current, ...update };

    // Ensure members stays an array even if someone passes undefined
    if (!Array.isArray(next.members)) next.members = [];
    writeSettings(next as any);
    setState(readSettings());
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

// ---------- Convenience readers ----------
export function listMembers(): Array<{ id: string; name: string; role?: string; colour?: string }> {
  const s = readSettings();
  return s.members; // guaranteed array
}

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
