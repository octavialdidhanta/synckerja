import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { toast } from "@/shared/hooks/use-toast";
import { supabase } from "@/shared/lib/supabaseClient";
import { RefreshCw } from "lucide-react";
import { OnboardingSplitLayout } from "@/0-onboarding/components/OnboardingSplitLayout";
import { sendConfirmationEmail } from "@/0-register/utils/emailConfirmation";
import { EmailOtpInput } from "@/0-register/components/EmailOtpInput";

const brandBlue = "hsl(var(--brand-blue))";

const defaultBrandMark = (
  <img src="/favicon.png" alt="" className="h-14 w-auto" width={56} height={56} />
);

function defaultVerifyShell(body: React.ReactNode) {
  return (
    <OnboardingSplitLayout scrollClassName="items-center justify-center">{body}</OnboardingSplitLayout>
  );
}

export type VerifyEmailScreenProps = {
  brandMark?: ReactNode;
  renderShell?: (body: React.ReactNode) => React.ReactNode;
};

export function VerifyEmailScreen({
  brandMark = defaultBrandMark,
  renderShell = defaultVerifyShell,
}: VerifyEmailScreenProps) {
  const { t } = useTranslation();
  const [resendingEmail, setResendingEmail] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [otpResetTrigger, setOtpResetTrigger] = useState(0);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [successRedirectSeconds, setSuccessRedirectSeconds] = useState<number | null>(null);
  const navigate = useNavigate();

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const clearRegistrationFlags = useCallback(() => {
    sessionStorage.removeItem("registrationFlow");
    sessionStorage.removeItem("fromRegistration");
    sessionStorage.removeItem("userEmail");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("pendingUserId");
    sessionStorage.removeItem("emailError");
    sessionStorage.removeItem("verifyEmailSentOk");
    sessionStorage.removeItem("verifyEmailSentToast");
    localStorage.removeItem("pendingEmailVerification");
  }, []);

  const handleVerificationSuccess = useCallback(() => {
    clearRegistrationFlags();
    sessionStorage.setItem("emailJustVerified", "true");
    sessionStorage.setItem("forceRefreshUserData", "true");
    sessionStorage.setItem("emailVerified", "true");
    navigate("/email-verified", { replace: true, state: { verifiedByPolling: true } });
  }, [clearRegistrationFlags, navigate]);

  useEffect(() => {
    if (successRedirectSeconds === null) return;
    if (successRedirectSeconds === 0) {
      if (isMountedRef.current) {
        handleVerificationSuccess();
      }
      setSuccessRedirectSeconds(null);
      return;
    }
    const id = window.setTimeout(() => {
      setSuccessRedirectSeconds((prev) => (prev === null || prev <= 0 ? null : prev - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [successRedirectSeconds, handleVerificationSuccess]);

  const checkValidAccess = useCallback(() => {
    if (typeof window === "undefined") return false;
    if (sessionStorage.getItem("verifyEmailSentOk") !== "1") return false;
    if (sessionStorage.getItem("registrationFlow") !== "true") return false;
    if (sessionStorage.getItem("fromRegistration") !== "true") return false;
    const pendingId = sessionStorage.getItem("pendingUserId");
    const email = sessionStorage.getItem("userEmail")?.trim();
    const name = sessionStorage.getItem("userName")?.trim();
    return Boolean(pendingId && email && name);
  }, []);

  const checkVerificationStatus = useCallback(
    async (userIdToCheck: string | null = null) => {
      if (!isMountedRef.current) return false;
      try {
        const targetUserId = userIdToCheck || userId || sessionStorage.getItem("pendingUserId");
        if (!targetUserId) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: verificationToken, error } = await supabase
              .from("email_verification_tokens")
              .select("email_verified")
              .eq("user_id", session.user.id)
              .eq("email_verified", true)
              .order("used_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!error && verificationToken?.email_verified) {
              handleVerificationSuccess();
              return true;
            }
          }
          return false;
        }

        const regEmail =
          (typeof window !== "undefined" && sessionStorage.getItem("userEmail")) || userEmail || "";
        if (!regEmail.trim()) return false;

        const { data: isVerified, error } = await supabase.rpc("registration_has_verified_email", {
          p_user_id: targetUserId,
          p_email: regEmail.trim(),
        });

        if (error) return false;
        if (isVerified === true) {
          handleVerificationSuccess();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [userId, userEmail, handleVerificationSuccess],
  );

  const submitOtp = useCallback(
    async (code: string) => {
      const email = (userEmail || sessionStorage.getItem("userEmail") || "").trim();
      if (!email) {
        toast({
          title: t("auth.verifyEmail.otpErrorTitle"),
          description: t("auth.verifyEmail.missingData"),
          variant: "destructive",
        });
        return;
      }
      setOtpSubmitting(true);
      setEmailError(null);
      try {
        const { data, error } = await supabase.rpc("confirm_email_verification_otp", {
          p_email: email,
          p_code: code,
        });
        if (error) {
          toast({
            title: t("auth.verifyEmail.otpErrorTitle"),
            description: error.message,
            variant: "destructive",
          });
          setOtpResetTrigger((x) => x + 1);
          return;
        }
        const row = data as { ok?: boolean; error?: string };
        if (row?.ok) {
          setSuccessRedirectSeconds(3);
          return;
        }
        const errKey = row?.error ?? "invalid_code";
        const msg =
          errKey === "invalid_or_expired"
            ? t("auth.verifyEmail.otpErrorExpired")
            : t("auth.verifyEmail.otpErrorInvalid");
        setEmailError(msg);
        toast({
          title: t("auth.verifyEmail.otpErrorTitle"),
          description: msg,
          variant: "destructive",
        });
        setOtpResetTrigger((x) => x + 1);
      } finally {
        setOtpSubmitting(false);
      }
    },
    [userEmail, t],
  );

  const resendVerificationEmail = useCallback(async () => {
    if (resendCooldown > 0) {
      toast({
        title: t("auth.verifyEmail.waitTitle"),
        description: t("auth.verifyEmail.waitDesc", { seconds: resendCooldown }),
      });
      return;
    }
    setResendingEmail(true);
    setEmailError(null);
    try {
      const email = userEmail || sessionStorage.getItem("userEmail") || "";
      const fullName = userName || sessionStorage.getItem("userName") || "";
      const pending = sessionStorage.getItem("pendingUserId") || userId;
      if (!email || !fullName || !pending) {
        setEmailError(t("auth.verifyEmail.missingData"));
        setResendingEmail(false);
        return;
      }
      const { data: issueData, error: issueErr } = await supabase.rpc("issue_new_verification_token", {
        p_email: email.trim(),
      });
      if (issueErr) {
        throw new Error(issueErr.message);
      }
      const issued = issueData as { ok?: boolean; token?: string; error?: string };
      if (!issued?.ok || !issued.token) {
        if (issued?.error === "user_not_found") {
          setEmailError(t("auth.verifyEmail.userNotFound"));
        } else {
          setEmailError(t("auth.verifyEmail.resendFail"));
        }
        setResendingEmail(false);
        return;
      }
      const { data: sessWrap } = await supabase.auth.getSession();
      await sendConfirmationEmail(
        email,
        fullName,
        window.location.origin,
        issued.token,
        sessWrap.session?.access_token,
      );
      sessionStorage.setItem("verifyEmailSentOk", "1");
      toast({
        title: t("auth.verifyEmail.resentTitle"),
        description: t("auth.verifyEmail.resentDesc"),
      });
      setOtpResetTrigger((x) => x + 1);
      setResendCooldown(60);
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownIntervalRef.current) {
              clearInterval(cooldownIntervalRef.current);
              cooldownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("auth.verifyEmail.resendFail");
      setEmailError(msg);
    } finally {
      setResendingEmail(false);
    }
  }, [userEmail, userName, userId, resendCooldown, t]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
        cooldownIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const performAccessCheck = async () => {
      const hasValidAccess = checkValidAccess();
      if (!hasValidAccess || !isMountedRef.current) {
        navigate("/register", { replace: true });
        return;
      }
      const pendingUserId = sessionStorage.getItem("pendingUserId");
      const storedEmail = sessionStorage.getItem("userEmail")?.trim() ?? "";
      if (!pendingUserId || !storedEmail) {
        navigate("/register", { replace: true });
        return;
      }

      const { data: dbAllows, error: allowErr } = await supabase.rpc(
        "registration_verify_email_page_allowed",
        { p_user_id: pendingUserId, p_email: storedEmail },
      );
      if (!isMountedRef.current) return;

      if (allowErr || dbAllows !== true) {
        const { data: alreadyVerified, error: verErr } = await supabase.rpc(
          "registration_has_verified_email",
          { p_user_id: pendingUserId, p_email: storedEmail },
        );
        if (!isMountedRef.current) return;

        if (!verErr && alreadyVerified === true) {
          clearRegistrationFlags();
          sessionStorage.setItem("emailVerified", "true");
          toast({
            title: t("auth.verifyEmail.alreadyVerifiedTitle"),
            description: t("auth.verifyEmail.alreadyVerifiedDesc"),
          });
          navigate("/login", { replace: true });
          return;
        }

        navigate("/register", { replace: true });
        return;
      }

      initializePage();
    };

    const initializePage = async () => {
      if (!isMountedRef.current) return;
      const storedEmail = sessionStorage.getItem("userEmail");
      const storedName = sessionStorage.getItem("userName");
      const storedEmailError = sessionStorage.getItem("emailError");
      const fromRegistration = sessionStorage.getItem("fromRegistration");
      const pendingUserId = sessionStorage.getItem("pendingUserId");
      if (storedEmail) setUserEmail(storedEmail);
      if (storedName) setUserName(storedName);
      if (pendingUserId) setUserId(pendingUserId);
      if (storedEmailError) {
        setEmailError(storedEmailError);
        sessionStorage.removeItem("emailError");
      }
      const shouldShowSentToast =
        fromRegistration === "true" && sessionStorage.getItem("verifyEmailSentToast") === "1";
      if (shouldShowSentToast) {
        sessionStorage.removeItem("verifyEmailSentToast");
        toast({
          title: t("auth.verifyEmail.sentToastTitle"),
          description: t("auth.verifyEmail.sentToastDesc"),
        });
      }
      const isVerified = await checkVerificationStatus(pendingUserId);
      if (isVerified || !isMountedRef.current) {
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = setInterval(async () => {
        if (!isMountedRef.current) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }
        const verified = await checkVerificationStatus(pendingUserId);
        if (verified && pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }, 5000);
    };

    performAccessCheck();
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [navigate, checkValidAccess, checkVerificationStatus, clearRegistrationFlags, t]);

  if (isLoading) {
    return renderShell(
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-[hsl(var(--brand-blue))] border-t-transparent" />,
    );
  }

  const otpDisabled = otpSubmitting || resendingEmail || successRedirectSeconds !== null;

  return renderShell(
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col">
        <div className="mb-2 flex w-full justify-center">{brandMark}</div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t("auth.verifyEmail.title")}
          </h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">{t("auth.verifyEmail.subtitle")}</p>
          <p className="mt-1 text-xs text-slate-500">{t("auth.verifyEmail.pollHint")}</p>
        </div>
      </div>

      <div className="flex flex-col items-stretch space-y-6 text-center">
        {userEmail && (
          <div className="w-full rounded-xl border border-[hsl(var(--brand-blue))]/25 bg-[hsl(var(--brand-blue))]/5 p-3">
            <p className="text-sm text-slate-800">
              <span className="font-semibold" style={{ color: brandBlue }}>
                {t("auth.verifyEmail.sentTo")}
              </span>{" "}
              <span className="text-slate-900">{userEmail}</span>
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-center text-sm font-medium text-slate-800">{t("auth.verifyEmail.otpLabel")}</p>
          <EmailOtpInput
            resetTrigger={otpResetTrigger}
            disabled={otpDisabled}
            onComplete={submitOtp}
            legend={t("auth.verifyEmail.otpLabel")}
          />
          {otpSubmitting && (
            <p className="text-center text-xs text-slate-500">{t("auth.verifyEmail.otpVerifying")}</p>
          )}
          {successRedirectSeconds !== null && successRedirectSeconds > 0 && (
            <div
              className="rounded-xl border border-[hsl(var(--brand-blue))]/30 bg-[hsl(var(--brand-blue))]/10 p-4"
              role="status"
              aria-live="polite"
            >
              <p
                className="text-center text-lg font-semibold tabular-nums text-slate-900"
                style={{ color: brandBlue }}
              >
                {t("auth.verifyEmail.redirectCountdown", { seconds: successRedirectSeconds })}
              </p>
            </div>
          )}
        </div>

        {emailError && (
          <div className="w-full rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-center text-sm text-red-700">{emailError}</p>
          </div>
        )}

        <div className="w-full space-y-3">
          <Button
            variant="outline"
            className="h-12 w-full border-2 border-[hsl(var(--brand-blue))] font-semibold text-[hsl(var(--brand-blue))] hover:bg-[hsl(var(--brand-blue))]/10"
            onClick={resendVerificationEmail}
            disabled={resendingEmail || resendCooldown > 0 || otpSubmitting || successRedirectSeconds !== null}
          >
            {resendingEmail ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> {t("auth.verifyEmail.sending")}
              </>
            ) : resendCooldown > 0 ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />{" "}
                {t("auth.verifyEmail.resendCooldown", { seconds: resendCooldown })}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" /> {t("auth.verifyEmail.resend")}
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            className="h-12 w-full font-semibold text-[hsl(var(--brand-blue))] hover:bg-slate-100 hover:text-[hsl(var(--brand-blue))]"
            onClick={() => {
              clearRegistrationFlags();
              navigate("/login");
            }}
            disabled={otpSubmitting || successRedirectSeconds !== null}
          >
            {t("auth.verifyEmail.backLogin")}
          </Button>
        </div>
      </div>
    </div>,
  );
}
