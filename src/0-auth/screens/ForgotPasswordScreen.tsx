import { useState, type ReactNode, type RefObject } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { supabase } from "@/shared/lib/supabaseClient";
import { SynckerjaBrandLogo } from "@/shared/brand/brandLogo";
import {
  authFormBottomSpacerClass,
  authFormFieldGap,
  authFormFooterTextClass,
  authFormFormClass,
  authFormHeaderLogoWrapper,
  authFormInputClass,
  authFormLabelClass,
  authFormRootClass,
  authFormSubmitClass,
  authFormSubtitleClass,
  authFormTitleClass,
} from "@/0-auth/styles/authFormStyles";

const defaultBrandMark = <SynckerjaBrandLogo className="h-10 w-auto sm:h-12" width={48} height={48} />;

export type ForgotPasswordScreenProps = {
  brandMark?: ReactNode;
  submitButtonRef?: RefObject<HTMLButtonElement | null>;
  onFieldFocus?: () => void;
  onFieldBlur?: () => void;
  /** Mobile auth routes omit the instructional subtitle under the title. */
  hideSubtitle?: boolean;
};

export function ForgotPasswordScreen({
  brandMark = defaultBrandMark,
  submitButtonRef,
  onFieldFocus,
  onFieldBlur,
  hideSubtitle = false,
}: ForgotPasswordScreenProps) {
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
    <div className={authFormRootClass}>
      <header className="flex flex-col items-center text-center">
        <div className={authFormHeaderLogoWrapper}>{brandMark}</div>
        <h1 className={authFormTitleClass}>{t("auth.forgotPassword.title")}</h1>
        {!hideSubtitle && (
          <p className={authFormSubtitleClass}>{t("auth.forgotPassword.subtitle")}</p>
        )}
      </header>

      {sent && (
        <Alert className="border-slate-200 bg-slate-50 text-slate-800">
          <AlertDescription className="text-xs sm:text-sm">
            {t("auth.forgotPassword.genericSent")}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} className={authFormFormClass}>
        <div className={authFormFieldGap}>
          <Label htmlFor="forgot-email" className={authFormLabelClass}>
            {t("auth.forgotPassword.email")}
          </Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
            required
            disabled={loading || sent}
            className={authFormInputClass}
          />
        </div>

        <Button
          ref={submitButtonRef}
          type="submit"
          className={authFormSubmitClass}
          style={{ backgroundColor: brandRed }}
          disabled={loading || sent}
        >
          {loading ? t("auth.forgotPassword.sending") : t("auth.forgotPassword.submit")}
        </Button>

        <p className={authFormFooterTextClass}>
          <Link to="/login" className="font-semibold hover:underline" style={{ color: brandBlue }}>
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </p>

        <div className={authFormBottomSpacerClass} aria-hidden />
      </form>
    </div>
  );
}
