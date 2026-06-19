import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { XenditKycVerificationForm } from "@/4-0-xendit-settings/components/XenditKycVerificationForm";
import { cn } from "@/shared/lib/utils";

type XenditBusinessVerificationSectionProps = {
  disabled?: boolean;
  defaultExpanded?: boolean;
  onVerified?: () => void;
};

export function XenditBusinessVerificationSection({
  disabled = false,
  defaultExpanded = false,
  onVerified,
}: XenditBusinessVerificationSectionProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-lg border border-blue-200/80 bg-blue-50/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("xendit.kyc.businessVerificationTitle", "Verifikasi Bisnis Anda")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t(
              "xendit.kyc.businessVerificationDesc",
              "Lengkapi data legalitas bisnis sebelum akun Xendit dibuat. Data akan dikirim ke Xendit untuk verifikasi.",
            )}
          </p>
        </div>
      </div>

      {!expanded ? (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => setExpanded(true)}
            className="h-8 text-xs"
          >
            {t("xendit.kyc.startVerification", "Mulai verifikasi bisnis")}
          </Button>
        </div>
      ) : (
        <div className={cn("mt-4 rounded-md border border-gray-200/80 bg-white p-4")}>
          <XenditKycVerificationForm
            active={expanded}
            showCancel
            onCancel={() => setExpanded(false)}
            onSuccess={() => {
              setExpanded(false);
              onVerified?.();
            }}
          />
        </div>
      )}
    </div>
  );
}
