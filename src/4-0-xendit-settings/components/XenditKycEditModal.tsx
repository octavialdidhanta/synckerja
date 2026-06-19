import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { XenditKycEntitySelect } from "@/4-0-xendit-settings/components/XenditKycEntitySelect";
import { XenditKycDirectorSection } from "@/4-0-xendit-settings/components/XenditKycDirectorSection";
import { XenditEntityDocumentsSection } from "@/4-0-xendit-settings/components/XenditEntityDocumentsSection";
import { XenditKycBusinessAddressSection } from "@/4-0-xendit-settings/components/XenditKycBusinessAddressSection";
import { XenditKycProofOfBusinessSection } from "@/4-0-xendit-settings/components/XenditKycProofOfBusinessSection";
import { XenditKycWizardSteps } from "@/4-0-xendit-settings/components/XenditKycWizardSteps";
import { XenditServiceAgreementSection } from "@/4-0-xendit-settings/components/XenditServiceAgreementSection";
import { updateXenditKycAndRetryDocuments } from "@/xendit/lib/xenditApi";
import {
  EMPTY_BUSINESS_ADDRESS,
  entitySelectToTypes,
  requiredDocumentSlots,
  type DocumentSlotKey,
} from "@/xendit/lib/xenditKycEntityConfig";
import { entitySelectFromKyc } from "@/xendit/lib/xenditKycUtils";
import {
  existingPathsFromKyc,
  INITIAL_KYC_FORM,
  uploadKycFormFiles,
  validateKycFormStep,
  type ExistingKycPaths,
  type XenditKycFormState,
} from "@/xendit/lib/xenditKycFormHelpers";
import type { OrganizationKycDocument } from "@/xendit/types/xendit";

type XenditKycEditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subAccountRowId: string | null;
  initialKyc: OrganizationKycDocument | null;
};

function formFromKyc(kyc: OrganizationKycDocument): XenditKycFormState {
  return {
    ...INITIAL_KYC_FORM,
    entitySelect: entitySelectFromKyc(kyc),
    legalName: kyc.legal_name ?? "",
    identityNumber: kyc.identity_number ?? "",
    npwp: kyc.npwp ?? "",
    nib: kyc.nib ?? "",
    directorNpwp: kyc.director_npwp ?? "",
    businessAddress: kyc.business_address ?? { ...EMPTY_BUSINESS_ADDRESS },
    businessWebsite: kyc.business_website ?? "",
    files: { ktp: null, serviceAgreement: null, documents: {} },
  };
}

function existingDocFlags(
  kyc: OrganizationKycDocument,
  existing: ExistingKycPaths,
): Partial<Record<DocumentSlotKey, boolean>> {
  const flags: Partial<Record<DocumentSlotKey, boolean>> = {};
  if (existing.nib) flags.nib = true;
  if (existing.npwp) flags.company_npwp = true;
  if (existing.directorNpwp) flags.director_npwp = true;
  if (existing.akta) flags.akta = true;
  if (existing.skMenkeh) flags.sk_menkeh = true;
  if (existing.proofOfBusiness) flags.proof_of_business = true;
  for (const slot of requiredDocumentSlots(kyc.business_type, kyc.entity_subtype)) {
    if (existing.entityExtra?.[slot]) flags[slot] = true;
  }
  return flags;
}

export function XenditKycEditModal({
  open,
  onOpenChange,
  subAccountRowId,
  initialKyc,
}: XenditKycEditModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<XenditKycFormState>(INITIAL_KYC_FORM);
  const [existing, setExisting] = useState<ExistingKycPaths>({});
  const [submitting, setSubmitting] = useState(false);

  const { businessType } = entitySelectToTypes(form.entitySelect);
  const isIndividual = businessType === "individual";

  const existingDocPaths = useMemo(
    () => (initialKyc ? existingDocFlags(initialKyc, existing) : {}),
    [initialKyc, existing],
  );

  useEffect(() => {
    if (!open || !initialKyc) return;
    setStep(1);
    setForm(formFromKyc(initialKyc));
    setExisting(existingPathsFromKyc(initialKyc));
  }, [open, initialKyc]);

  const patchForm = (patch: Partial<XenditKycFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const patchDocumentFile = (slot: DocumentSlotKey, file: File | null) => {
    setForm((prev) => ({
      ...prev,
      files: {
        ...prev.files,
        documents: { ...prev.files.documents, [slot]: file },
      },
    }));
  };

  const goNext = () => {
    const error = validateKycFormStep(form, step, existing, "edit");
    if (error) {
      toast.error(error);
      return;
    }
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  };

  const handleSubmit = async () => {
    if (!organizationId || !subAccountRowId) return;
    for (const s of [1, 2, 3] as const) {
      const error = validateKycFormStep(form, s, existing, "edit");
      if (error) {
        toast.error(error);
        setStep(s);
        return;
      }
    }

    setSubmitting(true);
    try {
      const paths = await uploadKycFormFiles(organizationId, form, existing);
      const result = await updateXenditKycAndRetryDocuments({
        organizationId,
        subAccountRowId,
        businessType: paths.businessType,
        entitySubtype: paths.entitySubtype,
        legalName: paths.legalName,
        identityNumber: paths.identityNumber,
        npwp: paths.npwp,
        nib: paths.nib,
        directorNpwp: paths.directorNpwp,
        ktpStoragePath: paths.ktpStoragePath,
        nibStoragePath: paths.nibStoragePath,
        npwpStoragePath: paths.npwpStoragePath,
        directorNpwpStoragePath: paths.directorNpwpStoragePath,
        aktaStoragePath: paths.aktaStoragePath,
        skMenkehStoragePath: paths.skMenkehStoragePath,
        entityExtraDocuments: paths.entityExtraDocuments,
        serviceAgreementStoragePath: paths.serviceAgreementStoragePath,
        businessAddress: paths.businessAddress,
        businessWebsite: paths.businessWebsite,
        proofOfBusinessStoragePath: paths.proofOfBusinessStoragePath,
      });

      if (result.document_upload_ok) {
        toast.success(
          t("xendit.kyc.updateRetrySuccess", "Dokumen berhasil diperbarui dan dikirim ke Xendit"),
        );
      } else {
        toast.warning(
          t(
            "xendit.kyc.updateRetryPartial",
            "Data KYC disimpan, tetapi upload ke Xendit gagal. Coba upload ulang.",
          ),
        );
      }

      void queryClient.invalidateQueries({ queryKey: ["xendit-settings", organizationId] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("xendit.kyc.editModalTitle", "Lengkapi Dokumen Legalitas")}</DialogTitle>
          <DialogDescription>
            {t(
              "xendit.kyc.editModalDesc",
              "Perbarui data KYC organisasi dan kirim ulang dokumen ke Xendit untuk akun ini.",
            )}
          </DialogDescription>
        </DialogHeader>

        <XenditKycWizardSteps step={step} />

        {step === 1 ? (
          <div className="space-y-4">
            <XenditKycEntitySelect
              value={form.entitySelect}
              onChange={(entitySelect) => patchForm({ entitySelect })}
            />
            <div className="space-y-2">
              <Label htmlFor="kyc-edit-legal-name">
                {isIndividual
                  ? t("xendit.kyc.fullName", "Nama lengkap")
                  : t("xendit.kyc.companyName", "Nama perusahaan")}
              </Label>
              <Input
                id="kyc-edit-legal-name"
                value={form.legalName}
                onChange={(e) => patchForm({ legalName: e.target.value })}
                required
              />
            </div>
            <XenditKycDirectorSection
              idPrefix="kyc-edit"
              entitySelect={form.entitySelect}
              identityNumber={form.identityNumber}
              directorNpwp={form.directorNpwp}
              ktpFile={form.files.ktp}
              directorNpwpFile={form.files.documents.director_npwp ?? null}
              onIdentityNumberChange={(identityNumber) => patchForm({ identityNumber })}
              onDirectorNpwpChange={(directorNpwp) => patchForm({ directorNpwp })}
              onKtpFileChange={(ktp) => patchForm({ files: { ...form.files, ktp } })}
              onDirectorNpwpFileChange={(file) => patchDocumentFile("director_npwp", file)}
              existingKtpUploaded={Boolean(existing.ktp)}
              existingDirectorNpwpUploaded={Boolean(existing.directorNpwp)}
              requireFiles={false}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <XenditEntityDocumentsSection
              idPrefix="kyc-edit"
              entitySelect={form.entitySelect}
              nib={form.nib}
              npwp={form.npwp}
              nibFile={form.files.documents.nib ?? null}
              npwpFile={form.files.documents.company_npwp ?? null}
              documentFiles={form.files.documents}
              existingPaths={existingDocPaths}
              useNewCompanyDeed={form.useNewCompanyDeed}
              onNibChange={(nib) => patchForm({ nib })}
              onNpwpChange={(npwp) => patchForm({ npwp })}
              onNibFileChange={(file) => patchDocumentFile("nib", file)}
              onNpwpFileChange={(file) => patchDocumentFile("company_npwp", file)}
              onDocumentFileChange={patchDocumentFile}
              onUseNewCompanyDeedChange={(useNewCompanyDeed) => patchForm({ useNewCompanyDeed })}
            />
            <XenditServiceAgreementSection
              idPrefix="kyc-edit"
              legalName={form.legalName}
              existingUploaded={Boolean(existing.serviceAgreement)}
              file={form.files.serviceAgreement}
              onFileChange={(serviceAgreement) =>
                patchForm({ files: { ...form.files, serviceAgreement } })
              }
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            {!isIndividual ? (
              <>
                <XenditKycBusinessAddressSection
                  idPrefix="kyc-edit"
                  address={form.businessAddress}
                  onChange={(businessAddress) => patchForm({ businessAddress })}
                />
                <XenditKycProofOfBusinessSection
                  idPrefix="kyc-edit"
                  website={form.businessWebsite}
                  proofFile={form.files.documents.proof_of_business ?? null}
                  existingProofUploaded={Boolean(existing.proofOfBusiness)}
                  onWebsiteChange={(businessWebsite) => patchForm({ businessWebsite })}
                  onProofFileChange={(file) => patchDocumentFile("proof_of_business", file)}
                />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("xendit.kyc.editStep3IndividualHint", "Perorangan tidak memerlukan alamat/bukti usaha.")}
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("common.cancel", "Batal")}
          </Button>
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
              disabled={submitting}
            >
              {t("common.back", "Kembali")}
            </Button>
          ) : null}
          {step < 3 ? (
            <Button type="button" onClick={goNext} disabled={submitting}>
              {t("common.next", "Lanjut")}
            </Button>
          ) : (
            <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting
                ? t("xendit.processing", "Memproses…")
                : t("xendit.kyc.submitUpdateRetry", "Simpan & kirim ulang")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
