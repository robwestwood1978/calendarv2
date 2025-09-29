// src/auth/AuthProvider.tsx
// Offline-first Auth context (email+password hashed in-browser).
// - No plaintext passwords stored.
// - Seed users created idempotently if fc_users_v1 is missing.
// - Session tracked in fc_session_v1.
// - Exposes role helpers & basic permission helpers for later decorators.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  PropsWithChildren,
} from 'react';
import { getFeatureFlags } from '../state/featureFlags';

export type Role = 'parent' | 'adult' | 'child';

export type User = {
  id: string;
  email: string;
  displayName?: string;
  role: Role;
  linkedMemberIds: string[]; // Member IDs this user cares about ("My agenda")
  salt: string;              // per-user salt
  passwordHash: string;      // sha256(salt + password) hex string
  createdAt: string;         // ISO
};

type Session = {
  currentUserId: string | null;
};

const LS_USERS = 'fc_users_v1';
const LS_SESSION = 'fc_session_v1';

// ---- utils ----
function uid(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readUsers(): User[] {
  try {
    const raw = localStorage.getItem(LS_USERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeUsers(users: User[]) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

function readSession(): Session {
  try {
    const raw = localStorage.getItem(LS_SESSION);
    if (!raw) return { currentUserId: null };
    const parsed = JSON.parse(raw);
    return { currentUserId: parsed?.currentUserId ?? null };
  } catch {
    return { currentUserId: null };
  }
}

function writeSession(session: Session) {
  localStorage.setItem(LS_SESSION, JSON.stringify(session));
}

// ---- seed users (idempotent) ----
// Fixed salts so the hashes are deterministic and we don't store plaintext.
const SEEDS: Array<{ email: string; role: Role; password: string; salt: string; displayName: string }> = [
  { email: 'parent@local.test', role: 'parent', password: 'parent123', salt: 's1', displayName: 'Parent' },
  { email: 'adult@local.test',  role: 'adult',  password: 'adult123',  salt: 's2', displayName: 'Adult'  },
  { email: 'child@local.test',  role: 'child',  password: 'child123',  salt: 's3', displayName: 'Child'  },
];

// Pre-computed SHA-256(salt + password) hex to avoid async seeding on boot.
// s1+parent123, s2+adult123, s3+child123
const SEED_HASHES: Record<string, string> = {
  'parent@local.test': '3a8b5e417fef1433fec78f2fb9d7509ed6bcf6f0b5a570f0a099e6cf178430a8',
  'adult@local.test':  '6c1e0233f5ccf0af36b5cc5e80ed5ba95c67bddfb385f84c407f7518287eded4',
  'child@local.test':  '65af9258aa5dce392560d2fb5c93ccd4f6cd3bf9a65130bfd044a62391615e81',
};

function ensureSeedUsers() {
  const existing = readUsers();
  if (existing.length > 0) return; // idempotent
  const now = new Date().toISOString();
  const seeded: User[] = SEEDS.map((s) => ({
    id: uid(),
    email: s.email,
    displayName: s.displayName,
    role: s.role,
    linkedMemberIds: [],
    salt: s.salt,
    passwordHash: SEED_HASHES[s.email],
    createdAt: now,
  }));
  writeUsers(seeded);
}

// ---- context ----
type AuthContextValue = {
  users: User[];
  currentUser: User | null;

  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  signOut: () => void;

  createUser: (email: string, password: string, role: Role, displayName?: string) => Promise<User>;
  deleteUser: (userId: string) => void;

  linkMember: (memberId: string) => void;
  unlinkMember: (memberId: string) => void;

  isParent: boolean;
  isAdult: boolean;
  isChild: boolean;

  canChangeSettings: boolean;
  // Event permission hint (exact enforcement will be in events-agenda decorator)
  canEditEvent: (evt: any) => boolean;

  // Allow self-demotion only (no promotions here)
  selfDemote: (nextRole: Role) => { ok: boolean; reason?: string };

  reload: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren<{}>) {
  // Seed users once (safe if feature flag is OFF – they will be invisible)
  useEffect(() => {
    ensureSeedUsers();
  }, []);

  const [users, setUsers] = useState<User[]>(() => readUsers());
  const [session, setSession] = useState<Session>(() => readSession());

  const currentUser = useMemo(
    () => users.find((u) => u.id === session.currentUserId) ?? null,
    [users, session.currentUserId]
  );

  // Keep state in sync if another tab changes storage
  useEffect(() => {
    const storageHandler = (e: StorageEvent) => {
      if (e.key === LS_USERS) setUsers(readUsers());
      if (e.key === LS_SESSION) setSession(readSession());
    };
    window.addEventListener('storage', storageHandler);
    return () => window.removeEventListener('storage', storageHandler);
  }, []);

  const persistUsers = useCallback((next: User[]) => {
    writeUsers(next);
    setUsers(next);
  }, []);

  const reload = useCallback(() => {
    setUsers(readUsers());
    setSession(readSession());
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { authEnabled } = getFeatureFlags();
    if (!authEnabled) {
      return { ok: false, reason: 'Authentication is disabled.' };
    }
    const user = readUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return { ok: false, reason: 'Account not found.' };
    }
    const hash = await sha256Hex(user.salt + password);
    if (hash !== user.passwordHash) {
      return { ok: false, reason: 'Incorrect password.' };
    }
    const nextSession: Session = { currentUserId: user.id };
    writeSession(nextSession);
    setSession(nextSession);
    return { ok: true };
  }, []);

  const signOut = useCallback(() => {
    const { authEnabled } = getFeatureFlags();
    if (!authEnabled) return;
    writeSession({ currentUserId: null });
    setSession({ currentUserId: null });
  }, []);

  const createUser = useCallback(
    async (email: string, password: string, role: Role, displayName?: string) => {
      const salt = uid().slice(0, 8); // short readable salt
      const passwordHash = await sha256Hex(salt + password);
      const newUser: User = {
        id: uid(),
        email,
        displayName: displayName || email.split('@')[0],
        role,
        linkedMemberIds: [],
        salt,
        passwordHash,
        createdAt: new Date().toISOString(),
      };
      const next = [...readUsers(), newUser];
      persistUsers(next);
      return newUser;
    },
    [persistUsers]
  );

  const deleteUser = useCallback(
    (userId: string) => {
      const next = readUsers().filter((u) => u.id !== userId);
      persistUsers(next);
      // Clear session if we deleted the signed-in user
      if (session.currentUserId === userId) {
        writeSession({ currentUserId: null });
        setSession({ currentUserId: null });
      }
    },
    [persistUsers, session.currentUserId]
  );

  const linkMember = useCallback(
    (memberId: string) => {
      if (!currentUser) return;
      if (currentUser.linkedMemberIds.includes(memberId)) return;
      const nextUsers = readUsers().map((u) =>
        u.id === currentUser.id
          ? { ...u, linkedMemberIds: [...u.linkedMemberIds, memberId] }
          : u
      );
      persistUsers(nextUsers);
    },
    [currentUser, persistUsers]
  );

  const unlinkMember = useCallback(
    (memberId: string) => {
      if (!currentUser) return;
      const nextUsers = readUsers().map((u) =>
        u.id === currentUser.id
          ? { ...u, linkedMemberIds: u.linkedMemberIds.filter((m) => m !== memberId) }
          : u
      );
      persistUsers(nextUsers);
    },
    [currentUser, persistUsers]
  );

  const isParent = currentUser?.role === 'parent';
  const isAdult = currentUser?.role === 'adult';
  const isChild = currentUser?.role === 'child';

  const canChangeSettings = !!currentUser && currentUser.role === 'parent';

  const canEditEvent = useCallback(
    (evt: any) => {
      // Parent: always
      if (currentUser?.role === 'parent') return true;
      // Child: never
      if (currentUser?.role === 'child') return false;
      // Adult: only where one of their linked members is attendee/responsible/owner
      if (currentUser?.role === 'adult') {
        const mine = new Set(currentUser.linkedMemberIds || []);
        const attendees: string[] =
          evt?.attendeeIds || evt?.attendees || evt?.members || []; // flexible field names
        const responsible: string | undefined = evt?.responsibleId || evt?.responsibleMemberId;
        const owner: string | undefined = evt?.ownerMemberId;
        const overlap = Array.isArray(attendees) ? attendees.some((m) => mine.has(m)) : false;
        if (overlap) return true;
        if (responsible && mine.has(responsible)) return true;
        if (owner && mine.has(owner)) return true;
        return false;
      }
      // Not signed-in → treat as full access (Slice B behaviour). Actual gating happens only when flag is ON.
      return true;
    },
    [currentUser]
  );

  const selfDemote = useCallback(
    (nextRole: Role) => {
      if (!currentUser) return { ok: false, reason: 'Not signed in.' };
      const order: Role[] = ['parent', 'adult', 'child'];
      const canDemote = order.indexOf(nextRole) > order.indexOf(currentUser.role);
      if (!canDemote) {
        return { ok: false, reason: 'You can only demote your own role, not promote.' };
      }
      const next = readUsers().map((u) =>
        u.id === currentUser.id ? { ...u, role: nextRole } : u
      );
      persistUsers(next);
      return { ok: true };
    },
    [currentUser, persistUsers]
  );

  const value: AuthContextValue = {
    users,
    currentUser,
    signIn,
    signOut,
    createUser,
    deleteUser,
    linkMember,
    unlinkMember,
    isParent,
    isAdult,
    isChild,
    canChangeSettings,
    canEditEvent,
    selfDemote,
    reload,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider />');
  }
  return ctx;
}
