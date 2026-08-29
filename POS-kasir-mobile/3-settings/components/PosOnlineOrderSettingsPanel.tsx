import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_SETTINGS_I18N } from "../lib/posSettingsCopy";
import type { PosDeviceSettings } from "../lib/posSettingsStorage";

type Props = {
  settings: PosDeviceSettings;
  soundLabel: string;
  onChange: (next: PosDeviceSettings) => void;
  onOpenSoundPicker: () => void;
};

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-1 pt-5 text-xs font-medium text-slate-400">{children}</p>;
}

function SettingsRow({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b border-slate-100 px-4 py-3.5",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-shrink-0 items-center self-center">{children}</div>
    </div>
  );
}

export function PosOnlineOrderSettingsPanel({
  settings,
  soundLabel,
  onChange,
  onOpenSoundPicker,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="pb-6">
      <SectionLabel>
        {t(POS_SETTINGS_I18N.receiveSection, "Online Order Reception")}
      </SectionLabel>
      <SettingsRow
        title={t(POS_SETTINGS_I18N.deviceOnlineOrders, "Device Online Orders")}
        description={t(
          POS_SETTINGS_I18N.deviceOnlineOrdersHint,
          "Turn on this setting to receive online orders and notifications from your online channels",
        )}
      >
        <Switch
          checked={settings.onlineOrdersEnabled}
          onCheckedChange={(checked) =>
            onChange({ ...settings, onlineOrdersEnabled: checked })
          }
        />
      </SettingsRow>

      <SectionLabel>
        {t(POS_SETTINGS_I18N.notifSection, "Online Order Notifications")}
      </SectionLabel>
      <SettingsRow title={t(POS_SETTINGS_I18N.sound, "Sound")}>
        <Switch
          checked={settings.notificationSoundEnabled}
          onCheckedChange={(checked) =>
            onChange({ ...settings, notificationSoundEnabled: checked })
          }
        />
      </SettingsRow>
      <button
        type="button"
        onClick={onOpenSoundPicker}
        className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
      >
        <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">
          {t(POS_SETTINGS_I18N.notificationSound, "Notification Sound")}
        </span>
        <span className="flex items-center gap-1 text-sm font-medium text-primary">
          {soundLabel}
          <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
        </span>
      </button>
    </div>
  );
}
