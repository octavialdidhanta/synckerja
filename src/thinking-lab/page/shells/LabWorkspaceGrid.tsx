import { useLayoutEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { becauseSentence } from "@/thinking-lab/big-thought/because";
import { ACTIVE_SET_CAP } from "@/thinking-lab/shared/limits";
import { canReviseIdea } from "@/thinking-lab/idea/revise";
import { checksFromValidation, ideaHistorySummary, uncheckedIdeaValidation } from "@/thinking-lab/idea/check/record";
import { ideaLabel } from "@/thinking-lab/idea/subject";
import { IDEA_ACTIVE_CAP } from "@/thinking-lab/idea/generate";
import { angleListSubject } from "@/thinking-lab/angle/subject";
import { angleVerdict } from "@/thinking-lab/angle/record";
import { territoryVerdict } from "@/thinking-lab/territory/record";
import { territoryChecksFromStored } from "@/thinking-lab/territory/passChecklist";
import { executionChecklistPassed } from "@/thinking-lab/execution/passChecklist";
import { latestPathReviews } from "@/thinking-lab/creative-idea/paths";
import {
  LAB_LEFT_COL,
  LAB_LEFT_SECTION,
  LAB_MAIN_GRID,
  LAB_MT_CARD,
  LAB_RIGHT_CARD,
  LAB_RIGHT_COL,
  LAB_SECTION,
} from "@/thinking-lab/page/thinkingLabLayout";
import { LabMasterComposer, LabMasterSavedList, LabMasterSectionArea } from "@/thinking-lab/page/shells/LabMasterColumn";
import { MasterThoughtMapTree } from "@/thinking-lab/section/MasterThoughtMapTree";
import { LabNodeInspector } from "@/thinking-lab/section/LabNodeInspector";
import { LockedPillarSection } from "@/thinking-lab/section/LockedPillarSection";
import { ExecutionScriptPanel } from "@/thinking-lab/section/ExecutionScriptPanel";
import type { LabWorkspaceGridProps } from "@/thinking-lab/page/shells/labWorkspaceGridTypes";
import { savedParentChanged, savedUnchecked } from "@/thinking-lab/page/savedAuditFlags";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";

function TruncatedBeliefLine({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflow(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  return (
    <Tooltip {...(overflow ? {} : { open: false })}>
      <TooltipTrigger asChild>
        <p
          ref={ref}
          tabIndex={overflow ? 0 : undefined}
          className={cn("mt-1 block min-w-0 max-w-full truncate outline-none", overflow && "cursor-help", className)}
        >
          {text}
        </p>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-md whitespace-normal break-words text-left">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function LabWorkspaceGrid({
  masterComposer,
  masterSavedList,
  masterSection,
  shared,
  map,
  execution: executionWiring,
  inspector,
}: LabWorkspaceGridProps) {
  const {
    t,
    masters,
    selected,
    focus,
    locked,
    showComposer,
    showBeliefField,
    skipAutoSelect,
    setSelectedId,
    setFocus,
    setPendingDelete,
    setEditingMasterId,
    busy,
    busyAction,
    notice,
    becauseParent,
    masterDescription,
    masterSubject,
    shownRowViews,
    catalogs,
    contentPillars,
    pillarCardsFor,
    angleCardView,
    validationForIdea,
  } = shared;
  const {
    labTerritories,
    labAngles,
    labIdeas,
    labExecutions,
    lockedChildren,
    focusedThought,
    generatingTerritoryIds,
    territoryGenerateThoughtId,
    executionCounts,
    onGenerateTerritory,
    setCreativePillarId,
    setCreativeFormat,
    admittedTerritories,
    angleChecklists,
  } = map;
  const {
    focusedExecution,
    focusedIdea,
    focusedPillarCard,
    executionDraft,
    executionProgress,
    executionPassProposal,
    executionLineOffer,
    executionRepairNote,
    executionRunChecks,
    executionChecklists,
    fixingLineId,
    characterGenerate,
    characterVisualDelete,
    characterVisualSave,
    pillarChoices,
    pathUp,
    creativeFormat,
    setScriptTableOpen,
    pillarHopStopped,
    onAcceptPassProposal,
    onDeclinePassProposal,
    onStopExecution,
    onRepairExecution,
    onFixLine,
    onRegenerateLine,
    onRewriteExecution,
    onRegenerateExecution,
    onOpenPillarPicker,
    onUseRecommendation,
    onUseExecutionOffer,
    onRetrySelling,
    onToggleExecutionPass,
    onGenerateCharacter,
    onStoreCharacterVisual,
    onDeleteCharacterVisual,
    onOpenExecutionSettings,
  } = executionWiring;
  const {
    setRecord,
    ideaSet,
    angleSet,
    territorySet,
    focusedAngle,
    focusedTerritory,
    focusedIdeaPassed,
    territoryCopy,
    territoriesPanelClosed,
    territoryChecklists,
    territoryVerdicts,
    territoryStage,
    territoryGenerateRun,
    territoryLock,
    fixingTerritoryCodes,
    fixingAngleCodes,
    admittedAngles,
    angleVerdicts,
    angleSetLocked,
    angleStage,
    angleGenerateRun,
    angleLock,
    angleIdeaRows,
    ideaRevisionTarget,
    ideaGenerateRun,
    ideaSetLocked,
    openIdeas,
    showGenerateIdea,
    showGenerateAngle,
    leadMagnetStep,
    creativeReviewReady,
    creativeReviews,
    onUnlock,
    onManualIdea,
    onEditTerritory,
    onEditAngle,
    onEditIdea,
    onGenerateAngle,
    onGenerateIdea,
    onReviseIdea,
    onLockIdeas,
    onAngleStage,
    onFixAngle,
    onLockAngles,
    onTerritoryStage,
    onFixTerritory,
    onLockTerritories,
    onReviewCreativePillars,
    onReviewLeadMagnetPillars,
    onLockCreativePillar,
    onLockAllCreativePillars,
  } = inspector;
  return (
                  <div className={LAB_MAIN_GRID}>
                    <div className={LAB_LEFT_COL}>
                      <div className={LAB_LEFT_SECTION}>
                        <div className={LAB_MT_CARD}>
                          {!showComposer && selected?.priorBelief ? (
                            <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch border-b border-white/15 bg-brand-blue text-white">
                              <div className="min-w-0 px-5 py-3">
                                <p className="text-[11px] leading-4 text-white/80">
                                  {t("thinkingLab.master.shiftFrom", "Keyakinan lama yang mau digeser")}
                                </p>
                                <TruncatedBeliefLine text={selected.priorBelief} className="text-sm leading-snug text-white" />
                              </div>
                              <div className="flex items-center gap-3 py-3" aria-hidden>
                                <span className="w-px self-stretch bg-white/40" />
                                <ArrowRight className="h-4 w-4 shrink-0 text-white" />
                              </div>
                              <div className="min-w-0 px-5 py-3">
                                <p className="text-[11px] leading-4 text-white/80">
                                  {t("thinkingLab.tree.masterThought", "Master Thought")}
                                </p>
                                <TruncatedBeliefLine
                                  text={selected.statement || selected.originalInput}
                                  className="text-sm font-medium leading-snug text-white"
                                />
                              </div>
                            </div>
                          ) : null}
                          {showComposer ? (
                            <LabMasterSavedList {...masterSavedList} />
                          ) : null}
                          {!showComposer ? (
                          <div className="flex min-h-0 flex-1 flex-col p-4">
                          <MasterThoughtMapTree
                            masters={masters.data ?? []}
                            selectedId={selected?.id ?? null}
                            inspectedMasterId={focus?.masterId ?? (selected && !locked ? selected.id : null)}
                            inspectedThoughtId={focus?.kind === "bigThought" ? focus.thoughtId : null}
                            inspectedTerritoryId={focus?.kind === "territory" ? focus.territoryId : null}
                            inspectedAngleId={focus?.kind === "angle" ? focus.angleId : null}
                            inspectedIdeaId={focus?.kind === "idea" ? focus.ideaId : null}
                            inspectedPillarId={focus?.kind === "pillar" ? focus.contentPillarId : null}
                            inspectedExecutionId={focus?.kind === "execution" ? focus.executionId : null}
                            childrenByMasterId={(() => {
                              /** Full nested map so Expand all can open every level without focus-gating. */
                              const territoriesForThought = (thoughtId: string) =>
                                (labTerritories.data ?? []).filter(
                                  (row) =>
                                    row.bigThoughtId === thoughtId &&
                                    row.admission === "GENERATE_VALID" &&
                                    row.status === "locked",
                                );
                              const anglesForTerritory = (territoryId: string) =>
                                (labAngles.data ?? []).filter(
                                  (angle) => angle.territoryId === territoryId && angle.admission === "GENERATE_VALID",
                                );
                              const executionNode = (
                                row: NonNullable<typeof labExecutions.data>[number],
                                leadMagnet = false,
                              ) => ({
                                id: row.id,
                                label: row.script?.title.trim() ?? "",
                                passed: executionChecklistPassed(
                                  row.canonicalSemantic,
                                  row.admission,
                                  row.script?.lineIssues.length ?? 0,
                                ),
                                ...(leadMagnet ? { leadMagnet: true } : {}),
                              });
                              const mapIdea = (idea: NonNullable<typeof labIdeas.data>[number]) => {
                                const cards = pillarCardsFor(idea);
                                const rows = (labExecutions.data ?? []).filter((row) => row.ideaId === idea.id);
                                const lockedIds = new Set(cards.map((card) => card.contentPillarId));
                                return {
                                  id: idea.id,
                                  code: idea.code,
                                  statement: idea.statement,
                                  subject: idea.canonicalSemantic.subject,
                                  recommended:
                                    idea.validation?.criteria.some((row) => row.id === "causeLock" && row.status === "PASS") ?? false,
                                  childCount: cards.length > 0 ? cards.length : (executionCounts[idea.id] ?? 0),
                                  pillars: cards.map((card) => ({
                                    id: card.contentPillarId,
                                    label: card.pillarName,
                                    leadMagnet: card.leadMagnet,
                                    executions: rows
                                      .filter((row) => row.contentPillarId === card.contentPillarId)
                                      .map((row) => executionNode(row, Boolean(card.leadMagnet))),
                                  })),
                                  executions: rows
                                    .filter((row) => !row.contentPillarId || !lockedIds.has(row.contentPillarId))
                                    .map((row) => executionNode(row)),
                                };
                              };
                              const mapAngle = (
                                angle: NonNullable<typeof labAngles.data>[number],
                                territoryName: string,
                              ) => {
                                const ideas = (labIdeas.data ?? []).filter(
                                  (idea) =>
                                    idea.angleId === angle.id &&
                                    (idea.validation ?? uncheckedIdeaValidation(idea.statement, angle.statement)).decision === "LOLOS",
                                );
                                const ownSubject = angleChecklists[angle.code.toUpperCase()]?.checks.find(
                                  (check) => check.id === "ownSubject",
                                );
                                const listedSubject =
                                  ownSubject?.state === "fail"
                                    ? ""
                                    : angleListSubject(angle.canonicalSemantic.subject ?? "", territoryName);
                                return {
                                  id: angle.id,
                                  code: angle.code,
                                  statement: angle.statement,
                                  subject: listedSubject,
                                  childCount: ideas.length,
                                  ideas: ideas.map((idea) => mapIdea(idea)),
                                };
                              };
                              const mapTerritory = (row: NonNullable<typeof labTerritories.data>[number]) => {
                                const angles = anglesForTerritory(row.id);
                                return {
                                  id: row.id,
                                  code: row.code,
                                  statement: row.statement,
                                  childCount: angles.length,
                                  angles: angles.map((angle) => mapAngle(angle, row.statement)),
                                };
                              };
                              if (!selected) return lockedChildren;
                              const next = new Map(lockedChildren);
                              const baseRows =
                                selected.mtStatus === "locked"
                                  ? (next.get(selected.id) ?? [])
                                  : shownRowViews.map((row) => ({
                                      id: row.id,
                                      code: row.code,
                                      label: row.label,
                                      statement: row.statement,
                                      childCount: 0,
                                    }));
                              next.set(
                                selected.id,
                                baseRows.map((row) => {
                                  const territories = territoriesForThought(row.id).map(mapTerritory);
                                  return {
                                    ...row,
                                    territories,
                                    childCount: territories.length,
                                  };
                                }),
                              );
                              return next;
                            })()}
                            deleteDisabled={masters.remove.isPending}
                            onSelect={(id) => {
                              skipAutoSelect.current = false;
                              setSelectedId(id);
                              const row = masters.data?.find((item) => item.id === id);
                              setFocus(row?.mtStatus === "locked" ? { kind: "master", masterId: id } : null);
                            }}
                            onSelectChild={(masterId, thoughtId) => {
                              skipAutoSelect.current = false;
                              setSelectedId(masterId);
                              setFocus({ kind: "bigThought", masterId, thoughtId });
                            }}
                            onSelectTerritory={(masterId, thoughtId, territoryId) => {
                              skipAutoSelect.current = false;
                              setSelectedId(masterId);
                              setFocus({ kind: "territory", masterId, thoughtId, territoryId });
                            }}
                            onSelectAngle={(masterId, thoughtId, territoryId, angleId) => {
                              skipAutoSelect.current = false;
                              setSelectedId(masterId);
                              setFocus({ kind: "angle", masterId, thoughtId, territoryId, angleId });
                            }}
                            onSelectIdea={(masterId, thoughtId, territoryId, angleId, ideaId) => {
                              skipAutoSelect.current = false;
                              setSelectedId(masterId);
                              setFocus({ kind: "idea", masterId, thoughtId, territoryId, angleId, ideaId });
                            }}
                            onSelectPillar={(masterId, thoughtId, territoryId, angleId, ideaId, contentPillarId) => {
                              skipAutoSelect.current = false;
                              setSelectedId(masterId);
                              const idea = (labIdeas.data ?? []).find((row) => row.id === ideaId);
                              const card = idea ? pillarCardsFor(idea).find((item) => item.contentPillarId === contentPillarId) : null;
                              setCreativePillarId(contentPillarId);
                              setCreativeFormat(card?.format ?? null);
                              setFocus({ kind: "pillar", masterId, thoughtId, territoryId, angleId, ideaId, contentPillarId });
                            }}
                            onSelectExecution={(masterId, thoughtId, territoryId, angleId, ideaId, executionId) => {
                              skipAutoSelect.current = false;
                              setSelectedId(masterId);
                              setFocus({ kind: "execution", masterId, thoughtId, territoryId, angleId, ideaId, executionId });
                            }}
                            onRequestEdit={(id) => {
                              skipAutoSelect.current = false;
                              setSelectedId(id);
                              setFocus(null);
                              setEditingMasterId(id);
                            }}
                            onRequestDelete={(id) => setPendingDelete({ kind: "master", id })}
                            territoryGenerateThoughtId={territoryGenerateThoughtId}
                            territoryGeneratePending={
                              territoryGenerateThoughtId != null && generatingTerritoryIds.has(territoryGenerateThoughtId)
                            }
                            onGenerateTerritory={(thoughtId) => void onGenerateTerritory(thoughtId)}
                          />
                          </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className={LAB_RIGHT_COL}>
                      <div className={LAB_SECTION}>
                        <div className={cn(LAB_RIGHT_CARD, showBeliefField && "overflow-hidden")}>
                          {showComposer ? (
                            <LabMasterComposer {...masterComposer} />
                          ) : selected && locked && focus?.masterId === selected.id && focus.kind === "execution" ? (
                            focusedExecution ? (
                              <ExecutionScriptPanel
                                pillarName={focusedExecution.pillarName}
                                leadMagnet={Boolean(
                                  focusedIdea &&
                                    pillarCardsFor(focusedIdea).find((card) => card.contentPillarId === focusedExecution.contentPillarId)?.leadMagnet,
                                )}
                                statement={focusedExecution.statement}
                                script={focusedExecution.script}
                                admission={focusedExecution.admission}
                                facts={focusedExecution.canonicalSemantic}
                                reading={executionDraft}
                                progress={executionProgress}
                                pending={busy}
                                passProposal={
                                  executionPassProposal?.executionId === focusedExecution.id ? executionPassProposal.changes : null
                                }
                                onAcceptPassProposal={onAcceptPassProposal}
                                onDeclinePassProposal={onDeclinePassProposal}
                                fixingLineId={fixingLineId}
                                onStop={onStopExecution}
                                onRepair={() => void onRepairExecution()}
                                onFixLine={onFixLine}
                                onRegenerateLine={onRegenerateLine}
                                onRewrite={onRewriteExecution}
                                onRegenerate={onRegenerateExecution}
                                onChangePillar={
                                  pillarHopStopped(focusedExecution.pillarName, focusedExecution.script, focusedExecution.id)
                                    ? undefined
                                    : onOpenPillarPicker
                                }
                                onUseRecommendation={
                                  pillarHopStopped(focusedExecution.pillarName, focusedExecution.script, focusedExecution.id)
                                    ? undefined
                                    : onUseRecommendation
                                }
                                pillarChoices={executionProgress?.phase === "recommend" ? pillarChoices : undefined}
                                onUseOffer={onUseExecutionOffer}
                                onRetrySelling={onRetrySelling}
                                checks={executionChecklists[focusedExecution.id] ?? executionRunChecks ?? undefined}
                                onTogglePass={onToggleExecutionPass}
                                offerNote={executionRepairNote}
                                offer={
                                  executionLineOffer?.executionId === focusedExecution.id
                                    ? executionLineOffer.script.scenes.flatMap((scene) =>
                                        scene.lines.flatMap((line) => {
                                          const previous = focusedExecution.script?.scenes
                                            .flatMap((item) => item.lines)
                                            .find((item) => item.id === line.id);
                                          if (!previous || previous.narration === line.narration) return [];
                                          return [{ lineId: line.id, narration: line.narration }];
                                        }),
                                      )
                                    : null
                                }
                                onViewTable={focusedExecution.script ? () => setScriptTableOpen(true) : undefined}
                                onGenerateCharacter={onGenerateCharacter}
                                onStoreCharacterVisual={onStoreCharacterVisual}
                                onDeleteCharacterVisual={onDeleteCharacterVisual}
                                generatingCharacter={characterGenerate}
                                deletingCharacterVisual={characterVisualDelete}
                                savingCharacterVisual={characterVisualSave}
                                onDelete={
                                  focus.kind === "execution"
                                    ? () => setPendingDelete({ kind: "execution", id: focus.executionId })
                                    : undefined
                                }
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {t("thinkingLab.execution.loading", "Loading the script...")}
                              </p>
                            )
                          ) : selected && locked && focus?.masterId === selected.id && focus.kind === "pillar" ? (
                            <LockedPillarSection
                              name={
                                focusedPillarCard?.pillarName ||
                                (contentPillars.data ?? []).find((pillar) => pillar.id === focus.contentPillarId)?.name ||
                                t("thinkingLab.tree.pillar", "Pillar")
                              }
                              leadMagnet={focusedPillarCard?.leadMagnet}
                              development={focusedPillarCard?.development ?? ""}
                              reason={focusedPillarCard?.reason ?? ""}
                              format={focusedPillarCard?.format ?? creativeFormat}
                              pending={busy}
                              pathUp={pathUp}
                              progress={executionProgress}
                              checks={executionProgress ? executionRunChecks : null}
                              reading={executionProgress ? executionDraft : null}
                              onStop={onStopExecution}
                              onSelectFormat={onOpenExecutionSettings}
                            />
                          ) : selected && locked ? (
                            focus?.masterId === selected.id ? (
                              <LabNodeInspector
                                parentChanged={
                                  focus.kind === "idea"
                                    ? savedParentChanged(ideaSet.data?.audit?.items, focusedIdea?.code)
                                    : focus.kind === "angle"
                                      ? savedParentChanged(angleSet.data?.audit?.items, focusedAngle?.code)
                                      : focus.kind === "territory"
                                        ? savedParentChanged(territorySet.data?.audit?.items, focusedTerritory?.code)
                                        : focus.kind === "bigThought"
                                          ? savedParentChanged(
                                              setRecord?.audit?.items,
                                              lockedChildren.get(selected.id)?.find((child) => child.id === focus.thoughtId)?.code,
                                            )
                                          : false
                                }
                                unchecked={
                                  focus.kind === "idea"
                                    ? savedUnchecked(ideaSet.data?.audit?.items, focusedIdea?.code)
                                    : focus.kind === "angle"
                                      ? savedUnchecked(angleSet.data?.audit?.items, focusedAngle?.code)
                                      : focus.kind === "territory"
                                        ? savedUnchecked(territorySet.data?.audit?.items, focusedTerritory?.code)
                                        : focus.kind === "bigThought"
                                          ? savedUnchecked(
                                              setRecord?.audit?.items,
                                              lockedChildren.get(selected.id)?.find((child) => child.id === focus.thoughtId)?.code,
                                            )
                                          : false
                                }
                                kind={
                                  focus.kind === "idea"
                                    ? "idea"
                                    : focus.kind === "angle"
                                    ? "angle"
                                    : focus.kind === "territory"
                                      ? "territory"
                                      : focus.kind === "bigThought"
                                        ? "bigThought"
                                        : "master"
                                }
                                code={
                                  focus.kind === "idea"
                                    ? focusedIdea?.code
                                    : focus.kind === "angle"
                                    ? focusedAngle?.code
                                    : focus.kind === "territory"
                                      ? focusedTerritory?.code
                                      : focus.kind === "bigThought"
                                    ? lockedChildren.get(selected.id)?.find((child) => child.id === focus.thoughtId)?.code
                                    : undefined
                                }
                                title={
                                  focus.kind === "bigThought"
                                    ? lockedChildren.get(selected.id)?.find((child) => child.id === focus.thoughtId)?.label
                                    : focus.kind === "angle"
                                      ? angleListSubject(
                                          focusedAngle?.canonicalSemantic.subject ?? "",
                                          focusedTerritory?.statement ?? "",
                                        )
                                      : focus.kind === "idea"
                                        ? ideaLabel(focusedIdea?.statement ?? "", focusedIdea?.canonicalSemantic.subject)
                                        : undefined
                                }
                                statement={
                                  focus.kind === "idea"
                                    ? (focusedIdea?.statement ?? "")
                                    : focus.kind === "angle"
                                    ? (focusedAngle?.statement ?? "")
                                    : focus.kind === "territory"
                                    ? (focusedTerritory?.statement ?? "")
                                    : focus.kind === "bigThought"
                                      ? becauseSentence(
                                          becauseParent,
                                          lockedChildren.get(selected.id)?.find((child) => child.id === focus.thoughtId)
                                            ?.statement ?? "",
                                        )
                                      : masterDescription
                                }
                                example={
                                  focus.kind === "angle" && focusedAngle
                                    ? angleCardView(
                                        focusedAngle,
                                        admittedAngles.findIndex((row) => row.id === focusedAngle.id),
                                      ).example
                                    : undefined
                                }
                                checks={
                                  focus.kind === "angle" && focusedAngle && !angleSetLocked
                                    ? angleCardView(
                                        focusedAngle,
                                        admittedAngles.findIndex((row) => row.id === focusedAngle.id),
                                      ).checklist
                                    : undefined
                                }
                                onFixNode={
                                  focus.kind === "angle" && focusedAngle && !angleSetLocked
                                    ? () => onFixAngle(focusedAngle.code)
                                    : undefined
                                }
                                fixingNode={
                                  focus.kind === "angle" && focusedAngle
                                    ? fixingAngleCodes.has(focusedAngle.code.toUpperCase())
                                    : false
                                }
                                territoryId={focus.kind === "territory" ? focusedTerritory?.id : undefined}
                                territoryArea={null}
                                linkSentence={focus.kind === "territory" ? territoryCopy?.area || null : null}
                                areaQuestion={
                                  focus.kind === "territory" ? focusedTerritory?.canonicalSemantic.areaQuestion?.trim() || null : null
                                }
                                territoryPass={
                                  focus.kind === "territory" &&
                                  focusedTerritory?.admission === "GENERATE_VALID" &&
                                  territoryCopy?.pass
                                    ? { lead: territoryCopy.passLead, body: territoryCopy.pass }
                                    : null
                                }
                                onUnlock={focus.kind === "master" ? () => void onUnlock() : undefined}
                                catalog={focus.kind === "master" ? selected.catalog : undefined}
                                catalogs={focus.kind === "master" ? (catalogs.data ?? []) : []}
                                catalogPending={masters.saveCatalog.isPending}
                                onSaveCatalog={
                                  focus.kind === "master"
                                    ? (catalog) => {
                                        void masters.saveCatalog.mutateAsync({ id: selected.id, catalog });
                                      }
                                    : undefined
                                }
                                onDelete={
                                  focus.kind === "bigThought"
                                    ? () => setPendingDelete({ kind: "bigThought", id: focus.thoughtId })
                                    : focus.kind === "territory"
                                      ? () =>
                                          setPendingDelete({
                                            kind: "territory",
                                            id: focus.territoryId,
                                            bigThoughtId: focus.thoughtId,
                                          })
                                      : focus.kind === "idea" && focusedIdea
                                        ? () =>
                                            setPendingDelete({
                                              kind: "idea",
                                              id: focusedIdea.id,
                                              angleId: focusedIdea.angleId,
                                            })
                                        : focus.kind === "angle" && focusedAngle
                                          ? () =>
                                              setPendingDelete({
                                                kind: "angle",
                                                id: focusedAngle.id,
                                                territoryId: focusedAngle.territoryId,
                                              })
                                          : undefined
                                }
                                unlockDisabled={busy}
                                pendingAction={
                                  focus.kind === "bigThought" && generatingTerritoryIds.has(focus.thoughtId)
                                    ? territoryStage === "generate"
                                      ? "generate"
                                      : "generate-territory"
                                    : busyAction
                                }
                                notice={focus.kind === "bigThought" && !territoriesPanelClosed ? notice : null}
                                manualAdd={
                                  focus?.kind === "angle" &&
                                          showGenerateIdea &&
                                          focusedAngle &&
                                          (labIdeas.data ?? []).filter((row) => row.angleId === focusedAngle.id).length <
                                            IDEA_ACTIVE_CAP
                                        ? {
                                            label: t("thinkingLab.manual.idea", "Write an Idea"),
                                            onSubmit: onManualIdea,
                                          }
                                        : null
                                }
                                onEditStatement={
                                  focus?.kind === "territory" && focusedTerritory?.status === "candidate"
                                    ? (statement) => onEditTerritory(focusedTerritory.id, statement)
                                    : focus?.kind === "angle" && focusedAngle?.status === "candidate"
                                      ? (statement) => onEditAngle(focusedAngle.id, statement)
                                      : focus?.kind === "idea" && focusedIdea?.status === "candidate"
                                        ? (statement) => onEditIdea(focusedIdea.id, statement)
                                    : undefined
                                }
                                onEditTerritory={onEditTerritory}
                                onEditAngle={onEditAngle}
                                onEditIdea={onEditIdea}
                                onDeleteIdea={
                                  focus.kind === "angle" && !ideaSetLocked
                                    ? (id) =>
                                        setPendingDelete({
                                          kind: "idea",
                                          id,
                                          angleId: focus.angleId,
                                        })
                                    : undefined
                                }
                                onGenerateAngle={
                                  focus.kind === "territory" || (focus.kind === "bigThought" && !territoriesPanelClosed)
                                    ? (territoryId) => void onGenerateAngle(territoryId)
                                    : undefined
                                }
                                angleId={focus.kind === "angle" ? focusedAngle?.id : undefined}
                                ideaReady={focus.kind === "angle" && showGenerateIdea}
                                onGenerateIdea={
                                  focus.kind === "angle" || focus.kind === "territory"
                                    ? (id) => void onGenerateIdea(id)
                                    : undefined
                                }
                                ideas={
                                  focus.kind === "angle" && angleIdeaRows.length > 0
                                    ? angleIdeaRows.map((row) => {
                                        const validation = validationForIdea(row);
                                        return {
                                          id: row.id,
                                          code: row.code,
                                          statement: row.statement,
                                          decision: validation.decision,
                                          listed: row.status !== "locked",
                                          title: validation.title || row.canonicalSemantic.subject,
                                          concept: validation.concept,
                                          mechanism: validation.mechanism,
                                          value: validation.value,
                                          mechanismKeys: row.canonicalSemantic.mechanismKeys,
                                          editable: row.status === "candidate" && validation.decision === "LOLOS",
                                          verdict: validation.decision === "LOLOS" ? "AUDIT_PASS" : null,
                                          checklist: checksFromValidation(validation),
                                          canRevise: canReviseIdea(row, angleIdeaRows, validation.decision),
                                          unchecked: savedUnchecked(ideaSet.data?.audit?.items, row.code),
                                          parentChanged: savedParentChanged(ideaSet.data?.audit?.items, row.code),
                                        };
                                      })
                                    : undefined
                                }
                                ideaHistory={
                                  focus.kind === "angle" && angleIdeaRows.length > 0
                                    ? ideaHistorySummary(angleIdeaRows.map((row) => validationForIdea(row)))
                                    : null
                                }
                                ideaRevisionTarget={focus.kind === "angle" ? ideaRevisionTarget : null}
                                onReviseIdea={focus.kind === "angle" ? onReviseIdea : undefined}
                                onLockIdeas={
                                  focus.kind === "angle" && !ideaSetLocked && openIdeas.length > 0
                                    ? () => void onLockIdeas()
                                    : undefined
                                }
                                ideaGenerateChecklist={
                                  focus.kind === "angle" &&
                                  ideaGenerateRun != null &&
                                  ideaGenerateRun.angleId === focusedAngle?.id
                                    ? { checks: ideaGenerateRun.checks, report: ideaGenerateRun.report }
                                    : null
                                }
                                executionReady={focus.kind === "idea" && focusedIdeaPassed && focusedIdea?.status === "locked"}
                                creativePath={
                                  focus.kind === "idea" && focusedIdeaPassed && focusedIdea?.status === "locked"
                                    ? (() => {
                                        const lockedIds = pillarCardsFor(focusedIdea).map((card) => card.contentPillarId);
                                        return {
                                          reviews: (creativeReviewReady ? (creativeReviews ?? []) : latestPathReviews(focusedIdea.developmentPaths)).filter(
                                            (review) => review.status === "RECOMMENDED" && review.development.trim() && !lockedIds.includes(review.contentPillarId),
                                          ),
                                          reviewReady: creativeReviewReady && lockedIds.length === 0,
                                          selectedPillarId: null,
                                          selectedPillarName: "",
                                          selectedFormat: null,
                                          lockedPillarIds: lockedIds,
                                          onReview: onReviewCreativePillars,
                                          onReviewLeadMagnet: onReviewLeadMagnetPillars,
                                          leadMagnetStep,
                                          onSelectPillar: onLockCreativePillar,
                                          onLockAllPillars: onLockAllCreativePillars,
                                          onSelectFormat: onOpenExecutionSettings,
                                        };
                                      })()
                                    : null
                                }
                                executionProgress={focus.kind === "idea" ? executionProgress : null}
                                executionChecklist={focus.kind === "idea" && executionProgress ? executionRunChecks : null}
                                onStopExecution={focus.kind === "idea" ? onStopExecution : undefined}
                                angleReady={
                                  focus.kind === "territory" &&
                                  showGenerateAngle &&
                                  admittedAngles.length < ACTIVE_SET_CAP
                                }
                                angles={
                                  focus.kind === "territory" && !angleSetLocked
                                    ? admittedAngles.map((row, index) => {
                                        const view = angleCardView(row, index);
                                        return {
                                          id: row.id,
                                          code: row.code,
                                          statement: row.statement,
                                          subject: view.subject,
                                          example: view.example,
                                          verdict: angleVerdicts[index] ?? null,
                                          editable: row.status === "candidate",
                                          checklist: view.checklist,
                                          checklistNote: angleChecklists[row.code.toUpperCase()]?.note,
                                        };
                                      })
                                    : undefined
                                }
                                angleStage={focus.kind === "territory" && !angleSetLocked ? angleStage : null}
                                angleGenerateChecklist={
                                  focus.kind === "territory" && angleGenerateRun?.territoryId === focus.territoryId
                                    ? { checks: angleGenerateRun.checks, report: angleGenerateRun.report }
                                    : null
                                }
                                onAngleStage={() => void onAngleStage()}
                                onFixAngle={
                                  focus.kind === "territory" && !angleSetLocked ? onFixAngle : undefined
                                }
                                onDeleteAngle={
                                  focus.kind === "territory" && !angleSetLocked
                                    ? (id) =>
                                        setPendingDelete({
                                          kind: "angle",
                                          id,
                                          territoryId: focus.territoryId,
                                        })
                                    : undefined
                                }
                                fixingAngleCodes={
                                  focus.kind === "territory" && !angleSetLocked ? [...fixingAngleCodes] : undefined
                                }
                                onLockAngles={
                                  focus.kind === "territory" &&
                                  !angleSetLocked &&
                                  angleLock.ok
                                    ? () => void onLockAngles()
                                    : undefined
                                }
                                territories={
                                  focus.kind === "bigThought" && !territoriesPanelClosed
                                    ? (focusedThought?.territories ?? []).map((row) => {
                                        const liveChecks = territoryChecklists[row.code.toUpperCase()]?.checks;
                                        const verdictIndex = admittedTerritories.findIndex((item) => item.id === row.id);
                                        const verdict = territoryVerdicts[verdictIndex] ?? null;
                                        const storedItem = territorySet.data?.audit?.items.find(
                                          (item) => item.code.toUpperCase() === row.code.toUpperCase(),
                                        );
                                        return {
                                          ...row,
                                          editable: row.status === "candidate",
                                          checklist:
                                            liveChecks && liveChecks.length > 0
                                              ? liveChecks
                                              : territoryChecksFromStored({
                                                  gateFailure:
                                                    verdict === "AUDIT_FAIL" ? storedItem?.gateFailure ?? null : null,
                                                  passed: verdict === "AUDIT_PASS",
                                                }),
                                          checklistNote: territoryChecklists[row.code.toUpperCase()]?.note,
                                          verdict,
                                        };
                                      })
                                    : undefined
                                }
                                territoryStage={focus.kind === "bigThought" && !territoriesPanelClosed ? territoryStage : null}
                                onTerritoryStage={() => void onTerritoryStage()}
                                onFixTerritory={
                                  focus.kind === "bigThought" && !territoriesPanelClosed ? onFixTerritory : undefined
                                }
                                onDeleteTerritory={
                                  focus.kind === "bigThought" && !territoriesPanelClosed
                                    ? (id) =>
                                        setPendingDelete({
                                          kind: "territory",
                                          id,
                                          bigThoughtId: focus.thoughtId,
                                        })
                                    : undefined
                                }
                                fixingTerritoryCodes={
                                  focus.kind === "bigThought" && !territoriesPanelClosed
                                    ? [...fixingTerritoryCodes]
                                    : undefined
                                }
                                onLockTerritories={
                                  focus.kind === "bigThought" &&
                                  !territoriesPanelClosed &&
                                  territoryLock.ok
                                    ? () => void onLockTerritories()
                                    : undefined
                                }
                                onGenerateTerritory={
                                  focus.kind === "bigThought" &&
                                  focusedThought?.canGenerateTerritory &&
                                  admittedTerritories.length < ACTIVE_SET_CAP
                                    ? () => void onGenerateTerritory(focus.thoughtId)
                                    : undefined
                                }
                                territoryGenerateChecklist={
                                  focus.kind === "bigThought" && territoryGenerateRun?.thoughtId === focus.thoughtId
                                    ? { checks: territoryGenerateRun.checks, report: territoryGenerateRun.report }
                                    : null
                                }
                                pathUp={pathUp}
                                subject={focus.kind === "master" ? masterSubject || null : undefined}
                                subjectNotice={
                                  focus.kind === "master" && !masterSubject
                                    ? t(
                                        "thinkingLab.master.subjectLocked",
                                        "This locked Master Thought has no subject yet. Unlock it, then save it again so the subject is stored.",
                                      )
                                    : null
                                }
                              />
                            ) : null
                          ) : (
                            <LabMasterSectionArea {...masterSection} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
  );
}
