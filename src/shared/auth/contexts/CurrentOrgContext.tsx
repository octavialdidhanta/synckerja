import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import {
  clearCurrentOrgCacheForUser,
  setCurrentOrgCacheForUser,
} from '@/shared/auth/hooks/useCurrentOrgCache';
export interface CurrentOrgContextValue {
  organizationId: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  currentOrg: { id: string } | null;
}

const CurrentOrgContext = createContext<CurrentOrgContextValue | undefined>(undefined);

export function CurrentOrgProvider({ children }: { children: React.ReactNode }) {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Snapshot for fetchFromProfile: jangan setLoading(true) saat refetch jika org sudah ada (tab resume / SIGNED_IN ulang) — semua halaman desktop+mobile ikut useCurrentOrg(). */
  const organizationIdRef = useRef<string | null>(null);
  useEffect(() => {
    organizationIdRef.current = organizationId;
  }, [organizationId]);

  const fetchFromProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setOrganizationId(null);
      setLoading(false);
      return;
    }
    const hadOrgId = organizationIdRef.current != null && organizationIdRef.current !== '';
    if (!hadOrgId) {
      setLoading(true);
    }
    setError(null);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('active_organization_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) {
      setError('Failed to fetch organization');
      setOrganizationId(null);
    } else {
      const orgId = profile?.active_organization_id ?? null;
      setOrganizationId(orgId);
      if (orgId) {
        setCurrentOrgCacheForUser(user.id, orgId);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem('registrationFlow') === 'true') return;
    const t = setTimeout(fetchFromProfile, 100);
    return () => clearTimeout(t);
  }, [fetchFromProfile]);

  useEffect(() => {
    const handler = (event: CustomEvent<{ organizationId?: string }>) => {
      const newOrgId = event.detail?.organizationId;
      if (newOrgId) setOrganizationId(newOrgId);
    };
    window.addEventListener('organization-switched', handler as EventListener);
    return () => window.removeEventListener('organization-switched', handler as EventListener);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setOrganizationId(null);
        setError(null);
        setLoading(false);
      }
      // After login, refetch profile so organizationId is set and SubscriptionExpiryGuard
      // can resolve (avoids loading forever when waitingForOrg never clears)
      if (event === 'SIGNED_IN') {
        fetchFromProfile();
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchFromProfile]);

  const refetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setOrganizationId(null);
      return;
    }
    clearCurrentOrgCacheForUser(user.id);
    setLoading(true);
    setError(null);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('active_organization_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) {
      setError('Failed to fetch organization');
      setOrganizationId(null);
    } else {
      const orgId = profile?.active_organization_id ?? null;
      setOrganizationId(orgId);
      if (orgId) setCurrentOrgCacheForUser(user.id, orgId);
      if (orgId) {
        window.dispatchEvent(new CustomEvent('organization-switched', { detail: { organizationId: orgId } }));
      }
    }
    setLoading(false);
  }, []);

  const value: CurrentOrgContextValue = {
    organizationId,
    loading,
    error,
    refetch,
    currentOrg: organizationId ? { id: organizationId } : null,
  };

  return (
    <CurrentOrgContext.Provider value={value}>
      {children}
    </CurrentOrgContext.Provider>
  );
}

export function useCurrentOrgContext(): CurrentOrgContextValue {
  const ctx = useContext(CurrentOrgContext);
  if (ctx === undefined) {
    throw new Error('useCurrentOrg must be used within CurrentOrgProvider');
  }
  return ctx;
}
