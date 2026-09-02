import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { SynckerjaOrderOrgSettings } from "@/synckerja-order/shared/lib/orderTypes";

type Props = {
  settings: SynckerjaOrderOrgSettings;
  onChange: (patch: Partial<SynckerjaOrderOrgSettings>) => void;
};

export function SynckerjaOrderContactPanel({ settings, onChange }: Props) {
  const { t } = useAppTranslation();
  return (
    <div className="grid content-start gap-4 p-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>{t("synckerjaOrder.contact.phone", "Phone")}</Label>
        <Input
          value={settings.contact_phone ?? ""}
          onChange={(e) => onChange({ contact_phone: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("synckerjaOrder.contact.email", "Email")}</Label>
        <Input
          value={settings.contact_email ?? ""}
          onChange={(e) => onChange({ contact_email: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("synckerjaOrder.contact.whatsapp", "WhatsApp")}</Label>
        <Input
          value={settings.contact_whatsapp ?? ""}
          onChange={(e) => onChange({ contact_whatsapp: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("synckerjaOrder.contact.instagram", "Instagram")}</Label>
        <Input
          value={settings.contact_instagram ?? ""}
          onChange={(e) => onChange({ contact_instagram: e.target.value })}
        />
      </div>
    </div>
  );
}
