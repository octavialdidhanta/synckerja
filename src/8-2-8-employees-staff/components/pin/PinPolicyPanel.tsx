import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosPinAccessSettings } from "../../lib/posStaffTypes";

type Props = {
  settings: PosPinAccessSettings;
  onChange: (patch: Partial<Omit<PosPinAccessSettings, "organization_id">>) => void;
  disabled?: boolean;
};

export function PinPolicyPanel({ settings, onChange, disabled }: Props) {
  const { t } = useAppTranslation();

  const rows: Array<{
    key: keyof Omit<PosPinAccessSettings, "organization_id">;
    labelKey: string;
    fallback: string;
  }> = [
    {
      key: "require_pin_for_void",
      labelKey: "employeesStaff.pinPolicy.void",
      fallback: "Require PIN to void items",
    },
    {
      key: "require_pin_for_refund",
      labelKey: "employeesStaff.pinPolicy.refund",
      fallback: "Require PIN for refunds",
    },
    {
      key: "require_pin_for_discount",
      labelKey: "employeesStaff.pinPolicy.discount",
      fallback: "Require PIN for discounts",
    },
    {
      key: "require_pin_for_cash_drawer",
      labelKey: "employeesStaff.pinPolicy.cashDrawer",
      fallback: "Require PIN to open cash drawer",
    },
  ];

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold">
        {t("employeesStaff.pinPolicy.title", "PIN policy (light)")}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {t(
          "employeesStaff.pinPolicy.hint",
          "These flags are stored for future POS enforcement. PIN verification at cashier login is not enabled in v1.",
        )}
      </p>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <span className="text-sm">{t(row.labelKey, row.fallback)}</span>
            <Switch
              checked={settings[row.key]}
              disabled={disabled}
              onCheckedChange={(v) => onChange({ [row.key]: v })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
