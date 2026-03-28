import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/lib/supabaseClient";
import { Button } from "@/shared/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { OnboardingSplitLayout } from "@/0-onboarding/components/OnboardingSplitLayout";

const brandRed = "hsl(var(--brand-red))";

interface EmailVerificationStatusProps {
  token?: string;
}

type TokenSnapshot = {
  ok?: boolean;
  error?: string;
  expires_at?: string;
  email_verified?: boolean;
  user_id?: string;
};

async function pollEmailVerification(
  token: string,
  userId: string,
  maxAttempts = 20,
  interval = 500,
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await supabase.rpc("poll_email_verified_by_token", {
      p_token: token,
      p_user_id: userId,
    });
    if (!error && data === true) return true;
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

export function EmailVerificationStatus({ token }: EmailVerificationStatusProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const verifiedByPolling = Boolean(
    (location.state as { verifiedByPolling?: boolean } | null)?.verifiedByPolling,
  );

  const [loading, setLoading] = useState(!verifiedByPolling);
  const [verified, setVerified] = useState(verifiedByPolling);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(verifiedByPolling);
  const [verificationStatus, setVerificationStatus] = useState(
    t("auth.emailVerified.verifying"),
  );

  useEffect(() => {
    if (verifiedByPolling) {
      sessionStorage.removeItem("registrationFlow");
      sessionStorage.removeItem("fromRegistration");
      sessionStorage.removeItem("userEmail");
      sessionStorage.removeItem("userName");
      sessionStorage.removeItem("emailError");
      sessionStorage.removeItem("pendingUserId");
      localStorage.removeItem("pendingEmailVerification");
      sessionStorage.setItem("emailJustVerified", "true");
      sessionStorage.setItem("emailVerified", "true");
      setLoading(false);
      setVerified(true);
      setShowSuccess(true);
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        if (token) {
          setVerificationStatus(t("auth.emailVerified.checkingToken"));
          const { data: snapRaw, error: snapErr } = await supabase.rpc("get_verification_token_snapshot", {
            p_token: token,
          });

          if (snapErr) {
            setError(t("auth.emailVerified.invalidToken"));
            setLoading(false);
            return;
          }

          const tokenData = snapRaw as TokenSnapshot;
          if (!tokenData?.ok || !tokenData.user_id) {
            setError(t("auth.emailVerified.invalidToken"));
            setLoading(false);
            return;
          }

          if (tokenData.email_verified) {
            setVerified(true);
            setLoading(false);
            setShowSuccess(true);
            return;
          }

          const now = new Date();
          const expiresAt = new Date(tokenData.expires_at ?? "");
          if (!tokenData.expires_at || Number.isNaN(expiresAt.getTime()) || now > expiresAt) {
            setError(t("auth.emailVerified.expired"));
            setLoading(false);
            return;
          }

          setVerificationStatus(t("auth.emailVerified.updating"));
          const { data: rpcData, error: rpcError } = await supabase.rpc("confirm_email_verification", {
            p_token: token,
          });

          if (rpcError) {
            setError(t("auth.emailVerified.updateFail"));
            setLoading(false);
            return;
          }
          const ok = rpcData && typeof rpcData === "object" && (rpcData as { ok?: boolean }).ok;
          if (!ok) {
            const err = (rpcData as { error?: string })?.error;
            setError(err === "expired" ? t("auth.emailVerified.expired") : t("auth.emailVerified.updateFail"));
            setLoading(false);
            return;
          }

          setVerificationStatus(t("auth.emailVerified.confirming"));
          let okPoll = await pollEmailVerification(token, tokenData.user_id);
          if (!okPoll) {
            await new Promise((r) => setTimeout(r, 1000));
            okPoll = await pollEmailVerification(token, tokenData.user_id, 10, 500);
          }
          if (!okPoll) {
            setError(t("auth.emailVerified.slow"));
            setLoading(false);
            return;
          }

          setVerified(true);
          sessionStorage.setItem("emailJustVerified", "true");
          sessionStorage.setItem("emailVerified", "true");
          setLoading(false);
          setShowSuccess(true);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError(t("auth.emailVerified.loginFirst"));
          setLoading(false);
          return;
        }
        const { data: verificationToken } = await supabase
          .from("email_verification_tokens")
          .select("email_verified")
          .eq("user_id", user.id)
          .order("used_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (verificationToken?.email_verified) {
          setVerified(true);
          setShowSuccess(true);
        } else {
          setError(t("auth.emailVerified.notVerifiedYet"));
        }
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError(t("auth.emailVerified.genericError"));
        setLoading(false);
      }
    };

    run();
  }, [token, verifiedByPolling, t]);

  const goLogin = () => {
    sessionStorage.setItem("fromEmailVerification", "true");
    navigate("/login");
  };

  if (loading) {
    return (
      <OnboardingSplitLayout scrollClassName="items-center justify-center">
        <div className="flex w-full max-w-md flex-col items-center space-y-4 text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-[hsl(var(--brand-blue))]" />
          <h1 className="text-xl font-semibold text-slate-900">{verificationStatus}</h1>
        </div>
      </OnboardingSplitLayout>
    );
  }

  if (error) {
    return (
      <OnboardingSplitLayout scrollClassName="items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <div className="flex w-full justify-center">
            <img src="/favicon.png" alt="" className="h-14 w-auto" width={56} height={56} />
          </div>
          <div className="space-y-6 text-center">
            <XCircle className="mx-auto h-16 w-16 text-destructive" />
            <h2 className="text-xl font-semibold text-destructive">{t("auth.emailVerified.failTitle")}</h2>
            <p className="text-sm text-slate-600">{error}</p>
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                className="h-12 border-2 border-[hsl(var(--brand-blue))] font-semibold text-[hsl(var(--brand-blue))] hover:bg-[hsl(var(--brand-blue))]/10"
                onClick={() => navigate("/verify-email")}
              >
                {t("auth.emailVerified.retry")}
              </Button>
              <Button
                className="h-12 font-semibold text-white shadow-md hover:opacity-[0.92]"
                style={{ backgroundColor: brandRed }}
                onClick={goLogin}
              >
                {t("auth.emailVerified.backLogin")}
              </Button>
            </div>
          </div>
        </div>
      </OnboardingSplitLayout>
    );
  }

  if (verified && showSuccess) {
    return (
      <OnboardingSplitLayout scrollClassName="items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <div className="flex w-full justify-center">
            <img src="/favicon.png" alt="" className="h-14 w-auto" width={56} height={56} />
          </div>
          <div className="space-y-6 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-[hsl(var(--brand-blue))]" />
            <h2 className="text-xl font-semibold text-slate-900">{t("auth.emailVerified.successTitle")}</h2>
            <p className="text-sm text-slate-600">{t("auth.emailVerified.successBody")}</p>
            <Button
              className="h-12 w-full font-semibold text-white shadow-md hover:opacity-[0.92]"
              style={{ backgroundColor: brandRed }}
              onClick={goLogin}
            >
              {t("auth.emailVerified.goLogin")}
            </Button>
          </div>
        </div>
      </OnboardingSplitLayout>
    );
  }

  return null;
}
