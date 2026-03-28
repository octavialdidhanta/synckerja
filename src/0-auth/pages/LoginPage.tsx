import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { AuthError } from "@supabase/supabase-js";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "@/shared/hooks/use-toast";
import { AuthSplitLayout } from "@/0-auth/components/AuthSplitLayout";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

const GAP_ABOVE_KEYBOARD = 12;

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

async function routeAfterLogin(navigate: (path: string, opts?: { replace?: boolean }) => void) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: memberships, error: uoErr } = await supabase
    .from("user_organizations")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1);

  if (uoErr || !memberships?.length) {
    const { data: hasVerifiedToken, error: verifyErr } = await supabase.rpc(
      "registration_has_verified_email",
      { p_user_id: user.id, p_email: (user.email ?? "").trim() },
    );
    if (verifyErr || !hasVerifiedToken) {
      navigate("/register", { replace: true });
      return;
    }
    navigate("/create-organization", { replace: true });
    return;
  }

  const orgId = memberships[0].organization_id;
  const { data: subs, error: subErr } = await supabase
    .from("organization_subscriptions")
    .select("id")
    .eq("organization_id", orgId)
    .limit(1);

  if (subErr || !subs?.length) {
    navigate("/create-plan", { replace: true });
    return;
  }

  if (!localStorage.getItem("hasSeenEmployeeWelcome")) {
    navigate("/employee-welcome", { replace: true });
    return;
  }

  navigate("/", { replace: true });
}

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const inputFocusedRef = useRef(false);

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

  const scrollPanel = useCallback(() => {
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    const panel = panelRef.current;
    const btn = submitRef.current;
    if (!panel || !btn || !inputFocusedRef.current) return;
    const vv = window.visualViewport;
    const visibleHeight = vv ? vv.height : window.innerHeight;
    const btnRect = btn.getBoundingClientRect();
    const targetBottom = visibleHeight - GAP_ABOVE_KEYBOARD;
    const scrollDelta = btnRect.bottom - targetBottom;
    if (scrollDelta > 0) panel.scrollTop = Math.max(0, panel.scrollTop + scrollDelta);
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => inputFocusedRef.current && scrollPanel();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [scrollPanel]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const showPromise = Keyboard.addListener("keyboardWillShow", (info) => {
      setKeyboardHeight(info.keyboardHeight ?? 0);
      if (inputFocusedRef.current) {
        setTimeout(scrollPanel, 100);
        setTimeout(scrollPanel, 400);
      }
    });
    const hidePromise = Keyboard.addListener("keyboardWillHide", () => setKeyboardHeight(0));
    return () => {
      showPromise.then((h) => h.remove());
      hidePromise.then((h) => h.remove());
    };
  }, [scrollPanel]);

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
            trimmedEmail
              ? `/register?email=${encodeURIComponent(trimmedEmail)}`
              : "/register",
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
      await routeAfterLogin(navigate);
    } finally {
      setLoading(false);
    }
  };

  const brandBlue = "hsl(var(--brand-blue))";
  const brandRed = "hsl(var(--brand-red))";

  return (
    <AuthSplitLayout scrollPanelRef={panelRef} keyboardPaddingBottom={keyboardHeight}>
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col">
          <div className="mb-5 flex w-full justify-center">
            <img
              src="/favicon.png"
              alt=""
              className="h-14 w-auto"
              width={56}
              height={56}
            />
          </div>
          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("auth.login.welcomeTitle")}
            </h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">{t("auth.login.welcomeSubtitle")}</p>
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
              onFocus={() => {
                inputFocusedRef.current = true;
                setTimeout(scrollPanel, 150);
              }}
              onBlur={() => {
                inputFocusedRef.current = false;
              }}
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
                onFocus={() => {
                  inputFocusedRef.current = true;
                  setTimeout(scrollPanel, 150);
                }}
                onBlur={() => {
                  inputFocusedRef.current = false;
                }}
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
            ref={submitRef}
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
          <Link
            to="/register"
            className="font-semibold hover:underline"
            style={{ color: brandBlue }}
          >
            {t("auth.login.register")}
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
