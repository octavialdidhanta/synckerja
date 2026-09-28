export type OrganizationAccessState =
  | "loading"
  | "ready"
  | "needs_organization"
  | "no_membership"
  | "orphan_recovering";

export type ReconcileOrganizationResult = {
  organizationId: string | null;
  accessState: OrganizationAccessState;
};
