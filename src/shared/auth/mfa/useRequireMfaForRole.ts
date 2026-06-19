import { useEffect, useMemo } from "react";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useMfaFactors } from "./useMfaFactors";

const GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;
const GRACE_STORAGE_KEY = "synckerja_mfa_grace_start";

function readGraceStartedAt(): number | null {
  try {
    const raw = localStorage.getItem(GRACE_STORAGE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function useRequireMfaForRole() {
  const { isOwner, isAdmin, loading: roleLoading } = useCentralizedUserData();
  const { hasVerifiedTotp, loading: mfaLoading } = useMfaFactors();

  const isPrivileged = isOwner || isAdmin;
  const loading = roleLoading || mfaLoading;

  const graceStartedAt = useMemo(() => readGraceStartedAt(), [hasVerifiedTotp, isPrivileged]);

  const graceEndsAt =
    graceStartedAt != null && Number.isFinite(graceStartedAt)
      ? graceStartedAt + GRACE_PERIOD_MS
      : null;

  useEffect(() => {
    if (loading || !isPrivileged || hasVerifiedTotp) return;
    try {
      if (!localStorage.getItem(GRACE_STORAGE_KEY)) {
        localStorage.setItem(GRACE_STORAGE_KEY, String(Date.now()));
      }
    } catch {
      /* ignore */
    }
  }, [loading, isPrivileged, hasVerifiedTotp]);

  const inGracePeriod =
    isPrivileged &&
    !hasVerifiedTotp &&
    graceEndsAt != null &&
    Date.now() < graceEndsAt;

  const mustEnroll = isPrivileged && !hasVerifiedTotp && !inGracePeriod;
  const shouldShowEnrollBanner = isPrivileged && !hasVerifiedTotp;

  return {
    loading,
    isPrivileged,
    hasVerifiedTotp,
    mustEnroll,
    shouldShowEnrollBanner,
    inGracePeriod,
    graceEndsAt,
  };
}
