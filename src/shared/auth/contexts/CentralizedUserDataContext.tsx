import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuth } from '@/shared/auth/contexts/AuthContext';
import type { User, Session } from '@supabase/supabase-js';
import { logger } from '@/shared/lib/logger';
import { pickHighestUserRoleFromRows } from '@/shared/lib/organizationRolePick';
import { forceClearCache } from '@/shared/auth/page-access/departmentPageAccessCache';

// Types - focus only on 5 core tables
interface UserData {
  user_id: string;
  full_name: string;
  email: string;
  active_organization_id?: string;
  department_id?: string;
  email_verified?: boolean; // Add email_verified field
}

interface Organization {
  id: string;
  company_name: string;
  industry?: string;
  address?: string;
  website?: string;
  user_id?: string;
}

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  department_id?: string;
  job_level_id?: string | null;
  job_levels?: { id: string; name: string } | null;
  departments?: { name: string } | null;
  department?: { name: string } | null;
}

type UserRole = 'owner' | 'admin' | 'employee' | 'hr' | 'manager' | 'member' | null;

/** Jangan mengosongkan `organization` di state jika profil punya `active_organization_id` (hindari skeleton / flicker). */
function mergeOrganizationState(
  fetched: Organization | null | undefined,
  activeOrganizationId: string | undefined,
  previous: Organization | null
): Organization | null {
  if (fetched) return fetched;
  if (activeOrganizationId) return previous;
  return null;
}

interface CentralizedUserDataContextType {
  // Auth data - focus only on 5 core tables
  user: User | null;
  userData: UserData | null;
  organization: Organization | null;
  userRole: UserRole;
  /** All `user_roles.role` values for the active org (user may have multiple rows). */
  organizationMemberRoles: string[];
  employee: Employee | null;
  loading: boolean;
  /**
   * True after the first profile/org/role resolution for the current auth user finishes
   * (cache hit, skip, or network). PageAccessGuard uses this to avoid a one-frame "denied"
   * flash while `canAccessPage` still sees empty roles/config.
   */
  centralProfileHydrated: boolean;
  error: Error | null;
  
  // Computed values
  isAuthenticated: boolean;
  isEmailVerified: boolean; // Keep for backward compatibility
  hasOrganization: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  displayName: string;
  organizationName: string;
  
  // Actions
  refreshUserData: () => Promise<void>;
  forceRefreshUserData: () => Promise<void>;
}

// Create context
const CentralizedUserDataContext = createContext<CentralizedUserDataContextType | undefined>(undefined);

// Nilai default saat hook dipanggil di luar provider (mis. saat HMR / React Fast Refresh)
const DEFAULT_CENTRALIZED_USER_DATA: CentralizedUserDataContextType = {
  user: null,
  userData: null,
  organization: null,
  userRole: null,
  organizationMemberRoles: [],
  employee: null,
  loading: true,
  centralProfileHydrated: false,
  error: null,
  isAuthenticated: false,
  isEmailVerified: false,
  hasOrganization: false,
  isOwner: false,
  isAdmin: false,
  displayName: '',
  organizationName: '',
  refreshUserData: async () => {},
  forceRefreshUserData: async () => {},
};

// Provider component
export const CentralizedUserDataProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, session, loading: authLoading } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [organizationMemberRoles, setOrganizationMemberRoles] = useState<string[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [centralProfileHydrated, setCentralProfileHydrated] = useState(() => !user?.id);
  const [error, setError] = useState<Error | null>(null);
  /** Snapshot org terakhir untuk callback async (timeout) — jangan setOrganization(null) saat refetch gagal. */
  const organizationStateRef = useRef<Organization | null>(null);
  organizationStateRef.current = organization;

  // Refs: Supabase TOKEN_REFRESHED gives a new `session` object every time — jangan jadikan
  // dependency useCallback/useEffect agar tidak re-run massal / setLoading saat pindah tab.
  const userRef = useRef<User | null>(null);
  const sessionRef = useRef<Session | null>(null);
  userRef.current = user;
  sessionRef.current = session;

  // Prevent multiple simultaneous fetches
  const fetchingRef = useRef(false);
  const lastUserIdRef = useRef<string>('');

  useLayoutEffect(() => {
    if (!user?.id) {
      setCentralProfileHydrated(true);
    } else {
      setCentralProfileHydrated(false);
    }
  }, [user?.id]);

  // Cache for user data to avoid repeated queries
  const userDataCacheRef = useRef<{
    data: UserData | null;
    organization: Organization | null;
    userRole: UserRole;
    organizationMemberRoles: string[];
    employee: Employee | null;
    timestamp: number;
  } | null>(null);
  const CACHE_DURATION = 60 * 1000; // 60 seconds cache - reduce refetches and timeout risk

  // Fetch user data - focus only on 5 core tables
  const refreshUserData = useCallback(async () => {
    const user = userRef.current;
    const session = sessionRef.current;
    // Hanya reset penuh saat benar-benar logout (!user). Session bisa null sebentar saat
    // TOKEN_REFRESHED / resume WebView — jangan kosongkan org/userData (bukti log RESUME:
    // orgIdPresent false + configRowCount 0 lalu setLoading permission).
    if (!user || !session || authLoading || fetchingRef.current) {
      if (!user) {
        setUserData(null);
        setOrganization(null);
        setUserRole(null);
        setOrganizationMemberRoles([]);
        setEmployee(null);
        setLoading(false);
        lastUserIdRef.current = '';
        setCentralProfileHydrated(true);
      }
      return;
    }

    // Check for force refresh flag first
    const forceRefresh = sessionStorage.getItem('forceRefreshUserData');
    const emailVerifiedFlag = sessionStorage.getItem('emailVerified');
    const currentPath = window.location.pathname;
    
    // Only skip data fetching on auth pages if no force refresh or email verified flag
    if (!forceRefresh && !emailVerifiedFlag && (currentPath === '/login' || currentPath === '/register' || currentPath === '/verify-email')) {
      setLoading(false);
      if (!user?.id) {
        setCentralProfileHydrated(true);
      } else {
        setCentralProfileHydrated(false);
      }
      return;
    }
    
    // If force refresh, clear the flag and continue with data fetching
    if (forceRefresh) {
      if (import.meta.env.DEV) {
        logger.userData('CentralizedUserDataContext: Force refresh detected, fetching fresh data...');
      }
      sessionStorage.removeItem('forceRefreshUserData');
      // Reset the fetching refs to allow fresh fetch
      fetchingRef.current = false;
      lastUserIdRef.current = '';
    }
    
    // If email verified flag exists, clear it and continue with data fetching
    if (emailVerifiedFlag) {
      if (import.meta.env.DEV) {
        logger.userData('CentralizedUserDataContext: Email verified flag detected, fetching fresh data...');
      }
      sessionStorage.removeItem('emailVerified');
      // Reset the fetching refs to allow fresh fetch
      fetchingRef.current = false;
      lastUserIdRef.current = '';
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh && !emailVerifiedFlag && userDataCacheRef.current) {
      const cacheAge = Date.now() - userDataCacheRef.current.timestamp;
      if (cacheAge < CACHE_DURATION && userDataCacheRef.current.data?.user_id === user.id) {
        if (import.meta.env.DEV) {
          logger.userData(`CentralizedUserDataContext: Using cached data (age: ${Math.floor(cacheAge / 1000)}s)`);
        }
        setUserData(userDataCacheRef.current.data);
        setOrganization(userDataCacheRef.current.organization);
        setUserRole(userDataCacheRef.current.userRole);
        setOrganizationMemberRoles(userDataCacheRef.current.organizationMemberRoles ?? []);
        setEmployee(userDataCacheRef.current.employee);
        setLoading(false);
        setCentralProfileHydrated(true);
        return;
      }
    }

    // Skip if already fetched for this user, unless force refresh or email verified flag
    if (lastUserIdRef.current === user.id && !forceRefresh && !emailVerifiedFlag) {
      const cached = userDataCacheRef.current;
      const cacheIncomplete =
        !!cached?.data?.active_organization_id &&
        !cached.userRole &&
        (cached.organizationMemberRoles?.length ?? 0) === 0;
      if (!cacheIncomplete) {
        if (import.meta.env.DEV) {
          logger.userData('CentralizedUserDataContext: Skipping fetch - already fetched for user:', user.id);
        }
        setLoading(false);
        setCentralProfileHydrated(true);
        return;
      }
      if (import.meta.env.DEV) {
        logger.userData('CentralizedUserDataContext: Incomplete cache for org user — refetching roles');
      }
      lastUserIdRef.current = '';
    }

    // If force refresh or email verified flag, reset cache
    if (forceRefresh || emailVerifiedFlag) {
      if (import.meta.env.DEV) {
        logger.userData('CentralizedUserDataContext: Force refresh or email verified - resetting cache for user:', user.id);
      }
      lastUserIdRef.current = '';
      fetchingRef.current = false;
      userDataCacheRef.current = null; // Clear cache on force refresh
    }

    try {
      fetchingRef.current = true;
      lastUserIdRef.current = user.id;
      setLoading(true);
      setCentralProfileHydrated(false);
      setError(null);
      
      // Run profile and email verification in parallel with timeout; one retry on timeout
      const QUERY_TIMEOUT = 12000; // 12s - balanced so slow DB can finish (indexes reduce load)
      const startTime = performance.now();

      const runFirstBatch = async (): Promise<{
        profileData: any;
        profileError: any;
        verificationToken: any;
      }> => {
        const profilePromise = supabase
          .from('profiles')
          .select('user_id, full_name, email, active_organization_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const verificationPromise = (async () => {
          try {
            return await supabase
              .from('email_verification_tokens')
              .select('email_verified')
              .eq('user_id', user.id)
              .order('used_at', { ascending: false })
              .limit(1)
              .maybeSingle();
          } catch {
            return { data: null, error: null };
          }
        })();

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('User data query timeout')), QUERY_TIMEOUT)
        );

        const results = await Promise.race(
          [Promise.allSettled([profilePromise, verificationPromise]), timeoutPromise]
        ) as PromiseSettledResult<any>[];

        let profileData: any = null;
        let profileError: any = null;
        let verificationToken: any = null;
        if (results[0]?.status === 'fulfilled') {
          profileData = results[0].value.data;
          profileError = results[0].value.error;
        } else if (results[0]?.status === 'rejected') {
          profileError = results[0].reason;
        }
        if (results[1]?.status === 'fulfilled') {
          verificationToken = results[1].value.data;
        }
        return { profileData, profileError, verificationToken };
      };

      let profileData: any = null;
      let profileError: any = null;
      let verificationToken: any = null;
      try {
        const batch = await runFirstBatch();
        profileData = batch.profileData;
        profileError = batch.profileError;
        verificationToken = batch.verificationToken;
      } catch (firstError: any) {
        if (firstError?.message === 'User data query timeout' && import.meta.env.DEV) {
          logger.debug('CentralizedUserDataContext: First batch timeout, retrying once...');
        }
        if (firstError?.message === 'User data query timeout') {
          try {
            const batch = await runFirstBatch();
            profileData = batch.profileData;
            profileError = batch.profileError;
            verificationToken = batch.verificationToken;
          } catch (retryError: any) {
            throw retryError;
          }
        } else {
          throw firstError;
        }
      }
      
      const verificationStatus = verificationToken?.email_verified === true;

      // Handle profile error - PGRST116 means no rows found, which is acceptable
      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      let organizationId = profileData?.active_organization_id;

      // SECURITY: If profile has an org, verify user still has active access (e.g. not resigned/terminated)
      if (organizationId) {
        try {
          const { data: uo } = await supabase
            .from('user_organizations')
            .select('is_active')
            .eq('user_id', user.id)
            .eq('organization_id', organizationId)
            .maybeSingle();
          if (!uo || uo.is_active !== true) {
            organizationId = null;
          }
        } catch {
          organizationId = null;
        }
      }

      // If no organization in profile or access was revoked, check user_organizations table (with timeout protection)
      if (!organizationId) {
        try {
          const orgQueryPromise = supabase
            .from('user_organizations')
            .select('organization_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('joined_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Increased timeout for organization query to handle database overload
          const orgTimeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Organization query timeout')), 15000)
          );

          const { data: userOrgData } = await Promise.race([
            orgQueryPromise,
            orgTimeoutPromise
          ]) as any;

          organizationId = userOrgData?.organization_id;
          
          // If we found an organization, update the profile (non-blocking)
          if (organizationId && profileData) {
            // Don't await - let it update in background
            supabase
              .from('profiles')
              .update({ active_organization_id: organizationId })
              .eq('user_id', user.id)
              .catch(() => {
                // Silently fail - non-critical update
              });
          }
        } catch (orgError: any) {
          // Silently handle timeout or error - organization lookup is optional
          if (import.meta.env.DEV) {
            logger.debug('Organization lookup failed (non-critical):', orgError.message);
          }
        }
      }
      
      // Performance monitoring
      const duration = performance.now() - startTime;
      logger.performance(`User Data Fetch (${user.id.slice(0, 8)}...)`, duration, 500);

// Set user data
      const userData: UserData = {
        user_id: user.id,
        full_name: profileData?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: profileData?.email || user.email || '',
        active_organization_id: organizationId,
        department_id: undefined, // Will be set from employee data
        email_verified: verificationStatus, // Use proper verification status from database function
      };
      
      setUserData(userData);

      if (organizationId) {
        setOrganization((prev) =>
          prev?.id === organizationId
            ? prev
            : mergeOrganizationState(
                { id: organizationId, company_name: prev?.company_name ?? "" },
                organizationId,
                prev,
              ),
        );
      }

      // Jangan tulis userDataCacheRef di sini: cache parsial (userRole null) bisa terbaca oleh
      // refresh berikutnya (<60s) dan menimpa state — UI profil menampilkan "—" sampai force refresh (ganti org).

      // Get employee record, role, and organization if organization exists (with timeout)
      if (organizationId) {
        // First, check if user is organization owner
        const { data: orgOwnerCheck } = await supabase
          .from('organizations')
          .select('user_id')
          .eq('id', organizationId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        const isOrgOwner = !!orgOwnerCheck;
        
        // Fetch employee without PostgREST embeds — nested selects (e.g. departments:department_id) can 400
        // if FK hints differ from the live schema; same pattern as useEmployees (enrich in follow-up queries).
        const employeePromise = (async () => {
          const result = await supabase
            .from('employees')
            .select(
              'id, employee_id, full_name, email, organization_id, department_id, employee_status_id, user_id, job_level_id',
            )
            .eq('user_id', user.id)
            .eq('organization_id', organizationId)
            .maybeSingle();

          if (result.error || !result.data) {
            return result;
          }

          const raw = result.data;
          const [statusRes, deptRes, levelRes] = await Promise.all([
            raw.employee_status_id
              ? supabase
                  .from('employee_statuses')
                  .select('name')
                  .eq('id', raw.employee_status_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
            raw.department_id
              ? supabase.from('departments').select('name').eq('id', raw.department_id).maybeSingle()
              : Promise.resolve({ data: null }),
            raw.job_level_id
              ? supabase.from('job_levels').select('id, name').eq('id', raw.job_level_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);

          return {
            data: {
              ...raw,
              employee_statuses: statusRes.data ? { name: statusRes.data.name } : null,
              departments: deptRes.data ? { name: deptRes.data.name } : null,
              job_levels: levelRes.data
                ? { id: levelRes.data.id, name: levelRes.data.name }
                : null,
            },
            error: null,
          };
        })();

        const rolePromise = supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('organization_id', organizationId);

        const organizationPromise = supabase
          .from('organizations')
          .select('id, company_name, industry, address, website, user_id')
          .eq('id', organizationId)
          .maybeSingle();

        // Run employee, role, and organization in parallel with timeout (indexes speed these up)
        const orgDataTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Organization data query timeout')), QUERY_TIMEOUT)
        );

        try {
          const results = await Promise.race([
            Promise.allSettled([employeePromise, rolePromise, organizationPromise]),
            orgDataTimeoutPromise
          ]) as PromiseSettledResult<any>[];

          const employeeData = results[0]?.status === 'fulfilled' ? results[0].value.data : null;
          const roleBundle = results[1]?.status === 'fulfilled' ? results[1].value : null;
          const roleRows = Array.isArray(roleBundle?.data)
            ? (roleBundle.data as { role: string }[])
            : [];
          const resolvedRole = pickHighestUserRoleFromRows(roleRows) as UserRole | null;
          const orgData = results[2]?.status === 'fulfilled' ? results[2].value.data : null;

          // Calculate is_organization_owner (not a database field)
          const calculatedIsOwner = employeeData && orgData && employeeData.user_id === (orgData as any).user_id;

          // SECURITY CHECK: If employee is terminated or inactive (resigned) and not owner, block access
          const canonicalStatus = String((employeeData as any)?.employee_statuses?.name || 'active').toLowerCase();
          const isTerminatedOrInactive = canonicalStatus === 'terminated' || canonicalStatus === 'inactive';
          if (employeeData && isTerminatedOrInactive && !isOrgOwner && !calculatedIsOwner) {
            if (import.meta.env.DEV) {
              console.warn('🚫 Access denied: Employee is terminated/inactive and not organization owner', {
                employeeId: employeeData.id,
                status: canonicalStatus,
                isOrgOwner,
                calculatedIsOwner
              });
            }
            setEmployee(null);
            setUserRole(null);
            setOrganizationMemberRoles([]);
            setOrganization((prev) =>
              mergeOrganizationState(null, userData.active_organization_id, prev)
            );
          } else {
            const enrichedEmployeeData = employeeData ? {
              ...employeeData,
              is_organization_owner: calculatedIsOwner || false
            } : null;

            const memberRoleListRaw = [
              ...new Set(
                roleRows
                  .map((r) => String((r as { role?: string }).role || "").trim())
                  .filter(Boolean),
              ),
            ];
            // Align with `useUserOrganizations.pickRole`: no `user_roles` row → treat as `employee`,
            // otherwise PageAccess sees `eff.length === 0` while header shows "Karyawan".
            let memberRoleList = memberRoleListRaw;
            let effectiveResolvedRole = resolvedRole;
            if (memberRoleList.length === 0) {
              if (isOrgOwner || calculatedIsOwner) {
                memberRoleList = ["owner"];
                effectiveResolvedRole = "owner";
              } else {
                memberRoleList = ["employee"];
                effectiveResolvedRole = (resolvedRole ?? "employee") as UserRole;
              }
            }

            setOrganizationMemberRoles(memberRoleList);

            setEmployee(enrichedEmployeeData);
            setUserRole(effectiveResolvedRole);
            setOrganization((prev) =>
              mergeOrganizationState(orgData, userData.active_organization_id, prev)
            );

            const orgForCache = mergeOrganizationState(
              orgData,
              userData.active_organization_id,
              organizationStateRef.current
            );

            if (employeeData?.department_id) {
              const updatedUserData = { ...userData, department_id: employeeData.department_id };
              setUserData(updatedUserData);
              userDataCacheRef.current = {
                data: updatedUserData,
                organization: orgForCache,
                userRole: effectiveResolvedRole,
                organizationMemberRoles: memberRoleList,
                employee: enrichedEmployeeData,
                timestamp: Date.now()
              };
            } else {
              userDataCacheRef.current = {
                data: userData,
                organization: orgForCache,
                userRole: effectiveResolvedRole,
                organizationMemberRoles: memberRoleList,
                employee: enrichedEmployeeData,
                timestamp: Date.now()
              };
            }
          }
        } catch (orgError: any) {
          if (orgError.message === 'Organization data query timeout') {
            // Timeout is handled gracefully with fallback, only log in dev mode
            if (import.meta.env.DEV) {
              logger.debug('CentralizedUserDataContext: Organization data timeout - using fallback data');
            }
            // Jangan setOrganization(null): profile masih punya active_organization_id → ProtectedRoute isLoadingOrgData + skeleton (debug D).
            setEmployee(null);

            // Set a default role based on email or user metadata
            if (user.email?.includes('owner') || user.email?.includes('admin')) {
              setUserRole('owner');
              logger.userData('CentralizedUserDataContext: Set fallback owner role based on email');
            } else if (user.user_metadata?.role) {
              setUserRole(user.user_metadata.role as UserRole);
              logger.userData('CentralizedUserDataContext: Set fallback role from user metadata:', user.user_metadata.role);
            } else {
              setUserRole('employee'); // Default fallback
              logger.userData('CentralizedUserDataContext: Set default employee role as fallback');
            }

            const fallbackRole = user.email?.includes('owner') || user.email?.includes('admin')
              ? 'owner'
              : (user.user_metadata?.role as UserRole || 'employee');
            setOrganizationMemberRoles([String(fallbackRole)]);

            userDataCacheRef.current = {
              data: userData,
              organization: organizationStateRef.current,
              userRole: fallbackRole,
              organizationMemberRoles: [String(fallbackRole)],
              employee: null,
              timestamp: Date.now()
            };
          } else {
            throw orgError;
          }
        }
      } else {
        // No organization found (profile tanpa active_organization_id di cabang ini)
        setEmployee(null);
        setOrganization((prev) =>
          mergeOrganizationState(null, userData.active_organization_id, prev)
        );
        setUserRole(null);
        setOrganizationMemberRoles([]);

        const orgForCache = mergeOrganizationState(
          null,
          userData.active_organization_id,
          organizationStateRef.current
        );
        userDataCacheRef.current = {
          data: userData,
          organization: orgForCache,
          userRole: null,
          organizationMemberRoles: [],
          employee: null,
          timestamp: Date.now()
        };
      }

    } catch (err: any) {
      // Handle timeout first - jangan log sebagai error (fallback dipakai, UX tetap jalan)
      if (err.message === 'User data query timeout') {
        // Timeout is handled gracefully with fallback, only log in dev mode
        if (import.meta.env.DEV) {
          logger.debug('CentralizedUserDataContext: Query timeout - creating fallback user data from auth');
        }
        
        // Create fallback user data from auth user info
        const fallbackUserData: UserData = {
          user_id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          active_organization_id: undefined, // Will be handled separately
          department_id: undefined,
          email_verified: true // Assume verified if user is authenticated
        };
        
        setUserData(fallbackUserData);
        
        // Try to set owner role if email suggests it
        const fallbackRole = user.email?.includes('owner') || user.email?.includes('admin') 
          ? 'owner' 
          : (user.user_metadata?.role as UserRole || 'employee');
        setUserRole(fallbackRole);
        setOrganizationMemberRoles([String(fallbackRole)]);

        // Update cache with fallback data
        userDataCacheRef.current = {
          data: fallbackUserData,
          organization: null,
          userRole: fallbackRole,
          organizationMemberRoles: [String(fallbackRole)],
          employee: null,
          timestamp: Date.now()
        };
        
        logger.userData('CentralizedUserDataContext: Fallback data created:', {
          userData: fallbackUserData,
          userRole: fallbackRole
        });
        
        // Don't set error state for timeout, just finish loading
        setError(null);
      } else {
        if (import.meta.env.DEV) {
          logger.error('❌ Error fetching user data:', err);
        }
        setError(err as Error);
        lastUserIdRef.current = '';
        userDataCacheRef.current = null;
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
      const snap = userDataCacheRef.current;
      const rolesStillPending =
        !!snap?.data?.active_organization_id &&
        !snap?.userRole &&
        (snap.organizationMemberRoles?.length ?? 0) === 0;
      setCentralProfileHydrated(!rolesStillPending);
    }
  }, [authLoading]);

  // Force refresh function that bypasses caching (e.g. after switch organization in drawer)
  const forceRefreshUserData = useCallback(async () => {
    logger.userData('CentralizedUserDataContext: Force refresh requested');
    if (!userRef.current) {
      logger.userData('CentralizedUserDataContext: No user for force refresh');
      return;
    }
    
    logger.userData('CentralizedUserDataContext: Resetting cache and forcing refresh...');
    lastUserIdRef.current = '';
    fetchingRef.current = false;
    userDataCacheRef.current = null; // Clear cache so sidebar/context get fresh org name
    previousOrgIdRef.current = undefined; // Allow org-change effect to run if needed
    
    await refreshUserData();
  }, [refreshUserData]);

  
  // Track previous organization ID to detect changes
  const previousOrgIdRef = useRef<string | undefined>();

  // Fresh role/org snapshot after login (avoids stale cache → "Limited Access" on first paint).
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        lastUserIdRef.current = '';
        fetchingRef.current = false;
        userDataCacheRef.current = null;
        setCentralProfileHydrated(false);
        forceClearCache();
        try {
          sessionStorage.setItem('forceRefreshUserData', '1');
        } catch {
          /* ignore */
        }
        if (userRef.current && sessionRef.current) {
          void refreshUserData();
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshUserData]);

  // Effect to refresh data when auth changes
  useEffect(() => {
    // Reset when user changes
    if (!user) {
      lastUserIdRef.current = '';
      fetchingRef.current = false;
      previousOrgIdRef.current = undefined;
      setUserData(null);
      setOrganization(null);
      setUserRole(null);
      setOrganizationMemberRoles([]);
      setEmployee(null);
      setLoading(false);
      setCentralProfileHydrated(true);
      return;
    }

    // Check for force refresh flags that bypass path restrictions
    const forceRefresh = sessionStorage.getItem('forceRefreshUserData');
    const emailVerifiedFlag = sessionStorage.getItem('emailVerified');
    
    // Skip data fetching on login/register pages to improve performance
    // BUT allow refresh if force refresh flag is set or email verification flag exists
    const currentPath = window.location.pathname;
    if (!forceRefresh && !emailVerifiedFlag && (currentPath === '/login' || currentPath === '/register' || currentPath === '/verify-email')) {
      setLoading(false);
      if (!user?.id) {
        setCentralProfileHydrated(true);
      } else {
        setCentralProfileHydrated(false);
      }
      return;
    }

    // Fetch on login, incomplete cache, or missing profile snapshot after auth.
    if (user && sessionRef.current) {
      const cached = userDataCacheRef.current;
      const cacheIncomplete =
        cached?.data?.user_id === user.id &&
        !!cached.data?.active_organization_id &&
        !cached.userRole &&
        (cached.organizationMemberRoles?.length ?? 0) === 0;
      const needsInitialProfile = !userData && !fetchingRef.current;
      const needsUserSwitch = lastUserIdRef.current !== user.id;
      if (needsUserSwitch || cacheIncomplete || needsInitialProfile) {
        refreshUserData();
      }
    }
  }, [user?.id, userData, refreshUserData]);

  // Effect to refresh data when active organization changes
  useEffect(() => {
    if (userData?.active_organization_id && 
        previousOrgIdRef.current !== undefined &&
        previousOrgIdRef.current !== userData.active_organization_id) {
      
      previousOrgIdRef.current = userData.active_organization_id;
      
      // Force refresh of organization-specific data when org actually changes
      lastUserIdRef.current = '';
      fetchingRef.current = false;
      refreshUserData();
    } else if (userData?.active_organization_id) {
      // Just track the organization ID without triggering refresh
      previousOrgIdRef.current = userData.active_organization_id;
    }
  }, [userData?.active_organization_id, refreshUserData]);

  // Sync sidebar and all pages when organization is switched from Profile or Sidebar drawer
  useEffect(() => {
    const handleOrganizationSwitch = () => {
      forceRefreshUserData();
    };
    window.addEventListener('organization-switched', handleOrganizationSwitch);
    return () => window.removeEventListener('organization-switched', handleOrganizationSwitch);
  }, [forceRefreshUserData]);

  // Computed values - focus only on 5 core tables  
  const isAuthenticated = !!user;
  const isEmailVerified = !!userData && userData.email_verified === true; // Use email_verification_tokens.email_verified NOT auth.users.email_confirmed_at
  const hasOrganization = !!userData?.active_organization_id;
  const isOwner =
    userRole === 'owner' ||
    organizationMemberRoles.includes('owner') ||
    (!!user?.id && !!organization?.user_id && organization.user_id === user.id);
  const isAdmin = userRole === 'admin' || organizationMemberRoles.includes('admin');
  const displayName = userData?.full_name || user?.user_metadata?.full_name || 'User';
  const organizationName = organization?.company_name || '';

  const value: CentralizedUserDataContextType = {
    // Auth data - focus only on 5 core tables
    user,
    userData,
    organization,
    userRole,
    organizationMemberRoles,
    employee,
    loading: authLoading || loading,
    centralProfileHydrated,
    error,
    
    // Computed values
    isAuthenticated,
    isEmailVerified,
    hasOrganization,
    isOwner,
    isAdmin,
    displayName,
    organizationName,
    
    // Actions
    refreshUserData,
    forceRefreshUserData,
  };

  return (
    <CentralizedUserDataContext.Provider value={value}>
      {children}
    </CentralizedUserDataContext.Provider>
  );
};

// Hooks
export const useCentralizedUserData = (): CentralizedUserDataContextType => {
  const context = useContext(CentralizedUserDataContext);
  // Saat di luar provider (mis. HMR / React Fast Refresh), kembalikan default agar tidak crash
  if (context === undefined) {
    if (import.meta.env.DEV) {
      console.warn('useCentralizedUserData: called outside CentralizedUserDataProvider, using default (loading)');
    }
    return DEFAULT_CENTRALIZED_USER_DATA;
  }
  return context;
};

export const useUserAuth = () => {
  const { user, loading, isAuthenticated } = useCentralizedUserData();
  return { user, loading, isAuthenticated };
};

export const useUserProfile = () => {
  const { userData, loading } = useCentralizedUserData();
  return { userData, loading };
};

export const useUserOrganization = () => {
  const { organization, loading, hasOrganization } = useCentralizedUserData();
  return { organization, loading, hasOrganization };
};

