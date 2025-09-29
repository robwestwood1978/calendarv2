// frontend/src/pages/Settings.tsx
// Baseline Settings page (keeps your AdminPanel) + additive Slice C toggle & Account panel.
// Uses the corrected hook contract: `useSettings()` returns the settings object itself.

import React from 'react'
import AdminPanel from '../components/AdminPanel'
import { useFeatureFlags, setAuthEnabled } from '../state/featureFlags'
import { useAuth } from '../auth/AuthProvider'
import { useSettings } from '../state/settings'

export default function Settings() {
  const [flags, setFlags] = useFeatureFlags()

  return (
    <div>
      <h2 className="text-xl font-semibold">Settings</h2>

      {/* Baseline content stays first */}
      <AdminPanel />

      {/* Additive, compact Slice C controls (flag-gated) */}
      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={!!flags.authEnabled}
            onChange={(e) => {
              setAuthEnabled(e.target.checked)
              setFlags({ ...flags, authEnabled: e.target.checked })
            }}
          />
          <span>Enable accounts &amp; “My agenda”</span>
        </label>
        {!flags.authEnabled ? (
          <p style={{ marginTop: 6, color: '#64748b', fontSize: 13 }}>
            When disabled, the app behaves exactly like Slice A/B. Seed users: <code>parent@local.test</code>, <code>adult@local.test</code>, <code>child@local.test</code>
          </p>
        ) : null}
      </div>

      {/* Account panel appears only when the flag is ON */}
      {flags.authEnabled ? <AccountPanel /> : null}
    </div>
  )
}

function AccountPanel() {
  const settings = useSettings() // ✅ settings object (has members array)
  const { currentUser, users, linkMember, unlinkMember, selfDemote, reload, isParent, isAdult, isChild } = useAuth()

  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Account</h3>

      {currentUser ? (
        <>
          <Row label="Signed in as" value={currentUser.email} />
          <Row label="Role" value={isParent ? 'Parent' : isAdult ? 'Adult' : isChild ? 'Child' : 'Guest'} />

          <div style={{ height: 8 }} />
          <div style={{ fontWeight: 700, fontSize: 14 }}>Linked members</div>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            “My agenda” will only show events for linked members.
          </p>
          <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
            {(settings.members || []).map((m) => {
              const linked = currentUser.linkedMemberIds.includes(m.id)
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 12, height: 12, borderRadius: 4,
                        background: m.colour || '#e5e7eb', border: '1px solid #cbd5e1'
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
              )
            })}
          </div>

          <div style={{ height: 12 }} />
          <div style={{ fontWeight: 700, fontSize: 14 }}>Role options</div>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            You can demote your own role (e.g., Parent → Adult → Child).
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
          <p style={{ color: '#64748b', fontSize: 13 }}>
            Not signed in. Use the header menu to sign in with a seed account.
          </p>
          <div style={{ color: '#0f172a', fontSize: 13, marginTop: 6 }}>
            <strong>Seed users:</strong> <code>parent@local.test</code>, <code>adult@local.test</code>, <code>child@local.test</code>
          </div>
        </>
      )}

      <div style={{ height: 12 }} />
      <div style={{ fontWeight: 700, fontSize: 14 }}>All local users</div>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
        Stored in your browser only. Clear via your browser storage settings.
      </p>
      <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
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
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, alignItems: 'center' }}>
      <div style={{ fontSize: 13, color: '#64748b' }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  background: '#0ea5e9', color: '#ffffff', fontWeight: 700,
  border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  background: '#f1f5f9', color: '#0f172a', fontWeight: 700,
  border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
}
