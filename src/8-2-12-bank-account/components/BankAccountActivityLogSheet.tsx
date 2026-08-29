import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useBankAccountActivityLog } from "../hooks/useBankAccountActivityLog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BankAccountActivityLogSheet({ open, onOpenChange }: Props) {
  const { t } = useAppTranslation();
  const { logs, isLoading } = useBankAccountActivityLog(open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {t("settings.bankAccount.activityLog", "Activity Log")}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("settings.bankAccount.activityEmpty", "No activity yet")}
            </p>
          ) : (
            <ul className="space-y-3">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-md border border-border bg-muted/20 px-3 py-2"
                >
                  <p className="text-sm font-medium text-foreground">{log.summary}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {log.action.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
