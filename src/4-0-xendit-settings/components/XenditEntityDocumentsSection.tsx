import { useTranslation } from "react-i18next";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  DOCUMENT_SLOT_LABELS,
  entitySelectToTypes,
  requiredDocumentSlots,
  type DocumentSlotKey,
  type EntitySelectValue,
} from "@/xendit/lib/xenditKycEntityConfig";

type XenditEntityDocumentsSectionProps = {
  idPrefix: string;
  entitySelect: EntitySelectValue;
  nib: string;
  npwp: string;
  nibFile: File | null;
  npwpFile: File | null;
  documentFiles: Partial<Record<DocumentSlotKey, File | null>>;
  existingPaths?: Partial<Record<DocumentSlotKey, boolean>>;
  useNewCompanyDeed: boolean;
  onNibChange: (value: string) => void;
  onNpwpChange: (value: string) => void;
  onNibFileChange: (file: File | null) => void;
  onNpwpFileChange: (file: File | null) => void;
  onDocumentFileChange: (slot: DocumentSlotKey, file: File | null) => void;
  onUseNewCompanyDeedChange: (value: boolean) => void;
  required?: boolean;
};

function slotLabel(
  slot: DocumentSlotKey,
  useNewCompanyDeed: boolean,
  t: (key: string, defaultValue: string) => string,
): string {
  if (slot === "akta") {
    return useNewCompanyDeed
      ? t("xendit.kyc.aktaPendirianUpload", "Unggah Akta Pendirian (PDF disarankan)")
      : t("xendit.kyc.aktaDocUpload", "Unggah Akta Pengangkatan Direktur Terakhir (PDF disarankan)");
  }
  if (slot === "sk_menkeh") {
    return useNewCompanyDeed
      ? t("xendit.kyc.skMenkehPendirianUpload", "Unggah SK Menkeh Pendirian (PDF disarankan)")
      : t("xendit.kyc.skMenkehDocUpload", "Unggah SK Menkeh atas Akta Terakhir (PDF disarankan)");
  }
  const meta = DOCUMENT_SLOT_LABELS[slot];
  return t(meta.key, meta.default);
}

export function XenditEntityDocumentsSection({
  idPrefix,
  entitySelect,
  nib,
  npwp,
  nibFile,
  npwpFile,
  documentFiles,
  existingPaths = {},
  useNewCompanyDeed,
  onNibChange,
  onNpwpChange,
  onNibFileChange,
  onNpwpFileChange,
  onDocumentFileChange,
  onUseNewCompanyDeedChange,
  required = false,
}: XenditEntityDocumentsSectionProps) {
  const { t } = useTranslation();
  const uploadedLabel = t("xendit.kyc.fileAlreadyUploaded", "Sudah diunggah");

  if (entitySelect === "individual") return null;

  const { businessType, entitySubtype } = entitySelectToTypes(entitySelect);
  const slots = requiredDocumentSlots(businessType, entitySubtype).filter(
    (s) => s !== "nib" && s !== "company_npwp" && s !== "director_npwp",
  );

  const showDeedToggle =
    entitySelect === "corporation" ||
    entitySelect === "foundation" ||
    entitySelect === "cooperative";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-nib`}>{t("xendit.kyc.nib", "Nomor NIB")}</Label>
        <Input id={`${idPrefix}-nib`} value={nib} onChange={(e) => onNibChange(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-npwp`}>{t("xendit.kyc.npwpCompany", "NPWP perusahaan")}</Label>
        <Input id={`${idPrefix}-npwp`} value={npwp} onChange={(e) => onNpwpChange(e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-nib-file`}>
          {t("xendit.kyc.nibDocUpload", "Unggah dokumen NIB (PDF disarankan)")}
        </Label>
        {existingPaths.nib && !nibFile ? (
          <p className="text-[10px] text-muted-foreground">{uploadedLabel}</p>
        ) : null}
        <Input
          id={`${idPrefix}-nib-file`}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) => onNibFileChange(e.target.files?.[0] ?? null)}
          required={required && !existingPaths.nib}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-npwp-file`}>
          {t("xendit.kyc.npwpDocUpload", "Unggah dokumen NPWP perusahaan (PDF disarankan)")}
        </Label>
        {existingPaths.company_npwp && !npwpFile ? (
          <p className="text-[10px] text-muted-foreground">{uploadedLabel}</p>
        ) : null}
        <Input
          id={`${idPrefix}-npwp-file`}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) => onNpwpFileChange(e.target.files?.[0] ?? null)}
          required={required && !existingPaths.company_npwp}
        />
      </div>

      {showDeedToggle ? (
        <label className="flex items-start gap-2 text-xs text-gray-700">
          <Checkbox
            checked={useNewCompanyDeed}
            onCheckedChange={(v) => onUseNewCompanyDeedChange(v === true)}
          />
          <span>
            {t(
              "xendit.kyc.useNewCompanyDeed",
              "Perusahaan baru (gunakan Akta Pendirian + SK Menkeh Pendirian)",
            )}
          </span>
        </label>
      ) : null}

      {slots.map((slot) => {
        const file = documentFiles[slot];
        const existing = existingPaths[slot];
        return (
          <div key={slot} className="space-y-2">
            <Label htmlFor={`${idPrefix}-${slot}-file`}>{slotLabel(slot, useNewCompanyDeed, t)}</Label>
            {existing && !file ? (
              <p className="text-[10px] text-muted-foreground">{uploadedLabel}</p>
            ) : null}
            <Input
              id={`${idPrefix}-${slot}-file`}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => onDocumentFileChange(slot, e.target.files?.[0] ?? null)}
              required={required && !existing}
            />
          </div>
        );
      })}
    </div>
  );
}
