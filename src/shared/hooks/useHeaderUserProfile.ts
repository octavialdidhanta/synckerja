import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/shared/lib/supabaseClient";
import { resolveProfilePhotoDisplayUrl } from "@/shared/lib/profilePhotoStorage";
import { displayNameFromUser, initialsFromNameOrEmail } from "@/shared/lib/userDisplayUtils";
import { useUserOrganizations } from "@/shared/hooks/useUserOrganizations";
import { PROFILE_QUERY_KEY, useProfile } from "@/shared/hooks/useProfile";

const AUTH_USER_QUERY_KEY = ["auth-user-header"] as const;

async function fetchAuthUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export function useHeaderUserProfile() {
  const queryClient = useQueryClient();
  const { data: orgData, isLoading: orgLoading } = useUserOrganizations();
  const { data: profile, isLoading: profileLoading } = useProfile();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: AUTH_USER_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY] });
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const userQuery = useQuery({
    queryKey: AUTH_USER_QUERY_KEY,
    queryFn: fetchAuthUser,
    staleTime: 60_000,
  });

  const user = userQuery.data;
  const email = user?.email ?? "";
  const profileName = profile?.full_name?.trim() ?? "";
  const metaName = displayNameFromUser(user?.user_metadata as Record<string, unknown> | undefined, email);
  const displaySource = profileName || metaName;
  const nameForUi = displaySource || email || "…";
  const initials = initialsFromNameOrEmail(displaySource || email.split("@")[0] || "", email);
  const avatarImageUrl = resolveProfilePhotoDisplayUrl(profile?.profile_photo_url ?? null);

  const activeId = orgData?.activeOrganizationId ?? null;
  const activeMembership = orgData?.memberships.find((m) => m.organizationId === activeId);
  const role = activeId ? (activeMembership?.role ?? "employee") : "";

  return {
    user,
    email,
    displayName: nameForUi,
    initials,
    avatarImageUrl,
    role,
    isLoading: userQuery.isLoading || orgLoading || profileLoading,
  };
}
