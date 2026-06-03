import { useEffect, useRef } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
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

type HeaderIdentitySnapshot = {
  displayName: string;
  initials: string;
  avatarImageUrl: string | null;
  role: string;
};

const emptySnapshot = (): HeaderIdentitySnapshot => ({
  displayName: "",
  initials: "",
  avatarImageUrl: null,
  role: "",
});

export function useHeaderUserProfile() {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const { data: orgData, isPending: orgPending, isSwitching } = useUserOrganizations();
  const { data: profile, isPending: profilePending } = useProfile();

  const userIdRef = useRef<string | undefined>(authUser?.id);
  useEffect(() => {
    if (authUser?.id) userIdRef.current = authUser.id;
  }, [authUser?.id]);

  const identitySnapshotRef = useRef<HeaderIdentitySnapshot>(emptySnapshot());

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id;
      const prevUserId = userIdRef.current;

      if (event === "SIGNED_OUT") {
        resetIdentityQueriesForAuthUser(queryClient, prevUserId);
        identitySnapshotRef.current = emptySnapshot();
        return;
      }

      // Tab resume / session restore often re-emits SIGNED_IN for the same user.
      // Clearing identity queries here caused header flash (metadata name, no avatar/role).
      if (
        event === "SIGNED_IN" &&
        prevUserId &&
        nextUserId &&
        prevUserId !== nextUserId
      ) {
        resetIdentityQueriesForAuthUser(queryClient, prevUserId);
        identitySnapshotRef.current = emptySnapshot();
        void queryClient.invalidateQueries({ queryKey: AUTH_USER_HEADER_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: profileQueryKey(nextUserId) });
      }

      if (nextUserId) userIdRef.current = nextUserId;
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const userQuery = useQuery({
    queryKey: AUTH_USER_HEADER_QUERY_KEY,
    queryFn: fetchAuthUser,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    initialData: () => authUser ?? undefined,
  });

  const user = userQuery.data ?? authUser ?? null;
  const email = user?.email ?? "";
  const profileName = profile?.full_name?.trim() ?? "";
  const metaName = displayNameFromUser(
    user?.user_metadata as Record<string, unknown> | undefined,
    email,
  );
  const displaySource = profileName || metaName;
  const nameForUi = isSwitching ? "…" : displaySource || email || "…";
  const initials = initialsFromNameOrEmail(displaySource || email.split("@")[0] || "", email);
  const avatarImageUrl = resolveProfilePhotoDisplayUrl(profile?.profile_photo_url ?? null);

  const activeId = orgData?.activeOrganizationId ?? null;
  const activeMembership = orgData?.memberships.find((m) => m.organizationId === activeId);
  const role = isSwitching ? "" : activeId ? (activeMembership?.role ?? "employee") : "";

  const hasResolvedProfile = profile !== undefined;
  const hasResolvedOrg = orgData !== undefined;
  const hasResolvedUser = user !== null && user !== undefined;

  useEffect(() => {
    if (!hasResolvedUser || !nameForUi || nameForUi === "…") return;
    const snap = identitySnapshotRef.current;
    snap.displayName = nameForUi;
    snap.initials = initials;
    snap.avatarImageUrl = avatarImageUrl;
    if (role) snap.role = role;
  }, [hasResolvedUser, nameForUi, initials, avatarImageUrl, role]);

  const snap = identitySnapshotRef.current;
  const displayName =
    nameForUi && nameForUi !== "…"
      ? nameForUi
      : snap.displayName || nameForUi;
  const displayInitials = initials || snap.initials;
  const displayAvatarUrl =
    avatarImageUrl ?? snap.avatarImageUrl;
  const displayRole = role || snap.role;

  const userBootstrapPending = userQuery.isPending && !hasResolvedUser;
  const orgBootstrapPending = orgPending && !hasResolvedOrg;
  const profileBootstrapPending = profilePending && !hasResolvedProfile;
  const hasCachedIdentity = Boolean(snap.displayName);

  return {
    user,
    email,
    displayName,
    initials: displayInitials,
    avatarImageUrl: displayAvatarUrl,
    role: displayRole,
    isLoading:
      isSwitching ||
      userBootstrapPending ||
      orgBootstrapPending ||
      profileBootstrapPending,
    hasCachedIdentity,
  };
}
