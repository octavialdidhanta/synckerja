import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/mobile-app/components/ui/sheet";
import { Separator } from "@/mobile-app/components/ui/separator";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  MOBILE_LEADS_BOTTOM_SHEET_FOOTER_SPACER_CLASS,
  MOBILE_LEADS_BOTTOM_SHEET_LIST_CLASS,
} from "@/mobile/4-leads-management/report/mobileLeadsReportLayout";

const SELECT_AFTER_CLOSE_MS = 280;

type AssigneeOption = {
  id: string;
  full_name: string;
  email: string;
};

type LeadAssigneePickerSheetProps = {
  value: string;
  employees: AssigneeOption[];
  onChange: (employeeId: string) => void;
  /** Raised z-index when opened inside lead detail dialog. */
  nestedInModal?: boolean;
};

export function LeadAssigneePickerSheet({
  value,
  employees,
  onChange,
  nestedInModal = true,
}: LeadAssigneePickerSheetProps) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () => [
      {
        value: "",
        label: t("leadsManagement.card.unassigned", "Unassigned"),
      },
      ...employees.map((emp) => ({
        value: emp.id,
        label: emp.full_name || emp.email,
      })),
    ],
    [employees, t],
  );

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label ??
    t("leadsManagement.filter.allAssignees", "Select assignee");

  const elevatedClass = nestedInModal ? "z-[60]" : undefined;

  const handleSelect = (employeeId: string) => {
    if (employeeId === value) {
      setOpen(false);
      return;
    }
    setOpen(false);
    window.setTimeout(() => onChange(employeeId), SELECT_AFTER_CLOSE_MS);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full justify-between bg-background text-sm font-normal"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="truncate text-foreground">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          overlayClassName={elevatedClass}
          className={cn(
            "flex max-h-[85vh] flex-col gap-0 rounded-t-2xl p-0 [&>button]:hidden",
            elevatedClass,
          )}
        >
          <div className="flex shrink-0 justify-center pb-1 pt-2">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
          </div>
          <SheetHeader className="flex shrink-0 flex-col gap-0 bg-primary px-4 py-3 text-primary-foreground">
            <SheetTitle className="text-center text-base font-semibold text-primary-foreground">
              {t("leadsManagement.filter.assignee", "Assignee")}
            </SheetTitle>
          </SheetHeader>
          <Separator className="shrink-0 bg-primary/20" />
          <div className={MOBILE_LEADS_BOTTOM_SHEET_LIST_CLASS}>
            <div className="space-y-1">
              {options.map((opt) => {
                const isActive = opt.value === value;
                return (
                  <button
                    key={opt.value || "unassigned"}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      isActive
                        ? "border-primary/30 bg-primary/10 font-medium text-primary"
                        : "border-border bg-card hover:bg-muted/50",
                    )}
                  >
                    <span className="min-w-0 truncate">{opt.label}</span>
                    {isActive ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className={MOBILE_LEADS_BOTTOM_SHEET_FOOTER_SPACER_CLASS} aria-hidden />
        </SheetContent>
      </Sheet>
    </>
  );
}
