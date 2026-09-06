import { ArrowLeft, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import {
  POS_NOTIFICATION_SOUND_OPTIONS,
  POS_SETTINGS_I18N,
  type PosNotificationSoundId,
} from "../lib/posSettingsCopy";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: PosNotificationSoundId;
  onSelect: (id: PosNotificationSoundId) => void;
};

export function PosNotificationSoundSheet({
  open,
  onOpenChange,
  value,
  onSelect,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full flex-col gap-0 border-l border-slate-200 bg-slate-100 p-0 sm:max-w-md",
          "[&>button]:hidden",
        )}
      >
        <div
          className="flex-shrink-0 border-b border-slate-200 bg-white"
          style={{
            paddingTop:
              "max(0px, env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))",
          }}
        >
          <SheetHeader
            className={cn(POS_PANEL.header, "flex-row space-y-0 border-b-0 text-left")}
          >
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={POS_PANEL.headerBack}
              aria-label={t(POS_SETTINGS_I18N.back, "Back")}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <SheetTitle className={cn(POS_PANEL.headerTitle, "leading-none")}>
              {t(POS_SETTINGS_I18N.soundSheetTitle, "Notification Sound")}
            </SheetTitle>
          </SheetHeader>
        </div>

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className={POS_PANEL.body}>
            <div className={POS_PANEL.card}>
              {POS_NOTIFICATION_SOUND_OPTIONS.map((opt) => {
                const selected = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSelect(opt.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      POS_PANEL.row,
                      "text-left transition-colors hover:bg-slate-50",
                    )}
                  >
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      {selected ? (
                        <Check className="h-5 w-5 text-primary" aria-hidden />
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        POS_PANEL.rowLabel,
                        selected && "font-medium text-slate-900",
                      )}
                    >
                      {t(opt.labelKey, opt.fallback)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
