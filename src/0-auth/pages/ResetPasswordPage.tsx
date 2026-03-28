import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "@/shared/hooks/use-toast";
import { AuthSplitLayout } from "@/0-auth/components/AuthSplitLayout";

function validatePassword(pwd: string, tr: (key: string) => string): string[] {
  const errors: string[] = [];
  if (pwd.length < 8) errors.push(tr("auth.register.passwordMin"));
  if (!/[0-9]/.test(pwd)) errors.push(tr("auth.register.passwordNumber"));
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) errors.push(tr("auth.register.passwordSpecial"));
  if (!/[A-Z]/.test(pwd)) errors.push(tr("auth.register.passwordUpper"));
  if (!/[a-z]/.test(pwd)) errors.push(tr("auth.register.passwordLower"));
  return errors;
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [waitExpired, setWaitExpired] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const brandBlue = "hsl(var(--brand-blue))";
  const brandRed = "hsl(var(--brand-red))";

  useEffect(() => {
    let cancelled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) setHasSession(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) setHasSession(true);
    });

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setWaitExpired(true);
    }, 4000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwdErrors = validatePassword(password, t);
    if (pwdErrors.length > 0) {
      toast({
        title: t("auth.register.passwordWeakTitle"),
        description: pwdErrors.join(", "),
        variant: "destructive",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        title: t("auth.register.passwordMismatchTitle"),
        description: t("auth.register.passwordMismatchDesc"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        console.warn("[reset-password] updateUser:", error.message);
        toast({
          title: t("auth.resetPassword.errors.generic"),
          variant: "destructive",
        });
        return;
      }
      await supabase.auth.signOut();
      navigate("/login?reason=password_reset", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  if (!hasSession && !waitExpired) {
    return (
      <AuthSplitLayout>
        <div className="flex w-full max-w-md flex-col items-center justify-center gap-4 py-12 text-center text-slate-600">
          <p className="text-sm">{t("auth.resetPassword.checkingLink")}</p>
        </div>
      </AuthSplitLayout>
    );
  }

  if (!hasSession && waitExpired) {
    return (
      <AuthSplitLayout>
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col">
            <div className="mb-5 flex w-full justify-center">
              <img src="/favicon.png" alt="" className="h-14 w-auto" width={56} height={56} />
            </div>
            <p className="text-center text-sm text-slate-600 sm:text-base">
              {t("auth.resetPassword.invalidSession")}
            </p>
          </div>
          <p className="text-center text-sm text-slate-600">
            <Link to="/forgot-password" className="font-semibold hover:underline" style={{ color: brandBlue }}>
              {t("auth.resetPassword.requestNewLink")}
            </Link>
            {" · "}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: brandBlue }}>
              {t("auth.verifyEmail.backLogin")}
            </Link>
          </p>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout>
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col">
          <div className="mb-5 flex w-full justify-center">
            <img src="/favicon.png" alt="" className="h-14 w-auto" width={56} height={56} />
          </div>
          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("auth.resetPassword.title")}
            </h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">{t("auth.resetPassword.subtitle")}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="reset-password" className="text-slate-800">
              {t("auth.resetPassword.newPassword")}
            </Label>
            <div className="relative">
              <Input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-12 border-slate-200 bg-white pr-11 focus-visible:ring-[hsl(var(--brand-blue))]"
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("auth.resetPassword.hidePassword") : t("auth.resetPassword.showPassword")}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-confirm" className="text-slate-800">
              {t("auth.resetPassword.confirmPassword")}
            </Label>
            <div className="relative">
              <Input
                id="reset-confirm"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="h-12 border-slate-200 bg-white pr-11 focus-visible:ring-[hsl(var(--brand-blue))]"
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? t("auth.resetPassword.hidePassword") : t("auth.resetPassword.showPassword")}
              >
                {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="h-12 w-full text-base font-semibold text-white shadow-md transition-colors hover:opacity-[0.92]"
            style={{ backgroundColor: brandRed }}
            disabled={loading}
          >
            {loading ? t("auth.resetPassword.saving") : t("auth.resetPassword.submit")}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-600">
          <Link to="/login" className="font-semibold hover:underline" style={{ color: brandBlue }}>
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
