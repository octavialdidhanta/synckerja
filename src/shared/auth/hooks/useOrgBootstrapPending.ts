import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

/**
 * Org loading only blocks UI on cold start (no organizationId yet).
 * After org is known, profile refetch / tab resume must not flip page skeletons.
 */
export function useOrgBootstrapPending() {
  const { organizationId, loading } = useCurrentOrg();
  return {
    organizationId,
    orgBootstrapPending: loading && !organizationId,
  };
}
