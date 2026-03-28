/**
 * `newOrganizationId` is set in OrganizationForm after create; bridges RLS until `user_organizations` is readable.
 */
export function readNewOrganizationIdFromSession(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("newOrganizationId");
}

export function effectiveOrganizationId(userOrganizationsId: string | null | undefined): string | null {
  const fromSession = readNewOrganizationIdFromSession();
  return fromSession || userOrganizationsId || null;
}
