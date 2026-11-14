import { useEffect, useState } from "react";
import { ClipboardCheck, Loader2, Lock, MoreVertical, Pencil, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { NODE_DEFINITIONS } from "@/thinking-lab/shared/definitions";
import { EMPTY_CATALOG_LINK } from "@/thinking-lab/master-thought/catalog";
import { CreativePathPanel } from "@/thinking-lab/section/CreativePathPanel";
import { EditableStatement, ManualStatementForm } from "@/thinking-lab/section/ManualStatementForm";
import { ExecutionPassChecklist } from "@/thinking-lab/section/ExecutionScriptPanel";
import { PassChecklist as TerritoryPassChecklist } from "@/thinking-lab/section/inspector/PassChecklist";
import { UncheckedBadge, ParentChangedBadge } from "@/thinking-lab/section/inspector/InspectorChrome";
import { MasterInspectorBody } from "@/thinking-lab/section/inspector/MasterInspectorBody";
import { IdeaInspectorBody } from "@/thinking-lab/section/inspector/IdeaInspectorBody";
import { AngleInspectorBody } from "@/thinking-lab/section/inspector/AngleInspectorBody";
import { BigThoughtInspectorBody } from "@/thinking-lab/section/inspector/BigThoughtInspectorBody";

import type { LabNodeInspectorProps } from "@/thinking-lab/section/inspector/types";
export type { LabNodeInspectorProps, InspectorAngle, InspectorTerritory, ManualAdd } from "@/thinking-lab/section/inspector/types";

// One source with the MCP definitions tool.

export function NodeDefinitionInfo({ kind }: { kind: keyof typeof NODE_DEFINITIONS }) {
  const definition = NODE_DEFINITIONS[kind];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-serif italic leading-none opacity-70 hover:opacity-100"
          aria-label={`Definisi ${definition.label}`}
        >
          i
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2 p-3 text-sm leading-relaxed">
        <p>{definition.body}</p>
        <p className="text-muted-foreground">{definition.note}</p>
      </PopoverContent>
    </Popover>
  );
}

export function LabNodeInspector({
  kind,
  code,
  unchecked,
  parentChanged,
  title,
  statement,
  example,
  checks,
  onFixNode,
  fixingNode = false,
  onUnlock,
  catalog = EMPTY_CATALOG_LINK,
  catalogs = [],
  catalogPending = false,
  onSaveCatalog,
  onDelete,
  unlockDisabled,
  onGenerateAngle,
  territoryId,
  angleReady = false,
  onGenerateIdea,
  angleId,
  ideaReady = false,
  ideas,
  ideaHistory = null,
  ideaRevisionTarget = null,
  onReviseIdea,
  onLockIdeas,
  onDeleteIdea,
  ideaGenerateChecklist = null,
  angles,
  angleStage = null,
  angleGenerateChecklist = null,
  onAngleStage,
  onLockAngles,
  onFixAngle,
  onReviseAngle,
  onDeleteAngle,
  fixingAngleCodes,
  territories,
  territoryStage,
  onTerritoryStage,
  onFixTerritory,
  onReviseTerritory,
  onDeleteTerritory,
  fixingTerritoryCodes,
  onLockTerritories,
  onGenerateTerritory,
  territoryGenerateChecklist = null,
  pendingAction = null,
  notice,
  pathUp,
  territoryArea = null,
  linkSentence = null,
  areaQuestion = null,
  territoryPass = null,
  subject,
  subjectNotice,
  questionNotes,
  manualAdd = null,
  onEditStatement,
  onEditTerritory,
  onEditAngle,
  onEditIdea,
  executionReady = false,
  creativePath = null,
  executionProgress = null,
  executionChecklist = null,
  onStopExecution,
}: LabNodeInspectorProps) {
  const { t } = useAppTranslation();
  const childGenerateRunning =
    pendingAction === "generate" ||
    pendingAction === "generate-territory" ||
    pendingAction === "generate-angle" ||
    pendingAction === "generate-idea";
  const manualRunning = pendingAction?.startsWith("manual-") ?? false;
  const [showWriteIdea, setShowWriteIdea] = useState(false);
  const [statementEditToken, setStatementEditToken] = useState(0);
  useEffect(() => {
    setShowWriteIdea(false);
    setStatementEditToken(0);
  }, [angleId, territoryId, kind]);
  const showWriteIdeaAction = Boolean(kind === "angle" && manualAdd && !childGenerateRunning);
  const showGenerateIdeaAction = Boolean(kind === "angle" && ideaReady && onGenerateIdea && angleId && !manualRunning);
  const showAngleMenu =
    showWriteIdeaAction || showGenerateIdeaAction || Boolean(kind === "angle" && (onLockIdeas || onDelete));
  const showTerritoryStageAction = Boolean(
    kind === "bigThought" &&
      (territories?.length ?? 0) > 0 &&
      territoryStage &&
      territoryStage !== "lock" &&
      territoryStage !== "generate" &&
      onTerritoryStage,
  );
  const showTerritoryGenerateAction = Boolean(kind === "bigThought" && onGenerateTerritory);
  const territoryActionLabel =
    territoryStage === "audit"
      ? t("thinkingLab.action.audit", "Audit")
      : territoryStage === "generate"
        ? t("thinkingLab.territory.generate", "Generate Territory")
        : t("thinkingLab.action.lock", "Lock");
  const showAngleStageMenu = Boolean(
    kind === "territory" &&
      angleStage &&
      onAngleStage &&
      pendingAction !== "generate-angle",
  );
  const angleActionLabel =
    angleStage === "audit" ? t("thinkingLab.action.audit", "Audit") : t("thinkingLab.action.lock", "Lock");
  const showThoughtMenu = Boolean(
    kind === "bigThought" && (showTerritoryStageAction || showTerritoryGenerateAction || onLockTerritories || onDelete),
  );
  const label =
    kind === "master"
      ? t("thinkingLab.tree.masterThought", "Master Thought")
      : kind === "idea"
        ? t("thinkingLab.idea.list", "Idea")
        : kind === "angle"
        ? t("thinkingLab.tree.angle", "Angle")
        : kind === "territory"
          ? t("thinkingLab.tree.territory", "Territory")
      : t("thinkingLab.tree.bigThought", "Big Thought");
  const heading = (title?.trim() || (kind === "master" && subject?.trim()) || statement).trim();
  const detail = statement.trim() !== heading ? statement.trim() : "";
  const showTerritoryGenerate = Boolean(
    kind === "territory" &&
      angleReady &&
      onGenerateAngle &&
      territoryId &&
      !manualRunning &&
      pendingAction !== "audit" &&
      !(angleStage === "audit" && pendingAction !== "generate-angle"),
  );
  const showIdeaHeaderMenu = Boolean(kind === "idea" && onDelete);
  const showTerritoryMenu = Boolean(
    kind === "territory" &&
      (showTerritoryGenerate || onEditStatement || onDelete || showAngleStageMenu || onLockAngles),
  );
  const pathBlock =
    pathUp && pathUp.length > 0 ? (
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("thinkingLab.tree.pathUp", "Path up")}</p>
        <ul className="space-y-2">
          {pathUp.map((item) => (
            <li key={`${item.label}-${item.title}`} className="border-l-2 border-border pl-2">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm text-foreground">{item.title}</p>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex items-start justify-between gap-3">
        <header className="min-w-0 flex-1 space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#1e4a86]">
            <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] bg-[#1e4a86]" aria-hidden />
            <span>{code?.trim() ? `${label} - ${code.trim()}` : label}</span>
            <NodeDefinitionInfo kind={kind} />
            {unchecked ? <UncheckedBadge /> : null}
            {parentChanged ? <ParentChangedBadge /> : null}
          </p>
          {onEditStatement && !title && kind !== "territory" ? (
            <EditableStatement statement={statement} enabled pending={Boolean(pendingAction)} onSave={onEditStatement} />
          ) : (
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">{heading}</h2>
          )}
          {kind === "territory" && linkSentence ? (
            <p className="text-[15px] leading-relaxed text-slate-600">{linkSentence}</p>
          ) : null}
          {kind === "territory" && areaQuestion ? (
            <p className="text-[15px] leading-relaxed text-slate-800">{areaQuestion}</p>
          ) : null}
          {kind !== "territory" && detail ? <p className="text-[15px] leading-relaxed text-slate-600">{detail}</p> : null}
          {kind === "angle" && example?.trim() ? (
            <p className="text-[15px] leading-relaxed text-slate-800">
              <span className="font-medium">{t("thinkingLab.angle.example", "Example")}. </span>
              {example.trim()}
            </p>
          ) : null}
          {kind === "angle" && checks ? (
            <TerritoryPassChecklist
              checks={checks}
              labelPrefix="thinkingLab.angle.pass"
              onFix={onFixNode}
              fixing={fixingNode}
              blocked={Boolean(pendingAction) && !fixingNode}
            />
          ) : null}
          {onEditStatement && title ? (
            <EditableStatement
              buttonOnly={Boolean(detail)}
              statement={statement}
              enabled
              pending={Boolean(pendingAction)}
              onSave={onEditStatement}
            />
          ) : null}
          {kind === "master" && subjectNotice ? <p className="text-sm text-muted-foreground">{subjectNotice}</p> : null}
        </header>
        {showThoughtMenu ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label={t("thinkingLab.action.more", "More actions")}
                aria-busy={
                  pendingAction === "generate-territory" ||
                  (Boolean(pendingAction) && pendingAction === territoryStage)
                    ? true
                    : undefined
                }
              >
                {pendingAction === "generate-territory" ||
                (Boolean(pendingAction) && pendingAction === territoryStage) ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <MoreVertical className="h-3.5 w-3.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              {showTerritoryGenerateAction ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "generate-territory"}
                  onSelect={() => onGenerateTerritory?.()}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("thinkingLab.territory.generate", "Generate Territory")}
                </DropdownMenuItem>
              ) : null}
              {showTerritoryStageAction ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === territoryStage || pendingAction === "generate-territory"}
                  onSelect={() => onTerritoryStage?.()}
                >
                  {territoryStage === "generate" ? <Sparkles className="h-3.5 w-3.5" /> : null}
                  {territoryStage === "audit" ? <ClipboardCheck className="h-3.5 w-3.5" /> : null}
                  {territoryActionLabel}
                </DropdownMenuItem>
              ) : null}
              {onLockTerritories ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "lock"}
                  onSelect={() => onLockTerritories()}
                >
                  <Lock className="h-3.5 w-3.5" />
                  {t("thinkingLab.action.lock", "Lock")}
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  disabled={Boolean(pendingAction)}
                  onSelect={() => onDelete()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("thinkingLab.action.delete", "Delete")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : showAngleMenu ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label={t("thinkingLab.action.more", "More actions")}
                aria-busy={pendingAction === "generate-idea" ? true : undefined}
              >
                {pendingAction === "generate-idea" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <MoreVertical className="h-3.5 w-3.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              {showWriteIdeaAction && manualAdd ? (
                <DropdownMenuItem className="cursor-pointer" onSelect={() => setShowWriteIdea(true)}>
                  {manualAdd.label}
                </DropdownMenuItem>
              ) : null}
              {showGenerateIdeaAction && onGenerateIdea && angleId ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "generate-idea"}
                  onSelect={() => onGenerateIdea(angleId)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("thinkingLab.idea.generate", "Generate Idea")}
                </DropdownMenuItem>
              ) : null}
              {onLockIdeas ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "lock"}
                  onSelect={() => onLockIdeas()}
                >
                  <Lock className="h-3.5 w-3.5" />
                  {t("thinkingLab.action.lock", "Lock")}
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  disabled={Boolean(pendingAction)}
                  onSelect={() => onDelete()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("thinkingLab.action.delete", "Delete")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : showTerritoryMenu ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label={t("thinkingLab.action.more", "More actions")}
                aria-busy={
                  pendingAction === "generate-angle" ||
                  pendingAction === "fix-angles" ||
                  (angleStage === "audit" && pendingAction === "audit")
                    ? true
                    : undefined
                }
              >
                {pendingAction === "generate-angle" ||
                pendingAction === "fix-angles" ||
                (angleStage === "audit" && pendingAction === "audit") ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <MoreVertical className="h-3.5 w-3.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              {showTerritoryGenerate && onGenerateAngle && territoryId ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "generate-angle"}
                  onSelect={() => onGenerateAngle(territoryId)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("thinkingLab.angle.generate", "Generate Angle")}
                </DropdownMenuItem>
              ) : null}
              {showAngleStageMenu && onAngleStage ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === angleStage}
                  onSelect={() => onAngleStage()}
                >
                  {angleStage === "audit" ? <ClipboardCheck className="h-3.5 w-3.5" /> : null}
                  {angleStage === "lock" ? <Lock className="h-3.5 w-3.5" /> : null}
                  {angleActionLabel}
                </DropdownMenuItem>
              ) : null}
              {onLockAngles && angleStage !== "lock" ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  aria-busy={pendingAction === "lock"}
                  onSelect={() => onLockAngles()}
                >
                  <Lock className="h-3.5 w-3.5" />
                  {t("thinkingLab.action.lock", "Lock")}
                </DropdownMenuItem>
              ) : null}
              {onEditStatement ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  disabled={Boolean(pendingAction)}
                  onSelect={() => setStatementEditToken((current) => current + 1)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t("thinkingLab.manual.edit", "Edit")}
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  disabled={Boolean(pendingAction)}
                  onSelect={() => onDelete()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("thinkingLab.action.delete", "Hapus")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : showIdeaHeaderMenu ? (
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
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                disabled={Boolean(pendingAction)}
                onSelect={() => onDelete?.()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("thinkingLab.action.delete", "Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {kind === "territory" && (territoryArea?.body || territoryPass?.body) ? (
        <div className="space-y-2">
          {territoryArea?.body ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-foreground">
              {territoryArea.lead ? <span className="font-semibold">{territoryArea.lead} </span> : null}
              {territoryArea.body}
            </p>
          ) : null}
          {territoryPass?.body ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-foreground">
              <span className="font-semibold">{territoryPass.lead}</span> {territoryPass.body}
            </p>
          ) : null}
        </div>
      ) : null}
      {kind === "territory" && onEditStatement && statementEditToken > 0 ? (
        <EditableStatement
          statement={statement}
          enabled
          showButton={false}
          editToken={statementEditToken}
          pending={Boolean(pendingAction)}
          onSave={onEditStatement}
        />
      ) : null}
      {kind === "territory" ? null : pathBlock}
      {kind === "master" && onSaveCatalog ? (
        <MasterInspectorBody
          catalog={catalog}
          catalogs={catalogs}
          catalogPending={catalogPending}
          onSaveCatalog={onSaveCatalog}
        />
      ) : null}
      {onUnlock ? (
        <Button type="button" variant="outline" size="sm" onClick={onUnlock} disabled={unlockDisabled} aria-busy={unlockDisabled}>
          {unlockDisabled ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("thinkingLab.action.unlock", "Unlock")}
        </Button>
      ) : null}
      {kind === "idea" && executionReady && executionProgress ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {executionProgress.phase === "write"
              ? executionProgress.medium === "image"
                ? t("thinkingLab.execution.writingSlides", "Writing the slides for {{pillar}}...", {
                    pillar: executionProgress.pillarName,
                  })
                : t("thinkingLab.execution.writing", "Writing the voice-over script for {{pillar}}...", {
                    pillar: executionProgress.pillarName,
                  })
              : executionProgress.phase === "repair"
                ? t("thinkingLab.execution.repairing", "Repairing only the failing lines...")
                : executionProgress.phase === "line"
                  ? t("thinkingLab.execution.rewritingLine", "Rewriting this line so the requirements that are switched on still pass...")
                  : executionProgress.phase === "switch"
                    ? t("thinkingLab.execution.rewritingSwitch", "Rewriting the lines for this requirement...")
                  : executionProgress.phase === "recommend"
                    ? t("thinkingLab.execution.recommending", "Looking for a pillar that can carry this Idea...")
                    : t("thinkingLab.execution.auditing", "Tracing the script path up to the Master Thought...")}
          </p>
          {onStopExecution ? (
            <Button type="button" size="sm" variant="outline" onClick={onStopExecution}>
              {t("thinkingLab.execution.stop", "Stop")}
            </Button>
          ) : null}
          {executionChecklist && executionChecklist.length > 0 ? <ExecutionPassChecklist checks={executionChecklist} /> : null}
        </div>
      ) : null}
      {kind === "idea" && executionReady && creativePath ? <CreativePathPanel path={creativePath} pendingAction={pendingAction} /> : null}
      {kind === "angle" && showWriteIdea && manualAdd && !childGenerateRunning ? (
        <ManualStatementForm
          label={manualAdd.label}
          submitLabel={t("thinkingLab.manual.save", "Save")}
          pending={manualRunning}
          onSubmit={async (statement) => {
            const reason = await manualAdd.onSubmit(statement);
            if (!reason) setShowWriteIdea(false);
            return reason;
          }}
        />
      ) : null}
      {kind === "angle" && ideaGenerateChecklist ? (
        <TerritoryPassChecklist checks={ideaGenerateChecklist.checks} report={ideaGenerateChecklist.report} labelPrefix="thinkingLab.idea.pass" />
      ) : null}
      {kind === "angle" && ideas && ideas.length > 0 ? (
        <IdeaInspectorBody
          ideas={ideas}
          angleId={angleId}
          ideaHistory={ideaHistory}
          ideaRevisionTarget={ideaRevisionTarget}
          pendingAction={pendingAction}
          onLockIdeas={onLockIdeas}
          onEditIdea={onEditIdea}
          onReviseIdea={onReviseIdea}
          onDeleteIdea={onDeleteIdea}
        />
      ) : null}
      {kind === "territory" && angleGenerateChecklist ? (
        <TerritoryPassChecklist checks={angleGenerateChecklist.checks} report={angleGenerateChecklist.report} labelPrefix="thinkingLab.angle.pass" showPending />
      ) : null}
      {kind === "territory" && angles && angles.length > 0 ? (
        <AngleInspectorBody
          angles={angles}
          pendingAction={pendingAction}
          fixingAngleCodes={fixingAngleCodes}
          onEditAngle={onEditAngle}
          onReviseAngle={onReviseAngle}
          onFixAngle={onFixAngle}
          onGenerateIdea={onGenerateIdea}
          onDeleteAngle={onDeleteAngle}
        />
      ) : null}
      {kind === "bigThought" ? (
        <BigThoughtInspectorBody
          manualAdd={manualAdd}
          childGenerateRunning={childGenerateRunning}
          manualRunning={manualRunning}
          pendingAction={pendingAction}
          questionNotes={questionNotes}
          territoryGenerateChecklist={territoryGenerateChecklist}
          territories={territories}
          fixingTerritoryCodes={fixingTerritoryCodes}
          onEditTerritory={onEditTerritory}
          onReviseTerritory={onReviseTerritory}
          onFixTerritory={onFixTerritory}
          onGenerateAngle={onGenerateAngle}
          onDeleteTerritory={onDeleteTerritory}
        />
      ) : null}
      {notice ? <p className="text-sm text-destructive">{notice}</p> : null}
      {kind === "territory" ? pathBlock : null}
    </div>
  );
}
