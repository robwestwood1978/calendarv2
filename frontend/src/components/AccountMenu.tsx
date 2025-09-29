// src/components/AccountMenu.tsx
// Header account control (avatar + dropdown).
// - Hidden entirely when authEnabled = false.
// - Minimal, dependency-free UI; small inline styles to avoid CSS regressions.

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useFeatureFlags } from '../state/featureFlags';

export default function AccountMenu() {
  const [flags] = useFeatureFlags();
  const { currentUser, signIn, signOut, isParent, isAdult, isChild } = useAuth();

  // When auth is disabled, render nothing (Slice B fidelity)
  if (!flags.authEnabled) return null;

  const roleLabel = isParent ? 'Parent' : isAdult ? 'Adult' : isChild ? 'Child' : 'Guest';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Dropdown
        trigger={
          <button
            aria-label="Account menu"
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: '1px solid #e5e7eb',
              background: '#f8fafc',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {currentUser ? initial(currentUser) : '↪'}
          </button>
        }
      >
        {currentUser ? (
          <SignedInPanel email={currentUser.email} role={roleLabel} onSignOut={signOut} />
        ) : (
          <SignInPanel onSubmit={signIn} />
        )}
      </Dropdown>
    </div>
  );
}

function initial(u: { email?: string; displayName?: string }) {
  const source = u.displayName || u.email || '?';
  const c = source.trim().charAt(0).toUpperCase();
  return c || '?';
}

function Dropdown({
  trigger,
  children,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            marginTop: 8,
            minWidth: 260,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            boxShadow:
              '0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)',
            padding: 12,
            zIndex: 50,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function LabeledRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 13, color: '#334155', marginBottom: 6 }}>
      <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function SignedInPanel({
  email,
  role,
  onSignOut,
}: {
  email: string;
  role: string;
  onSignOut: () => void;
}) {
  return (
    <div>
      <LabeledRow label="Signed in" value={email} />
      <LabeledRow label="Role" value={role} />
      <div style={{ height: 8 }} />
      <button
        onClick={onSignOut}
        style={{
          width: '100%',
          background: '#0ea5e9',
          color: '#ffffff',
          fontWeight: 600,
          border: 'none',
          borderRadius: 8,
          padding: '10px 12px',
          cursor: 'pointer',
        }}
      >
        Sign out
      </button>
    </div>
  );
}

function SignInPanel({
  onSubmit,
}: {
  onSubmit: (
    email: string,
    password: string
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    setBusy(true);
    setError(null);
    const res = await onSubmit(email.trim(), password);
    setBusy(false);
    if ('ok' in res && res.ok) {
      // dropdown will close when user clicks away; we keep it simple.
      return;
    }
    setError((res as any).reason || 'Could not sign in.');
  }

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Sign in</div>
      <div style={{ display: 'grid', gap: 8 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          style={inputStyle}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          style={inputStyle}
        />
        {error && (
          <div style={{ color: '#b91c1c', fontSize: 12 }}>{error}</div>
        )}
        <button
          onClick={handle}
          disabled={busy}
          style={{
            background: '#0ea5e9',
            color: '#ffffff',
            fontWeight: 600,
            border: 'none',
            borderRadius: 8,
            padding: '10px 12px',
            cursor: 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          Hint: use the seed accounts when enabled in Settings.  
          <code>parent@local.test</code>, <code>adult@local.test</code>, <code>child@local.test</code>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
};
