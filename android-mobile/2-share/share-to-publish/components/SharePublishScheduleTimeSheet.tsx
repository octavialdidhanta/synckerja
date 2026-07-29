import { Loader2 } from "lucide-react";
import { Button } from "@/mobile-app/components/ui/button";
import { Input } from "@/mobile-app/components/ui/input";
import { Label } from "@/mobile-app/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/mobile-app/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatDate } from "@/shared/utils/dateFormatter";

const QUICK_TIMES = ["12:00", "15:00", "18:00", "20:00"] as const;

const TIME_HHMM = /^\d{2}:\d{2}$/;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postDateYmd: string | null | undefined;
  timeWib: string;
  onTimeChange: (timeWib: string) => void;
  busy?: boolean;
  onConfirm: () => void;
};

export function SharePublishScheduleTimeSheet({
  open,
  onOpenChange,
  postDateYmd,
  timeWib,
  onTimeChange,
  busy = false,
  onConfirm,
}: Props) {
  const { t } = useAppTranslation();
  const timeValid = TIME_HHMM.test(timeWib.slice(0, 5));
  const canConfirm = Boolean(postDateYmd) && timeValid && !busy;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] overflow-y-auto rounded-t-2xl px-4 pb-6 pt-5"
      >
        <SheetHeader className="text-left">
          <SheetTitle>
            {t("share.publish.scheduleTime.title", "Schedule post")}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>{t("share.publish.scheduleTime.dateLabel", "Post date")}</Label>
            <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
              {postDateYmd ? formatDate(postDateYmd) : "—"}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="share-schedule-time">
              {t("share.publish.scheduleTime.timeLabel", "Time (WIB)")}
            </Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_TIMES.map((qt) => {
                const active = timeWib.slice(0, 5) === qt;
                return (
                  <Button
                    key={qt}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className={cn(
                      "h-9 min-w-[4.5rem]",
                      active && "border-primary ring-1 ring-primary/30",
                    )}
                    onClick={() => onTimeChange(qt)}
                  >
                    {qt}
                  </Button>
                );
              })}
            </div>
            <Input
              id="share-schedule-time"
              type="time"
              value={timeWib.slice(0, 5)}
              onChange={(e) => onTimeChange(e.target.value.slice(0, 5))}
              disabled={busy}
              className="mt-1"
            />
          </div>
        </div>

        <SheetFooter className="mt-5 gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full"
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("share.publish.scheduleTime.confirm", "Schedule")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t("share.publish.scheduleTime.cancel", "Cancel")}
          </Button>
        </SheetFooter>
        <div className="h-6 shrink-0 safe-area-bottom" aria-hidden />
      </SheetContent>
    </Sheet>
  );
}
