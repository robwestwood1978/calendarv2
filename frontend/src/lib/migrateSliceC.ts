// src/lib/migrateSliceC.ts
// Idempotent migration for Slice C (safe to run on every load).
// - Ensures settings include myAgendaOnly?: boolean (default false)
// - Ensures events retain stable id and optional sync-ready fields
//   createdByUserId? and ownerMemberId? (left undefined if unknown)
// - Leaves all Slice A/B data intact.

type AnyRecord = Record<string, any>;

const LS_SETTINGS = 'fc_settings_v3';
const LS_EVENTS = 'fc_events_v1';

export function migrateSliceC(): void {
  try {
    migrateSettings();
  } catch (e) {
    console.warn('[migrateSliceC] settings migration skipped:', e);
  }
  try {
    migrateEvents();
  } catch (e) {
    console.warn('[migrateSliceC] events migration skipped:', e);
  }
}

function migrateSettings() {
  const raw = localStorage.getItem(LS_SETTINGS);
  if (!raw) return; // nothing to do, Slice A/B will initialise as usual
  let parsed: AnyRecord;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  // Non-breaking: only add the key if missing.
  if (typeof parsed.myAgendaOnly === 'undefined') {
    parsed.myAgendaOnly = false;
    localStorage.setItem(LS_SETTINGS, JSON.stringify(parsed));
  }
}

function migrateEvents() {
  const raw = localStorage.getItem(LS_EVENTS);
  if (!raw) return; // no events yet
  let events: AnyRecord[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    events = parsed;
  } catch {
    return;
  }

  let changed = false;
  const next = events.map((evt) => {
    const copy = { ...evt };

    // Ensure a stable id (Slice A/B already creates one—this is defensive)
    if (!copy.id) {
      copy.id = uid();
      changed = true;
    }

    // Prepare sync-friendly optional ownership fields (do not infer)
    if (!('createdByUserId' in copy)) {
      copy.createdByUserId = undefined;
      changed = true;
    }
    if (!('ownerMemberId' in copy)) {
      // Owner can be set later (e.g., responsible adult/member)
      copy.ownerMemberId = undefined;
      changed = true;
    }
    return copy;
  });

  if (changed) {
    localStorage.setItem(LS_EVENTS, JSON.stringify(next));
  }
}

// Lightweight uid (defensive — events already have ids in Slice B)
function uid(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('');
}
