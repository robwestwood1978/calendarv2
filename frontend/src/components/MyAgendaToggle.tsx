// src/components/MyAgendaToggle.tsx
// Reusable, flag-gated "My agenda" toggle control.
// Use anywhere (e.g., headers, page toolbars). No side effects when auth is OFF.

import React from 'react';
import { useFeatureFlags } from '../state/featureFlags';
import { useAuth } from '../auth/AuthProvider';
import { useSettings } from '../state/settings';

export default function MyAgendaToggle({
  compact = false,
  align = 'left',
}: {
  compact?: boolean;
  align?: 'left' | 'right';
}) {
  const [flags] = useFeatureFlags();
  const { currentUser } = useAuth();
  const { settings, setMyAgendaOnly } = useSettings();

  if (!flags.authEnabled || !currentUser) return null;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 6 : 8,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 6 : 8, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={!!settings.myAgendaOnly}
          onChange={(e) => setMyAgendaOnly(e.target.checked)}
        />
        <span>My agenda</span>
      </label>
    </div>
  );
}
