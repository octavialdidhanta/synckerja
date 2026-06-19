import { useEffect, useState } from "react";
import { Switch } from "@/shared/components/ui/switch";
import { Button } from "@/shared/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { FormFieldLabel } from "@/shared/components/FormInfoHint";
import { useSecureXenditActions } from "@/xendit/hooks/useSecureXenditActions";
import {
  useInvalidatePayrollExpenseSettings,
  usePayrollExpenseSettings,
} from "../hooks/usePayrollExpenseSettings";

export function PayrollExpenseSettingsSection() {
  const { t } = useAppTranslation();
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id ?? null;
  const { data: settings, isLoading } = usePayrollExpenseSettings(organizationId);
  const invalidate = useInvalidatePayrollExpenseSettings();
  const { secureUpdatePayrollExpenseSettings } = useSecureXenditActions();

  const [enabled, setEnabled] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.is_enabled);
    setDirty(false);
  }, [settings?.organization_id, settings?.is_enabled]);

  if (!organizationId || isLoading) return null;

  const expenseInfo = (
    <div className="space-y-2">
      <p>
        {t(
          "payroll.expense.description",
          "Setelah payroll paid via Xendit, total THP karyawan otomatis dipost sebagai satu baris expense di Expense Dashboard.",
        )}
      </p>
      <p>
        {t(
          "payroll.expense.classificationHint",
          "Menggunakan tipe Fixed Expenses dan kategori Gaji Karyawan Tetap (buat di Pengaturan Expense jika belum ada).",
        )}
      </p>
    </div>
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await secureUpdatePayrollExpenseSettings(organizationId, { is_enabled: enabled });
      invalidate(organizationId);
      setDirty(false);
      toast.success(t("payroll.expense.settingsSaved", "Pengaturan post THP disimpan."));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("payroll.expense.settingsSaveFailed", "Gagal menyimpan"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-border space-y-2.5 border-t px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <FormFieldLabel
          label={t("payroll.expense.titleShort", "Post THP ke Expense")}
          labelClassName="text-xs font-medium"
          info={expenseInfo}
          infoAriaLabel={t("payroll.expense.titleShort", "Post THP ke Expense")}
        />
        <Switch
          checked={enabled}
          onCheckedChange={(next) => {
            setEnabled(next);
            setDirty(true);
          }}
          disabled={saving}
          aria-label={t("payroll.expense.titleShort", "Post THP ke Expense")}
        />
      </div>

      {dirty ? (
        <Button
          type="button"
          size="sm"
          className="h-8 w-full text-xs"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {t("payroll.expense.saveSettingsShort", "Simpan")}
        </Button>
      ) : null}
    </div>
  );
}
