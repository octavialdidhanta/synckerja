import { useCallback, useEffect, useState } from "react";
import type { Factor } from "@supabase/supabase-js";
import { supabase } from "@/shared/lib/supabaseClient";
import { getVerifiedTotpFactor } from "./mfaUtils";

export function useMfaFactors() {
  const [loading, setLoading] = useState(true);
  const [totpFactor, setTotpFactor] = useState<Factor | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const all = [...(data.totp ?? []), ...(data.phone ?? [])];
      setTotpFactor(getVerifiedTotpFactor(all));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTotpFactor(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    loading,
    error,
    totpFactor,
    hasVerifiedTotp: totpFactor != null,
    refresh,
  };
}
