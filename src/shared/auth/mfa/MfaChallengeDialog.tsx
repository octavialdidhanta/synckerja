import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { MfaOtpInput } from "./MfaOtpInput";
import { useMfaChallenge } from "./useMfaChallenge";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void | Promise<void>;
  title?: string;
  description?: string;
};

export function MfaChallengeDialog({
  open,
  onOpenChange,
  onVerified,
  title,
  description,
}: Props) {
  const { t } = useTranslation();
  const { verifying, error, verifyTotpCode, clearError } = useMfaChallenge();
  const [resetTrigger, setResetTrigger] = useState(0);

  const handleComplete = async (code: string) => {
    const ok = await verifyTotpCode(code);
    if (ok) {
      await supabaseLogStepUp();
      await onVerified();
      onOpenChange(false);
    } else {
      setResetTrigger((n) => n + 1);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) clearError();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <DialogTitle>{title ?? t("settings.security.twoFactor.challengeTitle")}</DialogTitle>
          </div>
          <DialogDescription>
            {description ?? t("settings.security.twoFactor.challengeDescription")}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="relative py-2">
          {verifying ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : null}
          <MfaOtpInput
            disabled={verifying}
            resetTrigger={resetTrigger}
            legend={t("settings.security.twoFactor.otpLegend")}
            onComplete={handleComplete}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function supabaseLogStepUp() {
  try {
    const { supabase } = await import("@/shared/lib/supabaseClient");
    await supabase.rpc("log_auth_security_event", {
      p_event: "mfa_step_up",
      p_metadata: {},
    });
  } catch {
    /* non-blocking */
  }
}
