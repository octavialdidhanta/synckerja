import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/shared/lib/supabaseClient";
import { resolveProfilePhotoDisplayUrl } from "@/shared/lib/profilePhotoStorage";
import { displayNameFromUser, initialsFromNameOrEmail } from "@/shared/lib/userDisplayUtils";
import { useUserOrganizations } from "@/shared/hooks/useUserOrganizations";
import { useProfile } from "@/shared/hooks/useProfile";
import {
  AUTH_USER_HEADER_QUERY_KEY,
  profileQueryKey,
  resetIdentityQueriesForAuthUser,
} from "@/shared/auth/identityQuerySync";
import { useAuth } from "@/shared/auth/contexts/AuthContext";

async function fetchAuthUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export function useHeaderUserProfile() {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const { data: orgData, isLoading: orgLoading, isSwitching } = useUserOrganizations();
  const { data: profile, isLoading: profileLoading } = useProfile();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id;
      if (event === "SIGNED_OUT") {
        resetIdentityQueriesForAuthUser(queryClient, authUser?.id);
        return;
      }
      if (event === "SIGNED_IN" && nextUserId) {
        resetIdentityQueriesForAuthUser(queryClient, authUser?.id);
        void queryClient.invalidateQueries({ queryKey: AUTH_USER_HEADER_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: profileQueryKey(nextUserId) });
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient, authUser?.id]);

  const userQuery = useQuery({
    queryKey: AUTH_USER_HEADER_QUERY_KEY,
    queryFn: fetchAuthUser,
    staleTime: 60_000,
  });

  const user = userQuery.data;
  const email = user?.email ?? "";
  const profileName = profile?.full_name?.trim() ?? "";
  const metaName = displayNameFromUser(user?.user_metadata as Record<string, unknown> | undefined, email);
  const displaySource = profileName || metaName;
  const nameForUi = isSwitching ? "…" : displaySource || email || "…";
  const initials = initialsFromNameOrEmail(displaySource || email.split("@")[0] || "", email);
  const avatarImageUrl = resolveProfilePhotoDisplayUrl(profile?.profile_photo_url ?? null);

  const activeId = orgData?.activeOrganizationId ?? null;
  const activeMembership = orgData?.memberships.find((m) => m.organizationId === activeId);
  const role = isSwitching ? "" : activeId ? (activeMembership?.role ?? "employee") : "";

  return {
    user,
    email,
    displayName: nameForUi,
    initials,
    avatarImageUrl,
    role,
    isLoading: userQuery.isLoading || orgLoading || profileLoading || isSwitching,
  };
}
