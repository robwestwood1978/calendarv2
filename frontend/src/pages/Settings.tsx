// frontend/src/state/settings.tsx
// Stable ABI:
// - `useSettings()` returns a *plain* Settings object (data only; no methods; no .settings alias).
// - Mutations via `useSettingsActions()`.
// - No React context dependency (useSyncExternalStore + localStorage).
// - Members is ALWAYS an array. fmt/pickEventColour/listMembers/readEventsRaw unchanged.
// - Default export also provided.

import React, { useMemo, useSyncExternalStore } from 'react'
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

// ---------- Types ----------
export type Member = { id: string; name: string; role?: 'parent' | 'adult' | 'child'; colour?: string }
export type Settings = {
  weekStartMonday?: boolean
  timeFormat24h?: boolean
  defaultDurationMins?: number
  members: Member[]                   // always an array
  myAgendaOnly?: boolean              // optional Slice C toggle
}

// ---------- Normalisation & IO ----------
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

// ---------- Global store (no context) ----------
type Store = {
  get: () => Settings
  set: (update: Partial<Settings> | ((s: Settings) => Settings)) => void
  setMyAgendaOnly: (on: boolean) => void
  subscribe: (fn: () => void) => () => void
}
const store: Store = (() => {
  const get = () => readSettings()
  const set: Store['set'] = (update) => {
    const current = readSettings()
    const next = typeof update === 'function'
      ? (update as (s: Settings) => Settings)(current)
      : { ...current, ...update }
    if (!Array.isArray(next.members)) next.members = []
    writeSettings(next as any)
  }
  const setMyAgendaOnly = (on: boolean) => set({ myAgendaOnly: !!on })
  const subscribe = (fn: () => void) => {
    const onCustom = () => fn()
    const onStorage = (e: StorageEvent) => { if (e.key === LS_SETTINGS) fn() }
    window.addEventListener('fc:settings:changed', onCustom)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('fc:settings:changed', onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }
  return { get, set, setMyAgendaOnly, subscribe }
})()

// ---------- Public hooks ----------
export function useSettings(): Settings {
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get)
  // Return *only* data; ensure members is an array.
  return useMemo(() => ({ ...snapshot, members: Array.isArray(snapshot.members) ? snapshot.members : [] }), [snapshot])
}

// Explicit actions hook for writes
export function useSettingsActions(): Pick<Store, 'set' | 'setMyAgendaOnly'> {
  return { set: store.set, setMyAgendaOnly: store.setMyAgendaOnly }
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

// ---------- Colour helper ----------
export function pickEventColour(evt: any, settings: Settings): string | undefined {
  const map = new Map<string, string>()
  ;(settings.members || []).forEach((m) => { if (m.id && m.colour) map.set(m.id, m.colour) })

  const attendees: string[] = evt?.attendeeIds || evt?.attendees || evt?.members || []
  for (const mId of Array.isArray(attendees) ? attendees : []) {
    const c = map.get(mId); if (c) return c
  }
  const responsible: string | undefined = evt?.responsibleId || evt?.responsibleMemberId
  if (responsible && map.has(responsible)) return map.get(responsible)
  const owner: string | undefined = evt?.ownerMemberId
  if (owner && map.has(owner)) return map.get(owner)
  return evt?.colour || evt?.color
}

// ---------- No-op provider for JSX compatibility ----------
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

// Default export for legacy default imports
export default useSettings
