import { useCallback, useState } from "react";
import type { AuthMfaEnrollTOTPResponse } from "@supabase/supabase-js";
import { supabase } from "@/shared/lib/supabaseClient";
import { generateRecoveryCodes, hashRecoveryCode } from "./recoveryCodes";

type EnrollState = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
} | null;

export function useMfaEnroll() {
  const [enrolling, setEnrolling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [enrollState, setEnrollState] = useState<EnrollState>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const startEnroll = useCallback(async () => {
    setEnrolling(true);
    setError(null);
    setRecoveryCodes(null);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator",
      });
      if (enrollError) throw enrollError;
      const totp = (data as AuthMfaEnrollTOTPResponse).totp;
      setEnrollState({
        factorId: data.id,
        qrCode: totp.qr_code,
        secret: totp.secret,
        uri: totp.uri,
      });
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEnrollState(null);
      return null;
    } finally {
      setEnrolling(false);
    }
  }, []);

  const confirmEnroll = useCallback(
    async (code: string) => {
      if (!enrollState?.factorId) return { ok: false as const, recoveryCodes: null as string[] | null };
      setConfirming(true);
      setError(null);
      try {
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: enrollState.factorId,
        });
        if (challengeError) throw challengeError;

        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: enrollState.factorId,
          challengeId: challengeData.id,
          code: code.replace(/\s/g, ""),
        });
        if (verifyError) throw verifyError;

        const codes = generateRecoveryCodes();
        const hashes = await Promise.all(codes.map((c) => hashRecoveryCode(c)));
        const { error: storeError } = await supabase.rpc("store_mfa_recovery_codes", {
          p_hashes: hashes,
        });
        if (storeError) throw storeError;

        await supabase.rpc("log_auth_security_event", {
          p_event: "mfa_enrolled",
          p_metadata: { factor_type: "totp" },
        });

        setRecoveryCodes(codes);
        setEnrollState(null);
        return { ok: true as const, recoveryCodes: codes };
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return { ok: false as const, recoveryCodes: null };
      } finally {
        setConfirming(false);
      }
    },
    [enrollState],
  );

  const cancelEnroll = useCallback(async () => {
    if (enrollState?.factorId) {
      await supabase.auth.mfa.unenroll({ factorId: enrollState.factorId });
    }
    setEnrollState(null);
    setError(null);
  }, [enrollState]);

  const unenroll = useCallback(async (factorId: string, code: string) => {
    setConfirming(true);
    setError(null);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: code.replace(/\s/g, ""),
      });
      if (verifyError) throw verifyError;

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) throw unenrollError;

      await supabase.rpc("clear_mfa_recovery_codes");
      await supabase.rpc("log_auth_security_event", { p_event: "mfa_unenrolled", p_metadata: {} });

      setRecoveryCodes(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setConfirming(false);
    }
  }, []);

  const reset = useCallback(() => {
    setEnrollState(null);
    setError(null);
    setRecoveryCodes(null);
  }, []);

  const regenerateRecoveryCodes = useCallback(async (factorId: string, code: string) => {
    setConfirming(true);
    setError(null);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: code.replace(/\s/g, ""),
      });
      if (verifyError) throw verifyError;

      const codes = generateRecoveryCodes();
      const hashes = await Promise.all(codes.map((c) => hashRecoveryCode(c)));
      const { error: storeError } = await supabase.rpc("store_mfa_recovery_codes", {
        p_hashes: hashes,
      });
      if (storeError) throw storeError;

      await supabase.rpc("log_auth_security_event", {
        p_event: "mfa_recovery_codes_regenerated",
        p_metadata: { count: codes.length },
      });

      setRecoveryCodes(codes);
      return { ok: true as const, recoveryCodes: codes };
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return { ok: false as const, recoveryCodes: null as string[] | null };
    } finally {
      setConfirming(false);
    }
  }, []);

  return {
    enrolling,
    confirming,
    enrollState,
    error,
    recoveryCodes,
    startEnroll,
    confirmEnroll,
    cancelEnroll,
    unenroll,
    reset,
    regenerateRecoveryCodes,
  };
}
