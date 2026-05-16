
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { logger } from "@/shared/lib/logger";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  active_organization_id: string | null;
  created_at: string;
  updated_at: string;
  organization_created: boolean;
  profile_photo_url?: string | null;
}

interface Organization {
  company_name: string;
}

type UserRole = 'owner' | 'admin' | 'employee' | null;

interface UserData {
  profile: Profile | null;
  organization: Organization | null;
  userRole: UserRole;
  loading: boolean;
  refreshUserData: () => Promise<void>;
}

// Ultra-fast cache for user data
const userDataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 60 * 1000; // 1 minute for faster updates

// Make cache accessible globally for avatar sync
if (typeof window !== 'undefined') {
  (window as any).userDataCache = userDataCache;
}

export const useUserData = (): UserData => {
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef<string>('');

  const fetchUserData = useCallback(async (userId: string) => {
    // Prevent duplicate fetches for the same user
    if (fetchingRef.current) {
      logger.userData('🚫 Preventing duplicate fetch for user:', userId);
      return;
    }

    // Check if we already have this user in progress and have data
    if (lastFetchRef.current === userId && profile !== null) {
      logger.userData('📋 Using existing fetch for user:', userId);
      return;
    }

    // Check cache first
    const cacheKey = `user-${userId}`;
    const cached = userDataCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      setProfile(cached.data.profile);
      setOrganization(cached.data.organization);
      setUserRole(cached.data.userRole);
      setLoading(false);
      return;
    }

    try {
      fetchingRef.current = true;
      lastFetchRef.current = userId;
      setLoading(true);
      
      logger.userData("🔍 useUserData: Starting optimized fetch for user:", userId);
      
      // OPTIMIZED: Use Promise.allSettled for better error handling
      // This ensures all queries run in parallel, even if some fail
      const [profileResult, roleResult, photoDetailsResult, photoEmployeeResult] = await Promise.allSettled([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase.rpc('get_user_role_in_active_org'),
        supabase
          .from('user_profile_details')
          .select('profile_photo_url')
          .eq('profile_id', userId)
          .maybeSingle(),
        supabase
          .from('employees')
          .select('profile_photo_url')
          .eq('user_id', userId)
          .maybeSingle()
      ]);

      // Process profile result
      let profileData: Profile | null = null;
      if (profileResult.status === 'fulfilled' && profileResult.value.data) {
        profileData = profileResult.value.data;
        logger.userData("✅ useUserData: Profile fetched:", profileData);
      } else {
        const error = profileResult.status === 'rejected' ? profileResult.reason : profileResult.value.error;
        console.error("❌ useUserData: Profile error:", error);
        // Create fallback profile from auth data with all required fields
        profileData = {
          id: userId,
          user_id: userId,
          full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
          email: user?.email || '',
          active_organization_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // email_verified field moved to email_verification_tokens table
          organization_created: false,
          profile_photo_url: null
        };
      }

      let photoUrl: string | null = profileData?.profile_photo_url ?? null;
      if (!photoUrl && photoDetailsResult.status === 'fulfilled' && photoDetailsResult.value.data?.profile_photo_url) {
        photoUrl = photoDetailsResult.value.data.profile_photo_url;
      }
      if (!photoUrl && photoEmployeeResult.status === 'fulfilled' && photoEmployeeResult.value.data?.profile_photo_url) {
        photoUrl = photoEmployeeResult.value.data.profile_photo_url;
      }
      
      // Add photo URL to profile data
      if (profileData) {
        profileData = {
          ...profileData,
          profile_photo_url: photoUrl
        };
      }

      setProfile(profileData);

      // Process role result
      let roleData: UserRole = null;
      if (roleResult.status === 'fulfilled' && !roleResult.value.error) {
        roleData = roleResult.value.data as UserRole;
        logger.userData("✅ useUserData: Role in active org:", roleData);
      } else {
        const error = roleResult.status === 'rejected' ? roleResult.reason : roleResult.value.error;
        console.error("❌ useUserData: Role fetch error:", error);
      }
      setUserRole(roleData);

      // Get organization data if available
      let orgData = null;
      if (profileData?.active_organization_id) {
        const { data: organizationData, error: orgError } = await supabase
          .from('organizations')
          .select('company_name')
          .eq('id', profileData.active_organization_id)
          .single();

        if (orgError) {
          console.error("❌ useUserData: Organization error:", orgError);
        } else {
          logger.userData("✅ useUserData: Organization fetched:", organizationData);
          orgData = organizationData;
        }
      }

      setOrganization(orgData);

      // Cache the results
      userDataCache.set(cacheKey, {
        data: {
          profile: profileData,
          organization: orgData,
          userRole: roleData
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error("❌ useUserData: Unexpected error:", error);
      
      // Even on error, create a basic profile from auth data with all required fields
      const fallbackProfile = {
        id: userId,
        user_id: userId,
        full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
        email: user?.email || '',
        active_organization_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // email_verified field moved to email_verification_tokens table
        organization_created: false,
        profile_photo_url: null
      };
      setProfile(fallbackProfile);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user || !session) {
      setProfile(null);
      setOrganization(null);
      setUserRole(null);
      setLoading(false);
      lastFetchRef.current = '';
      return;
    }

    fetchUserData(user.id);
  }, [user?.id, session, fetchUserData]);

  const refreshUserData = useCallback(async () => {
    if (user?.id) {
      logger.userData('🔄 Manual refresh of user data triggered');
      lastFetchRef.current = ''; // Reset to allow refetch
      userDataCache.delete(`user-${user.id}`); // Clear cache
      fetchingRef.current = false; // Reset fetching flag
      await fetchUserData(user.id);
    }
  }, [user?.id, fetchUserData]);

  return { profile, organization, userRole, loading, refreshUserData };
};
