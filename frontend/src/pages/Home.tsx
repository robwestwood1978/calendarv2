// src/pages/Home.tsx
// Adds a small "My agenda" toolbar (in addition to the global header switch)
// and shows a concise upcoming list using the agenda helper.
// With auth OFF, this page renders exactly as before (no toggle, full list fallback).

import React, { useMemo } from 'react';
import { DateTime } from 'luxon';
import { useSettings, fmt } from '../state/settings';
import { useFeatureFlags } from '../state/featureFlags';
import { useAuth } from '../auth/AuthProvider';
import { useAgendaList } from '../state/events-agenda';

export default function Home() {
  const [flags] = useFeatureFlags();
  const { settings, setMyAgendaOnly } = useSettings();
  const { currentUser } = useAuth();

  // Live, filtered list when auth is enabled & user opted for "My agenda".
  const agenda = useAgendaList();

  // If auth is OFF, useAgendaList() returns the full list anyway,
  // so this remains non-breaking.
  const upcoming = useMemo(() => {
    const now = DateTime.local();
    return agenda
      .filter((e: any) => (e?.end ? DateTime.fromISO(e.end) >= now : true))
      .sort((a: any, b: any) => DateTime.fromISO(a.start).toMillis() - DateTime.fromISO(b.start).toMillis())
      .slice(0, 10);
  }, [agenda]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2 className="text-xl font-semibold">Home</h2>

      {/* Local toolbar (flag-gated). We also have the global header switch. */}
      {flags.authEnabled && currentUser ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={!!settings.myAgendaOnly}
              onChange={(e) => setMyAgendaOnly(e.target.checked)}
            />
            My agenda
          </label>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Showing {settings.myAgendaOnly ? 'linked members only' : 'all family events'}.
          </span>
        </div>
      ) : null}

      <section style={panel}>
        <h3 style={h3}>Upcoming</h3>
        {upcoming.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 14 }}>No upcoming events.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {upcoming.map((e: any) => (
              <li key={e.id} style={row}>
                <div style={{ minWidth: 120, color: '#334155' }}>
                  <div style={{ fontWeight: 700 }}>{fmt.day(DateTime.fromISO(e.start))}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {e.allDay ? 'All day' : `${fmt.time(DateTime.fromISO(e.start))} – ${fmt.time(DateTime.fromISO(e.end))}`}
                  </div>
                </div>
                <div style={{ flex: 1, fontWeight: 600 }}>{e.title || 'Untitled'}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const panel: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 16,
  background: '#ffffff',
};

const h3: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  margin: 0,
  marginBottom: 10,
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
