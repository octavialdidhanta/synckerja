import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle, Eye, EyeOff, Key } from "lucide-react";
import { TwoFactorSecuritySection } from "@/1-home/settings/components/TwoFactorSecuritySection";
import { PasswordStrengthIndicator } from "@/1-home/settings/components/PasswordStrengthIndicator";
import { SecurityTipsSection } from "@/1-home/settings/components/SecurityTipsSection";
import { useChangePasswordSettings } from "@/1-home/settings/hooks/useChangePasswordSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";

export function SecuritySettings() {
  const { t } = useTranslation();
  const cp = useChangePasswordSettings();

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
          {cp.errors.general ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{cp.errors.general}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={(e) => void cp.handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t("settings.security.form.currentPasswordLabel")}</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={cp.showCurrentPassword ? "text" : "password"}
                  value={cp.currentPassword}
                  onChange={(e) => cp.setCurrentPassword(e.target.value)}
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
              {cp.errors.current ? <p className="text-sm text-destructive">{cp.errors.current}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">{t("settings.security.form.newPasswordLabel")}</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={cp.showNewPassword ? "text" : "password"}
                  value={cp.newPassword}
                  onChange={(e) => cp.setNewPassword(e.target.value)}
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
              {cp.errors.new ? <p className="text-sm text-destructive">{cp.errors.new}</p> : null}
              <PasswordStrengthIndicator password={cp.newPassword} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("settings.security.form.confirmPasswordLabel")}</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={cp.showConfirmPassword ? "text" : "password"}
                  value={cp.confirmPassword}
                  onChange={(e) => cp.setConfirmPassword(e.target.value)}
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
              {cp.errors.confirm ? <p className="text-sm text-destructive">{cp.errors.confirm}</p> : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button type="submit" disabled={cp.isLoading} className="gap-2">
                {cp.isLoading ? (
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
              <Button type="button" variant="outline" disabled={cp.isLoading} onClick={cp.resetForm}>
                {t("settings.security.actions.cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <TwoFactorSecuritySection />

      <SecurityTipsSection />
    </div>
  );
}
