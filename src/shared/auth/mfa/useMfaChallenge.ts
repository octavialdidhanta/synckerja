import { useCallback, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { fetchVerifiedTotpFactor } from "./mfaUtils";

export function useMfaChallenge() {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyTotpCode = useCallback(async (code: string, factorId?: string) => {
    setVerifying(true);
    setError(null);
    try {
      const factor = factorId ? { id: factorId } : await fetchVerifiedTotpFactor();
      if (!factor?.id) {
        throw new Error("No verified TOTP factor");
      }

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code: code.replace(/\s/g, ""),
      });
      if (verifyError) throw verifyError;
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      return false;
    } finally {
      setVerifying(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { verifying, error, verifyTotpCode, clearError };
}
