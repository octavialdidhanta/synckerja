import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import type { AuthError } from "@supabase/supabase-js";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { PosBrandMark } from "@/pos-mobile/shared/components/PosBrandMark";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "@/shared/hooks/use-toast";
import { resolvePostAuthRouting } from "@/shared/auth/mfa/resolvePostAuthRouting";
import { cleanupAuthState } from "@/shared/auth/utils/authCleanup";
import { isSessionAccessTokenExpired } from "@/shared/auth/utils/expiredAuth";
import { emailsMatch } from "../lib/emailsMatch";
import { POS_AUTH_PATHS, POS_POST_LOGIN_REDIRECT } from "../lib/posAuthPaths";
import { clearPosLoginEmail, readPosLoginEmail, stashPosLoginEmail } from "../lib/posLoginEmailStorage";

type LocationState = { email?: string };

function messageForAuthError(error: AuthError, t: (key: string, fallback?: string) => string): string {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return t("posAuth.errors.invalidCredentials", "Invalid email or password.");
  }
  if (
    code === "email_not_confirmed" ||
    msg.includes("email not confirmed") ||
    msg.includes("not confirmed")
  ) {
    return t("posAuth.errors.emailNotConfirmed", "Confirm your email before signing in.");
  }
  return error.message;
}

export function PosLoginPasswordForm() {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const stateEmail = (location.state as LocationState | null)?.email?.trim() ?? "";
  const [email, setEmail] = useState(stateEmail || readPosLoginEmail() || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingSessionEmail, setExistingSessionEmail] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);

  useEffect(() => {
    if (!email) {
      navigate(POS_AUTH_PATHS.login, { replace: true });
      return;
    }
    stashPosLoginEmail(email);
  }, [email, navigate]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!email.trim()) {
        if (!cancelled) setSessionChecked(true);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      let active = session;
      if (active && isSessionAccessTokenExpired(active)) {
        const { data, error } = await supabase.auth.refreshSession();
        if (cancelled) return;
        if (error || !data.session) {
          await supabase.auth.signOut({ scope: "local" });
          cleanupAuthState();
          if (!cancelled) {
            setExistingSessionEmail(null);
            setSessionChecked(true);
          }
          return;
        }
        active = data.session;
      }

      if (!active) {
        if (!cancelled) {
          setExistingSessionEmail(null);
          setSessionChecked(true);
        }
        return;
      }

      const sessionEmail = (active.user.email ?? "").trim();
      if (sessionEmail && emailsMatch(sessionEmail, email)) {
        await resolvePostAuthRouting(navigate, POS_POST_LOGIN_REDIRECT, {
          mfaChallengeBasePath: POS_AUTH_PATHS.loginMfa,
        });
        return;
      }

      if (!cancelled) {
        setExistingSessionEmail(sessionEmail || null);
        setSessionChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, email]);

  const continueAsSession = async () => {
    setLoading(true);
    try {
      await resolvePostAuthRouting(navigate, POS_POST_LOGIN_REDIRECT, {
        mfaChallengeBasePath: POS_AUTH_PATHS.loginMfa,
      });
    } finally {
      setLoading(false);
    }
  };

  const useDifferentAccount = async () => {
    setSwitchingAccount(true);
    try {
      await supabase.auth.signOut({ scope: "local" });
      cleanupAuthState();
      setExistingSessionEmail(null);
      setPassword("");
    } finally {
      setSwitchingAccount(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || existingSessionEmail) return;
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        const code = error.code ?? "";
        const msg = (error.message ?? "").toLowerCase();

        if (
          code === "email_not_confirmed" ||
          msg.includes("email not confirmed") ||
          msg.includes("not confirmed")
        ) {
          toast({ title: messageForAuthError(error, t), variant: "destructive" });
          navigate(
            `${POS_AUTH_PATHS.register}?email=${encodeURIComponent(trimmedEmail)}`,
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
              title: t("posAuth.errors.noAccountTitle", "No account for this email"),
              description: t(
                "posAuth.errors.noAccountDesc",
                "This email is not registered yet. You are being taken to sign up.",
              ),
            });
            navigate(
              `${POS_AUTH_PATHS.register}?email=${encodeURIComponent(trimmedEmail)}`,
              { replace: true },
            );
            return;
          }
        }

        toast({ title: messageForAuthError(error, t), variant: "destructive" });
        return;
      }

      clearPosLoginEmail();
      await resolvePostAuthRouting(navigate, POS_POST_LOGIN_REDIRECT, {
        mfaChallengeBasePath: POS_AUTH_PATHS.loginMfa,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!email) return null;

  if (!sessionChecked) {
    return (
      <div className="flex w-full flex-col items-center gap-5" aria-busy>
        <PosBrandMark />
        <p className="text-sm text-muted-foreground">
          {t("posAuth.login.checkingSession", "Checking signed-in session…")}
        </p>
      </div>
    );
  }

  if (existingSessionEmail) {
    const busy = loading || switchingAccount;
    return (
      <div className="flex w-full flex-col items-center gap-5">
        <PosBrandMark />
        <div className="w-full space-y-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-center">
          <p className="text-sm font-medium text-foreground">
            {t("posAuth.session.mismatchTitle", "Already signed in")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t(
              "posAuth.session.mismatchDesc",
              "You are signed in as {{sessionEmail}}, but you entered {{email}}. Continue with the signed-in account or switch accounts.",
              { sessionEmail: existingSessionEmail, email },
            )}
          </p>
        </div>
        <Button
          type="button"
          disabled={busy}
          onClick={() => void continueAsSession()}
          className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("posAuth.session.continueAs", "Continue as {{email}}", {
            email: existingSessionEmail,
          })}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void useDifferentAccount()}
          className="h-12 w-full rounded-lg text-base"
        >
          {switchingAccount
            ? t("posAuth.session.switching", "Switching…")
            : t("posAuth.session.useDifferentAccount", "Use a different account")}
        </Button>
        <Link to={POS_AUTH_PATHS.login} className="text-sm text-muted-foreground hover:underline">
          {t("posAuth.login.backToEmail", "Use a different email")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col items-center gap-5">
      <PosBrandMark />
      <p className="max-w-full truncate text-center text-sm text-muted-foreground" title={email}>
        {email}
      </p>

      <div className="relative w-full">
        <Input
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("posAuth.login.passwordPlaceholder", "Password")}
          required
          disabled={loading}
          className="h-12 w-full rounded-lg border-border bg-background pr-11 text-base"
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={
            showPassword
              ? t("posAuth.login.hidePassword", "Hide password")
              : t("posAuth.login.showPassword", "Show password")
          }
        >
          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>

      <Button
        type="submit"
        disabled={loading || !password}
        className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90"
      >
        {loading
          ? t("posAuth.login.submitting", "Signing in…")
          : t("posAuth.login.submit", "Sign in")}
      </Button>

      <Link
        to={POS_AUTH_PATHS.forgotPassword}
        className="text-sm font-medium text-primary hover:underline"
      >
        {t("posAuth.login.forgotPassword", "Forgot password?")}
      </Link>

      <Link to={POS_AUTH_PATHS.login} className="text-sm text-muted-foreground hover:underline">
        {t("posAuth.login.backToEmail", "Use a different email")}
      </Link>
    </form>
  );
}
