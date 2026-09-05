import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_SETTINGS_I18N } from "../../../lib/posSettingsCopy";
import { POS_TICKET_COPIES_MAX, POS_TICKET_COPIES_MIN } from "../../../lib/printer/posPrinterTypes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: number;
  onSave: (value: number) => void;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

export function PosTicketCopiesSheet({ open, onOpenChange, value, onSave }: Props) {
  const { t } = useAppTranslation();
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (open) setDraft(String(value));
  }, [open, value]);

  const commit = () => {
    const n = Number.parseInt(draft || "1", 10);
    const clamped = Number.isFinite(n)
      ? Math.min(POS_TICKET_COPIES_MAX, Math.max(POS_TICKET_COPIES_MIN, n))
      : POS_TICKET_COPIES_MIN;
    onSave(clamped);
    onOpenChange(false);
  };

  const onKey = (key: (typeof KEYS)[number]) => {
    if (key === "") return;
    if (key === "back") {
      setDraft((d) => d.slice(0, -1));
      return;
    }
    setDraft((d) => {
      const next = (d === "0" ? key : d + key).slice(0, 2);
      return next;
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-xl p-0 sm:max-w-lg"
        style={{
          paddingBottom:
            "max(1rem, env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px), var(--footer-bottom-inset, 0px))",
        }}
      >
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle className="text-base">
            {t(POS_SETTINGS_I18N.printerTicketCopies, "Number of Order Tickets Printed")}
          </SheetTitle>
        </SheetHeader>
        <div className="px-4 pt-4 pb-2">
          <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl font-semibold tabular-nums text-slate-900">
            {draft || "0"}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((key, idx) => {
              if (key === "") return <div key={`empty-${idx}`} />;
              if (key === "back") {
                return (
                  <Button
                    key="back"
                    type="button"
                    variant="secondary"
                    className="h-12"
                    onClick={() => onKey("back")}
                  >
                    ⌫
                  </Button>
                );
              }
              return (
                <Button
                  key={key}
                  type="button"
                  variant="secondary"
                  className={cn("h-12 text-lg")}
                  onClick={() => onKey(key)}
                >
                  {key}
                </Button>
              );
            })}
            <Button
              type="button"
              className="col-span-3 h-12 bg-primary text-primary-foreground hover:bg-brand-blue-deep"
              onClick={commit}
            >
              {t(POS_SETTINGS_I18N.printerCopiesDone, "Done")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
