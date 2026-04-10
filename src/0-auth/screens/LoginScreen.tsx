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

const defaultBrandMark = (
  <img src="/pwa-512.png" alt="Synckerja" className="h-14 w-auto" width={512} height={512} />
);

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

  const brandBlue = "hsl(var(--brand-blue))";
  const brandRed = "hsl(var(--brand-red))";

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col">
        <div className="mb-2 flex w-full justify-center">{brandMark}</div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t("auth.login.welcomeTitle")}
          </h1>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="login-email" className="text-slate-800">
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
            disabled={loading}
            className="h-12 border-slate-200 bg-white focus-visible:ring-[hsl(var(--brand-blue))]"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="login-password" className="text-slate-800">
              {t("auth.login.password")}
            </Label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--brand-blue))] hover:underline"
            >
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
              disabled={loading}
              className="h-12 border-slate-200 bg-white pr-11 focus-visible:ring-[hsl(var(--brand-blue))] auth-input-scroll-margin"
            />
            <button
              type="button"
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <Button
          ref={submitButtonRef}
          type="submit"
          className="h-12 w-full text-base font-semibold text-white shadow-md transition-colors hover:opacity-[0.92]"
          style={{ backgroundColor: brandRed }}
          disabled={loading}
        >
          {loading ? t("auth.login.submitting") : t("auth.login.submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-600">
        {t("auth.login.noAccount")}{" "}
        <Link to="/register" className="font-semibold hover:underline" style={{ color: brandBlue }}>
          {t("auth.login.register")}
        </Link>
      </p>
    </div>
  );
}
