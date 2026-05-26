import { useState, useEffect, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useRegistration } from "@/0-register/hooks/useRegistration";
import { Eye, EyeOff } from "lucide-react";
import { showErrorToast } from "@/0-register/utils/error-toast";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { SynckerjaBrandLogo } from "@/shared/brand/brandLogo";
import { startGoogleSignIn } from "@/0-auth/lib/googleSignIn";
import { AuthDivider, GoogleSignInButton } from "@/0-auth/components/GoogleSignInButton";
import { toast } from "@/shared/hooks/use-toast";
import { PasswordRequirementGrid } from "@/0-register/components/PasswordRequirementGrid";
import {
  authFormBottomSpacerClass,
  authFormEyeIconClass,
  authFormFieldGap,
  authFormFooterTextClass,
  authFormFormClass,
  authFormGoogleSectionClass,
  authFormHeaderLogoWrapper,
  authFormInputClass,
  authFormInputWithToggleClass,
  authFormLabelClass,
  authFormPasswordToggleClass,
  authFormRootClass,
  authFormSubmitClass,
  authFormSubtitleClass,
  authFormTitleClass,
} from "@/0-auth/styles/authFormStyles";

export type RegistrationFormKeyboardProps = {
  submitButtonRef?: RefObject<HTMLButtonElement | null>;
  onKeyboardInputFocus?: () => void;
  onKeyboardInputBlur?: () => void;
  /** When set, replaces the default favicon header mark. */
  brandMark?: ReactNode;
};

const defaultRegistrationBrand = <SynckerjaBrandLogo className="h-10 w-auto sm:h-12" width={48} height={48} />;

export function RegistrationForm(props: RegistrationFormKeyboardProps) {
  const { submitButtonRef, onKeyboardInputFocus, onKeyboardInputBlur, brandMark = defaultRegistrationBrand } = props;
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const navigate = useNavigate();
  const { register, loading, error, emailSuggestion, acceptEmailSuggestion } = useRegistration();
  const [googleLoading, setGoogleLoading] = useState(false);

  const brandBlue = "hsl(var(--brand-blue))";
  const brandRed = "hsl(var(--brand-red))";

  const validatePassword = (pwd: string) => {
    const errors: string[] = [];
    if (pwd.length < 8) errors.push(t("auth.register.passwordMin"));
    if (!/[0-9]/.test(pwd)) errors.push(t("auth.register.passwordNumber"));
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) errors.push(t("auth.register.passwordSpecial"));
    if (!/[A-Z]/.test(pwd)) errors.push(t("auth.register.passwordUpper"));
    if (!/[a-z]/.test(pwd)) errors.push(t("auth.register.passwordLower"));
    return errors;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) setEmail(emailParam);
    const emailError = sessionStorage.getItem("emailError");
    if (emailError) {
      setEmailStatus({ type: "error", message: `${t("auth.register.emailSendFail")} ${emailError}` });
      sessionStorage.removeItem("emailError");
    }
    const fromRegistration = sessionStorage.getItem("fromRegistration");
    if (fromRegistration) {
      setEmailStatus({ type: "success", message: t("auth.register.emailSentSuccess") });
      sessionStorage.removeItem("fromRegistration");
    }
  }, [searchParams, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailStatus({ type: null, message: "" });
    const passwordValidationErrors = validatePassword(password);
    if (passwordValidationErrors.length > 0) {
      showErrorToast({
        title: t("auth.register.passwordWeakTitle"),
        message: passwordValidationErrors.join(", "),
      });
      return;
    }
    if (password !== confirmPassword) {
      showErrorToast({
        title: t("auth.register.passwordMismatchTitle"),
        message: t("auth.register.passwordMismatchDesc"),
      });
      return;
    }
    try {
      await register(fullName, email, password, confirmPassword);
    } catch (err) {
      console.error(err);
    }
  };

  const onGoogleRegister = async () => {
    setGoogleLoading(true);
    try {
      const { error: oauthErr, completedInApp } = await startGoogleSignIn({
        mode: "register",
        navigate,
      });
      if (oauthErr === "access_denied") {
        toast({ title: t("auth.google.errors.accessDenied"), variant: "destructive" });
        setGoogleLoading(false);
        return;
      }
      if (oauthErr === "android_oauth_misconfigured") {
        toast({
          title: t("auth.google.errors.androidMisconfiguredTitle"),
          description: t("auth.google.errors.androidMisconfiguredDescription"),
          variant: "destructive",
        });
        setGoogleLoading(false);
        return;
      }
      if (oauthErr === "google_account_reauth_failed") {
        toast({
          title: t("auth.google.errors.reauthFailedTitle"),
          description: t("auth.google.errors.reauthFailedDescription"),
          variant: "destructive",
        });
        setGoogleLoading(false);
        return;
      }
      if (oauthErr === "not_configured") {
        toast({
          title: t("auth.google.errors.generic"),
          description: t("auth.google.errors.notConfigured"),
          variant: "destructive",
        });
        setGoogleLoading(false);
        return;
      }
      if (oauthErr) {
        toast({
          title: t("auth.google.errors.generic"),
          description: oauthErr,
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
  const showPasswordHints = password.length > 0;

  return (
    <div className={authFormRootClass}>
      <header className="flex flex-col items-center text-center">
        <div className={authFormHeaderLogoWrapper}>{brandMark}</div>
        <h1 className={authFormTitleClass}>{t("auth.register.title")}</h1>
        <p className={authFormSubtitleClass}>{t("auth.register.subtitle")}</p>
      </header>

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-sm">
            {error}
            {emailSuggestion && (
              <button
                type="button"
                className="mt-1 block font-semibold underline hover:opacity-90"
                style={{ color: brandBlue }}
                onClick={() => setEmail(acceptEmailSuggestion(emailSuggestion))}
              >
                {t("auth.register.useSuggestion")}: {emailSuggestion}
              </button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {emailStatus.type && (
        <Alert
          className={`py-2 ${
            emailStatus.type === "error"
              ? "border-red-200 bg-red-50"
              : "border-brand-blue/30 bg-brand-blue/10"
          }`}
        >
          <AlertDescription
            className={`text-sm ${emailStatus.type === "error" ? "text-red-700" : "text-[hsl(var(--brand-blue))]"}`}
          >
            {emailStatus.message}
          </AlertDescription>
        </Alert>
      )}

      <section className={authFormGoogleSectionClass} aria-label={t("auth.google.continueRegister")}>
        <GoogleSignInButton
          mode="register"
          loading={googleLoading}
          disabled={authBusy}
          onClick={() => void onGoogleRegister()}
        />
        <AuthDivider />
      </section>

      <form onSubmit={handleSubmit} className={authFormFormClass}>
        <div className={authFormFieldGap}>
          <Label htmlFor="fullName" className={authFormLabelClass}>
            {t("auth.register.fullName")}
          </Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onFocus={onKeyboardInputFocus}
            onBlur={onKeyboardInputBlur}
            required
            disabled={authBusy}
            className={authFormInputClass}
            autoComplete="name"
          />
        </div>

        <div className={authFormFieldGap}>
          <Label htmlFor="email" className={authFormLabelClass}>
            {t("auth.register.email")}
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={onKeyboardInputFocus}
            onBlur={onKeyboardInputBlur}
            required
            disabled={authBusy}
            className={authFormInputClass}
            autoComplete="email"
          />
        </div>

        <div className={`auth-input-scroll-margin ${authFormFieldGap}`}>
          <Label htmlFor="password" className={authFormLabelClass}>
            {t("auth.register.password")}
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={handlePasswordChange}
              onFocus={onKeyboardInputFocus}
              onBlur={onKeyboardInputBlur}
              required
              disabled={authBusy}
              className={authFormInputWithToggleClass}
              autoComplete="new-password"
            />
            <button
              type="button"
              tabIndex={-1}
              className={authFormPasswordToggleClass}
              onClick={() => setShowPassword(!showPassword)}
              disabled={authBusy}
              aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
            >
              {showPassword ? <EyeOff className={authFormEyeIconClass} /> : <Eye className={authFormEyeIconClass} />}
            </button>
          </div>
          {showPasswordHints ? <PasswordRequirementGrid password={password} /> : null}
        </div>

        <div className={`auth-input-scroll-margin ${authFormFieldGap}`}>
          <Label htmlFor="confirmPassword" className={authFormLabelClass}>
            {t("auth.register.confirmPassword")}
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onFocus={onKeyboardInputFocus}
              onBlur={onKeyboardInputBlur}
              required
              disabled={authBusy}
              className={authFormInputWithToggleClass}
              autoComplete="new-password"
            />
            <button
              type="button"
              tabIndex={-1}
              className={authFormPasswordToggleClass}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={authBusy}
              aria-label={
                showConfirmPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")
              }
            >
              {showConfirmPassword ? (
                <EyeOff className={authFormEyeIconClass} />
              ) : (
                <Eye className={authFormEyeIconClass} />
              )}
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
          {loading ? t("auth.register.submitting") : t("auth.register.submit")}
        </Button>

        <footer className="space-y-2 pt-0.5 text-center">
          <p className="text-[10px] leading-snug text-slate-500 sm:text-xs">
            {t("auth.register.termsPrefix")}{" "}
            <Link to="/policy/terms" className="font-semibold hover:underline" style={{ color: brandBlue }}>
              {t("auth.register.terms")}
            </Link>{" "}
            {t("auth.register.termsAnd")}{" "}
            <Link to="/policy/privacy" className="font-semibold hover:underline" style={{ color: brandBlue }}>
              {t("auth.register.privacy")}
            </Link>
            .
          </p>
          <p className={authFormFooterTextClass}>
            {t("auth.register.hasAccount")}{" "}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: brandBlue }}>
              {t("auth.register.login")}
            </Link>
          </p>
        </footer>
        <div className={authFormBottomSpacerClass} aria-hidden />
      </form>
    </div>
  );
}
