import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { PROFILE_QUERY_KEY } from "@/shared/hooks/useProfile";
import {
  userOrganizationsQueryKey,
  type UserOrganizationsData,
} from "@/shared/hooks/userOrganizationsQuery";
import { forceClearCache } from "@/shared/auth/page-access/departmentPageAccessCache";

export const AUTH_USER_HEADER_QUERY_KEY = ["auth-user-header"] as const;
export const CURRENT_USER_ROLE_QUERY_KEY = ["currentUserRole"] as const;

export type CentralIdentitySeedInput = {
  user: User;
  userData: {
    user_id: string;
    full_name: string;
    email: string;
    active_organization_id?: string;
    preferred_locale?: string | null;
  } | null;
  organization: {
    id: string;
    company_name: string;
  } | null;
  userRole: string | null;
  userOrganizations?: UserOrganizationsData | null;
};

/** Seed TanStack cache from CentralizedUserDataContext so header hooks skip duplicate fetches. */
export function seedIdentityQueriesFromCentralSnapshot(
  queryClient: QueryClient,
  input: CentralIdentitySeedInput,
) {
  const { user, userData, organization, userRole } = input;
  const userId = user.id;

  queryClient.setQueryData(AUTH_USER_HEADER_QUERY_KEY, user);

  // Do not seed profile / current-employee here — partial rows (no photo) block
  // useProfile & useCurrentEmployee from fetching with refetchOnMount: false.

  if (userRole != null) {
    queryClient.setQueryData(CURRENT_USER_ROLE_QUERY_KEY, userRole);
  }

  if (input.userOrganizations) {
    queryClient.setQueryData(userOrganizationsQueryKey, input.userOrganizations);
  } else if (organization && userData?.active_organization_id && userRole) {
    queryClient.setQueryData<UserOrganizationsData>(userOrganizationsQueryKey, {
      userId,
      activeOrganizationId: userData.active_organization_id,
      memberships: [
        {
          organizationId: organization.id,
          companyName: organization.company_name,
          role: userRole,
        },
      ],
    });
  }
}

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
  queryClient.removeQueries({ queryKey: CURRENT_USER_ROLE_QUERY_KEY });
}

/** Remove org-scoped TanStack Query cache after CMS delete / org switch cleanup. */
export function clearOrganizationScopedQueries(queryClient: QueryClient) {
  const queryCache = queryClient.getQueryCache().getAll();
  for (const query of queryCache) {
    const key = query.queryKey;
    const keyStr = JSON.stringify(key).toLowerCase();
    if (
      keyStr.includes("organization") ||
      keyStr.includes("org-") ||
      keyStr.includes("inventory") ||
      keyStr.includes("employee") ||
      keyStr.includes("subscription")
    ) {
      void queryClient.cancelQueries({ queryKey: key });
      queryClient.removeQueries({ queryKey: key });
    }
  }
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
