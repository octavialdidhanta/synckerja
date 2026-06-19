import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Switch } from "@/shared/components/ui/switch";
import { Button } from "@/shared/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { FormFieldLabel } from "@/shared/components/FormInfoHint";
import { useSecureXenditActions } from "@/xendit/hooks/useSecureXenditActions";
import {
  useInvalidatePayrollEscrowSettings,
  usePayrollEscrowSettings,
} from "../escrow/hooks/usePayrollEscrowSettings";
import { PayrollEscrowSubAccountSelect } from "./components/PayrollEscrowSubAccountSelect";

export function PayrollEscrowSettingsSection() {
  const { t } = useAppTranslation();
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id ?? null;
  const { data: settings, isLoading } = usePayrollEscrowSettings(organizationId);
  const invalidate = useInvalidatePayrollEscrowSettings();
  const { secureUpdatePayrollEscrowSettings } = useSecureXenditActions();

  const [enabled, setEnabled] = useState(false);
  const [escrowSubAccountId, setEscrowSubAccountId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.is_enabled);
    setEscrowSubAccountId(settings.escrow_sub_account_row_id);
    setDirty(false);
  }, [settings?.organization_id, settings?.is_enabled, settings?.escrow_sub_account_row_id]);

  if (!organizationId || isLoading) return null;

  const escrowInfo = (
    <div className="space-y-2">
      <p>
        {t(
          "payroll.escrow.description",
          "Setelah payroll paid via Xendit, PPh21 dan BPJS karyawan otomatis dipindah ke sub-account escrow.",
        )}
      </p>
      <p>
        {t(
          "payroll.escrow.requireXenditHint",
          "Mark as Paid manual dinonaktifkan saat escrow aktif.",
        )}
      </p>
    </div>
  );

  const handleSave = async () => {
    if (enabled && !escrowSubAccountId) {
      toast.error(
        t("payroll.escrow.subAccountRequired", "Pilih sub-account escrow sebelum mengaktifkan."),
      );
      return;
    }
    setSaving(true);
    try {
      await secureUpdatePayrollEscrowSettings(organizationId, {
        is_enabled: enabled,
        escrow_sub_account_row_id: escrowSubAccountId,
        require_xendit_disburse: true,
      });
      invalidate(organizationId);
      setDirty(false);
      toast.success(t("payroll.escrow.settingsSaved", "Pengaturan escrow disimpan."));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("payroll.escrow.settingsSaveFailed", "Gagal menyimpan"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-border space-y-2.5 border-t px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <FormFieldLabel
          label={t("payroll.escrow.titleShort", "Escrow PPh/BPJS")}
          labelClassName="text-xs font-medium"
          info={escrowInfo}
          infoAriaLabel={t("payroll.escrow.titleShort", "Escrow PPh/BPJS")}
        />
        <Switch
          checked={enabled}
          onCheckedChange={(next) => {
            setEnabled(next);
            setDirty(true);
          }}
          disabled={saving}
          aria-label={t("payroll.escrow.titleShort", "Escrow PPh/BPJS")}
        />
      </div>

      {enabled ? (
        <div className="space-y-1.5">
          <FormFieldLabel
            label={t("payroll.escrow.subAccountLabelShort", "Akun escrow")}
            labelClassName="text-muted-foreground text-[11px] font-normal"
            info={t(
              "payroll.escrow.subAccountInfo",
              "Pilih sub-account Xendit non-utama. Buat baru di Pengaturan Xendit jika belum ada.",
            )}
            infoAriaLabel={t("payroll.escrow.subAccountLabelShort", "Akun escrow")}
          />
          <PayrollEscrowSubAccountSelect
            organizationId={organizationId}
            value={escrowSubAccountId}
            onChange={(next) => {
              setEscrowSubAccountId(next);
              setDirty(true);
            }}
            disabled={saving}
          />
          <Link
            to="/xendit/connect"
            className="text-primary inline-block text-[11px] hover:underline"
          >
            {t("payroll.escrow.createSubAccountLinkShort", "+ Sub-account baru")}
          </Link>
        </div>
      ) : null}

      {dirty ? (
        <Button
          type="button"
          size="sm"
          className="h-8 w-full text-xs"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {t("payroll.escrow.saveSettingsShort", "Simpan")}
        </Button>
      ) : null}
    </div>
  );
}
