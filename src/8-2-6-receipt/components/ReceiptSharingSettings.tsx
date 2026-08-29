import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { ReceiptDraft } from "../types";

type ReceiptSharingSettingsProps = {
  draft: ReceiptDraft;
  disabled?: boolean;
  onChange: (patch: Partial<ReceiptDraft>) => void;
};

export function ReceiptSharingSettings({ draft, disabled, onChange }: ReceiptSharingSettingsProps) {
  const { t } = useAppTranslation();

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <p className="border-b pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("receiptSettings.section.sharing", "Digital receipt")}
        </p>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="receipt-share-email">{t("receiptSettings.shareEmail", "Offer receipt via email")}</Label>
          <Switch
            id="receipt-share-email"
            checked={draft.shareViaEmail}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ shareViaEmail: checked })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="receipt-share-sms">{t("receiptSettings.shareSms", "Offer receipt via SMS")}</Label>
          <Switch
            id="receipt-share-sms"
            checked={draft.shareViaSms}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ shareViaSms: checked })}
          />
        </div>
      </section>
      <section className="space-y-4">
        <p className="border-b pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("receiptSettings.section.social", "Social links")}
        </p>
        {(
          [
            ["websiteUrl", "receiptSettings.website", "Website"],
            ["twitterUrl", "receiptSettings.twitter", "Twitter / X"],
            ["facebookUrl", "receiptSettings.facebook", "Facebook"],
            ["instagramUrl", "receiptSettings.instagram", "Instagram"],
            ["tiktokUrl", "receiptSettings.tiktok", "TikTok"],
            ["whatsappUrl", "receiptSettings.whatsapp", "WhatsApp"],
          ] as const
        ).map(([key, i18nKey, fallback]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`receipt-${key}`}>{t(i18nKey, fallback)}</Label>
            <Input
              id={`receipt-${key}`}
              value={draft[key]}
              disabled={disabled}
              placeholder="https://"
              onChange={(event) => onChange({ [key]: event.target.value })}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
