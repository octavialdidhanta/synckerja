import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Shield, ShieldCheck, ShieldOff, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  MfaEnrollDialog,
  MfaOtpInput,
  MfaRegenerateRecoveryCodesDialog,
  useMfaEnroll,
  useMfaFactors,
  useRequireMfaForRole,
} from "@/shared/auth/mfa";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

export function TwoFactorSecuritySection() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const setup2faHandled = useRef(false);
  const setup2fa = searchParams.get("setup2fa");
  const { organizationId } = useCurrentOrg();
  const { isOwner, isAdmin } = useCentralizedUserData();
  const { data: xenditSettings } = useXenditOrgSettings(organizationId);
  const { hasVerifiedTotp, totpFactor, loading, refresh } = useMfaFactors();
  const { shouldShowEnrollBanner, inGracePeriod, graceEndsAt } = useRequireMfaForRole();
  const { unenroll, confirming, error: unenrollError } = useMfaEnroll();

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [unenrollOpen, setUnenrollOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [recoveryRedirect, setRecoveryRedirect] = useState(false);
  const [requiredRedirect, setRequiredRedirect] = useState(false);

  const xenditEnabled = Boolean(xenditSettings?.account?.is_enabled);
  const isPrivileged = isOwner || isAdmin;
  const blockUnenroll = isPrivileged && xenditEnabled;

  useEffect(() => {
    if (setup2fa === "recovery") setRecoveryRedirect(true);
    if (setup2fa === "required") setRequiredRedirect(true);
  }, [setup2fa]);

  useEffect(() => {
    if (loading) return;
    if (setup2fa !== "required" && setup2fa !== "recovery") return;
    if (setup2faHandled.current) return;
    setup2faHandled.current = true;

    if (!hasVerifiedTotp) {
      setEnrollOpen(true);
    }

    requestAnimationFrame(() => {
      document.getElementById("two-factor-security-section")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });

    const next = new URLSearchParams(searchParams);
    next.delete("setup2fa");
    setSearchParams(next, { replace: true });
  }, [hasVerifiedTotp, loading, searchParams, setSearchParams, setup2fa]);

  if (loading) return null;

  const graceDaysLeft =
    graceEndsAt != null
      ? Math.max(0, Math.ceil((graceEndsAt - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;

  const handleUnenroll = async (code: string) => {
    if (!totpFactor?.id) return;
    const ok = await unenroll(totpFactor.id, code);
    if (ok) {
      toast.success(t("settings.security.twoFactor.unenrollSuccess"));
      setUnenrollOpen(false);
      await refresh();
    } else {
      setResetTrigger((n) => n + 1);
    }
  };

  return (
    <>
      <Card id="two-factor-security-section" className="border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>{t("settings.security.twoFactor.title")}</CardTitle>
            <Badge variant={hasVerifiedTotp ? "default" : "secondary"}>
              {hasVerifiedTotp
                ? t("settings.security.twoFactor.statusActive")
                : t("settings.security.twoFactor.statusInactive")}
            </Badge>
          </div>
          <CardDescription>{t("settings.security.twoFactor.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recoveryRedirect && !hasVerifiedTotp ? (
            <Alert variant="destructive">
              <AlertDescription>{t("settings.security.setup2fa.recoveryBanner")}</AlertDescription>
            </Alert>
          ) : null}

          {shouldShowEnrollBanner && !hasVerifiedTotp ? (
            <Alert variant={inGracePeriod && !requiredRedirect ? "default" : "destructive"}>
              <AlertDescription>
                {requiredRedirect
                  ? t("settings.security.setup2fa.requiredBanner")
                  : inGracePeriod
                    ? t("settings.security.twoFactor.graceBanner", { days: graceDaysLeft })
                    : t("settings.security.twoFactor.requiredBanner")}
              </AlertDescription>
            </Alert>
          ) : null}

          {hasVerifiedTotp && totpFactor ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {t("settings.security.twoFactor.authenticatorApp")}
              </div>
              <p className="mt-1 text-muted-foreground">
                {t("settings.security.twoFactor.enrolledAt", {
                  date: totpFactor.updated_at
                    ? new Date(totpFactor.updated_at).toLocaleDateString()
                    : "—",
                })}
              </p>
              <p className="mt-2 text-muted-foreground">{t("settings.security.twoFactor.backupCodesHint")}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("settings.security.twoFactor.notEnrolledHint")}</p>
          )}

          <div className="flex flex-wrap gap-3">
            {!hasVerifiedTotp ? (
              <Button type="button" onClick={() => setEnrollOpen(true)}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                {t("settings.security.twoFactor.enable")}
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setRegenerateOpen(true)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  {t("settings.security.twoFactor.regenerateRecovery")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={blockUnenroll}
                  onClick={() => setUnenrollOpen(true)}
                >
                  <ShieldOff className="mr-2 h-4 w-4" />
                  {t("settings.security.twoFactor.disable")}
                </Button>
              </>
            )}
          </div>

          {blockUnenroll ? (
            <p className="text-xs text-muted-foreground">{t("settings.security.twoFactor.blockUnenrollXendit")}</p>
          ) : null}
        </CardContent>
      </Card>

      <MfaEnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        onEnrolled={() => void refresh()}
      />

      {totpFactor ? (
        <MfaRegenerateRecoveryCodesDialog
          open={regenerateOpen}
          onOpenChange={setRegenerateOpen}
          factorId={totpFactor.id}
        />
      ) : null}

      <Dialog open={unenrollOpen} onOpenChange={setUnenrollOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.security.twoFactor.unenrollTitle")}</DialogTitle>
            <DialogDescription>{t("settings.security.twoFactor.unenrollDescription")}</DialogDescription>
          </DialogHeader>
          {unenrollError ? (
            <Alert variant="destructive">
              <AlertDescription>{unenrollError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="relative py-2">
            {confirming ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : null}
            <MfaOtpInput
              disabled={confirming}
              resetTrigger={resetTrigger}
              legend={t("settings.security.twoFactor.unenrollLegend")}
              onComplete={handleUnenroll}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUnenrollOpen(false)}>
              {t("settings.security.actions.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
