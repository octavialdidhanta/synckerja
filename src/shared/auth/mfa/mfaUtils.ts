import type { Factor } from "@supabase/supabase-js";
import { supabase } from "@/shared/lib/supabaseClient";

export type AalLevel = "aal1" | "aal2";

export function getVerifiedTotpFactor(factors: Factor[] | undefined): Factor | null {
  if (!factors?.length) return null;
  return (
    factors.find((f) => f.factor_type === "totp" && f.status === "verified") ?? null
  );
}

export async function fetchVerifiedTotpFactor(): Promise<Factor | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const all = [...(data.totp ?? []), ...(data.phone ?? [])];
  return getVerifiedTotpFactor(all);
}

export async function getAalState(): Promise<{
  currentLevel: AalLevel | null;
  nextLevel: AalLevel | null;
}> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return {
    currentLevel: (data?.currentLevel as AalLevel | null) ?? null,
    nextLevel: (data?.nextLevel as AalLevel | null) ?? null,
  };
}

export async function needsMfaChallengeAtLogin(): Promise<boolean> {
  const { nextLevel, currentLevel } = await getAalState();
  return nextLevel === "aal2" && currentLevel !== "aal2";
}

export async function hasAal2Session(): Promise<boolean> {
  const { currentLevel } = await getAalState();
  return currentLevel === "aal2";
}

export function decodeJwtAal(accessToken: string | undefined): AalLevel | null {
  if (!accessToken) return null;
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as {
      aal?: string;
    };
    if (payload.aal === "aal1" || payload.aal === "aal2") return payload.aal;
    return null;
  } catch {
    return null;
  }
}
