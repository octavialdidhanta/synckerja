import type { Organization } from "@/shared/auth/organizationAccess/organizationAccessModel";

/** Keep previous org name only while fetch is in-flight; drop stale data once fetch settles. */
export function mergeOrganizationState(
  fetched: Organization | null | undefined,
  activeOrganizationId: string | undefined,
  previous: Organization | null,
  fetchSettled: boolean,
): Organization | null {
  if (fetched) return fetched;
  if (!fetchSettled && activeOrganizationId) return previous;
  return null;
}
