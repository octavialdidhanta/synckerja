import { useState } from "react";
import { Loader2, MoreVertical, Pencil, Sparkles, Trash2, Wrench } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { EditableStatement } from "@/thinking-lab/section/ManualStatementForm";
import { PassChecklist as TerritoryPassChecklist, checkRowFailed } from "@/thinking-lab/section/inspector/PassChecklist";
import { VerdictChip } from "@/thinking-lab/section/inspector/InspectorChrome";
import type { InspectorAngle } from "@/thinking-lab/section/inspector/types";

export type AngleInspectorBodyProps = {
  angles: InspectorAngle[];
  pendingAction?: string | null;
  fixingAngleCodes?: readonly string[];
  onEditAngle?: (id: string, statement: string) => Promise<string | null>;
  onReviseAngle?: (code: string) => void;
  onFixAngle?: (code: string) => void;
  onGenerateIdea?: (angleId: string) => void;
  onDeleteAngle?: (id: string) => void;
};

export function AngleInspectorBody({
  angles,
  pendingAction = null,
  fixingAngleCodes,
  onEditAngle,
  onReviseAngle,
  onFixAngle,
  onGenerateIdea,
  onDeleteAngle,
}: AngleInspectorBodyProps) {
  const { t } = useAppTranslation();
  const reviseAngle = onReviseAngle ?? onFixAngle;
  const [angleEditToken, setAngleEditToken] = useState<Record<string, number>>({});

  if (angles.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("thinkingLab.angle.list", "Angles")}
      </p>
      <ul className="space-y-2">
        {angles.map((angle) => {
          const angleFixing =
            (fixingAngleCodes ?? []).some((code) => code.toUpperCase() === angle.code.toUpperCase()) ||
            pendingAction === `fix-angle:${angle.code}`;
          const otherWorkRunning = Boolean(pendingAction) && !pendingAction.startsWith("fix-angle:");
          const angleNeedsFix = checkRowFailed(angle.verdict, angle.checklist);
          const showAngleMenu =
            Boolean(angle.editable && onEditAngle) ||
            (angleNeedsFix && Boolean(reviseAngle)) ||
            (angle.verdict === "AUDIT_PASS" && Boolean(onGenerateIdea)) ||
            Boolean(onDeleteAngle);
          return (
            <li key={angle.id} className="rounded-lg border border-border bg-background px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{angle.code}</span>
                {angle.verdict ? <VerdictChip verdict={angle.verdict} verbatim /> : null}
                {showAngleMenu ? (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="ml-auto h-6 w-6 shrink-0 text-muted-foreground"
                        aria-label={`${t("thinkingLab.action.more", "More actions")} ${angle.code}`}
                        aria-busy={angleFixing || undefined}
                        disabled={angleFixing || otherWorkRunning}
                      >
                        {angleFixing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <MoreVertical className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[11rem]">
                      {angle.editable && onEditAngle ? (
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          disabled={angleFixing || otherWorkRunning}
                          onSelect={() =>
                            setAngleEditToken((current) => ({
                              ...current,
                              [angle.id]: (current[angle.id] ?? 0) + 1,
                            }))
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t("thinkingLab.manual.edit", "Edit")}
                        </DropdownMenuItem>
                      ) : null}
                      {angleNeedsFix && reviseAngle ? (
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          disabled={angleFixing || otherWorkRunning}
                          aria-busy={angleFixing}
                          onSelect={() => reviseAngle(angle.code)}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          {t("thinkingLab.idea.revise", "Revise")}
                        </DropdownMenuItem>
                      ) : null}
                      {angle.verdict === "AUDIT_PASS" && onGenerateIdea ? (
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          disabled={Boolean(pendingAction)}
                          aria-busy={pendingAction === "generate-idea"}
                          onSelect={() => onGenerateIdea(angle.id)}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {t("thinkingLab.idea.generate", "Generate Idea")}
                        </DropdownMenuItem>
                      ) : null}
                      {onDeleteAngle ? (
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                          disabled={angleFixing || otherWorkRunning}
                          onSelect={() => onDeleteAngle(angle.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("thinkingLab.action.deleteAngle", "Delete Angle")}
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
              {angle.subject ? <p className="text-sm font-medium text-foreground">{angle.subject}</p> : null}
              <EditableStatement
                compact
                showButton={false}
                editToken={angleEditToken[angle.id] ?? 0}
                statement={angle.statement}
                enabled={Boolean(angle.editable && onEditAngle)}
                pending={Boolean(pendingAction)}
                onSave={(next) => onEditAngle?.(angle.id, next) ?? Promise.resolve(null)}
              />
              {angle.example?.trim() ? (
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  <span className="font-medium text-slate-700">{t("thinkingLab.angle.example", "Example")}. </span>
                  {angle.example.trim()}
                </p>
              ) : null}
              <TerritoryPassChecklist
                checks={angle.checklist}
                note={angle.checklistNote}
                labelPrefix="thinkingLab.angle.pass"
                onFix={angleNeedsFix && reviseAngle ? () => reviseAngle(angle.code) : undefined}
                fixLabel={t("thinkingLab.idea.revise", "Revise")}
                fixing={angleFixing}
                blocked={otherWorkRunning}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}