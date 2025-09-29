// frontend/src/state/settings.tsx
// Back-compat shim for Slice A/B consumers.
// - `useSettings()` returns the settings object itself
// - BUT also exposes `.settings` alias, and attaches `setSettings` / `setMyAgendaOnly`
//   so legacy code that expects `{ settings } = useSettings()` (or expects methods on it) keeps working.

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { DateTime } from 'luxon'

type AnyRecord = Record<string, any>

const LS_SETTINGS = 'fc_settings_v3'
const LS_EVENTS = 'fc_events_v1'

// ---------- Formatting helpers (stable) ----------
export const fmt = {
  day(dt: DateTime) {
    return dt.toFormat('ccc d LLL')
  },
  time(dt: DateTime) {
    return dt.toFormat('HH:mm')
  },
}

// ---------- Settings shape ----------
export type Member = { id: string; name: string; role?: 'parent' | 'adult' | 'child'; colour?: string }
export type Settings = {
  weekStartMonday?: boolean
  timeFormat24h?: boolean
  defaultDurationMins?: number
  members: Member[]                   // always an array
  myAgendaOnly?: boolean              // optional Slice C toggle (unused if feature off)
}

// Normalize any raw object to safe Settings
function normalizeSettings(input: any): Settings {
  const s = (input && typeof input === 'object') ? input : {}
  return {
    weekStartMonday: typeof s.weekStartMonday === 'boolean' ? s.weekStartMonday : false,
    timeFormat24h: typeof s.timeFormat24h === 'boolean' ? s.timeFormat24h : true,
    defaultDurationMins: typeof s.defaultDurationMins === 'number' ? s.defaultDurationMins : 60,
    members: Array.isArray(s.members) ? s.members : [],
    myAgendaOnly: typeof s.myAgendaOnly === 'boolean' ? s.myAgendaOnly : false,
  }
}

function readSettingsRaw(): AnyRecord {
  try {
    const raw = localStorage.getItem(LS_SETTINGS)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
function readSettings(): Settings {
  return normalizeSettings(readSettingsRaw())
}
function writeSettings(next: AnyRecord) {
  const merged = { ...readSettingsRaw(), ...next }
  const normalized = normalizeSettings(merged)
  const out = { ...merged, ...normalized, members: normalized.members, myAgendaOnly: normalized.myAgendaOnly }
  localStorage.setItem(LS_SETTINGS, JSON.stringify(out))
  window.dispatchEvent(new CustomEvent('fc:settings:changed'))
}

// ---------- Event colour helper (stable) ----------
export function pickEventColour(evt: any, settings: Settings): string | undefined {
  const memberColourMap = new Map<string, string>()
  ;(settings.members || []).forEach((m) => {
    if (m.id && m.colour) memberColourMap.set(m.id, m.colour)
  })

  const attendees: string[] = evt?.attendeeIds || evt?.attendees || evt?.members || []
  for (const mId of Array.isArray(attendees) ? attendees : []) {
    const c = memberColourMap.get(mId)
    if (c) return c
  }

  const responsible: string | undefined = evt?.responsibleId || evt?.responsibleMemberId
  if (responsible && memberColourMap.has(responsible)) return memberColourMap.get(responsible)

  const owner: string | undefined = evt?.ownerMemberId
  if (owner && memberColourMap.has(owner)) return memberColourMap.get(owner)

  return evt?.colour || evt?.color
}

// ---------- Context ----------
type Ctx = {
  value: Settings
  setSettings: (update: Partial<Settings> | ((s: Settings) => Settings)) => void
  setMyAgendaOnly: (on: boolean) => void
}
const SettingsContext = createContext<Ctx | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<Settings>(() => readSettings())

  useEffect(() => {
    const onCustom = () => setValue(readSettings())
    const onStorage = (e: StorageEvent) => { if (e.key === LS_SETTINGS) onCustom() }
    window.addEventListener('fc:settings:changed', onCustom)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('fc:settings:changed', onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setSettings: Ctx['setSettings'] = (update) => {
    const current = readSettings()
    const next = typeof update === 'function'
      ? (update as (s: Settings) => Settings)(current)
      : { ...current, ...update }
    if (!Array.isArray(next.members)) next.members = []
    writeSettings(next as any)
    setValue(readSettings())
  }
  const setMyAgendaOnly = (on: boolean) => setSettings({ myAgendaOnly: !!on })

  const ctx = useMemo<Ctx>(() => ({ value, setSettings, setMyAgendaOnly }), [value])
  return <SettingsContext.Provider value={ctx}>{children}</SettingsContext.Provider>
}

// ---------- Public hooks (back-compat) ----------

/**
 * Baseline-compatible hook.
 * Returns the settings object itself, but also attaches:
 *  - .settings   -> alias to itself (legacy code: const { settings } = useSettings())
 *  - .setSettings / .setMyAgendaOnly -> mutation helpers (legacy code calling methods off hook result)
 */
export function useSettings(): Settings & {
  settings: Settings
  setSettings?: Ctx['setSettings']
  setMyAgendaOnly?: Ctx['setMyAgendaOnly']
} {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>')
  const s = ctx.value as Settings & {
    settings?: Settings
    setSettings?: Ctx['setSettings']
    setMyAgendaOnly?: Ctx['setMyAgendaOnly']
  }
  // attach legacy-friendly aliases exactly once (idempotent)
  if (!s.settings) s.settings = s
  if (!s.setSettings) s.setSettings = ctx.setSettings
  if (!s.setMyAgendaOnly) s.setMyAgendaOnly = ctx.setMyAgendaOnly
  return s
}

// New explicit actions hook (optional for new code)
export function useSettingsActions(): Pick<Ctx, 'setSettings' | 'setMyAgendaOnly'> {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettingsActions must be used within <SettingsProvider>')
  return { setSettings: ctx.setSettings, setMyAgendaOnly: ctx.setMyAgendaOnly }
}

// ---------- Convenience readers ----------
export function listMembers(): Member[] {
  return readSettings().members // guaranteed array
}
export function readEventsRaw(): any[] {
  try {
    const raw = localStorage.getItem(LS_EVENTS)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}
