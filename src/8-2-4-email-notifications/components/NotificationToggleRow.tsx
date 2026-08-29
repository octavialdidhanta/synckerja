import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type NotificationToggleRowProps = {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  footnote?: string;
};

export function NotificationToggleRow({
  id,
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  footnote,
}: NotificationToggleRowProps) {
  const { t } = useAppTranslation();

  return (
    <div className="space-y-1 border-b border-border/60 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={id} className="text-sm font-medium text-foreground">
            {title}
          </Label>
          <p className="text-sm text-muted-foreground">{description}</p>
          {footnote ? <p className="text-xs italic text-muted-foreground">{footnote}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <span className="text-sm text-muted-foreground">
            {checked
              ? t("settings.emailNotifications.on", "ON")
              : t("settings.emailNotifications.off", "OFF")}
          </span>
          <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}
