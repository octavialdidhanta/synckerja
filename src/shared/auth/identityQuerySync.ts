import type { QueryClient } from "@tanstack/react-query";
import { PROFILE_QUERY_KEY } from "@/shared/hooks/useProfile";
import {
  userOrganizationsQueryKey,
  type UserOrganizationsData,
} from "@/shared/hooks/useUserOrganizations";
import { forceClearCache } from "@/shared/auth/page-access/departmentPageAccessCache";

export const AUTH_USER_HEADER_QUERY_KEY = ["auth-user-header"] as const;

export function profileQueryKey(userId: string | null | undefined) {
  return [PROFILE_QUERY_KEY, userId ?? "none"] as const;
}

/** Drop cached profile/orgs/header auth so another user cannot flash on sign-in. */
export function resetIdentityQueriesForAuthUser(
  queryClient: QueryClient,
  previousUserId?: string | null,
) {
  queryClient.removeQueries({ queryKey: [PROFILE_QUERY_KEY] });
  if (previousUserId) {
    queryClient.removeQueries({ queryKey: profileQueryKey(previousUserId) });
  }
  queryClient.removeQueries({ queryKey: userOrganizationsQueryKey });
  queryClient.removeQueries({ queryKey: AUTH_USER_HEADER_QUERY_KEY });
}

/** After active org changes: optimistic role in header + await fresh org/role rows. */
export async function syncAfterOrganizationSwitch(
  queryClient: QueryClient,
  organizationId: string,
) {
  forceClearCache();

  await queryClient.cancelQueries({ queryKey: userOrganizationsQueryKey });

  const previous = queryClient.getQueryData<UserOrganizationsData>(userOrganizationsQueryKey);
  if (previous) {
    queryClient.setQueryData<UserOrganizationsData>(userOrganizationsQueryKey, {
      ...previous,
      activeOrganizationId: organizationId,
    });
  }

  await Promise.all([
    queryClient.refetchQueries({ queryKey: userOrganizationsQueryKey }),
    queryClient.refetchQueries({ queryKey: [PROFILE_QUERY_KEY] }),
    queryClient.refetchQueries({ queryKey: AUTH_USER_HEADER_QUERY_KEY }),
  ]);
}
