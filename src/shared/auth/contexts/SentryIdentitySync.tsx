import { useEffect } from "react";
import { useCentralizedUserData } from "@/shared/auth/contexts/useCentralizedUserData";
import { setSentryIdentity } from "@/shared/lib/sentry";

/**
 * Tags Sentry events with the signed-in user's id and active organization id (UUIDs only:
 * no name, email or company name), so an error can be traced to a tenant in our own DB.
 */
export function SentryIdentitySync() {
  const { user, organization, userRole } = useCentralizedUserData();
  const userId = user?.id ?? null;
  const orgId = organization?.id ?? null;

  useEffect(() => {
    setSentryIdentity({ userId, orgId, role: userId ? userRole : null });
  }, [userId, orgId, userRole]);

  return null;
}
