
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { devLog } from '../utils/devLogger';

// Global cache for organization data
const orgCache = new Map<string, { data: string | null; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useCurrentOrg = () => {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const fetchingRef = useRef(false);
  const lastUserIdRef = useRef<string>('');

  const fetchCurrentOrg = useCallback(async () => {
    // Prevent duplicate fetches
    if (fetchingRef.current) {
      devLog.log('🚫 useCurrentOrg: Fetch already in progress, skipping');
      return;
    }

    try {
      fetchingRef.current = true;
      
      // Check for new organization from sessionStorage first (highest priority)
      const newOrgId = sessionStorage.getItem('newOrganizationId');
      if (newOrgId) {
        devLog.log('useCurrentOrg: Found new organization ID in sessionStorage:', newOrgId);
        setOrganizationId(newOrgId);
        setLoading(false);
        fetchingRef.current = false;
        sessionStorage.removeItem('newOrganizationId');
        return;
      }
      
      // Get current user with increased timeout to prevent frequent timeouts
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth timeout')), 30000) // Increased to 30 seconds
      );
      
      const authPromise = supabase.auth.getUser();
      const { data: { user }, error: authError } = await Promise.race([
        authPromise, 
        timeoutPromise
      ]) as any;
      
      if (authError) {
        console.error('useCurrentOrg: Auth error:', authError);
        // Don't set error for timeout, just use cached data or default
        if (authError.message === 'Auth timeout') {
          devLog.log('useCurrentOrg: Auth timeout, using fallback');
          setLoading(false);
          fetchingRef.current = false;
          return;
        }
        setError('Authentication failed');
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      if (!user) {
        devLog.log('useCurrentOrg: No authenticated user found');
        setOrganizationId(null);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      // Prevent duplicate fetches for same user
      if (lastUserIdRef.current === user.id && organizationId !== null) {
        devLog.log('📋 useCurrentOrg: Using cached data for user:', user.id);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      devLog.log('useCurrentOrg: User authenticated:', user.id);
      lastUserIdRef.current = user.id;

      // Check cache first
      const cacheKey = `org-${user.id}`;
      const cached = orgCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        devLog.log('📋 useCurrentOrg: Using cached organization data');
        setOrganizationId(cached.data);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      // Get user's profile to find active organization (with timeout)
      const profilePromise = supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .maybeSingle();
        
      const { data: profile, error: profileError } = await Promise.race([
        profilePromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), 10000) // Increased to 10 seconds
        )
      ]) as any;

      if (profileError || !profile) {
        console.error('useCurrentOrg: Profile fetch error:', profileError);
        
        // If profile doesn't exist, try to find user's first organization
        const { data: userOrgs, error: orgError } = await supabase
          .from('user_organizations')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1);

        if (orgError || !userOrgs || userOrgs.length === 0) {
          devLog.log('useCurrentOrg: No organizations found for user');
          setOrganizationId(null);
          setError('No organization found. Please join an organization first.');
          setLoading(false);
          fetchingRef.current = false;
          return;
        }

        // Set the first organization as active
        const firstOrgId = userOrgs[0].organization_id;
        devLog.log('useCurrentOrg: Setting first org as active:', firstOrgId);
        
        // Update profile with active organization
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('user_id', user.id)
          .maybeSingle();

        await supabase
          .from('profiles')
          .upsert({
            user_id: user.id,
            active_organization_id: firstOrgId,
            full_name: existingProfile?.full_name || user.user_metadata?.full_name || '',
            email: existingProfile?.email || user.email || '',
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        setOrganizationId(firstOrgId);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      const orgId = profile?.active_organization_id;
      
      // Cache the result
      orgCache.set(cacheKey, {
        data: orgId || null,
        timestamp: Date.now()
      });

      if (!orgId) {
        devLog.log('useCurrentOrg: No active organization in profile');
        setError('No active organization selected');
        setOrganizationId(null);
      } else {
        devLog.log('useCurrentOrg: Active organization found:', orgId);
        setOrganizationId(orgId);
      }

      setLoading(false);
    } catch (error) {
      console.error('useCurrentOrg: Unexpected error:', error);
      // Don't set error for timeout errors, just continue with current state
      if (error instanceof Error && error.message === 'Auth timeout') {
        devLog.log('useCurrentOrg: Auth timeout handled, continuing with current state');
      } else {
        setError('Failed to fetch organization');
      }
      setLoading(false);
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Only fetch if not in registration flow
    const registrationFlow = sessionStorage.getItem('registrationFlow');
    if (registrationFlow !== 'true') {
      fetchCurrentOrg();
    }

    // Listen for auth changes - but debounce them and avoid during registration
    let timeoutId: NodeJS.Timeout;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      devLog.log('useCurrentOrg: Auth state changed:', event);
      
      // Skip during registration flow
      const isRegistrationFlow = sessionStorage.getItem('registrationFlow') === 'true';
      if (isRegistrationFlow) {
        devLog.log('useCurrentOrg: Skipping during registration flow');
        return;
      }
      
      // Clear any existing timeout
      if (timeoutId) clearTimeout(timeoutId);
      
      // Only refetch on important auth events and debounce them more aggressively
      if (event === 'SIGNED_IN') {
        timeoutId = setTimeout(() => {
          // Double check we're still not in registration flow
          const stillInRegistration = sessionStorage.getItem('registrationFlow') === 'true';
          if (!stillInRegistration && !organizationId) {
            lastUserIdRef.current = ''; // Force refetch only if needed
            fetchCurrentOrg();
          }
        }, 2000); // Increased debounce to 2 seconds
      } else if (event === 'SIGNED_OUT') {
        setOrganizationId(null);
        setLoading(false);
        setError(null);
        orgCache.clear(); // Clear cache on sign out
      }
      // Skip INITIAL_SESSION to prevent redundant calls
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchCurrentOrg]);

  const switchOrganization = async (newOrgId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('profiles')
        .update({ 
          active_organization_id: newOrgId,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error switching organization:', error);
        toast({
          title: 'Error',
          description: 'Failed to switch organization',
          variant: 'destructive'
        });
        return false;
      }

      // Clear cache to ensure fresh data
      const cacheKey = `org-${user.id}`;
      orgCache.delete(cacheKey);
      
      // Update state immediately
      setOrganizationId(newOrgId);
      
      devLog.log('🔄 Organization changed, optimizing cache for:', newOrgId);
      devLog.log('✅ Organization switched successfully to:', newOrgId);
      toast({
        title: 'Success',
        description: 'Organization switched successfully'
      });
      return true;
    } catch (error) {
      console.error('Error switching organization:', error);
      return false;
    }
  };

  const refetch = () => {
    setLoading(true);
    setError(null);
    // Re-run the effect
    const fetchCurrentOrg = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setOrganizationId(null);
          setLoading(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('active_organization_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          setError('Failed to fetch organization');
        } else {
          setOrganizationId(profile?.active_organization_id || null);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Refetch error:', error);
        setError('Failed to fetch organization');
        setLoading(false);
      }
    };
    
    fetchCurrentOrg();
  };

  return {
    organizationId,
    loading,
    error,
    switchOrganization,
    refetch,
    // Backward compatibility - provide currentOrg as an object with id
    currentOrg: organizationId ? { id: organizationId } : null
  };
};

// Export utility function for backward compatibility
export const getCurrentOrganizationId = async (): Promise<{ organizationId: string }> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !profile?.active_organization_id) {
    throw new Error('No active organization found');
  }

  return { organizationId: profile.active_organization_id };
};
