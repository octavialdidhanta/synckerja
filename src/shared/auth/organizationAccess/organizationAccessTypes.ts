export type OrganizationAccessState =
  | "loading"
  | "ready"
  | "no_membership"
  | "orphan_recovering";

export type ReconcileOrganizationResult = {
  organizationId: string | null;
  accessState: OrganizationAccessState;
};
