// src/state/featureFlags.ts
// Local-only feature flags for gated, additive features.
// Default: authEnabled = false (Slice C completely OFF by default)

import { useEffect, useState } from 'react';

export type FeatureFlags = {
  authEnabled: boolean;
};

const LS_KEY = 'fc_feature_flags_v1';

function readFlags(): FeatureFlags {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { authEnabled: false };
    const parsed = JSON.parse(raw);
    return {
      authEnabled: !!parsed.authEnabled,
    };
  } catch {
    return { authEnabled: false };
  }
}

function writeFlags(flags: FeatureFlags) {
  localStorage.setItem(LS_KEY, JSON.stringify(flags));
}

export function getFeatureFlags(): FeatureFlags {
  return readFlags();
}

export function setFeatureFlags(next: FeatureFlags) {
  writeFlags(next);
  // Broadcast change for other hooks/components
  window.dispatchEvent(new CustomEvent('fc:featureflags:changed'));
}

export function setAuthEnabled(enabled: boolean) {
  const prev = readFlags();
  writeFlags({ ...prev, authEnabled: enabled });
  window.dispatchEvent(new CustomEvent('fc:featureflags:changed'));
}

export function useFeatureFlags(): [FeatureFlags, (next: FeatureFlags) => void] {
  const [flags, setFlags] = useState<FeatureFlags>(readFlags());

  useEffect(() => {
    const handler = () => setFlags(readFlags());
    window.addEventListener('fc:featureflags:changed', handler);
    // Also react to manual localStorage changes (other tabs)
    const storageHandler = (e: StorageEvent) => {
      if (e.key === LS_KEY) handler();
    };
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('fc:featureflags:changed', handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  const update = (next: FeatureFlags) => setFeatureFlags(next);

  return [flags, update];
}
