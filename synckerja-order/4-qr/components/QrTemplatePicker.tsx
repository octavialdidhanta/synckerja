import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { templateLabelKey } from "../lib/qrPrintDefaults";
import { QR_PRINT_TEMPLATES, type QrPrintTemplateId } from "../lib/qrPrintTypes";

type Props = {
  value: QrPrintTemplateId;
  onChange: (value: QrPrintTemplateId) => void;
  disabled?: boolean;
};

export function QrTemplatePicker({ value, onChange, disabled }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="grid grid-cols-3 gap-2">
      {QR_PRINT_TEMPLATES.map((templateId) => {
        const active = value === templateId;
        return (
          <button
            key={templateId}
            type="button"
            disabled={disabled}
            onClick={() => onChange(templateId)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              active
                ? "border-primary bg-primary/5 font-medium text-primary"
                : "border-border bg-card text-foreground hover:bg-muted/50",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            {t(templateLabelKey(templateId), templateId)}
          </button>
        );
      })}
    </div>
  );
}
