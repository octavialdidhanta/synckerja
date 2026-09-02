import { Label } from "@/shared/components/ui/label";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { SynckerjaOrderOrgSettings } from "@/synckerja-order/shared/lib/orderTypes";

type Props = {
  settings: SynckerjaOrderOrgSettings;
  onChange: (patch: Partial<SynckerjaOrderOrgSettings>) => void;
};

export function SynckerjaOrderTermsPanel({ settings, onChange }: Props) {
  const { t } = useAppTranslation();
  return (
    <div className="space-y-1.5 p-4">
      <Label>{t("synckerjaOrder.terms.label", "Guest terms")}</Label>
      <textarea
        className="min-h-[280px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={settings.terms_html ?? ""}
        onChange={(e) => onChange({ terms_html: e.target.value })}
        placeholder={t(
          "synckerjaOrder.terms.placeholder",
          "Shown on the public storefront.",
        )}
      />
    </div>
  );
}
