import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
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
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { MfaOtpInput } from "./MfaOtpInput";
import { MfaRecoveryCodesPanel } from "./MfaRecoveryCodesPanel";
import { useMfaEnroll } from "./useMfaEnroll";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factorId: string;
};

type Step = "verify" | "codes";

export function MfaRegenerateRecoveryCodesDialog({ open, onOpenChange, factorId }: Props) {
  const { t } = useTranslation();
  const { confirming, error, recoveryCodes, regenerateRecoveryCodes, reset } = useMfaEnroll();
  const [step, setStep] = useState<Step>("verify");
  const [resetTrigger, setResetTrigger] = useState(0);
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset();
      setStep("verify");
      setSavedConfirmed(false);
      setResetTrigger(0);
    }
    onOpenChange(next);
  };

  const handleVerify = async (code: string) => {
    const result = await regenerateRecoveryCodes(factorId, code);
    if (result.ok) {
      setStep("codes");
      toast.success(t("settings.security.twoFactor.regenerateSuccess"));
    } else {
      setResetTrigger((n) => n + 1);
    }
  };

  const handleFinish = () => {
    reset();
    setStep("verify");
    setSavedConfirmed(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.security.twoFactor.regenerateTitle")}</DialogTitle>
          <DialogDescription>
            {step === "verify"
              ? t("settings.security.twoFactor.regenerateDescription")
              : t("settings.security.twoFactor.recoveryDescription")}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {step === "verify" ? (
          <div className="relative py-2">
            {confirming ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : null}
            <MfaOtpInput
              disabled={confirming}
              resetTrigger={resetTrigger}
              legend={t("settings.security.twoFactor.regenerateLegend")}
              onComplete={handleVerify}
            />
          </div>
        ) : null}

        {step === "codes" && recoveryCodes ? (
          <div className="space-y-4">
            <MfaRecoveryCodesPanel codes={recoveryCodes} />
            <div className="flex items-start gap-2">
              <Checkbox
                id="regenerate-recovery-saved"
                checked={savedConfirmed}
                onCheckedChange={(checked) => setSavedConfirmed(checked === true)}
              />
              <Label htmlFor="regenerate-recovery-saved" className="text-sm leading-snug">
                {t("settings.security.twoFactor.savedConfirm")}
              </Label>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          {step === "verify" ? (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {t("settings.security.actions.cancel")}
            </Button>
          ) : null}
          {step === "codes" ? (
            <Button type="button" disabled={!savedConfirmed} onClick={handleFinish}>
              {t("settings.security.twoFactor.done")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
