import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { pickProfilePhotoUrl } from "@/shared/lib/profilePhotoStorage";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { profileQueryKey } from "@/shared/auth/identityQuerySync";

export const PROFILE_QUERY_KEY = "profile" as const;

export type ProfileRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  job_title: string | null;
  location: string | null;
  website: string | null;
  profile_photo_url: string | null;
  preferred_locale: string | null;
  active_organization_id: string | null;
  updated_at: string;
};

export type ProfileUpdatePayload = {
  full_name: string;
  phone: string;
  bio: string;
  job_title: string;
  location: string;
  website: string;
  profile_photo_url: string | null;
  preferred_locale: string;
};

async function fetchProfile(): Promise<ProfileRow | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(
      "user_id, email, full_name, phone, bio, job_title, location, website, profile_photo_url, preferred_locale, active_organization_id, updated_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profileData) return null;

  const { data: detailsData } = await supabase
    .from("user_profile_details")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();

  const employeeQuery = supabase
    .from("employees")
    .select("profile_photo_url")
    .eq("user_id", user.id);
  if (profileData.active_organization_id) {
    employeeQuery.eq("organization_id", profileData.active_organization_id);
  }
  const { data: employeeData } = await employeeQuery.maybeSingle();

  const photoUrl =
    detailsData?.profile_photo_url ||
    employeeData?.profile_photo_url ||
    profileData.profile_photo_url ||
    null;

  return {
    ...profileData,
    phone: detailsData?.phone ?? profileData.phone,
    bio: detailsData?.bio ?? profileData.bio,
    job_title: detailsData?.job_title ?? profileData.job_title,
    location: detailsData?.location ?? profileData.location,
    website: detailsData?.website ?? profileData.website,
    profile_photo_url: photoUrl,
  } as ProfileRow;
}

export function useProfile() {
  const { user } = useAuth();
  const { centralProfileHydrated } = useCentralizedUserData();
  return useQuery({
    queryKey: profileQueryKey(user?.id),
    queryFn: fetchProfile,
    enabled: !!user?.id && centralProfileHydrated,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    refetchOnMount: (query) => {
      const data = query.state.data as ProfileRow | null | undefined;
      if (!data?.profile_photo_url) return true;
      return false;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ProfileUpdatePayload) => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: payload.full_name.trim() || null,
          phone: payload.phone.trim() || null,
          bio: payload.bio.trim() || null,
          job_title: payload.job_title.trim() || null,
          location: payload.location.trim() || null,
          website: payload.website.trim() || null,
          profile_photo_url: payload.profile_photo_url,
          preferred_locale: payload.preferred_locale,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      await supabase
        .from("employees")
        .update({
          profile_photo_url: payload.profile_photo_url,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    },
    onSuccess: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) });
      }
      void queryClient.invalidateQueries({ queryKey: ["profile-preferred-locale"] });
    },
  });
}
