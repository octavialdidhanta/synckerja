import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { resolvePostAuthRouting } from "@/shared/auth/mfa/resolvePostAuthRouting";
import { completeGoogleSsoLogin } from "@/0-auth/lib/completeGoogleSsoLogin";
import { resolveSsoOAuthSession, waitForExistingAuthSession } from "@/0-auth/lib/resolveSsoOAuthSession";
import {
  clearStashedSsoOAuthMode,
  clearStashedSsoRedirectTo,
  readStashedSsoRedirectTo,
} from "@/0-auth/lib/googleSignIn";
import { isNativeCapacitorAuth } from "@/0-auth/lib/ssoRedirectUrl";
import { Button } from "@/shared/components/ui/button";

type Phase = "loading" | "error" | "done";

const CALLBACK_TIMEOUT_MS = 45_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Supabase Auth PKCE callback for Google sign-in / sign-up.
 * Drive OAuth uses `/auth/google/callback` — do not merge the two flows.
 */
export function SupabaseSsoCallbackScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const oauthError = searchParams.get("error");
    const oauthErrorDescription = searchParams.get("error_description");
    if (oauthError) {
      clearStashedSsoRedirectTo();
      clearStashedSsoOAuthMode();
      if (oauthError === "access_denied") {
        // User cancelled consent / account selection; return to login silently.
        navigate("/login", { replace: true });
        return;
      }
      setErrorMessage(oauthErrorDescription || oauthError);
      setPhase("error");
      return;
    }

    const code = searchParams.get("code");

    void (async () => {
      try {
        const finishWithUser = async (user: NonNullable<Awaited<ReturnType<typeof resolveSsoOAuthSession>>["user"]>) => {
          const complete = await completeGoogleSsoLogin(user);
          if (!complete.ok) {
            throw new Error(complete.error ?? t("auth.google.errors.generic"));
          }

          const redirectTo = readStashedSsoRedirectTo();
          clearStashedSsoRedirectTo();
          clearStashedSsoOAuthMode();

          setPhase("done");
          await resolvePostAuthRouting(navigate, redirectTo);
        };

        await withTimeout(
          (async () => {
            if (!code?.trim() && isNativeCapacitorAuth()) {
              const nativeSession = await waitForExistingAuthSession(10_000);
              if (nativeSession?.user) {
                await finishWithUser(nativeSession.user);
                return;
              }
            }

            const session = await resolveSsoOAuthSession(code);
            const user = session.user;
            if (!user) {
              throw new Error(t("auth.google.errors.noSession"));
            }

            await finishWithUser(user);
          })(),
          CALLBACK_TIMEOUT_MS,
          "callback_timeout",
        );
      } catch (err) {
        clearStashedSsoRedirectTo();
        clearStashedSsoOAuthMode();
        const raw = err instanceof Error ? err.message : "";
        const msg =
          raw === "missing_auth_code"
            ? t("auth.google.errors.noSession")
            : raw === "callback_timeout"
              ? t("auth.google.errors.generic")
              : raw || t("auth.google.errors.generic");
        setErrorMessage(msg);
        setPhase("error");
      }
    })();
  }, [navigate, searchParams, t]);

  if (phase === "error") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold text-slate-900">{t("auth.google.callbackErrorTitle")}</h1>
        <p className="max-w-md text-sm text-slate-600">{errorMessage}</p>
        <Button asChild variant="default" className="mt-2">
          <Link to="/login">{t("auth.google.backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center"
      aria-busy={phase === "loading"}
    >
      <Loader2 className="h-8 w-8 animate-spin text-slate-500" aria-hidden />
      <p className="text-sm font-medium text-slate-700">{t("auth.google.callbackLoading")}</p>
      <span className="sr-only">{t("auth.google.callbackLoading")}</span>
    </div>
  );
}
