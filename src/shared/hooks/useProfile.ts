import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

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

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "user_id, email, full_name, phone, bio, job_title, location, website, profile_photo_url, preferred_locale, active_organization_id, updated_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as ProfileRow | null;
}

export function useProfile() {
  return useQuery({
    queryKey: [PROFILE_QUERY_KEY],
    queryFn: fetchProfile,
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
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["profile-preferred-locale"] });
    },
  });
}
