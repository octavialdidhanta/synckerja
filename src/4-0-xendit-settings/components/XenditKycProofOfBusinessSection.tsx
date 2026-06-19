import { useTranslation } from "react-i18next";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

type XenditKycProofOfBusinessSectionProps = {
  idPrefix: string;
  website: string;
  proofFile: File | null;
  existingProofUploaded?: boolean;
  onWebsiteChange: (value: string) => void;
  onProofFileChange: (file: File | null) => void;
};

export function XenditKycProofOfBusinessSection({
  idPrefix,
  website,
  proofFile,
  existingProofUploaded = false,
  onWebsiteChange,
  onProofFileChange,
}: XenditKycProofOfBusinessSectionProps) {
  const { t } = useTranslation();
  const uploadedLabel = t("xendit.kyc.fileAlreadyUploaded", "Sudah diunggah");

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-700">
        {t("xendit.kyc.proofOfBusinessTitle", "Bukti usaha")}
      </p>
      <p className="text-[10px] text-muted-foreground">
        {t(
          "xendit.kyc.proofOfBusinessHint",
          "Isi website bisnis yang aktif, atau unggah invoice/foto toko jika belum punya website.",
        )}
      </p>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-website`}>{t("xendit.kyc.businessWebsite", "Website bisnis")}</Label>
        <Input
          id={`${idPrefix}-website`}
          type="url"
          placeholder="https://contoh.com"
          value={website}
          onChange={(e) => onWebsiteChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-proof-file`}>
          {t("xendit.kyc.proofOfBusinessUpload", "Unggah bukti usaha (invoice/foto toko)")}
        </Label>
        {existingProofUploaded && !proofFile ? (
          <p className="text-[10px] text-muted-foreground">{uploadedLabel}</p>
        ) : null}
        <Input
          id={`${idPrefix}-proof-file`}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) => onProofFileChange(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
