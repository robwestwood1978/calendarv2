// frontend/src/state/settings.tsx
// Restores baseline contract: `useSettings()` returns the *settings object itself*.
// Adds `useSettingsActions()` for mutating helpers.
// Guarantees settings.members is always an array to protect legacy code.

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

// ---------- Settings shape (extend without breaking) ----------
export type Settings = {
  weekStartMonday?: boolean
  timeFormat24h?: boolean
  defaultDurationMins?: number
  members: Array<{ id: string; name: string; role?: 'parent' | 'adult' | 'child'; colour?: string }>
  // Slice C optional:
  myAgendaOnly?: boolean
}

// Normalize any raw object to a safe Settings
function normalizeSettings(input: any): Settings {
  const s = (input && typeof input === 'object') ? input : {}
  return {
    weekStartMonday: s.weekStartMonday ?? false,
    timeFormat24h: s.timeFormat24h ?? true,
    defaultDurationMins: typeof s.defaultDurationMins === 'number' ? s.defaultDurationMins : 60,
    members: Array.isArray(s.members) ? s.members : [],          // <- always an array
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
  // Merge with existing to preserve unknown keys, then normalize important ones
  const merged = { ...readSettingsRaw(), ...next }
  const normalized = normalizeSettings(merged)
  const finalOut = { ...merged, ...normalized, members: normalized.members, myAgendaOnly: normalized.myAgendaOnly }
  localStorage.setItem(LS_SETTINGS, JSON.stringify(finalOut))
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

// ---------- Context (internal) ----------
type Ctx = {
  value: Settings
  setSettings: (update: Partial<Settings> | ((s: Settings) => Settings)) => void
  setMyAgendaOnly: (on: boolean) => void
}

const SettingsContext = createContext<Ctx | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<Settings>(() => readSettings())

  // React to external changes (other tabs / preflight / migrations)
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

// ---------- Public hooks (compatibility) ----------

// ✅ Baseline contract: return the *settings object itself*.
// Components that do `const { members } = useSettings()` will keep working.
export function useSettings(): Settings {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>')
  return ctx.value
}

// New opt-in actions hook (only needed by Slice-C additions)
export function useSettingsActions(): Pick<Ctx, 'setSettings' | 'setMyAgendaOnly'> {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettingsActions must be used within <SettingsProvider>')
  return { setSettings: ctx.setSettings, setMyAgendaOnly: ctx.setMyAgendaOnly }
}

// ---------- Convenience readers ----------
export function listMembers(): Array<{ id: string; name: string; role?: string; colour?: string }> {
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
