import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { ReceiptDraft } from "../types";
import { OutletLogoUploader } from "./OutletLogoUploader";

type ReceiptCustomizationFormProps = {
  draft: ReceiptDraft;
  logoPreviewUrl: string | null;
  disabled?: boolean;
  onChange: (patch: Partial<ReceiptDraft>) => void;
  onLogoFile: (file: File | null) => void;
};

export function ReceiptCustomizationForm({
  draft,
  logoPreviewUrl,
  disabled,
  onChange,
  onLogoFile,
}: ReceiptCustomizationFormProps) {
  const { t } = useAppTranslation();

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("receiptSettings.section.outletLogo", "Outlet logo")}
        </p>
        <OutletLogoUploader
          previewUrl={logoPreviewUrl}
          outletName={draft.outletName}
          disabled={disabled}
          onFile={onLogoFile}
        />
      </section>

      <section className="space-y-4">
        <p className="border-b pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("receiptSettings.section.outletInfo", "Receipt info")}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="receipt-outlet-name">{t("receiptSettings.outletName", "Outlet Name")}</Label>
          <Input
            id="receipt-outlet-name"
            value={draft.outletName}
            disabled={disabled}
            onChange={(event) => onChange({ outletName: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="receipt-business-name">{t("receiptSettings.businessName", "Business Name")}</Label>
          <Input
            id="receipt-business-name"
            value={draft.businessName}
            disabled={disabled}
            onChange={(event) => onChange({ businessName: event.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="receipt-city">{t("receiptSettings.city", "City")}</Label>
            <Input
              id="receipt-city"
              value={draft.city}
              disabled={disabled}
              onChange={(event) => onChange({ city: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receipt-province">{t("receiptSettings.province", "Province")}</Label>
            <Input
              id="receipt-province"
              value={draft.province}
              disabled={disabled}
              onChange={(event) => onChange({ province: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receipt-postal">{t("receiptSettings.postalCode", "Postal Code")}</Label>
            <Input
              id="receipt-postal"
              value={draft.postalCode}
              disabled={disabled}
              onChange={(event) => onChange({ postalCode: event.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="receipt-phone">{t("receiptSettings.phone", "Phone Number")}</Label>
          <div className="flex overflow-hidden rounded-md border border-input">
            <span className="flex items-center gap-1 border-r bg-muted px-3 text-sm text-muted-foreground">
              <span aria-hidden>🇮🇩</span>
              +62
            </span>
            <Input
              id="receipt-phone"
              className="border-0 shadow-none focus-visible:ring-0"
              value={draft.phoneNational}
              disabled={disabled}
              onChange={(event) => onChange({ phoneNational: event.target.value.replace(/\D/g, "") })}
            />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("receiptSettings.section.notes", "Notes")}
        </p>
        <Textarea
          value={draft.footerNotes}
          disabled={disabled}
          rows={5}
          placeholder={t("receiptSettings.notesPlaceholder", "Notes")}
          onChange={(event) => onChange({ footerNotes: event.target.value })}
        />
      </section>
    </div>
  );
}
