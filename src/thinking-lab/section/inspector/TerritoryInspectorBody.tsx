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
import type { InspectorTerritory } from "@/thinking-lab/section/inspector/types";

export type TerritoryInspectorBodyProps = {
  territories: InspectorTerritory[];
  pendingAction?: string | null;
  fixingTerritoryCodes?: readonly string[];
  onEditTerritory?: (id: string, statement: string) => Promise<string | null>;
  onReviseTerritory?: (code: string) => void;
  onFixTerritory?: (code: string) => void;
  onGenerateAngle?: (territoryId: string) => void;
  onDeleteTerritory?: (id: string) => void;
};

export function TerritoryInspectorBody({
  territories,
  pendingAction = null,
  fixingTerritoryCodes,
  onEditTerritory,
  onReviseTerritory,
  onFixTerritory,
  onGenerateAngle,
  onDeleteTerritory,
}: TerritoryInspectorBodyProps) {
  const { t } = useAppTranslation();
  const reviseTerritory = onReviseTerritory ?? onFixTerritory;
  const [territoryEditToken, setTerritoryEditToken] = useState<Record<string, number>>({});

  if (territories.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("thinkingLab.territory.list", "Territories")}
      </p>
      <ul className="space-y-2">
        {territories.map((territory) => {
          const territoryFixing =
            (fixingTerritoryCodes ?? []).some((code) => code.toUpperCase() === territory.code.toUpperCase()) ||
            pendingAction === `fix-territory:${territory.code}`;
          const otherWorkRunning = Boolean(pendingAction) && !pendingAction.startsWith("fix-territory:");
          const territoryNeedsFix = checkRowFailed(territory.verdict, territory.checklist);
          const showTerritoryCardMenu =
            Boolean(territory.editable && onEditTerritory) ||
            (territory.verdict === "AUDIT_PASS" && Boolean(onGenerateAngle)) ||
            (territoryNeedsFix && Boolean(reviseTerritory)) ||
            Boolean(onDeleteTerritory);
          return (
            <li key={territory.id} className="rounded-lg border border-border bg-background px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{territory.code}</span>
                {territory.verdict ? <VerdictChip verdict={territory.verdict} verbatim /> : null}
                {showTerritoryCardMenu ? (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="ml-auto h-6 w-6 shrink-0 text-muted-foreground"
                        aria-label={`${t("thinkingLab.action.more", "More actions")} ${territory.code}`}
                        aria-busy={territoryFixing || undefined}
                        disabled={territoryFixing || otherWorkRunning}
                      >
                        {territoryFixing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <MoreVertical className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[11rem]">
                      {territory.editable && onEditTerritory ? (
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          disabled={territoryFixing || otherWorkRunning}
                          onSelect={() =>
                            setTerritoryEditToken((current) => ({
                              ...current,
                              [territory.id]: (current[territory.id] ?? 0) + 1,
                            }))
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t("thinkingLab.manual.edit", "Edit")}
                        </DropdownMenuItem>
                      ) : null}
                      {territoryNeedsFix && reviseTerritory ? (
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          disabled={territoryFixing || otherWorkRunning}
                          aria-busy={territoryFixing}
                          onSelect={() => reviseTerritory(territory.code)}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          {t("thinkingLab.idea.revise", "Revise")}
                        </DropdownMenuItem>
                      ) : null}
                      {territory.verdict === "AUDIT_PASS" && onGenerateAngle ? (
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          disabled={Boolean(pendingAction)}
                          aria-busy={pendingAction === "generate-angle"}
                          onSelect={() => onGenerateAngle(territory.id)}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {t("thinkingLab.angle.generateBranch", "Generate Angle")}
                        </DropdownMenuItem>
                      ) : null}
                      {onDeleteTerritory ? (
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                          disabled={territoryFixing || otherWorkRunning}
                          onSelect={() => onDeleteTerritory(territory.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("thinkingLab.action.deleteTerritory", "Delete Territory")}
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
              <EditableStatement
                compact
                showButton={false}
                editToken={territoryEditToken[territory.id] ?? 0}
                statement={territory.statement}
                enabled={Boolean(territory.editable && onEditTerritory)}
                pending={Boolean(pendingAction)}
                onSave={(next) => onEditTerritory?.(territory.id, next) ?? Promise.resolve(null)}
              />
              {territory.link ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{territory.link}</p> : null}
              {territory.detail ? (
                <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{territory.detail}</p>
              ) : null}
              {territory.question ? (
                <p className="mt-1 text-[15px] leading-relaxed text-slate-800">{territory.question}</p>
              ) : null}
              <TerritoryPassChecklist
                checks={territory.checklist}
                note={territory.checklistNote}
                onFix={territoryNeedsFix && reviseTerritory ? () => reviseTerritory(territory.code) : undefined}
                fixLabel={t("thinkingLab.idea.revise", "Revise")}
                fixing={territoryFixing}
                blocked={otherWorkRunning}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}