// src/pages/Home.tsx
// Restored baseline behaviour: upcoming agenda, who's going chips, quick-add.
// No "My agenda" UI (parked). Reads directly from storage, not filtered.

import React, { useMemo } from 'react';
import { DateTime } from 'luxon';
import { fmt, listMembers, readEventsRaw } from '../state/settings';

type AnyEvent = {
  id: string;
  title?: string;
  start?: string;
  end?: string;
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
};

export default function Home() {
  const members = listMembers(); // guaranteed array
  const memberIndex = useMemo(() => {
    const idx = new Map<string, { id: string; name: string; colour?: string }>();
    (members || []).forEach((m) => idx.set(m.id, m));
    return idx;
  }, [members]);

  const upcoming: AnyEvent[] = useMemo(() => {
    const now = DateTime.local();
    return (readEventsRaw() as AnyEvent[])
      .filter((e) => {
        const end = e?.end ? DateTime.fromISO(e.end) : null;
        return end ? end >= now : true;
      })
      .sort((a, b) => DateTime.fromISO(a.start || '').toMillis() - DateTime.fromISO(b.start || '').toMillis())
      .slice(0, 12);
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold">Home</h2>

      <section style={panel}>
        <h3 style={h3}>Upcoming</h3>
        {upcoming.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 14 }}>No upcoming events.</div>
        ) : (
          <ul style={listStyle}>
            {upcoming.map((e) => (
              <li key={e.id} style={row}>
                <div style={{ minWidth: 120 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>
                    {safeDay(e.start)}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {e.allDay ? 'All day' : `${safeTime(e.start)}${e.end ? ` – ${safeTime(e.end)}` : ''}`}
                  </div>
                </div>
                <div style={{ flex: 1, fontWeight: 600, color: '#0f172a' }}>
                  {e.title || 'Untitled'}
                </div>
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
                  {renderExtras(e, memberIndex)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <a href="/calendar?new=1" title="Quick add event" aria-label="Quick add event" style={fab}>+</a>
    </div>
  );
}

function attendeeIds(e: AnyEvent): string[] {
  if (Array.isArray(e.attendeeIds)) return e.attendeeIds;
  if (Array.isArray(e.attendees)) return e.attendees;
  if (Array.isArray(e.members)) return e.members;
  return [];
}

function renderExtras(
  e: AnyEvent,
  members: Map<string, { id: string; name: string; colour?: string }>
) {
  const chips: React.ReactNode[] = [];
  const resp = e.responsibleId || e.responsibleMemberId;
  if (resp && !attendeeIds(e).includes(resp)) {
    const m = members.get(resp);
    chips.push(<span key={`r-${resp}`} className="fc-badge" title="Responsible">Resp: {m?.name || '—'}</span>);
  }
  const owner = e.ownerMemberId;
  if (owner && !attendeeIds(e).includes(owner)) {
    const m = members.get(owner);
    chips.push(<span key={`o-${owner}`} className="fc-badge" title="Owner">Owner: {m?.name || '—'}</span>);
  }
  const bring = normaliseBring(e);
  if (bring) chips.push(<span key="bring" className="fc-badge" title="What to bring">{bring}</span>);
  return chips;
}

function normaliseBring(e: AnyEvent): string | null {
  const fromArrayish = (v: unknown) =>
    Array.isArray(v) ? v.filter(Boolean).join(', ') : typeof v === 'string' ? v.trim() : null;

  return (
    fromArrayish((e as any).bring) ||
    fromArrayish((e as any).items) ||
    fromArrayish((e as any).packingList) ||
    fromArrayish((e as any)?.notes?.bring) ||
    fromArrayish((e as any)?.notes?.items) ||
    null
  );
}

function safeDay(iso?: string) { try { return iso ? fmt.day(DateTime.fromISO(iso)) : '—'; } catch { return '—'; } }
function safeTime(iso?: string) { try { return iso ? fmt.time(DateTime.fromISO(iso)) : '—'; } catch { return '—'; } }

const panel: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#ffffff', marginTop: 12 };
const h3: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 10 };
const listStyle: React.CSSProperties = { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f8fafc' };
const fab: React.CSSProperties = { position: 'fixed', right: 16, bottom: 76, width: 48, height: 48, borderRadius: 999, display: 'grid', placeItems: 'center', textDecoration: 'none', background: '#0ea5e9', color: '#fff', fontSize: 28, fontWeight: 700, boxShadow: '0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)' };
