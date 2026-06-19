import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useBankAccounts } from "@/shared/hooks/finance/useBankAccounts";
import { XenditKycEntitySelect } from "@/4-0-xendit-settings/components/XenditKycEntitySelect";
import { XenditKycDirectorSection } from "@/4-0-xendit-settings/components/XenditKycDirectorSection";
import { XenditEntityDocumentsSection } from "@/4-0-xendit-settings/components/XenditEntityDocumentsSection";
import { XenditKycBusinessAddressSection } from "@/4-0-xendit-settings/components/XenditKycBusinessAddressSection";
import { XenditKycProofOfBusinessSection } from "@/4-0-xendit-settings/components/XenditKycProofOfBusinessSection";
import { XenditKycWizardSteps } from "@/4-0-xendit-settings/components/XenditKycWizardSteps";
import { XenditServiceAgreementSection } from "@/4-0-xendit-settings/components/XenditServiceAgreementSection";
import { useSecureXenditActions } from "@/xendit/hooks/useSecureXenditActions";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import {
  getSubAccountEmailErrorMessage,
  isSubAccountEmailTaken,
} from "@/xendit/lib/subAccountEmailUtils";
import {
  isValidEmailAddress,
  mapBankNameToXenditCode,
  XENDIT_DISBURSEMENT_BANKS,
} from "@/xendit/lib/bankCodes";
import {
  entitySelectToTypes,
  type DocumentSlotKey,
} from "@/xendit/lib/xenditKycEntityConfig";
import {
  INITIAL_KYC_FORM,
  uploadKycFormFiles,
  validateKycFormStep,
  type XenditKycFormState,
} from "@/xendit/lib/xenditKycFormHelpers";

const NONE_BANK = "__none__";

type XenditKycVerificationFormProps = {
  active?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  idPrefix?: string;
};

export function XenditKycVerificationForm({
  active = true,
  onSuccess,
  onCancel,
  showCancel = true,
  idPrefix = "kyc",
}: XenditKycVerificationFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { secureSubmitKyc } = useSecureXenditActions();
  const { data: xenditSettings } = useXenditOrgSettings(organizationId);
  const { bankAccounts = [], loading: banksLoading } = useBankAccounts();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<XenditKycFormState>(INITIAL_KYC_FORM);
  const [submitting, setSubmitting] = useState(false);

  const activeBanks = useMemo(
    () => bankAccounts.filter((b) => b.is_active),
    [bankAccounts],
  );

  const { businessType } = entitySelectToTypes(form.entitySelect);
  const isIndividual = businessType === "individual";

  useEffect(() => {
    if (!active) return;
    setStep(1);
    setForm(INITIAL_KYC_FORM);
  }, [active]);

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

  const applyBankAccount = (bankAccountId: string) => {
    patchForm({ linkedBankAccountId: bankAccountId });
    if (bankAccountId === NONE_BANK) return;
    const row = activeBanks.find((b) => b.id === bankAccountId);
    if (!row) return;
    patchForm({
      linkedBankAccountId: bankAccountId,
      bankCode: row.bank_name ? mapBankNameToXenditCode(row.bank_name) : form.bankCode,
      accountNumber: row.account_number ?? form.accountNumber,
      accountHolder: row.account_holder ?? form.accountHolder,
    });
  };

  const goNext = () => {
    const error = validateKycFormStep(form, step);
    if (error) {
      toast.error(error);
      return;
    }
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  };

  const handleSubmit = async () => {
    if (!organizationId) return;
    for (const s of [1, 2, 3] as const) {
      const error = validateKycFormStep(form, s);
      if (error) {
        toast.error(error);
        setStep(s);
        return;
      }
    }

    const trimmedEmail = form.email.trim().toLowerCase();
    if (!isValidEmailAddress(trimmedEmail)) {
      toast.error(t("xendit.subAccountEmailInvalid", "Masukkan alamat email yang valid"));
      return;
    }
    if (isSubAccountEmailTaken(trimmedEmail, xenditSettings?.subAccounts)) {
      toast.error(
        t("xendit.subAccountEmailAlreadyExists", "Email sudah terdaftar untuk bisnis ini"),
      );
      return;
    }

    setSubmitting(true);
    try {
      const paths = await uploadKycFormFiles(organizationId, form);
      const result = await secureSubmitKyc({
        organizationId,
        businessName: form.businessName.trim() || form.legalName.trim(),
        email: trimmedEmail,
        linkedBankAccountId: form.linkedBankAccountId !== NONE_BANK ? form.linkedBankAccountId : null,
        payoutBankCode: form.bankCode.trim(),
        payoutAccountNumber: form.accountNumber.trim(),
        payoutAccountHolderName: form.accountHolder.trim(),
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
          t(
            "xendit.kyc.verificationSubmitSuccess",
            "Verifikasi bisnis dikirim. Akun Xendit sedang diproses.",
          ),
        );
      } else {
        toast.warning(
          t(
            "xendit.kyc.verificationSubmitPartial",
            "Data tersimpan, tetapi upload ke Xendit gagal. Coba kirim ulang dari daftar akun.",
          ),
        );
      }

      void queryClient.invalidateQueries({ queryKey: ["xendit-settings", organizationId] });
      void queryClient.invalidateQueries({ queryKey: ["bank-accounts", organizationId] });
      onSuccess?.();
    } catch (err) {
      toast.error(getSubAccountEmailErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  if (!active) return null;

  return (
    <div className="space-y-4">
      <XenditKycWizardSteps step={step} />

      {step === 1 ? (
        <div className="space-y-4">
          <XenditKycEntitySelect
            value={form.entitySelect}
            onChange={(entitySelect) => patchForm({ entitySelect })}
          />
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-legal-name`}>
              {isIndividual
                ? t("xendit.kyc.fullName", "Nama lengkap")
                : t("xendit.kyc.companyName", "Nama perusahaan")}
            </Label>
            <Input
              id={`${idPrefix}-legal-name`}
              value={form.legalName}
              onChange={(e) => patchForm({ legalName: e.target.value })}
              required
            />
          </div>
          {isIndividual ? (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-npwp-opt`}>
                {t("xendit.kyc.npwpOptional", "NPWP (opsional)")}
              </Label>
              <Input
                id={`${idPrefix}-npwp-opt`}
                value={form.npwp}
                onChange={(e) => patchForm({ npwp: e.target.value })}
              />
            </div>
          ) : null}
          <XenditKycDirectorSection
            idPrefix={idPrefix}
            entitySelect={form.entitySelect}
            identityNumber={form.identityNumber}
            directorNpwp={form.directorNpwp}
            ktpFile={form.files.ktp}
            directorNpwpFile={form.files.documents.director_npwp ?? null}
            onIdentityNumberChange={(identityNumber) => patchForm({ identityNumber })}
            onDirectorNpwpChange={(directorNpwp) => patchForm({ directorNpwp })}
            onKtpFileChange={(ktp) => patchForm({ files: { ...form.files, ktp } })}
            onDirectorNpwpFileChange={(file) => patchDocumentFile("director_npwp", file)}
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <XenditEntityDocumentsSection
            idPrefix={idPrefix}
            entitySelect={form.entitySelect}
            nib={form.nib}
            npwp={form.npwp}
            nibFile={form.files.documents.nib ?? null}
            npwpFile={form.files.documents.company_npwp ?? null}
            documentFiles={form.files.documents}
            useNewCompanyDeed={form.useNewCompanyDeed}
            onNibChange={(nib) => patchForm({ nib })}
            onNpwpChange={(npwp) => patchForm({ npwp })}
            onNibFileChange={(file) => patchDocumentFile("nib", file)}
            onNpwpFileChange={(file) => patchDocumentFile("company_npwp", file)}
            onDocumentFileChange={patchDocumentFile}
            onUseNewCompanyDeedChange={(useNewCompanyDeed) => patchForm({ useNewCompanyDeed })}
            required
          />
          <XenditServiceAgreementSection
            idPrefix={idPrefix}
            legalName={form.legalName}
            file={form.files.serviceAgreement}
            onFileChange={(serviceAgreement) =>
              patchForm({ files: { ...form.files, serviceAgreement } })
            }
            required
          />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          {!isIndividual ? (
            <>
              <XenditKycBusinessAddressSection
                idPrefix={idPrefix}
                address={form.businessAddress}
                onChange={(businessAddress) => patchForm({ businessAddress })}
              />
              <XenditKycProofOfBusinessSection
                idPrefix={idPrefix}
                website={form.businessWebsite}
                proofFile={form.files.documents.proof_of_business ?? null}
                onWebsiteChange={(businessWebsite) => patchForm({ businessWebsite })}
                onProofFileChange={(file) => patchDocumentFile("proof_of_business", file)}
              />
            </>
          ) : null}
          <div className="border-t border-gray-200 pt-3">
            <p className="mb-2 text-xs font-medium text-gray-700">
              {t("xendit.kyc.payoutSection", "Rekening payout")}
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-business-name`}>
                  {t("xendit.subAccountBusinessName", "Nama bisnis di Xendit")}
                </Label>
                <Input
                  id={`${idPrefix}-business-name`}
                  value={form.businessName}
                  onChange={(e) => patchForm({ businessName: e.target.value })}
                  placeholder={
                    form.legalName ||
                    t("xendit.subAccountBusinessNamePlaceholder", "PT Contoh Indonesia")
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-email`}>{t("xendit.subAccountEmail", "Email bisnis")}</Label>
                <Input
                  id={`${idPrefix}-email`}
                  type="email"
                  value={form.email}
                  onChange={(e) => patchForm({ email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("xendit.linkErpBankAccount", "Gunakan rekening yang sudah ada")}</Label>
                <Select
                  value={form.linkedBankAccountId}
                  onValueChange={applyBankAccount}
                  disabled={banksLoading || activeBanks.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("xendit.selectBankAccount", "Pilih rekening")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_BANK}>
                      {t("xendit.manualBankEntry", "Isi rekening baru")}
                    </SelectItem>
                    {activeBanks.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.name}
                        {bank.bank_name ? ` · ${bank.bank_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "xendit.linkErpBankAccountHint",
                    "Opsional. Pilih rekening dari menu Keuangan agar kolom bank di bawah terisi otomatis.",
                  )}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t("xendit.bank", "Bank")}</Label>
                  <Select value={form.bankCode || undefined} onValueChange={(bankCode) => patchForm({ bankCode })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("xendit.selectBank", "Pilih bank")} />
                    </SelectTrigger>
                    <SelectContent>
                      {XENDIT_DISBURSEMENT_BANKS.map((bank) => (
                        <SelectItem key={bank.code} value={bank.code}>
                          {bank.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("xendit.accountNumber", "Nomor rekening")}</Label>
                  <Input
                    value={form.accountNumber}
                    onChange={(e) => patchForm({ accountNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("xendit.accountHolder", "Nama pemilik rekening")}</Label>
                  <Input
                    value={form.accountHolder}
                    onChange={(e) => patchForm({ accountHolder: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
        {showCancel && onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {t("common.cancel", "Batal")}
          </Button>
        ) : null}
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
              : t("xendit.kyc.submitVerification", "Kirim verifikasi bisnis")}
          </Button>
        )}
      </div>
    </div>
  );
}
