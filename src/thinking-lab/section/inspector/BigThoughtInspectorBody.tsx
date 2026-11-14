import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ManualStatementForm } from "@/thinking-lab/section/ManualStatementForm";
import { PassChecklist as TerritoryPassChecklist } from "@/thinking-lab/section/inspector/PassChecklist";
import { TerritoryInspectorBody } from "@/thinking-lab/section/inspector/TerritoryInspectorBody";
import type { LabNodeInspectorProps, ManualAdd } from "@/thinking-lab/section/inspector/types";

export type BigThoughtInspectorBodyProps = {
  manualAdd?: ManualAdd | null;
  childGenerateRunning: boolean;
  manualRunning: boolean;
  pendingAction?: string | null;
  questionNotes?: string[];
  territoryGenerateChecklist?: LabNodeInspectorProps["territoryGenerateChecklist"];
  territories?: LabNodeInspectorProps["territories"];
  fixingTerritoryCodes?: readonly string[];
  onEditTerritory?: LabNodeInspectorProps["onEditTerritory"];
  onReviseTerritory?: LabNodeInspectorProps["onReviseTerritory"];
  onFixTerritory?: LabNodeInspectorProps["onFixTerritory"];
  onGenerateAngle?: LabNodeInspectorProps["onGenerateAngle"];
  onDeleteTerritory?: LabNodeInspectorProps["onDeleteTerritory"];
};

export function BigThoughtInspectorBody({
  manualAdd = null,
  childGenerateRunning,
  manualRunning,
  pendingAction = null,
  questionNotes,
  territoryGenerateChecklist = null,
  territories,
  fixingTerritoryCodes,
  onEditTerritory,
  onReviseTerritory,
  onFixTerritory,
  onGenerateAngle,
  onDeleteTerritory,
}: BigThoughtInspectorBodyProps) {
  const { t } = useAppTranslation();

  return (
    <>
      {manualAdd && !childGenerateRunning ? (
        <ManualStatementForm
          label={manualAdd.label}
          submitLabel={t("thinkingLab.manual.save", "Save")}
          pending={manualRunning}
          onSubmit={manualAdd.onSubmit}
        />
      ) : null}
      {questionNotes && questionNotes.length > 0 ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("thinkingLab.bigThought.question", "Question this Big Thought")}</p>
          <ul className="space-y-1">
            {questionNotes.map((note) => (
              <li key={note} className="text-sm text-muted-foreground">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {territoryGenerateChecklist ? (
        <TerritoryPassChecklist
          checks={territoryGenerateChecklist.checks}
          report={territoryGenerateChecklist.report}
          showPending
        />
      ) : null}
      {territories && territories.length > 0 ? (
        <TerritoryInspectorBody
          territories={territories}
          pendingAction={pendingAction}
          fixingTerritoryCodes={fixingTerritoryCodes}
          onEditTerritory={onEditTerritory}
          onReviseTerritory={onReviseTerritory}
          onFixTerritory={onFixTerritory}
          onGenerateAngle={onGenerateAngle}
          onDeleteTerritory={onDeleteTerritory}
        />
      ) : null}
    </>
  );
}