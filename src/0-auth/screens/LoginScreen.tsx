import { useState, useEffect, type RefObject, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { AuthError } from "@supabase/supabase-js";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "@/shared/hooks/use-toast";
import { routeAfterLogin } from "@/0-auth/lib/postLoginRouting";
import { startGoogleSignIn } from "@/0-auth/lib/googleSignIn";
import { AuthDivider, GoogleSignInButton } from "@/0-auth/components/GoogleSignInButton";
import {
  authFormEyeIconClass,
  authFormFieldGap,
  authFormFooterTextClass,
  authFormForgotLinkClass,
  authFormFormClass,
  authFormGoogleSectionClass,
  authFormHeaderLogoWrapper,
  authFormInputClass,
  authFormInputWithToggleClass,
  authFormLabelClass,
  authFormPasswordToggleClass,
  authFormRootClass,
  authFormSubmitClass,
  authFormTitleClass,
  authFormBottomSpacerClass,
} from "@/0-auth/styles/authFormStyles";
import { SynckerjaBrandLogo } from "@/shared/brand/brandLogo";

function messageForAuthError(error: AuthError, t: (key: string) => string): string {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return t("auth.login.errors.invalidCredentials");
  }
  if (
    code === "email_not_confirmed" ||
    msg.includes("email not confirmed") ||
    msg.includes("not confirmed")
  ) {
    return t("auth.login.errors.emailNotConfirmed");
  }
  return error.message;
}

const defaultBrandMark = <SynckerjaBrandLogo className="h-10 w-auto sm:h-12" width={48} height={48} />;

export type LoginScreenProps = {
  submitButtonRef?: RefObject<HTMLButtonElement | null>;
  onFieldFocus?: () => void;
  onFieldBlur?: () => void;
  brandMark?: ReactNode;
};

export function LoginScreen({
  submitButtonRef,
  onFieldFocus,
  onFieldBlur,
  brandMark = defaultBrandMark,
}: LoginScreenProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "session_expired") {
      toast({
        title: t("auth.login.sessionExpired"),
        variant: "destructive",
      });
    }
    if (reason === "password_reset") {
      toast({
        title: t("auth.resetPassword.successTitle"),
        description: t("auth.resetPassword.successDesc"),
      });
    }
  }, [searchParams, t]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        const code = error.code ?? "";
        const msg = (error.message ?? "").toLowerCase();
        const trimmedEmail = email.trim();

        if (
          code === "email_not_confirmed" ||
          msg.includes("email not confirmed") ||
          msg.includes("not confirmed")
        ) {
          toast({ title: messageForAuthError(error, t), variant: "destructive" });
          navigate(
            trimmedEmail ? `/register?email=${encodeURIComponent(trimmedEmail)}` : "/register",
            { replace: true },
          );
          return;
        }

        const looksInvalidCreds =
          code === "invalid_credentials" || msg.includes("invalid login credentials");
        if (looksInvalidCreds && trimmedEmail) {
          const { data: exists, error: rpcErr } = await supabase.rpc("email_exists", {
            p_email: trimmedEmail,
          });
          if (!rpcErr && exists === false) {
            toast({
              title: t("auth.login.redirectToRegisterTitle"),
              description: t("auth.login.redirectToRegisterDesc"),
            });
            navigate(`/register?email=${encodeURIComponent(trimmedEmail)}`, { replace: true });
            return;
          }
        }

        toast({ title: messageForAuthError(error, t), variant: "destructive" });
        return;
      }
      await routeAfterLogin(navigate, searchParams.get("redirectTo"));
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error, completedInApp } = await startGoogleSignIn({
        mode: "login",
        redirectToParam: searchParams.get("redirectTo"),
        navigate,
      });
      if (error === "access_denied") {
        // User cancelled account picker / consent; do not show an error toast.
        setGoogleLoading(false);
        return;
      }
      if (error === "android_oauth_misconfigured") {
        toast({
          title: t("auth.google.errors.androidMisconfiguredTitle"),
          description: t("auth.google.errors.androidMisconfiguredDescription"),
          variant: "destructive",
        });
        setGoogleLoading(false);
        return;
      }
      if (error === "google_account_reauth_failed") {
        toast({
          title: t("auth.google.errors.reauthFailedTitle"),
          description: t("auth.google.errors.reauthFailedDescription"),
          variant: "destructive",
        });
        setGoogleLoading(false);
        return;
      }
      if (error === "not_configured") {
        toast({
          title: t("auth.google.errors.generic"),
          description: t("auth.google.errors.notConfigured"),
          variant: "destructive",
        });
        setGoogleLoading(false);
        return;
      }
      if (error) {
        toast({
          title: t("auth.google.errors.generic"),
          description: error.length > 120 ? `${error.slice(0, 120)}…` : error,
          variant: "destructive",
        });
        setGoogleLoading(false);
        return;
      }
      if (completedInApp) {
        setGoogleLoading(false);
      }
    } catch {
      toast({ title: t("auth.google.errors.generic"), variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  const authBusy = loading || googleLoading;
  const brandBlue = "hsl(var(--brand-blue))";
  const brandRed = "hsl(var(--brand-red))";

  return (
    <div className={authFormRootClass}>
      <header className="flex flex-col items-center text-center">
        <div className={authFormHeaderLogoWrapper}>{brandMark}</div>
        <h1 className={authFormTitleClass}>{t("auth.login.welcomeTitle")}</h1>
      </header>

      <section className={authFormGoogleSectionClass} aria-label={t("auth.google.continueLogin")}>
        <GoogleSignInButton
          mode="login"
          loading={googleLoading}
          disabled={authBusy}
          onClick={() => void onGoogleSignIn()}
        />
        <AuthDivider />
      </section>

      <form onSubmit={onSubmit} className={authFormFormClass}>
        <div className={authFormFieldGap}>
          <Label htmlFor="login-email" className={authFormLabelClass}>
            {t("auth.login.email")}
          </Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
            required
            disabled={authBusy}
            className={authFormInputClass}
          />
        </div>

        <div className={`auth-input-scroll-margin ${authFormFieldGap}`}>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="login-password" className={authFormLabelClass}>
              {t("auth.login.password")}
            </Label>
            <Link to="/forgot-password" className={authFormForgotLinkClass}>
              {t("auth.login.forgotPassword")}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
              required
              disabled={authBusy}
              className={authFormInputWithToggleClass}
            />
            <button
              type="button"
              tabIndex={-1}
              className={authFormPasswordToggleClass}
              onClick={() => setShowPassword((v) => !v)}
              disabled={authBusy}
              aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
            >
              {showPassword ? <EyeOff className={authFormEyeIconClass} /> : <Eye className={authFormEyeIconClass} />}
            </button>
          </div>
        </div>

        <Button
          ref={submitButtonRef}
          type="submit"
          className={authFormSubmitClass}
          style={{ backgroundColor: brandRed }}
          disabled={authBusy}
        >
          {loading ? t("auth.login.submitting") : t("auth.login.submit")}
        </Button>

        <p className={authFormFooterTextClass}>
          {t("auth.login.noAccount")}{" "}
          <Link to="/register" className="font-semibold hover:underline" style={{ color: brandBlue }}>
            {t("auth.login.register")}
          </Link>
        </p>

        <div className={authFormBottomSpacerClass} aria-hidden />
      </form>
    </div>
  );
}
