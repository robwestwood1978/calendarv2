// frontend/src/App.tsx
// Layout component (matches your Slice A/B): header + Outlet + bottom nav.
// No routes here (they remain in main.tsx). No "My agenda" UI.
// AuthProvider wraps the layout so AccountMenu works when the flag is ON.

import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import AccountMenu from './components/AccountMenu'

export default function AppLayout() {
  return (
    <AuthProvider>
      <div className="app-shell" style={{ minHeight: '100dvh', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
        <Header />
        <main style={{ padding: 16 }}>
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </AuthProvider>
  )
}

function Header() {
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
      {/* AccountMenu hides itself when auth flag is OFF */}
      <AccountMenu />
    </header>
  )
}

function BottomNav() {
  const linkStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 600,
    color: '#334155',
  }
  const active: React.CSSProperties = {
    background: '#eef2ff',
    color: '#1e3a8a',
  }
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
      <NavLink to="/" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}>Home</NavLink>
      <NavLink to="/calendar" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}>Calendar</NavLink>
      <NavLink to="/lists" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}>Lists</NavLink>
      <NavLink to="/chores" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}>Chores</NavLink>
      <NavLink to="/meals" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}>Meals</NavLink>
      <NavLink to="/settings" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}>Settings</NavLink>
    </nav>
  )
}
