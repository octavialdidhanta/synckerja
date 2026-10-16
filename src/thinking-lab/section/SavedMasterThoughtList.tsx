import { MoreVertical } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { LabMasterThought } from "@/thinking-lab/master-thought/types";

type Props = {
  masters: LabMasterThought[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
};

function savedTitle(row: LabMasterThought): string {
  return (row.statement || row.originalInput || row.priorBelief || "").trim();
}

function savedDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export function SavedMasterThoughtList({ masters, onOpen, onDelete }: Props) {
  const { t, dateLocale } = useAppTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <h2 className="shrink-0 text-sm font-semibold text-foreground">
        {t("thinkingLab.saved.title", "Saved Master Thoughts")}
      </h2>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {masters.map((row) => {
          const title = savedTitle(row);
          const when = savedDate(row.updatedAt, dateLocale);
          return (
            <li key={row.id} className="rounded-lg border border-border bg-card">
              <div className="flex items-start gap-1 p-3">
                <button type="button" className="min-w-0 flex-1 space-y-3 text-left" onClick={() => onOpen(row.id)}>
                  <div className="border-l-2 border-brand-blue-deep pl-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("thinkingLab.tree.masterThought", "Master Thought")}
                    </p>
                    <p className="mt-1 break-words text-sm font-medium leading-snug text-foreground">{title}</p>
                  </div>
                  {row.priorBelief ? (
                    <div className="border-l-2 border-[hsl(359_77%_34%)] pl-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t("thinkingLab.master.shiftFrom", "Old belief to shift")}
                      </p>
                      <p className="mt-1 break-words text-sm leading-snug text-foreground">{row.priorBelief}</p>
                    </div>
                  ) : null}
                  {when ? (
                    <p className="text-xs text-muted-foreground">
                      {t("thinkingLab.saved.updated", "Updated {{date}}", { date: when })}
                    </p>
                  ) : null}
                </button>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      aria-label={t("thinkingLab.action.more", "More actions")}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[9rem]">
                    <DropdownMenuItem className="cursor-pointer" onSelect={() => onOpen(row.id)}>
                      {t("thinkingLab.saved.open", "Open")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-destructive focus:text-destructive"
                      onSelect={() => onDelete(row.id)}
                    >
                      {t("thinkingLab.action.delete", "Delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
