import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearCurrentOrgCacheForUser,
  setCurrentOrgCacheForUser,
} from '@/shared/auth/hooks/useCurrentOrgCache';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';

export interface CurrentOrgContextValue {
  organizationId: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  currentOrg: { id: string } | null;
}

const CurrentOrgContext = createContext<CurrentOrgContextValue | undefined>(undefined);

/**
 * Mirrors active org from `CentralizedUserDataContext` — avoids duplicate `auth.getUser()` + `profiles`.
 */
export function CurrentOrgProvider({ children }: { children: React.ReactNode }) {
  const {
    user,
    userData,
    loading: centralLoading,
    centralProfileHydrated,
    error: centralError,
    forceRefreshUserData,
  } = useCentralizedUserData();

  const [overrideOrgId, setOverrideOrgId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: CustomEvent<{ organizationId?: string }>) => {
      const newOrgId = event.detail?.organizationId;
      if (newOrgId) setOverrideOrgId(newOrgId);
    };
    window.addEventListener('organization-switched', handler as EventListener);
    return () => window.removeEventListener('organization-switched', handler as EventListener);
  }, []);

  // Only clear override once central data has caught up to the same org (or no override).
  useEffect(() => {
    if (!overrideOrgId) return;
    if (userData?.active_organization_id === overrideOrgId) {
      setOverrideOrgId(null);
    }
  }, [userData?.active_organization_id, overrideOrgId]);

  useEffect(() => {
    if (user?.id && userData?.active_organization_id) {
      setCurrentOrgCacheForUser(user.id, overrideOrgId ?? userData.active_organization_id);
    }
    if (!user?.id) {
      setOverrideOrgId(null);
    }
  }, [user?.id, userData?.active_organization_id, overrideOrgId]);

  const organizationId = overrideOrgId ?? userData?.active_organization_id ?? null;
  const loading = Boolean(user?.id) && (centralLoading || !centralProfileHydrated);
  const error = centralError?.message ?? null;

  const refetch = useCallback(async () => {
    if (user?.id) {
      clearCurrentOrgCacheForUser(user.id);
    }
    await forceRefreshUserData();
  }, [forceRefreshUserData, user?.id]);

  const value = useMemo<CurrentOrgContextValue>(
    () => ({
      organizationId,
      loading,
      error,
      refetch,
      currentOrg: organizationId ? { id: organizationId } : null,
    }),
    [organizationId, loading, error, refetch],
  );

  return <CurrentOrgContext.Provider value={value}>{children}</CurrentOrgContext.Provider>;
}

export function useCurrentOrgContext(): CurrentOrgContextValue {
  const ctx = useContext(CurrentOrgContext);
  if (ctx === undefined) {
    throw new Error('useCurrentOrg must be used within CurrentOrgProvider');
  }
  return ctx;
}
