import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { defaultQrPrintCopy } from "../lib/qrPrintDefaults";
import type { SynckerjaOrderQrSettingsDraft } from "../lib/qrPrintTypes";
import { QrTemplatePicker } from "./QrTemplatePicker";

type Props = {
  draft: SynckerjaOrderQrSettingsDraft;
  brandImageUrl: string | null;
  onChange: (patch: Partial<SynckerjaOrderQrSettingsDraft>) => void;
  disabled?: boolean;
};

export function QrCustomizePanel({ draft, brandImageUrl, onChange, disabled }: Props) {
  const { t, language } = useAppTranslation();
  const locale = language === "en" ? "en" : "id";
  const defaults = defaultQrPrintCopy(locale);

  return (
    <div className="space-y-5 print:hidden">
      <div>
        <Label className="mb-2 block text-xs font-medium text-muted-foreground">
          {t("synckerjaOrder.qr.customize.template", "Template")}
        </Label>
        <QrTemplatePicker
          value={draft.template_id}
          onChange={(template_id) => onChange({ template_id })}
          disabled={disabled}
        />
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground">
          {t("synckerjaOrder.qr.customize.text", "Card text")}
        </Label>
        <div className="space-y-2">
          <Input
            value={draft.headline_text ?? ""}
            placeholder={defaults.headline}
            disabled={disabled}
            onChange={(e) => onChange({ headline_text: e.target.value || null })}
          />
          <Input
            value={draft.subheadline_text ?? ""}
            placeholder={defaults.subheadline}
            disabled={disabled}
            onChange={(e) => onChange({ subheadline_text: e.target.value || null })}
          />
          <Input
            value={draft.footer_text ?? ""}
            placeholder={defaults.footer}
            disabled={disabled}
            onChange={(e) => onChange({ footer_text: e.target.value || null })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="qr-accent-color" className="text-xs font-medium text-muted-foreground">
          {t("synckerjaOrder.qr.customize.accent", "Accent color")}
        </Label>
        <div className="flex items-center gap-2">
          <input
            id="qr-accent-color"
            type="color"
            value={draft.accent_color}
            disabled={disabled}
            onChange={(e) => onChange({ accent_color: e.target.value })}
            className="h-9 w-12 cursor-pointer rounded border border-border bg-card"
          />
          <Input
            value={draft.accent_color}
            disabled={disabled}
            className="font-mono text-sm"
            onChange={(e) => {
              const v = e.target.value.trim();
              if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange({ accent_color: v });
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {t("synckerjaOrder.qr.customize.paper", "Paper size")}
        </Label>
        <div className="flex gap-2">
          {(["a4", "a5"] as const).map((size) => (
            <button
              key={size}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ paper_size: size })}
              className={
                draft.paper_size === size
                  ? "rounded-md border border-primary bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary"
                  : "rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted/50"
              }
            >
              {size.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
        <Label className="text-xs font-medium text-muted-foreground">
          {t("synckerjaOrder.qr.customize.display", "Display options")}
        </Label>
        {(
          [
            ["show_logo", "synckerjaOrder.qr.customize.showLogo", "Show logo"],
            ["show_outlet_name", "synckerjaOrder.qr.customize.showOutlet", "Show outlet name"],
            ["show_table_name", "synckerjaOrder.qr.customize.showTable", "Show table name"],
            ["show_scan_instruction", "synckerjaOrder.qr.customize.showInstruction", "Show scan instructions"],
            ["show_url", "synckerjaOrder.qr.customize.showUrl", "Show URL on card"],
          ] as const
        ).map(([key, labelKey, fallback]) => (
          <label key={key} className="flex items-center justify-between gap-2 text-sm">
            <span>{t(labelKey, fallback)}</span>
            <Switch
              checked={draft[key]}
              disabled={disabled}
              onCheckedChange={(v) => onChange({ [key]: v === true })}
            />
          </label>
        ))}
        {draft.show_logo && !brandImageUrl ? (
          <p className="text-xs text-amber-700">
            {t(
              "synckerjaOrder.qr.customize.logoMissing",
              "Upload a hero image on the Profile tab, then Save and continue.",
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}
