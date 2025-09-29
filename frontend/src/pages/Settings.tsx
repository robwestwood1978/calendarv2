// src/pages/Settings.tsx
// Adds: Slice C feature flag toggle, Account panel (who I am, link/unlink members),
// self-demotion, and a seed-users hint. All additions are non-breaking & flag-gated.

import React, { useMemo } from 'react';
import { useSettings } from '../state/settings';
import { useFeatureFlags, setAuthEnabled } from '../state/featureFlags';
import { useAuth } from '../auth/AuthProvider';

export default function SettingsPage() {
  const [flags] = useFeatureFlags();

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <h2 className="text-xl font-semibold">Settings</h2>

      <section style={panel}>
        <h3 style={h3}>Experiments</h3>
        <div style={{ fontSize: 14, color: '#334155' }}>
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <FlagToggle />
            Enable accounts &amp; “My agenda”
          </label>
          <p style={{ marginTop: 8, color: '#64748b' }}>
            When disabled, the app behaves exactly like Slice A/B.
          </p>
        </div>
      </section>

      {flags.authEnabled ? <AccountPanel /> : <SeedHint />}
    </div>
  );
}

function FlagToggle() {
  const [flags, setFlags] = useFeatureFlags();
  return (
    <input
      type="checkbox"
      checked={!!flags.authEnabled}
      onChange={(e) => {
        setAuthEnabled(e.target.checked);
        setFlags({ ...flags, authEnabled: e.target.checked });
      }}
    />
  );
}

function SeedHint() {
  return (
    <section style={panel}>
      <h3 style={h3}>Accounts (Slice C)</h3>
      <p style={{ color: '#64748b', fontSize: 14 }}>
        Turn on the feature to use local-only sign in and “My agenda”. Seed users are available:
      </p>
      <ul style={ul}>
        <li><code>parent@local.test</code> / <code>parent123</code></li>
        <li><code>adult@local.test</code> / <code>adult123</code></li>
        <li><code>child@local.test</code> / <code>child123</code></li>
      </ul>
    </section>
  );
}

function AccountPanel() {
  const { settings } = useSettings();
  const { currentUser, users, linkMember, unlinkMember, selfDemote, reload, isParent, isAdult, isChild } = useAuth();

  return (
    <section style={panel}>
      <h3 style={h3}>Account</h3>

      {currentUser ? (
        <>
          <Row label="Signed in as" value={currentUser.email} />
          <Row label="Role" value={roleLabel({ isParent, isAdult, isChild })} />

          <div style={{ height: 8 }} />
          <h4 style={h4}>Linked members</h4>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            “My agenda” will only show events for linked members.
          </p>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {(settings.members || []).map((m) => {
              const linked = currentUser.linkedMemberIds.includes(m.id);
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 4,
                        background: m.colour || '#e5e7eb',
                        display: 'inline-block',
                        border: '1px solid #cbd5e1',
                      }}
                      aria-hidden
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      {m.role ? <div style={{ fontSize: 12, color: '#64748b' }}>{m.role}</div> : null}
                    </div>
                  </div>
                  <div>
                    {linked ? (
                      <button style={btnSecondary} onClick={() => unlinkMember(m.id)}>Unlink</button>
                    ) : (
                      <button style={btnPrimary} onClick={() => linkMember(m.id)}>Link</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ height: 16 }} />
          <h4 style={h4}>Role options</h4>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            You can demote your own role (e.g., Parent → Adult → Child). Promotions are not allowed locally.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button style={btnSecondary} onClick={() => { const r = selfDemote('adult'); if (!r.ok) alert(r.reason); else reload(); }}>
              Demote to Adult
            </button>
            <button style={btnSecondary} onClick={() => { const r = selfDemote('child'); if (!r.ok) alert(r.reason); else reload(); }}>
              Demote to Child
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ color: '#64748b', fontSize: 14 }}>
            Not signed in. Use the header menu to sign in with a seed account.
          </p>
          <div style={{ color: '#0f172a', fontSize: 14, marginTop: 8 }}>
            <strong>Seed users:</strong>{' '}
            <code>parent@local.test</code>, <code>adult@local.test</code>, <code>child@local.test</code>
          </div>
        </>
      )}

      <div style={{ height: 16 }} />
      <h4 style={h4}>All local users</h4>
      <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
        These are stored in your browser only and can be cleared via your browser storage settings.
      </p>
      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        {users.map((u) => (
          <div key={u.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontWeight: 600 }}>{u.email}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Role: {u.role.charAt(0).toUpperCase() + u.role.slice(1)} · Linked: {u.linkedMemberIds.length}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function roleLabel({ isParent, isAdult, isChild }: { isParent: boolean; isAdult: boolean; isChild: boolean }) {
  return isParent ? 'Parent' : isAdult ? 'Adult' : isChild ? 'Child' : 'Guest';
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, alignItems: 'center' }}>
      <div style={{ fontSize: 13, color: '#64748b' }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
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

const h4: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  margin: 0,
};

const ul: React.CSSProperties = {
  marginTop: 8,
  paddingLeft: 18,
  color: '#0f172a',
  fontSize: 14,
};

const btnPrimary: React.CSSProperties = {
  background: '#0ea5e9',
  color: '#ffffff',
  fontWeight: 700,
  border: 'none',
  borderRadius: 8,
  padding: '8px 10px',
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  background: '#f1f5f9',
  color: '#0f172a',
  fontWeight: 700,
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '8px 10px',
  cursor: 'pointer',
};
