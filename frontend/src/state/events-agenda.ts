// src/state/events-agenda.ts
// Agenda & permissions helpers (no wiring yet).
// - Pure functions you can use to decorate event lists without changing Calendar/EventGrid/EventModal
// - Respect feature flag + current user linking.
// - Keep this module dependency-light: only import when you intentionally swap it in.

import { getFeatureFlags } from './featureFlags';
import { readEventsRaw } from './settings';
import { useAuth } from '../auth/AuthProvider';

// Event shape is intentionally loose for compatibility with Slice A/B.
export type AnyEvent = {
  id: string;
  title?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  attendeeIds?: string[]; // or "attendees" / "members" in older events
  attendees?: string[];
  members?: string[];
  responsibleId?: string;
  responsibleMemberId?: string;
  ownerMemberId?: string;
  createdByUserId?: string;
  // colour fields etc are preserved but not required here
};

function getAttendeeIds(evt: AnyEvent): string[] {
  if (Array.isArray(evt.attendeeIds)) return evt.attendeeIds;
  if (Array.isArray(evt.attendees)) return evt.attendees;
  if (Array.isArray(evt.members)) return evt.members;
  return [];
}

export function agendaFilter(
  events: AnyEvent[],
  opts: {
    myAgendaOnly: boolean;
    currentUser: { linkedMemberIds: string[] } | null;
    authEnabled: boolean;
  }
): AnyEvent[] {
  const { myAgendaOnly, currentUser, authEnabled } = opts;

  // If auth is disabled, or no user, or toggle off → return original events
  if (!authEnabled || !currentUser || !myAgendaOnly) return events;

  const mine = new Set(currentUser.linkedMemberIds || []);
  if (mine.size === 0) return []; // user has no linked members → empty agenda

  return events.filter((evt) => {
    const attendees = getAttendeeIds(evt);
    if (attendees.some((m) => mine.has(m))) return true;
    if (evt.responsibleId && mine.has(evt.responsibleId)) return true;
    if (evt.responsibleMemberId && mine.has(evt.responsibleMemberId)) return true;
    if (evt.ownerMemberId && mine.has(evt.ownerMemberId)) return true;
    return false;
  });
}

// Convenience: pull from storage and filter according to current context.
// This is *not* wired into Calendar yet — we’ll call it from Home/Calendar wrappers later.
export function listAgendaNow(
  ctx: { myAgendaOnly: boolean; currentUser: { linkedMemberIds: string[] } | null }
): AnyEvent[] {
  const flags = getFeatureFlags();
  const all = readEventsRaw();
  return agendaFilter(all, {
    myAgendaOnly: !!ctx.myAgendaOnly,
    currentUser: ctx.currentUser,
    authEnabled: !!flags.authEnabled,
  });
}

// Permission checks (to be used by writers later, so Calendar UX stays unchanged)
export function canEditAccordingToAuth(
  evt: AnyEvent,
  ctx: { role?: 'parent' | 'adult' | 'child'; linkedMemberIds?: string[] } | null,
  authEnabled: boolean
): boolean {
  // When auth is disabled, keep Slice A/B behaviour (full access)
  if (!authEnabled) return true;
  if (!ctx || !ctx.role) return false;

  if (ctx.role === 'parent') return true;
  if (ctx.role === 'child') return false;

  // Adult: only if event overlaps with user's linked members
  const mine = new Set(ctx.linkedMemberIds || []);
  const attendees = getAttendeeIds(evt);
  if (attendees.some((m) => mine.has(m))) return true;
  if (evt.responsibleId && mine.has(evt.responsibleId)) return true;
  if (evt.responsibleMemberId && mine.has(evt.responsibleMemberId)) return true;
  if (evt.ownerMemberId && mine.has(evt.ownerMemberId)) return true;

  return false;
}

// Optional React hook for convenience when you want the live filtered list on pages.
// (You will use this in Home page wiring; Calendar will keep its own workflows untouched.)
export function useAgendaList(): AnyEvent[] {
  // Lazy import to avoid circular deps; useAuth lives in auth/
  const { currentUser } = useAuth() as any;
  const flags = getFeatureFlags();
  const settingsRaw = localStorage.getItem('fc_settings_v3');
  const myAgendaOnly = settingsRaw ? !!JSON.parse(settingsRaw).myAgendaOnly : false;
  const all = readEventsRaw();
  return agendaFilter(all, {
    myAgendaOnly,
    currentUser,
    authEnabled: !!flags.authEnabled,
  });
}
