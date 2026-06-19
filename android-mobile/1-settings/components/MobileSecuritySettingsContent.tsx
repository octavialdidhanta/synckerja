import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle, Eye, EyeOff, Key } from "lucide-react";
import { Card } from "@/mobile-app/components/ui/card";
import { Button } from "@/mobile-app/components/ui/button";
import { Input } from "@/mobile-app/components/ui/input";
import { Label } from "@/mobile-app/components/ui/label";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { useChangePasswordSettings } from "@/1-home/settings/hooks/useChangePasswordSettings";
import { PasswordStrengthIndicator } from "@/1-home/settings/components/PasswordStrengthIndicator";
import { SecurityTipsSection } from "@/1-home/settings/components/SecurityTipsSection";
import { TwoFactorSecuritySection } from "@/1-home/settings/components/TwoFactorSecuritySection";
import { useMfaFactors } from "@/shared/auth/mfa";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";
import { MobileSecuritySettingsSkeleton } from "@/mobile/1-settings/skeletons/MobileSecuritySettingsSkeleton";

export default function MobileSecuritySettingsContent() {
  const { t } = useTranslation();
  const cp = useChangePasswordSettings();
  const { loading: mfaLoading } = useMfaFactors();
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  if (mfaLoading) {
    return <MobileSecuritySettingsSkeleton variant="content" />;
  }

  return (
    <div className="space-y-1">
      <Card className="border border-border bg-gradient-card">
        <div className="border-b border-border p-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("settings.security.changePassword.title")}
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("settings.security.changePassword.description")}
          </p>
        </div>
        <div className="space-y-3 p-3">
          {cp.errors.general ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{cp.errors.general}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={(e) => void cp.handleSubmit(e)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mobile-current-password" className="text-xs">
                {t("settings.security.form.currentPasswordLabel")}
              </Label>
              <div className="relative">
                <Input
                  id="mobile-current-password"
                  type={cp.showCurrentPassword ? "text" : "password"}
                  value={cp.currentPassword}
                  onChange={(e) => cp.setCurrentPassword(e.target.value)}
                  onFocus={kb.onInputFocus}
                  onBlur={kb.onInputBlur}
                  className={cp.errors.current ? "border-destructive pr-10" : "pr-10"}
                  placeholder={t("settings.security.form.currentPasswordPlaceholder")}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => cp.setShowCurrentPassword(!cp.showCurrentPassword)}
                >
                  {cp.showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {cp.errors.current ? <p className="text-xs text-destructive">{cp.errors.current}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mobile-new-password" className="text-xs">
                {t("settings.security.form.newPasswordLabel")}
              </Label>
              <div className="relative">
                <Input
                  id="mobile-new-password"
                  type={cp.showNewPassword ? "text" : "password"}
                  value={cp.newPassword}
                  onChange={(e) => cp.setNewPassword(e.target.value)}
                  onFocus={kb.onInputFocus}
                  onBlur={kb.onInputBlur}
                  className={cp.errors.new ? "border-destructive pr-10" : "pr-10"}
                  placeholder={t("settings.security.form.newPasswordPlaceholder")}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => cp.setShowNewPassword(!cp.showNewPassword)}
                >
                  {cp.showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {cp.errors.new ? <p className="text-xs text-destructive">{cp.errors.new}</p> : null}
              <PasswordStrengthIndicator password={cp.newPassword} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mobile-confirm-password" className="text-xs">
                {t("settings.security.form.confirmPasswordLabel")}
              </Label>
              <div className="relative">
                <Input
                  id="mobile-confirm-password"
                  type={cp.showConfirmPassword ? "text" : "password"}
                  value={cp.confirmPassword}
                  onChange={(e) => cp.setConfirmPassword(e.target.value)}
                  onFocus={kb.onInputFocus}
                  onBlur={kb.onInputBlur}
                  className={cp.errors.confirm ? "border-destructive pr-10" : "pr-10"}
                  placeholder={t("settings.security.form.confirmPasswordPlaceholder")}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => cp.setShowConfirmPassword(!cp.showConfirmPassword)}
                >
                  {cp.showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {cp.errors.confirm ? <p className="text-xs text-destructive">{cp.errors.confirm}</p> : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button ref={submitRef} type="submit" disabled={cp.isLoading} size="sm" className="gap-2">
                {cp.isLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    {t("settings.security.actions.updating")}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {t("settings.security.actions.update")}
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={cp.isLoading} onClick={cp.resetForm}>
                {t("settings.security.actions.cancel")}
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <TwoFactorSecuritySection />

      <Card className="border border-border bg-gradient-card">
        <div className="p-3">
          <SecurityTipsSection variant="plain" />
        </div>
      </Card>
    </div>
  );
}
