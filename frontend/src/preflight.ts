// src/preflight.ts
// Runs *before* the app loads to ensure localStorage has safe shapes for legacy readers.

import { migrateSliceC } from './lib/migrateSliceC';

// Run idempotent migration immediately so fc_settings_v3 is safe (members: [])
migrateSliceC();

// Extra belt-and-braces: if someone cleared storage between builds, ensure shape again
try {
  const LS_SETTINGS = 'fc_settings_v3';
  const raw = localStorage.getItem(LS_SETTINGS);
  const parsed = raw ? JSON.parse(raw) : {};
  const next = {
    ...parsed,
    members: Array.isArray(parsed?.members) ? parsed.members : [],
    weekStartMonday: typeof parsed?.weekStartMonday === 'boolean' ? parsed.weekStartMonday : false,
    timeFormat24h: typeof parsed?.timeFormat24h === 'boolean' ? parsed.timeFormat24h : true,
    defaultDurationMins: typeof parsed?.defaultDurationMins === 'number' ? parsed.defaultDurationMins : 60,
    myAgendaOnly: typeof parsed?.myAgendaOnly === 'boolean' ? parsed.myAgendaOnly : false,
  };
  if (JSON.stringify(parsed) !== JSON.stringify(next)) {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(next));
  }
} catch {
  // ignore — localStorage not available (SSR) or JSON parse error; app will still boot
}
