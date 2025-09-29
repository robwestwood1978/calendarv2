// frontend/src/lib/migrateSliceC.ts
// Idempotent migration for Slice C (safe on every load).
// - Ensures fc_settings_v3 exists with safe defaults (incl. members: [])
// - Ensures every event in fc_events_v1 has a stable id and *tags: []* array
// - Adds optional sync-ready fields createdByUserId?, ownerMemberId? (left undefined)

type AnyRecord = Record<string, any>

const LS_SETTINGS = 'fc_settings_v3'
const LS_EVENTS = 'fc_events_v1'

export function migrateSliceC(): void {
  try { migrateSettings() } catch (e) { console.warn('[migrateSliceC] settings migration skipped:', e) }
  try { migrateEvents() } catch (e) { console.warn('[migrateSliceC] events migration skipped:', e) }
}

function migrateSettings() {
  let raw: string | null = null
  try { raw = localStorage.getItem(LS_SETTINGS) } catch {}
  let parsed: AnyRecord = {}
  if (raw) {
    try { parsed = JSON.parse(raw) || {} } catch { parsed = {} }
  }

  const next: AnyRecord = { ...parsed }

  // Strong defaults for legacy readers:
  if (!Array.isArray(next.members)) next.members = []
  if (typeof next.weekStartMonday === 'undefined') next.weekStartMonday = false
  if (typeof next.timeFormat24h === 'undefined') next.timeFormat24h = true
  if (typeof next.defaultDurationMins === 'undefined') next.defaultDurationMins = 60

  // Slice C key:
  if (typeof next.myAgendaOnly === 'undefined') next.myAgendaOnly = false

  if (JSON.stringify(parsed) !== JSON.stringify(next)) {
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(next)) } catch {}
  }
}

function migrateEvents() {
  const raw = localStorage.getItem(LS_EVENTS)
  if (!raw) return
  let events: AnyRecord[]
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    events = parsed
  } catch { return }

  let changed = false
  const next = events.map((evt) => {
    const copy: AnyRecord = { ...evt }

    // Ensure a stable id (defensive)
    if (!copy.id) { copy.id = uid(); changed = true }

    // Prepare sync-friendly fields (do not infer)
    if (!('createdByUserId' in copy)) { copy.createdByUserId = undefined; changed = true }
    if (!('ownerMemberId' in copy))   { copy.ownerMemberId   = undefined; changed = true }

    // NEW: Guarantee tags is always an array
    const normTags = normalizeTags(copy.tags)
    if (normTags.changed) { copy.tags = normTags.value; changed = true }

    return copy
  })

  if (changed) {
    try { localStorage.setItem(LS_EVENTS, JSON.stringify(next)) } catch {}
  }
}

function normalizeTags(tags: unknown): { value: string[]; changed: boolean } {
  if (Array.isArray(tags)) {
    // Coerce to strings & filter empties
    const arr = tags.map(String).filter(Boolean)
    return { value: arr, changed: arr.length !== tags.length || arr.some((v, i) => v !== String((tags as any[])[i])) }
  }
  if (typeof tags === 'string') {
    const trimmed = tags.trim()
    return { value: trimmed ? [trimmed] : [], changed: true }
  }
  return { value: [], changed: tags !== undefined } // if undefined or other type, set to [] and mark changed if not already undefined
}

function uid(): string {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('')
}
