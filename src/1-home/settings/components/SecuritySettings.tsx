import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, Eye, EyeOff, Key, Shield } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";

const NEW_PASSWORD_MIN = 8;

export function SecuritySettings() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    current?: string;
    new?: string;
    confirm?: string;
    general?: string;
  }>({});

  const validatePasswords = () => {
    const newErrors: typeof errors = {};

    if (!currentPassword) {
      newErrors.current = t("settings.security.validation.currentRequired");
    }

    if (!newPassword) {
      newErrors.new = t("settings.security.validation.newRequired");
    } else if (newPassword.length < NEW_PASSWORD_MIN) {
      newErrors.new = t("settings.security.validation.newTooShort");
    }

    if (!confirmPassword) {
      newErrors.confirm = t("settings.security.validation.confirmRequired");
    } else if (newPassword !== confirmPassword) {
      newErrors.confirm = t("settings.security.validation.confirmMismatch");
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      newErrors.new = t("settings.security.validation.sameAsCurrent");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswords()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user?.email) {
        setErrors({ general: t("settings.security.error.unableVerify") });
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setErrors({ current: t("settings.security.validation.currentIncorrect") });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setErrors({ general: updateError.message || t("settings.security.error.updateFailed") });
        return;
      }

      toast.success(t("settings.security.toast.updateSuccess"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("settings.security.error.updateFailed");
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle>{t("settings.security.changePassword.title")}</CardTitle>
          </div>
          <CardDescription>{t("settings.security.changePassword.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.general ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.general}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t("settings.security.form.currentPasswordLabel")}</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={errors.current ? "border-destructive pr-10" : "pr-10"}
                  placeholder={t("settings.security.form.currentPasswordPlaceholder")}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.current ? <p className="text-sm text-destructive">{errors.current}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">{t("settings.security.form.newPasswordLabel")}</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={errors.new ? "border-destructive pr-10" : "pr-10"}
                  placeholder={t("settings.security.form.newPasswordPlaceholder")}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.new ? <p className="text-sm text-destructive">{errors.new}</p> : null}
              <PasswordStrengthIndicator password={newPassword} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("settings.security.form.confirmPasswordLabel")}</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={errors.confirm ? "border-destructive pr-10" : "pr-10"}
                  placeholder={t("settings.security.form.confirmPasswordPlaceholder")}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.confirm ? <p className="text-sm text-destructive">{errors.confirm}</p> : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button type="submit" disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    {t("settings.security.actions.updating")}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {t("settings.security.actions.update")}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={() => {
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setErrors({});
                }}
              >
                {t("settings.security.actions.cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>{t("settings.security.tips.title")}</CardTitle>
          </div>
          <CardDescription>{t("settings.security.tips.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {(
              [
                "settings.security.tips.strongPassword",
                "settings.security.tips.complexity",
                "settings.security.tips.noPersonalInfo",
                "settings.security.tips.changeRegularly",
              ] as const
            ).map((key) => (
              <li key={key} className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function PasswordStrengthIndicator({ password }: { password: string }) {
  const { t } = useTranslation();

  const getStrength = () => {
    let score = 0;
    if (password.length >= NEW_PASSWORD_MIN) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getStrength();
  const label =
    strength < 2
      ? t("settings.security.passwordStrength.weak")
      : strength < 4
        ? t("settings.security.passwordStrength.fair")
        : strength < 5
          ? t("settings.security.passwordStrength.good")
          : t("settings.security.passwordStrength.strong");

  const barClass =
    strength < 2
      ? "bg-destructive"
      : strength < 4
        ? "bg-amber-500"
        : strength < 5
          ? "bg-primary"
          : "bg-emerald-600";

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t("settings.security.passwordStrength.label")}</span>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-2 rounded-full transition-all ${barClass}`}
          style={{ width: `${(strength / 6) * 100}%` }}
        />
      </div>
    </div>
  );
}
