import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { supabase } from "@/shared/lib/supabaseClient";
import { routeAfterLogin } from "@/0-auth/lib/postLoginRouting";
import {
  abandonMfaChallengeAndReturnToLogin,
  MfaOtpInput,
  useMfaChallenge,
} from "@/shared/auth/mfa";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { mfaSecuritySettingsPath } from "@/shared/auth/mfa/mfaSettingsPaths";
import { hashRecoveryCode } from "@/shared/auth/mfa/recoveryCodes";
import { fetchVerifiedTotpFactor, hasAal2Session } from "@/shared/auth/mfa/mfaUtils";
import {
  authFormRootClass,
  authFormTitleClass,
  authFormHeaderLogoWrapper,
  authFormBottomSpacerClass,
} from "@/0-auth/styles/authFormStyles";
import { SynckerjaBrandLogo } from "@/shared/brand/brandLogo";

type Mode = "totp" | "recovery";

export type MfaVerifyScreenProps = {
  brandMark?: ReactNode;
  onFieldFocus?: () => void;
  onFieldBlur?: () => void;
  submitButtonRef?: RefObject<HTMLButtonElement | null>;
};

const defaultBrandMark = <SynckerjaBrandLogo className="h-10 w-auto sm:h-12" width={48} height={48} />;

export function MfaVerifyScreen({
  brandMark = defaultBrandMark,
  onFieldFocus,
  onFieldBlur,
  submitButtonRef,
}: MfaVerifyScreenProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const { verifying, error, verifyTotpCode, clearError } = useMfaChallenge();
  const [resetTrigger, setResetTrigger] = useState(0);
  const [mode, setMode] = useState<Mode>("totp");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [abandoning, setAbandoning] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }
      if (await hasAal2Session()) {
        await routeAfterLogin(navigate, searchParams.get("redirectTo"));
        return;
      }
      const factor = await fetchVerifiedTotpFactor();
      if (!factor) {
        await routeAfterLogin(navigate, searchParams.get("redirectTo"));
      }
    })();
  }, [navigate, searchParams]);

  const finishLogin = async () => {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      if (await hasAal2Session()) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await supabase.rpc("log_auth_security_event", { p_event: "mfa_verified", p_metadata: {} });
    await routeAfterLogin(navigate, searchParams.get("redirectTo"));
  };

  const handleTotpComplete = async (code: string) => {
    const ok = await verifyTotpCode(code);
    if (ok) {
      await finishLogin();
    } else {
      setResetTrigger((n) => n + 1);
      await supabase.rpc("log_auth_security_event", { p_event: "mfa_failed", p_metadata: {} });
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setRecoveryError(null);
    try {
      const hash = await hashRecoveryCode(recoveryInput);
      const { data: consumed, error: rpcError } = await supabase.rpc("consume_mfa_recovery_code", {
        p_code_hash: hash,
      });
      if (rpcError) throw rpcError;
      if (!consumed) {
        setRecoveryError(t("settings.security.twoFactor.recoveryInvalid"));
        return;
      }

      const factor = await fetchVerifiedTotpFactor();
      if (factor?.id) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      await supabase.rpc("clear_mfa_recovery_codes");

      navigate(mfaSecuritySettingsPath({ setup2fa: "recovery" }), { replace: true });
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : String(err));
    } finally {
      setRecoveryLoading(false);
    }
  };

  const backToLoginDisabled = verifying || recoveryLoading || abandoning;

  const handleBackToLogin = async () => {
    if (backToLoginDisabled) return;
    setAbandoning(true);
    try {
      await abandonMfaChallengeAndReturnToLogin(navigate, signOut);
    } finally {
      setAbandoning(false);
    }
  };

  return (
    <div className={authFormRootClass}>
      <header className="flex flex-col items-center text-center">
        <div className={authFormHeaderLogoWrapper}>{brandMark}</div>
        <div className="mb-2 flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className={authFormTitleClass}>{t("settings.security.twoFactor.loginTitle")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("settings.security.twoFactor.loginDescription")}</p>
      </header>

      {mode === "totp" ? (
        <div className="mt-6 space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="relative">
            {verifying ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : null}
            <MfaOtpInput
              disabled={verifying}
              resetTrigger={resetTrigger}
              legend={t("settings.security.twoFactor.otpLegend")}
              onComplete={handleTotpComplete}
              onInputFocus={onFieldFocus}
              onInputBlur={onFieldBlur}
            />
          </div>
          <Button
            type="button"
            variant="link"
            className="w-full text-sm"
            onClick={() => {
              clearError();
              setMode("recovery");
            }}
          >
            {t("settings.security.twoFactor.useRecovery")}
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void handleRecovery(e)} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recovery-code">{t("settings.security.twoFactor.recoveryLabel")}</Label>
            <Input
              id="recovery-code"
              value={recoveryInput}
              onChange={(e) => setRecoveryInput(e.target.value)}
              placeholder="XXXX-XXXX"
              autoComplete="off"
              disabled={recoveryLoading}
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
            />
          </div>
          {recoveryError ? (
            <Alert variant="destructive">
              <AlertDescription>{recoveryError}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            ref={submitButtonRef}
            type="submit"
            className="w-full"
            disabled={recoveryLoading || !recoveryInput.trim()}
          >
            {recoveryLoading ? t("settings.security.twoFactor.verifying") : t("settings.security.twoFactor.verifyRecovery")}
          </Button>
          <Button type="button" variant="link" className="w-full text-sm" onClick={() => setMode("totp")}>
            {t("settings.security.twoFactor.backToTotp")}
          </Button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm font-medium"
          disabled={backToLoginDisabled}
          onClick={() => void handleBackToLogin()}
        >
          {abandoning
            ? t("settings.security.twoFactor.returningToLogin")
            : t("settings.security.twoFactor.backToLogin")}
        </Button>
      </p>
      <div className={authFormBottomSpacerClass} aria-hidden />
    </div>
  );
}
