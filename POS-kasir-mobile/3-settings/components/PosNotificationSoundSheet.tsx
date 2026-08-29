import { Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
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
      <SheetContent side="right" className="w-80 p-0 sm:max-w-sm">
        <SheetHeader className="border-b px-4 py-4 text-left">
          <SheetTitle>
            {t(POS_SETTINGS_I18N.soundSheetTitle, "Notification Sound")}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col py-1">
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
                  "flex items-center gap-3 px-4 py-3.5 text-left text-sm transition-colors hover:bg-slate-50",
                  selected && "bg-primary/5 font-semibold text-primary",
                )}
              >
                <span className="min-w-0 flex-1">
                  {t(opt.labelKey, opt.fallback)}
                </span>
                {selected ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
