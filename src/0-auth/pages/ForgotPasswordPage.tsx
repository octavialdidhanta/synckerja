import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { supabase } from "@/shared/lib/supabaseClient";
import { AuthSplitLayout } from "@/0-auth/components/AuthSplitLayout";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const brandBlue = "hsl(var(--brand-blue))";
  const brandRed = "hsl(var(--brand-red))";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) {
        console.warn("[forgot-password] resetPasswordForEmail:", error.message);
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout>
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col">
          <div className="mb-5 flex w-full justify-center">
            <img src="/favicon.png" alt="" className="h-14 w-auto" width={56} height={56} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("auth.forgotPassword.title")}
            </h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">{t("auth.forgotPassword.subtitle")}</p>
          </div>
        </div>

        {sent && (
          <Alert className="border-slate-200 bg-slate-50 text-slate-800">
            <AlertDescription>{t("auth.forgotPassword.genericSent")}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="forgot-email" className="text-slate-800">
              {t("auth.forgotPassword.email")}
            </Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || sent}
              className="h-12 border-slate-200 bg-white focus-visible:ring-[hsl(var(--brand-blue))]"
            />
          </div>

          <Button
            type="submit"
            className="h-12 w-full text-base font-semibold text-white shadow-md transition-colors hover:opacity-[0.92]"
            style={{ backgroundColor: brandRed }}
            disabled={loading || sent}
          >
            {loading ? t("auth.forgotPassword.sending") : t("auth.forgotPassword.submit")}
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
