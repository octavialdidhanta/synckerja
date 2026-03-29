import { useState, useEffect, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Link, useSearchParams } from "react-router-dom";
import { useRegistration } from "@/0-register/hooks/useRegistration";
import { Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { showErrorToast } from "@/0-register/utils/error-toast";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";

export type RegistrationFormKeyboardProps = {
  submitButtonRef?: RefObject<HTMLButtonElement | null>;
  onKeyboardInputFocus?: () => void;
  onKeyboardInputBlur?: () => void;
};

export function RegistrationForm(props: RegistrationFormKeyboardProps) {
  const { submitButtonRef, onKeyboardInputFocus, onKeyboardInputBlur } = props;
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [emailStatus, setEmailStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const { register, loading, error, emailSuggestion, acceptEmailSuggestion } = useRegistration();

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
    const newPassword = e.target.value;
    setPassword(newPassword);
    setPasswordErrors(validatePassword(newPassword));
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

  const inputClass =
    "h-12 border-slate-200 bg-white focus-visible:ring-[hsl(var(--brand-blue))]";

  return (
    <div className="space-y-8">
      <div className="flex flex-col">
        <div className="mb-5 flex w-full justify-center">
          <img src="/favicon.png" alt="" className="h-14 w-auto" width={56} height={56} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t("auth.register.title")}
          </h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">{t("auth.register.subtitle")}</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            {emailSuggestion && (
              <button
                type="button"
                className="mt-2 block font-semibold underline hover:opacity-90"
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
          className={
            emailStatus.type === "error"
              ? "border-red-200 bg-red-50"
              : "border-brand-blue/30 bg-brand-blue/10"
          }
        >
          <AlertDescription
            className={emailStatus.type === "error" ? "text-red-700" : "text-[hsl(var(--brand-blue))]"}
          >
            {emailStatus.message}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-slate-800">
            {t("auth.register.fullName")}
          </Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onFocus={onKeyboardInputFocus}
            onBlur={onKeyboardInputBlur}
            required
            disabled={loading}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-800">
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
            disabled={loading}
            className={inputClass}
          />
        </div>
        <div className="auth-input-scroll-margin space-y-2">
          <Label htmlFor="password" className="text-slate-800">
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
              disabled={loading}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:pointer-events-none"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
              aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {password && (
            <div className="text-xs space-y-1 mt-2">
              <p className="font-medium">{t("auth.register.passwordRulesTitle")}</p>
              <ul className="space-y-1">
                {[
                  { ok: password.length >= 8, label: t("auth.register.ruleLen") },
                  { ok: /[0-9]/.test(password), label: t("auth.register.ruleNum") },
                  { ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password), label: t("auth.register.ruleSpec") },
                  { ok: /[A-Z]/.test(password), label: t("auth.register.ruleUp") },
                  { ok: /[a-z]/.test(password), label: t("auth.register.ruleLow") },
                ].map((row) => (
                  <li
                    key={row.label}
                    className={`flex items-center gap-1 ${row.ok ? "text-[hsl(var(--brand-blue))]" : "text-[hsl(var(--brand-red))]"}`}
                  >
                    {row.ok ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {row.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="auth-input-scroll-margin space-y-2">
          <Label htmlFor="confirmPassword" className="text-slate-800">
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
              disabled={loading}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:pointer-events-none"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={loading}
              aria-label={
                showConfirmPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")
              }
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
          {loading ? t("auth.register.submitting") : t("auth.register.submit")}
        </Button>
        <p className="text-center text-xs text-slate-600">
          {t("auth.register.termsPrefix")}{" "}
          <a href="#" className="font-semibold hover:underline" style={{ color: brandBlue }}>
            {t("auth.register.terms")}
          </a>{" "}
          {t("auth.register.termsAnd")}{" "}
          <a href="#" className="font-semibold hover:underline" style={{ color: brandBlue }}>
            {t("auth.register.privacy")}
          </a>
        </p>
      </form>

      <p className="text-center text-sm text-slate-600">
        {t("auth.register.hasAccount")}{" "}
        <Link to="/login" className="font-semibold hover:underline" style={{ color: brandBlue }}>
          {t("auth.register.login")}
        </Link>
      </p>
    </div>
  );
}
