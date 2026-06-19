import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { MfaOtpInput } from "./MfaOtpInput";
import { MfaRecoveryCodesPanel } from "./MfaRecoveryCodesPanel";
import { useMfaEnroll } from "./useMfaEnroll";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrolled: () => void;
};

type Step = "intro" | "qr" | "verify" | "recovery";

export function MfaEnrollDialog({ open, onOpenChange, onEnrolled }: Props) {
  const { t } = useTranslation();
  const {
    enrolling,
    confirming,
    enrollState,
    error,
    recoveryCodes,
    startEnroll,
    confirmEnroll,
    cancelEnroll,
    reset,
  } = useMfaEnroll();
  const [step, setStep] = useState<Step>("intro");
  const [resetTrigger, setResetTrigger] = useState(0);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  const handleClose = useCallback(
    async (next: boolean) => {
      if (!next) {
        if (enrollState && step !== "recovery") {
          await cancelEnroll();
        }
        reset();
        setStep("intro");
        setSavedConfirmed(false);
      }
      onOpenChange(next);
    },
    [cancelEnroll, enrollState, onOpenChange, reset, step],
  );

  const handleStart = async () => {
    const data = await startEnroll();
    if (data) setStep("qr");
  };

  const handleVerify = async (code: string) => {
    const result = await confirmEnroll(code);
    if (result.ok) {
      setStep("recovery");
    } else {
      setResetTrigger((n) => n + 1);
    }
  };

  const handleFinish = () => {
    onEnrolled();
    reset();
    setStep("intro");
    setSavedConfirmed(false);
    onOpenChange(false);
  };

  const copySecret = async () => {
    if (!enrollState?.secret) return;
    await navigator.clipboard.writeText(enrollState.secret);
    setCopiedSecret(true);
    toast.success(t("settings.security.twoFactor.secretCopied"));
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => void handleClose(v)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle>{t("settings.security.twoFactor.enrollTitle")}</DialogTitle>
          </div>
          <DialogDescription>
            {step === "recovery"
              ? t("settings.security.twoFactor.recoveryDescription")
              : t("settings.security.twoFactor.enrollDescription")}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {step === "intro" ? (
          <p className="text-sm text-muted-foreground">{t("settings.security.twoFactor.enrollIntro")}</p>
        ) : null}

        {step === "qr" && enrollState ? (
          <div className="space-y-4">
            <div className="flex justify-center rounded-lg border bg-white p-4">
              <img
                src={enrollState.qrCode}
                alt={t("settings.security.twoFactor.qrAlt")}
                className="h-44 w-44"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("settings.security.twoFactor.manualSecret")}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{enrollState.secret}</code>
                <Button type="button" variant="outline" size="sm" onClick={() => void copySecret()}>
                  <Copy className="h-4 w-4" />
                  {copiedSecret ? t("settings.security.twoFactor.copied") : t("settings.security.twoFactor.copy")}
                </Button>
              </div>
            </div>
            <div className="relative">
              {confirming ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : null}
              <MfaOtpInput
                disabled={confirming}
                resetTrigger={resetTrigger}
                legend={t("settings.security.twoFactor.verifyEnrollLegend")}
                onComplete={handleVerify}
              />
            </div>
          </div>
        ) : null}

        {step === "recovery" && recoveryCodes ? (
          <div className="space-y-4">
            <MfaRecoveryCodesPanel codes={recoveryCodes} />
            <div className="flex items-start gap-2">
              <Checkbox
                id="enroll-recovery-saved"
                checked={savedConfirmed}
                onCheckedChange={(checked) => setSavedConfirmed(checked === true)}
              />
              <Label htmlFor="enroll-recovery-saved" className="text-sm leading-snug">
                {t("settings.security.twoFactor.savedConfirm")}
              </Label>
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {step === "intro" ? (
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                {t("settings.security.actions.cancel")}
              </Button>
              <Button type="button" disabled={enrolling} onClick={() => void handleStart()}>
                {enrolling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("settings.security.twoFactor.enrolling")}
                  </>
                ) : (
                  t("settings.security.twoFactor.startEnroll")
                )}
              </Button>
            </>
          ) : null}
          {step === "recovery" ? (
            <Button type="button" disabled={!savedConfirmed} onClick={handleFinish}>
              {t("settings.security.twoFactor.done")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
