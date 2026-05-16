import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useAuthSession } from "@/shared/hooks/useAuthSession";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  active_organization_id: string | null;
  created_at: string;
  updated_at: string;
  organization_created?: boolean;
}

interface ProfileDetails {
  phone?: string;
  bio?: string;
  job_title?: string;
  location?: string;
  website?: string;
  profile_photo_url?: string;
}

interface Organization {
  company_name: string;
}

type UserRole = "owner" | "admin" | "employee" | null;

export interface UnifiedProfileData {
  profile: Profile | null;
  profileDetails: ProfileDetails | null;
  organization: Organization | null;
  userRole: UserRole;
  profilePhotoUrl: string | null;
  fullName: string;
  email: string;
  organizationName: string | null;
}

export const UNIFIED_PROFILE_KEY = "unified-profile";

export const useUnifiedProfile = () => {
  const { user, session } = useAuthSession();

  return useQuery<UnifiedProfileData>({
    queryKey: [UNIFIED_PROFILE_KEY, user?.id],
    queryFn: async () => {
      if (!user) {
        throw new Error("No authenticated user");
      }

      const [profileResult, detailsResult, employeeResult, roleResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("user_profile_details").select("*").eq("profile_id", user.id).maybeSingle(),
        supabase.from("employees").select("profile_photo_url").eq("user_id", user.id).maybeSingle(),
        supabase.rpc("get_user_role_in_active_org"),
      ]);

      let profileData: Profile | null = profileResult.data as Profile | null;
      if (profileResult.error) {
        profileData = {
          id: user.id,
          user_id: user.id,
          full_name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "User",
          email: user.email || "",
          active_organization_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          organization_created: false,
        };
      }

      const roleData = roleResult.error ? null : (roleResult.data as UserRole);

      let orgData: Organization | null = null;
      if (profileData?.active_organization_id) {
        const { data: organizationData, error: orgError } = await supabase
          .from("organizations")
          .select("company_name")
          .eq("id", profileData.active_organization_id)
          .single();

        if (!orgError) {
          orgData = organizationData;
        }
      }

      const detailsData = detailsResult.data;
      const photoUrl =
        profileData?.profile_photo_url ||
        detailsData?.profile_photo_url ||
        employeeResult.data?.profile_photo_url ||
        null;

      const profileDetails: ProfileDetails = {
        phone: detailsData?.phone || undefined,
        bio: detailsData?.bio || undefined,
        job_title: detailsData?.job_title || undefined,
        location: detailsData?.location || undefined,
        website: detailsData?.website || undefined,
        profile_photo_url: photoUrl || undefined,
      };

      return {
        profile: profileData,
        profileDetails,
        organization: orgData,
        userRole: roleData,
        profilePhotoUrl: photoUrl,
        fullName: profileData?.full_name || "User",
        email: profileData?.email || user.email || "",
        organizationName: orgData?.company_name || null,
      };
    },
    enabled: !!user && !!session,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });
};
