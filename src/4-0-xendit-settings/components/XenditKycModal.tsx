import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { XenditKycVerificationForm } from "@/4-0-xendit-settings/components/XenditKycVerificationForm";

type XenditKycModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** @deprecated Prefer inline {@link XenditBusinessVerificationSection}. */
export function XenditKycModal({ open, onOpenChange }: XenditKycModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("xendit.kyc.businessVerificationTitle", "Verifikasi Bisnis Anda")}</DialogTitle>
          <DialogDescription>
            {t(
              "xendit.kyc.businessVerificationDesc",
              "Lengkapi data legalitas bisnis sebelum akun Xendit dibuat. Data akan dikirim ke Xendit untuk verifikasi.",
            )}
          </DialogDescription>
        </DialogHeader>
        <XenditKycVerificationForm
          active={open}
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
