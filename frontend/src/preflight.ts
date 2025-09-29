// frontend/src/preflight.ts
// Run before the app mounts so legacy readers see a safe fc_settings_v3 shape.

import { migrateSliceC } from './lib/migrateSliceC';

migrateSliceC();

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
  // ignore
}
