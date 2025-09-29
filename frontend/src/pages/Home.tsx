// src/pages/Home.tsx
// Restores Slice A/B "Home" behaviour: upcoming agenda, who’s going, quick add.
// Slice C adds only a tiny "My agenda" toggle (shown only when flag is ON & a user is signed in).

import React, { useMemo } from 'react';
import { DateTime } from 'luxon';
import { useFeatureFlags } from '../state/featureFlags';
import { useAuth } from '../auth/AuthProvider';
import { useSettings, fmt, listMembers } from '../state/settings';
import { useAgendaList } from '../state/events-agenda';
import MyAgendaToggle from '../components/MyAgendaToggle';

type AnyEvent = {
  id: string;
  title?: string;
  start?: string; // ISO
  end?: string;   // ISO
  allDay?: boolean;
  attendeeIds?: string[];
  attendees?: string[];
  members?: string[];
  responsibleId?: string;
  responsibleMemberId?: string;
  ownerMemberId?: string;
  bring?: string | string[];
  items?: string | string[];
  packingList?: string | string[];
  notes?: any;
  colour?: string;
  color?: string;
};

export default function Home() {
  const [flags] = useFeatureFlags();
  const { currentUser } = useAuth();
  const { settings } = useSettings();

  // Pull the live event list (flag-aware; with flag OFF this returns full list).
  const all = useAgendaList();

  const memberIndex = useMemo(() => {
    const idx = new Map<string, { id: string; name: string; colour?: string }>();
    (listMembers() || []).forEach((m) => idx.set(m.id, m));
    return idx;
  }, [settings.members]); // settings.members is guaranteed array

  const upcoming: AnyEvent[] = useMemo(() => {
    const now = DateTime.local();
    return (all as AnyEvent[])
      .filter((e) => {
        // show items that are ongoing or upcoming
        const end = e?.end ? DateTime.fromISO(e.end) : null;
        return end ? end >= now : true;
      })
      .sort((a, b) => {
        const sa = DateTime.fromISO(a.start || '');
        const sb = DateTime.fromISO(b.start || '');
        return sa.toMillis() - sb.toMillis();
      })
      .slice(0, 12);
  }, [all]);

  return (
    <div>
      <h2 className="text-xl font-semibold">Home</h2>

      {/* Additive, flag-gated "My agenda" control */}
      {flags.authEnabled && currentUser ? (
        <div style={{ marginTop: 8 }}>
          <MyAgendaToggle />
        </div>
      ) : null}

      <section style={panel}>
        <h3 style={h3}>Upcoming</h3>
        {upcoming.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 14 }}>No upcoming events.</div>
        ) : (
          <ul style={listStyle}>
            {upcoming.map((e) => (
              <li key={e.id} style={row}>
                {/* When: date + time */}
                <div style={{ minWidth: 120 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>
                    {safeDay(e.start)}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {e.allDay
                      ? 'All day'
                      : `${safeTime(e.start)}${e.end ? ` – ${safeTime(e.end)}` : ''}`}
                  </div>
                </div>

                {/* What: title */}
                <div style={{ flex: 1, fontWeight: 600, color: '#0f172a' }}>
                  {e.title || 'Untitled'}
                </div>

                {/* Who: chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {attendeeIds(e).map((id) => {
                    const m = memberIndex.get(id);
                    return (
                      <span key={id} className="fc-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span
                          aria-hidden
                          style={{
                            width: 8, height: 8, borderRadius: 999,
                            background: m?.colour || '#94a3b8',
                            display: 'inline-block',
                          }}
                        />
                        <span>{m?.name || '—'}</span>
                      </span>
                    );
                  })}
                  {/* Responsible / Owner fallbacks */}
                  {renderIfExtra(e, memberIndex)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Floating quick add: keep it simple & non-intrusive (links to Calendar) */}
      <a
        href="/calendar?new=1"
        title="Quick add event"
        aria-label="Quick add event"
        style={fab}
      >
        +
      </a>
    </div>
  );
}

function attendeeIds(e: AnyEvent): string[] {
  if (Array.isArray(e.attendeeIds)) return e.attendeeIds;
  if (Array.isArray(e.attendees)) return e.attendees;
  if (Array.isArray(e.members)) return e.members;
  return [];
}

function renderIfExtra(
  e: AnyEvent,
  members: Map<string, { id: string; name: string; colour?: string }>
) {
  const chips: React.ReactNode[] = [];

  const responsible = e.responsibleId || e.responsibleMemberId;
  if (responsible && !attendeeIds(e).includes(responsible)) {
    const m = members.get(responsible);
    chips.push(
      <span key={`r-${responsible}`} className="fc-badge" title="Responsible">
        Resp: {m?.name || '—'}
      </span>
    );
  }

  const owner = e.ownerMemberId;
  if (owner && !attendeeIds(e).includes(owner)) {
    const m = members.get(owner);
    chips.push(
      <span key={`o-${owner}`} className="fc-badge" title="Owner">
        Owner: {m?.name || '—'}
      </span>
    );
  }

  const bringText = normaliseBring(e);
  if (bringText) {
    chips.push(
      <span key="bring" className="fc-badge" title="What to bring">{bringText}</span>
    );
  }

  return chips;
}

function normaliseBring(e: AnyEvent): string | null {
  const fromArrayish = (v: unknown) =>
    Array.isArray(v) ? v.filter(Boolean).join(', ') : typeof v === 'string' ? v.trim() : null;

  return (
    fromArrayish(e.bring) ||
    fromArrayish(e.items) ||
    fromArrayish(e.packingList) ||
    // allow a structured notes.bring or notes.items form
    fromArrayish((e as any)?.notes?.bring) ||
    fromArrayish((e as any)?.notes?.items) ||
    null
  );
}

function safeDay(iso?: string) {
  if (!iso) return '—';
  try { return fmt.day(DateTime.fromISO(iso)); } catch { return '—'; }
}
function safeTime(iso?: string) {
  if (!iso) return '—';
  try { return fmt.time(DateTime.fromISO(iso)); } catch { return '—'; }
}

// Styles kept lightweight and consistent with existing app CSS.
const panel: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 16,
  background: '#ffffff',
  marginTop: 12,
};

const h3: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  margin: 0,
  marginBottom: 10,
};

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: 8,
};

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  background: '#f8fafc',
};

const fab: React.CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 76, // above bottom nav
  width: 48,
  height: 48,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  textDecoration: 'none',
  background: '#0ea5e9',
  color: '#fff',
  fontSize: 28,
  fontWeight: 700,
  boxShadow:
    '0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)',
};
