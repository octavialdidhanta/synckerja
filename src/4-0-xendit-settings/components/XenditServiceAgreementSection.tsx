import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  XENDIT_SERVICE_AGREEMENT_DOWNLOAD_NAME,
  XENDIT_SERVICE_AGREEMENT_TEMPLATE_PATH,
} from "@/xendit/lib/xenditKycTemplate";

type XenditServiceAgreementSectionProps = {
  idPrefix: "kyc" | "kyc-edit";
  legalName?: string;
  existingUploaded?: boolean;
  file: File | null;
  onFileChange: (file: File | null) => void;
  required?: boolean;
};

export function XenditServiceAgreementSection({
  idPrefix,
  legalName = "",
  existingUploaded = false,
  file,
  onFileChange,
  required = false,
}: XenditServiceAgreementSectionProps) {
  const { t } = useTranslation();
  const inputId = `${idPrefix}-service-agreement`;
  const trimmedLegal = legalName.trim();

  return (
    <div className="space-y-3">
      <Alert className="border-blue-200 bg-blue-50/50">
        <AlertTitle className="text-sm font-medium text-gray-900">
          {t("xendit.kyc.serviceAgreementGuideTitle", "Cara mengunggah Service Agreement")}
        </AlertTitle>
        <AlertDescription asChild>
          <div className="mt-2 space-y-2 text-xs text-gray-700">
            <ol className="list-decimal space-y-1.5 pl-4">
              <li>{t("xendit.kyc.serviceAgreementStep1", "Unduh template Service Agreement")}</li>
              <li>
                <span>
                  {t("xendit.kyc.serviceAgreementStep2", "Isi data bisnis dan tanda tangani")}
                </span>
                {trimmedLegal ? (
                  <p className="mt-0.5 font-medium text-gray-900">
                    {t(
                      "xendit.kyc.serviceAgreementStep2NameHint",
                      "Pastikan nama legal sama dengan: {{name}}",
                      { name: trimmedLegal },
                    )}
                  </p>
                ) : null}
              </li>
              <li>
                {t(
                  "xendit.kyc.serviceAgreementStep3",
                  "Unggah PDF yang sudah ditandatangani di field di bawah",
                )}
              </li>
            </ol>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" asChild>
              <a
                href={XENDIT_SERVICE_AGREEMENT_TEMPLATE_PATH}
                download={XENDIT_SERVICE_AGREEMENT_DOWNLOAD_NAME}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {t("xendit.kyc.serviceAgreementDownload", "Unduh template")}
              </a>
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor={inputId}>
          {t("xendit.kyc.serviceAgreementUpload", "Unggah Service Agreement (PDF ditandatangani)")}
        </Label>
        <p className="text-[10px] text-muted-foreground">
          {t(
            "xendit.kyc.serviceAgreementFormatNote",
            "Format PDF disarankan. Maks. 10 MB.",
          )}
        </p>
        {existingUploaded && !file ? (
          <p className="text-[10px] text-muted-foreground">
            {t("xendit.kyc.fileAlreadyUploaded", "Sudah diunggah")} —{" "}
            {t(
              "xendit.kyc.serviceAgreementReplaceHint",
              "Unggah file baru jika perlu mengganti dokumen.",
            )}
          </p>
        ) : null}
        <Input
          id={inputId}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          required={required && !existingUploaded}
        />
      </div>
    </div>
  );
}
