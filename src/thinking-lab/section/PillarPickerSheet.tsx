import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { groupContentPillars, type ContentPillarFunnel, type LabContentPillar } from "@/thinking-lab/execution/pillars";
import { pillarLessSuitable } from "@/thinking-lab/execution/script";

const FUNNEL_LABEL: Record<ContentPillarFunnel, string> = {
  top: "Awareness",
  middle: "Consideration",
  bottom: "Conversion",
};

export function PillarPickerSheet({
  open,
  pillars,
  masterSells,
  pending = false,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pillars: LabContentPillar[];
  masterSells: true | false | "unresolved" | "unknown";
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (pillars: LabContentPillar[]) => void;
}) {
  const { t } = useAppTranslation();
  const [selected, setSelected] = useState<string[]>([]);
  const groups = groupContentPillars(pillars);
  const chosen = pillars.filter((pillar) => selected.includes(pillar.id));

  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => (checked ? [...current, id] : current.filter((item) => item !== id)));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("thinkingLab.execution.chooseTitle", "Choose a content pillar")}</SheetTitle>
          <SheetDescription>
            {t("thinkingLab.execution.chooseHint", "Every selected pillar becomes its own Execution and writes a Script VO.")}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("thinkingLab.execution.noPillars", "This organization has no active content pillars yet.")}
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.funnel} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{FUNNEL_LABEL[group.funnel]}</h3>
                <ul className="space-y-2">
                  {group.items.map((pillar) => {
                    const checked = selected.includes(pillar.id);
                    const unsuitable = pillarLessSuitable(pillar.name, masterSells);
                    return (
                      <li key={pillar.id}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-3 py-2">
                          <Checkbox
                            checked={checked}
                            disabled={pending}
                            onCheckedChange={(value) => toggle(pillar.id, value === true)}
                            aria-label={pillar.name}
                          />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{pillar.name}</span>
                              <span className="text-xs text-muted-foreground">{FUNNEL_LABEL[pillar.funnel]}</span>
                            </span>
                            {pillar.category ? <span className="mt-0.5 block text-xs text-muted-foreground">{pillar.category}</span> : null}
                            {unsuitable ? (
                              <span className="mt-1 block text-xs text-amber-700">
                                {t("thinkingLab.execution.lessSuitable", "Marked as a weak fit for this Idea.")}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" disabled={pending || chosen.length === 0} onClick={() => onConfirm(chosen)}>
            {t("thinkingLab.execution.create", "Create Execution for {{count}} pillar", { count: chosen.length })}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("thinkingLab.execution.cancel", "Cancel")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
