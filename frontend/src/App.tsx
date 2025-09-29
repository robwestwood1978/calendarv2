// src/App.tsx
// Router-light App: assumes the Router is created in main.tsx (baseline behaviour).
// Keeps Slice C providers, migration, header AccountMenu, and bottom nav.
// No route changes and no Calendar/Event logic touched.

import React, { useEffect } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { SettingsProvider, useSettings } from './state/settings';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import AccountMenu from './components/AccountMenu';
import { migrateSliceC } from './lib/migrateSliceC';
import { useFeatureFlags } from './state/featureFlags';

import Home from './pages/Home';
import CalendarPage from './pages/Calendar';
import SettingsPage from './pages/Settings';

function AppRoot() {
  // Run idempotent migrations once on mount
  useEffect(() => {
    migrateSliceC();
  }, []);

  return (
    <SettingsProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </SettingsProvider>
  );
}

function Shell() {
  return (
    <div
      className="app-shell"
      style={{ minHeight: '100dvh', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}
    >
      <Header />
      <main style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

function Header() {
  const [flags] = useFeatureFlags();
  const { settings, setMyAgendaOnly } = useSettings();
  const { currentUser } = useAuth();

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderBottom: '1px solid #e5e7eb',
        background: '#ffffff',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Family Calendar</div>
      <div style={{ flex: 1 }} />
      {flags.authEnabled && currentUser ? (
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: '#334155',
            marginRight: 8,
          }}
          title="Show only events for my linked members"
        >
          <input
            type="checkbox"
            checked={!!settings.myAgendaOnly}
            onChange={(e) => setMyAgendaOnly(e.target.checked)}
          />
          My agenda
        </label>
      ) : null}
      <AccountMenu />
    </header>
  );
}

function BottomNav() {
  const linkStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 600,
    color: '#334155',
  };
  const active: React.CSSProperties = {
    background: '#eef2ff',
    color: '#1e3a8a',
  };

  return (
    <nav
      style={{
        position: 'sticky',
        bottom: 0,
        background: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        padding: 12,
        display: 'flex',
        gap: 12,
        justifyContent: 'space-around',
      }}
    >
      <NavLink to="/" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}>
        Home
      </NavLink>
      <NavLink
        to="/calendar"
        style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}
      >
        Calendar
      </NavLink>
      <NavLink
        to="/settings"
        style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}
      >
        Settings
      </NavLink>
    </nav>
  );
}

export default AppRoot;
