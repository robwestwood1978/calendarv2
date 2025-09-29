// frontend/src/state/settings.tsx
// Final, durable version.
// - `useSettings()` no longer depends on React Context; it uses a global store via useSyncExternalStore.
// - Still exports a no-op SettingsProvider (compat).
// - Satisfies BOTH historical call patterns:
//     * const { members } = useSettings()
//     * const { settings } = useSettings(); settings.members.map(...)
// - Attaches .setSettings and .setMyAgendaOnly on the returned object too.
// - Members is ALWAYS an array. fmt/pickEventColour/listMembers/readEventsRaw unchanged.
// - Default export is useSettings (covers default-import legacy).

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

// ---------- Settings shape ----------
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
  // notify all subscribers
  window.dispatchEvent(new CustomEvent('fc:settings:changed'))
}

// ---------- Global store (context-free) ----------
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

// ---------- Event colour helper (stable) ----------
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

// ---------- Public hooks (compat; no context needed) ----------
export function useSettings(): Settings & {
  settings: Settings
  setSettings?: Store['set']
  setMyAgendaOnly?: Store['setMyAgendaOnly']
} {
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get)
  // Attach legacy-friendly aliases (memoised so referentially stable for consumers)
  return useMemo(() => {
    const s = snapshot as Settings & {
      settings?: Settings
      setSettings?: Store['set']
      setMyAgendaOnly?: Store['setMyAgendaOnly']
    }
    if (!s.settings) s.settings = s
    if (!s.setSettings) s.setSettings = store.set
    if (!s.setMyAgendaOnly) s.setMyAgendaOnly = store.setMyAgendaOnly
    return s
  }, [snapshot])
}

// Optional explicit actions hook for new code
export function useSettingsActions(): Pick<Store, 'set' | 'setMyAgendaOnly'> {
  // No subscription needed for actions
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

// ---------- No-op provider (compat with existing tree) ----------
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Deliberately no context — keep for JSX structure compatibility
  return <>{children}</>
}

// Default export for legacy `import useSettings from '…/settings'`
export default useSettings
