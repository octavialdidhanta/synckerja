import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/hooks/use-toast';
import { logger } from '@/shared/lib/logger';

// Enhanced cache with TTL and memory management
class OrgCache {
  private cache = new Map<string, { data: string | null; timestamp: number; ttl: number }>();
  private maxSize = 50;
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, value: string | null, ttl: number = this.defaultTTL): void {
    // Cleanup old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.getOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): string | null | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  private getOldestKey(): string | undefined {
    let oldestKey: string | undefined;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instance
const orgCache = new OrgCache();

// Request deduplication
const pendingRequests = new Map<string, Promise<any>>();

export const useOptimizedCurrentOrg = () => {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Refs for preventing duplicate requests
  const fetchingRef = useRef(false);
  const lastUserIdRef = useRef<string>('');
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchCurrentOrg = useCallback(async (forceRefresh = false): Promise<string | null> => {
    // Prevent duplicate fetches
    if (fetchingRef.current && !forceRefresh) {
      logger.debug('useOptimizedCurrentOrg: Fetch already in progress, skipping');
      return organizationId;
    }

    try {
      fetchingRef.current = true;
      // logger.time('fetchCurrentOrg');
      
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        logger.error('useOptimizedCurrentOrg: Auth error:', authError);
        if (mountedRef.current) {
          setError('Authentication failed');
          setLoading(false);
        }
        return null;
      }

      if (!user) {
        logger.debug('useOptimizedCurrentOrg: No authenticated user found');
        if (mountedRef.current) {
          setOrganizationId(null);
          setLoading(false);
        }
        return null;
      }

      // Check cache first (unless forced refresh)
      const cacheKey = `org-${user.id}`;
      if (!forceRefresh) {
        const cached = orgCache.get(cacheKey);
        if (cached !== undefined) {
          logger.debug('useOptimizedCurrentOrg: Using cached organization data');
          if (mountedRef.current) {
            setOrganizationId(cached);
            setLoading(false);
          }
          return cached;
        }
      }

      // Deduplicate requests
      const requestKey = `fetch-${user.id}`;
      if (pendingRequests.has(requestKey)) {
        logger.debug('useOptimizedCurrentOrg: Request already pending, waiting...');
        return await pendingRequests.get(requestKey);
      }

      // Create new request
      const requestPromise = (async () => {
        try {
          // Get user's profile to find active organization
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('active_organization_id')
            .eq('user_id', user.id)
            .single();

          if (profileError) {
            logger.warn('useOptimizedCurrentOrg: Profile fetch error, trying fallback:', profileError);
            
            // Fallback: find user's first organization
            const { data: userOrgs, error: orgError } = await supabase
              .from('user_organizations')
              .select('organization_id')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .limit(1);

            if (orgError || !userOrgs || userOrgs.length === 0) {
              logger.info('useOptimizedCurrentOrg: No organizations found for user');
              orgCache.set(cacheKey, null);
              return null;
            }

            const firstOrgId = (userOrgs[0] as any).organization_id;
            logger.info('useOptimizedCurrentOrg: Setting first org as active:', firstOrgId);
            
            // Update profile async (don't wait for completion)
            (supabase as any)
              .from('profiles')
              .upsert({
                user_id: user.id,
                active_organization_id: firstOrgId,
                full_name: user.user_metadata?.full_name || '',
                email: user.email || '',
                updated_at: new Date().toISOString()
              }, { onConflict: 'user_id' })
              .then(({ error }) => {
                if (error) logger.warn('Profile update failed:', error);
              });

            orgCache.set(cacheKey, firstOrgId);
            return firstOrgId;
          }

          const orgId = (profile as any)?.active_organization_id || null;
          
          // Cache with appropriate TTL
          const ttl = orgId ? 5 * 60 * 1000 : 60 * 1000; // 5min for valid org, 1min for null
          orgCache.set(cacheKey, orgId, ttl);

          logger.debug('useOptimizedCurrentOrg: Organization fetched:', orgId);
          return orgId;
        } finally {
          pendingRequests.delete(requestKey);
        }
      })();

      pendingRequests.set(requestKey, requestPromise);
      const result = await requestPromise;

      if (mountedRef.current) {
        setOrganizationId(result);
        setError(result === null ? 'No active organization found' : null);
        setLoading(false);
      }

      return result;
    } catch (error) {
      logger.error('useOptimizedCurrentOrg: Unexpected error:', error);
      if (mountedRef.current) {
        setError('Failed to fetch organization');
        setLoading(false);
      }
      return null;
    } finally {
      fetchingRef.current = false;
      // logger.timeEnd('fetchCurrentOrg');
    }
  }, [organizationId]);

  // Optimized auth state listener
  useEffect(() => {
    // Skip during registration flow
    const registrationFlow = sessionStorage.getItem('registrationFlow');
    if (registrationFlow === 'true') {
      logger.debug('useOptimizedCurrentOrg: Skipping during registration flow');
      return;
    }

    // Initial fetch
    fetchCurrentOrg();

    // Optimized auth state listener with aggressive debouncing
    let debounceTimer: NodeJS.Timeout;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      logger.debug('useOptimizedCurrentOrg: Auth state changed:', event);
      
      // Clear existing timer
      if (debounceTimer) clearTimeout(debounceTimer);
      
      // Only handle critical events
      if (event === 'SIGNED_IN') {
        debounceTimer = setTimeout(() => {
          if (mountedRef.current && !organizationId) {
            lastUserIdRef.current = ''; // Force refetch only if needed
            fetchCurrentOrg();
          }
        }, 1500); // Increased debounce
      } else if (event === 'SIGNED_OUT') {
        if (mountedRef.current) {
          setOrganizationId(null);
          setLoading(false);
          setError(null);
        }
        orgCache.clear();
      }
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      subscription.unsubscribe();
    };
  }, [fetchCurrentOrg, organizationId]);

  const switchOrganization = useCallback(async (newOrgId: string): Promise<boolean> => {
    try {
      // logger.time('switchOrganization');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await (supabase as any)
        .from('profiles')
        .update({ 
          active_organization_id: newOrgId,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) {
        logger.error('Error switching organization:', error);
        toast({
          title: 'Error',
          description: 'Failed to switch organization',
          variant: 'destructive'
        });
        return false;
      }

      // Update cache and state
      const cacheKey = `org-${user.id}`;
      orgCache.set(cacheKey, newOrgId);
      setOrganizationId(newOrgId);
      
      toast({
        title: 'Success',
        description: 'Organization switched successfully'
      });
      
      return true;
    } catch (error) {
      logger.error('Error switching organization:', error);
      return false;
    } finally {
      // logger.timeEnd('switchOrganization');
    }
  }, [toast]);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchCurrentOrg(true); // Force refresh
  }, [fetchCurrentOrg]);

  // Memoized return object to prevent unnecessary re-renders
  const returnValue = useMemo(() => ({
    organizationId,
    loading,
    error,
    switchOrganization,
    refetch,
    // Backward compatibility
    currentOrg: organizationId ? { id: organizationId } : null
  }), [organizationId, loading, error, switchOrganization, refetch]);

  return returnValue;
};

// Optimized utility function with caching
export const getOptimizedCurrentOrganizationId = async (): Promise<{ organizationId: string }> => {
  // logger.time('getOptimizedCurrentOrganizationId');
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check cache first
    const cacheKey = `org-${user.id}`;
    const cached = orgCache.get(cacheKey);
    if (cached) {
      if (!cached) throw new Error('No active organization found');
      return { organizationId: cached };
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('active_organization_id')
      .eq('user_id', user.id)
      .single();

    if (error || !(profile as any)?.active_organization_id) {
      throw new Error('No active organization found');
    }

    // Cache the result
    orgCache.set(cacheKey, (profile as any).active_organization_id);
    
    return { organizationId: (profile as any).active_organization_id };
  } finally {
    // logger.timeEnd('getOptimizedCurrentOrganizationId');
  }
};