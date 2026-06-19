import { useTranslation } from "react-i18next";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { EntitySelectValue } from "@/xendit/lib/xenditKycEntityConfig";

type XenditKycDirectorSectionProps = {
  idPrefix: string;
  entitySelect: EntitySelectValue;
  identityNumber: string;
  directorNpwp: string;
  ktpFile: File | null;
  directorNpwpFile: File | null;
  onIdentityNumberChange: (value: string) => void;
  onDirectorNpwpChange: (value: string) => void;
  onKtpFileChange: (file: File | null) => void;
  onDirectorNpwpFileChange: (file: File | null) => void;
  existingKtpUploaded?: boolean;
  existingDirectorNpwpUploaded?: boolean;
  requireFiles?: boolean;
};

export function XenditKycDirectorSection({
  idPrefix,
  entitySelect,
  identityNumber,
  directorNpwp,
  ktpFile,
  directorNpwpFile,
  onIdentityNumberChange,
  onDirectorNpwpChange,
  onKtpFileChange,
  onDirectorNpwpFileChange,
  existingKtpUploaded = false,
  existingDirectorNpwpUploaded = false,
  requireFiles = true,
}: XenditKycDirectorSectionProps) {
  const { t } = useTranslation();
  const uploadedLabel = t("xendit.kyc.fileAlreadyUploaded", "Sudah diunggah");
  const isIndividual = entitySelect === "individual";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-ktp-number`}>
          {isIndividual
            ? t("xendit.kyc.ktpNumber", "Nomor KTP")
            : t("xendit.kyc.ktpPic", "Nomor KTP penanggung jawab")}
        </Label>
        <Input
          id={`${idPrefix}-ktp-number`}
          value={identityNumber}
          onChange={(e) => onIdentityNumberChange(e.target.value)}
          inputMode="numeric"
          required
        />
      </div>

      {!isIndividual ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-director-npwp`}>
            {t("xendit.kyc.directorNpwp", "NPWP direktur/pemilik")}
          </Label>
          <Input
            id={`${idPrefix}-director-npwp`}
            value={directorNpwp}
            onChange={(e) => onDirectorNpwpChange(e.target.value)}
            required
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-ktp-file`}>{t("xendit.kyc.ktpUpload", "Unggah foto KTP")}</Label>
        {existingKtpUploaded && !ktpFile ? (
          <p className="text-[10px] text-muted-foreground">{uploadedLabel}</p>
        ) : null}
        <Input
          id={`${idPrefix}-ktp-file`}
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => onKtpFileChange(e.target.files?.[0] ?? null)}
          required={requireFiles && !existingKtpUploaded}
        />
      </div>

      {!isIndividual ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-director-npwp-file`}>
            {t("xendit.kyc.directorNpwpDocUpload", "Unggah dokumen NPWP direktur (PDF disarankan)")}
          </Label>
          {existingDirectorNpwpUploaded && !directorNpwpFile ? (
            <p className="text-[10px] text-muted-foreground">{uploadedLabel}</p>
          ) : null}
          <Input
            id={`${idPrefix}-director-npwp-file`}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => onDirectorNpwpFileChange(e.target.files?.[0] ?? null)}
            required={requireFiles && !existingDirectorNpwpUploaded}
          />
        </div>
      ) : null}
    </div>
  );
}
