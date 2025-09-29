// src/lib/migrateSliceC.ts
// Idempotent migration for Slice C (safe on every load).
// Guarantees fc_settings_v3 exists and *always* has a members: [] array.
// Also ensures optional sync-ready fields on events are present (left undefined).

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
  // 1) Read whatever is there (or nothing)
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LS_SETTINGS);
  } catch {
    // continue with defaults
  }

  let parsed: AnyRecord = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) || {};
    } catch {
      parsed = {};
    }
  }

  // 2) Backfill *strong* defaults expected by legacy readers
  const hasMembersArray = Array.isArray(parsed.members);
  const next: AnyRecord = {
    ...parsed,
    // Always provide an array — legacy code does .members.map(...)
    members: hasMembersArray ? parsed.members : [],
  };

  // 3) Add Slice C flag key if missing (non-breaking)
  if (typeof next.myAgendaOnly === 'undefined') {
    next.myAgendaOnly = false;
  }

  // 4) Write back only if something actually changed
  const changed =
    !raw ||
    !hasMembersArray ||
    (typeof parsed.myAgendaOnly === 'undefined');

  if (changed) {
    try {
      localStorage.setItem(LS_SETTINGS, JSON.stringify(next));
    } catch {
      // ignore; nothing else we can do in local-only mode
    }
  }
}

function migrateEvents() {
  const raw = localStorage.getItem(LS_EVENTS);
  if (!raw) return;
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

    if (!copy.id) {
      copy.id = uid();
      changed = true;
    }
    if (!('createdByUserId' in copy)) {
      copy.createdByUserId = undefined;
      changed = true;
    }
    if (!('ownerMemberId' in copy)) {
      copy.ownerMemberId = undefined;
      changed = true;
    }
    return copy;
  });

  if (changed) {
    try {
      localStorage.setItem(LS_EVENTS, JSON.stringify(next));
    } catch {
      // ignore write errors
    }
  }
}

function uid(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('');
}
