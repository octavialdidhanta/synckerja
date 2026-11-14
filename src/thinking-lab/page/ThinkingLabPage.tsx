import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ClipboardCheck, Loader2, MoreVertical, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Accordion } from "@/shared/components/ui/accordion";
import { CheckSettingsDialog } from "@/thinking-lab/section/CheckSettingsDialog";
import { skippedChecks, type CheckLevel } from "@/thinking-lab/shared/checkSettings";
import { useCheckSettings } from "@/thinking-lab/shared/useCheckSettings";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Textarea } from "@/shared/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { cn } from "@/shared/lib/utils";
import { isGeminiBillingNoticeError, isGeminiBillingNoticeMessage } from "@/shared/ai/geminiSpendCap";
import { askThinkingLab, parseModelJson, setThinkingAuditScope } from "@/thinking-lab/shared/ai";
import { ACTIVE_SET_CAP } from "@/thinking-lab/shared/limits";
import type { AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import {
  bigThoughtFingerprint,
  fingerprintsMatch,
  angleFingerprint,
  ideaFingerprint,
  ideaSetFingerprint,
  territoryFingerprint,
} from "@/thinking-lab/shared/fingerprint";
import { beliefsMatch, confirmedFingerprint, confirmedParentReady } from "@/thinking-lab/master-thought/semantic";
import { masterBeliefDescription } from "@/thinking-lab/master-thought/description";
import { territoryDescriptions, writeTerritoryAreaSentence } from "@/thinking-lab/territory/description";
import {
  firstTerritoryFailure,
  runTerritoryChecks,
  territoryChecksFromStored,
  type TerritoryPassCheck,
  type TerritoryPeer,
} from "@/thinking-lab/territory/passChecklist";
import { buildTerritoryRevisionPrompt, parseTerritoryRevision } from "@/thinking-lab/territory/revise";
import { ANSWERED_QUESTION_VERSION, resolveAnsweredQuestion } from "@/thinking-lab/big-thought/answeredQuestion";
import type { LabMasterThought } from "@/thinking-lab/master-thought/types";
import { useMasterThought } from "@/thinking-lab/master-thought/useMasterThought";
import {
  GENERATE_LESSON_CODE,
  canReviseBigThought,
  bigThoughtVerdict,
  generateLessons,
  mergeBigThoughtLessons,
  readBigThoughtSetRecord,
  withBigThoughtResult,
  withBigThoughtRevision,
  withoutBigThought,
  type BigThoughtSetRecord,
} from "@/thinking-lab/big-thought/record";
import { buildBigThoughtRevisionPrompt, parseBigThoughtRevision } from "@/thinking-lab/big-thought/revise";
import {
  buildGeneratePrompt,
  countGenerateValid,
  keepGroundedBigThoughts,
  nextBigThoughtCode,
  parseGeneratedBigThoughts,
  runGenerateRounds,
} from "@/thinking-lab/big-thought/generate";
import {
  attachLesson,
  checklistFromFailure,
  bigThoughtListed,
  readBigThoughtCheckId,
  waitForChecklistReport,
  type GateLesson,
  type PassChecklist,
} from "@/thinking-lab/big-thought/checklist";
import { factsForBigThoughtChecks, runBigThoughtChecks } from "@/thinking-lab/big-thought/passChecks";
import { asBecauseClause, becauseSentence } from "@/thinking-lab/big-thought/because";
import {
  bigThoughtLabelIsOpen,
  bigThoughtLabelRestates,
  bigThoughtRepeats,
  buildBigThoughtLabelPrompt,
  buildKeyBeliefFromLabelPrompt,
  parseBigThoughtLabels,
  parseKeyBeliefChoice,
  readBigThoughtLabel,
} from "@/thinking-lab/big-thought/label";
import { evaluateLock, selectStageAction } from "@/thinking-lab/big-thought/lock";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import { ManualStatementForm } from "@/thinking-lab/section/ManualStatementForm";
import { activeBigThoughts } from "@/thinking-lab/big-thought/repository";
import type { BigThoughtFacts } from "@/thinking-lab/big-thought/types";
import { useBigThoughts, useLockedLabTree } from "@/thinking-lab/big-thought/useBigThoughts";
import { canShowGenerateAngle } from "@/thinking-lab/angle/eligibility";
import {
  angleChecksFromStored,
  firstAngleFailure,
  runAngleChecks,
  type AnglePassCheck,
  type AnglePeer,
} from "@/thinking-lab/angle/passChecklist";
import { buildAngleRevisionPrompt, parseAngleRevision } from "@/thinking-lab/angle/revise";
import {
  proposeAngleStatements,
  runAngleGenerate,
  shownAngleFacts,
} from "@/thinking-lab/angle/generate";
import { evaluateAngleLock, selectAngleStage } from "@/thinking-lab/angle/lock";
import { visibleAngles } from "@/thinking-lab/angle/policy";
import { angleExampleProblem, normalizeAngleExample } from "@/thinking-lab/angle/example";
import { angleListSubject, angleSubjectProblem } from "@/thinking-lab/angle/subject";
import { loadAngleParentGate, loadAngleSet, saveAngleSet } from "@/thinking-lab/angle/repository";
import {
  angleVerdict,
  canReviseAngle,
  emptyAngleSetRecord,
  mergeAngleAuditLessons,
  withAngleResult,
  withAngleRevision,
  withoutAngle,
  type AngleSetRecord,
} from "@/thinking-lab/angle/record";
import { useAngleSet, useLabAngles } from "@/thinking-lab/angle/useAngles";
import { canShowGenerateIdea } from "@/thinking-lab/idea/eligibility";
import { ideaLabel } from "@/thinking-lab/idea/subject";
import { IDEA_ACTIVE_CAP } from "@/thinking-lab/idea/generate";
import { saveIdeaValidation, type LabIdea } from "@/thinking-lab/idea/repository";
import {  latestPathReviews, leadMagnetBriefForPillar, lockedPillarCards, mergeLockedPillar } from "@/thinking-lab/creative-idea/paths";
import {
  admissionForDecision,
  checksFromValidation,
  ideaHistorySummary,
  uncheckedIdeaValidation,
  type IdeaValidation,
} from "@/thinking-lab/idea/check/record";
import { canReviseIdea } from "@/thinking-lab/idea/revise";
import { useIdeaSet, useLabIdeas } from "@/thinking-lab/idea/useIdeas";
import { savePillarMediumDefault, usePillarMediumDefaults } from "@/thinking-lab/execution/pillarDefaults";
import {
  
  executionChecklistPassed } from "@/thinking-lab/execution/passChecklist";
import {
  
  type ScriptDecision } from "@/thinking-lab/execution/confirm";
import { useOrgContentPillars } from "@/thinking-lab/execution/pillars";
import {  pillarNeedsRecommendation } from "@/thinking-lab/execution/recommend";
import {
  
  buildPlanScript,
  imageContentTypeName,
  withCharacterVisuals,
  withoutCharacterVisual,
  type CharacterVisualKind } from "@/thinking-lab/execution/script";
import { useLabExecutionCounts, useLabExecutions } from "@/thinking-lab/execution/useExecutions";
import { canGenerateTerritory } from "@/thinking-lab/territory/eligibility";
import {
  admittedTerritorySetChanged,
  proposeTerritoryStatements,
  runTerritoryGenerate,
  shownTerritoryFacts,
  territoryRejectionReason,
  territoryRelationForGate,
} from "@/thinking-lab/territory/generate";
import { loadTerritoryParentGate, loadTerritorySet, saveTerritorySet } from "@/thinking-lab/territory/repository";
import { evaluateTerritoryLock, selectTerritoryStage } from "@/thinking-lab/territory/lock";
import {
  canReviseTerritory,
  emptyTerritorySetRecord,
  mergeTerritoryAuditLessons,
  territoryVerdict,
  withTerritoryResult,
  withTerritoryRevision,
  withoutTerritory,
  type TerritorySetRecord,
} from "@/thinking-lab/territory/record";
import type { TerritorySemanticFacts } from "@/thinking-lab/territory/types";
import { useLabTerritories, useTerritorySet } from "@/thinking-lab/territory/useTerritories";
import { ThinkingLabPageSkeleton } from "@/thinking-lab/page/ThinkingLabPageSkeleton";
import { LabWorkspaceGrid } from "@/thinking-lab/page/shells/LabWorkspaceGrid";
import { LabDialogs } from "@/thinking-lab/page/shells/LabDialogs";
import { buildLabWorkspaceGridProps } from "@/thinking-lab/page/shells/labWorkspaceGridTypes";
import type { LabFocus } from "@/thinking-lab/page/labFocus";
import { createAngleActions, useAngleFlowState } from "@/thinking-lab/page/angleFlow";
import { createBigThoughtActions, useBigThoughtFlowState } from "@/thinking-lab/page/bigThoughtFlow";
import { createExecutionActions, useExecutionState } from "@/thinking-lab/page/executionFlow";
import { createTerritoryActions, useTerritoryFlowState } from "@/thinking-lab/page/territoryFlow";
import { createIdeaActions, useIdeaFlowState } from "@/thinking-lab/page/ideaFlow";
import { createMasterThoughtActions } from "@/thinking-lab/page/masterThoughtFlow";
import {
  LAB_MT_CARD,
  LAB_LEFT_COL,
  LAB_LEFT_SECTION,
  LAB_MAIN_GRID,
  LAB_RIGHT_CARD,
  LAB_RIGHT_COL,
  LAB_SECTION,
} from "@/thinking-lab/page/thinkingLabLayout";
import { BigThoughtSection } from "@/thinking-lab/section/BigThoughtSection";
import { buildLockedMapChildren } from "@/thinking-lab/section/lockedMapChildren";
import { LabNodeInspector, NodeDefinitionInfo } from "@/thinking-lab/section/LabNodeInspector";
import { LockedPillarSection } from "@/thinking-lab/section/LockedPillarSection";
import { ExecutionScriptPanel, ExecutionScriptTable } from "@/thinking-lab/section/ExecutionScriptPanel";
import type { CharacterStudioTab } from "@/thinking-lab/section/CharacterVisualStudio";
import { CharacterSheetError, copyStoredCharacterVisual, generateCharacterVisuals, removeCharacterVisual, storeCharacterVisual } from "@/thinking-lab/execution/generateCharacterVisual";
import { invalidateContentPillarQueries } from "@/6-1-dashboard/lib/contentPillarTracker";
import { HeaderAndTab } from "@/6-1-content-calendar/container/HeaderAndTab";
import { SaveToPlanModal } from "@/6-1-script-generator/components/SaveToPlanModal";
import { PillarPickerSheet } from "@/thinking-lab/section/PillarPickerSheet";
import { ExecutionConfirmDialog } from "@/thinking-lab/section/ExecutionConfirmDialog";
import { MasterThoughtMapTree } from "@/thinking-lab/section/MasterThoughtMapTree";
import { ContentUsageAudit } from "@/6-1-dashboard/modal/ContentUsageAudit";
import { MasterCatalogField } from "@/thinking-lab/section/MasterCatalogField";
import { MasterCatalogPicker } from "@/thinking-lab/section/MasterCatalogPicker";
import { EMPTY_CATALOG_LINK, catalogContext, type MasterCatalogLink } from "@/thinking-lab/master-thought/catalog";
import { SavedMasterThoughtList } from "@/thinking-lab/section/SavedMasterThoughtList";
import { useLabCatalogs } from "@/thinking-lab/master-thought/useLabCatalogs";
import { MasterThoughtSection } from "@/thinking-lab/section/MasterThoughtSection";
import type { ProductReasonPool } from "@/thinking-lab/master-thought/productReasonPool";
import { ProductBeliefSource } from "@/thinking-lab/section/ProductBeliefSource";

function parentFingerprint(master: LabMasterThought): string | null {
  if (!master.confirmationSource) return null;
  return confirmedFingerprint(master.statement, master.rootBelief || master.statement);
}

function parentIsReady(master: LabMasterThought): boolean {
  return confirmedParentReady({
    confirmationSource: master.confirmationSource,
    statement: master.statement,
    rootBelief: master.rootBelief,
    semanticFingerprint: master.semanticFingerprint,
  });
}

/** The open node survives a remount of the page (e.g. an auth/access re-check), so the user is not sent back to the start. */
const LAB_VIEW_KEY = "thinking-lab:view";

type StoredLabView = { organizationId: string; selectedId: string | null; focus: LabFocus | null; composerOpen: boolean };

function readStoredLabView(): StoredLabView | null {
  try {
    const raw = sessionStorage.getItem(LAB_VIEW_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredLabView> | null;
    if (!value || typeof value.organizationId !== "string") return null;
    return {
      organizationId: value.organizationId,
      selectedId: typeof value.selectedId === "string" ? value.selectedId : null,
      focus: value.focus && typeof value.focus === "object" && typeof value.focus.kind === "string" ? value.focus : null,
      composerOpen: typeof value.composerOpen === "boolean" ? value.composerOpen : true,
    };
  } catch {
    return null;
  }
}

function writeStoredLabView(view: StoredLabView) {
  try {
    sessionStorage.setItem(LAB_VIEW_KEY, JSON.stringify(view));
  } catch {
    // Storage can be unavailable (private mode, quota); the page still works without it.
  }
}

export function ThinkingLabPage() {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const masters = useMasterThought();
  const catalogs = useLabCatalogs(masters.organizationId);
  const checkSettingsQuery = useCheckSettings(masters.organizationId);
  const checkSettingsRef = useRef(checkSettingsQuery.data?.checks);
  checkSettingsRef.current = checkSettingsQuery.data?.checks;
  /** Checks switched OFF for this organization, read at call time. */
  const skipFor = (level: CheckLevel) => skippedChecks(checkSettingsRef.current, level);
  const skippedMark = (level: CheckLevel): { skipped?: string[] } => {
    const skipped = skipFor(level);
    return skipped.length ? { skipped } : {};
  };
  const [storedView] = useState(readStoredLabView);
  const [selectedId, setSelectedId] = useState<string | null>(() => storedView?.selectedId ?? null);
  const [newPrior, setNewPrior] = useState("");
  const [newPlanted, setNewPlanted] = useState("");
  const [newAudience, setNewAudience] = useState("");
  const [reasonPool, setReasonPool] = useState<ProductReasonPool | null>(null);
  const [newCatalog, setNewCatalog] = useState<MasterCatalogLink>(EMPTY_CATALOG_LINK);
  const [originalDraft, setOriginalDraft] = useState("");
  const [priorDraft, setPriorDraft] = useState("");
  const [audienceDraft, setAudienceDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const labRunRef = useRef(false);
  const territoryFlowState = useTerritoryFlowState();
  const { generatingTerritoryIds, fixingTerritoryCodes, territoryChecklists, territoryGenerateRun } = territoryFlowState;
  const angleFlowState = useAngleFlowState();
  const { fixingAngleCodes, angleChecklists, angleGenerateRun } = angleFlowState;
  const legacyIdeaSaveRef = useRef(new Set<string>());
  const ideaFlowState = useIdeaFlowState();
  const { ideaGenerateRun, ideaRevisionTarget } = ideaFlowState;
  const [notice, setNotice] = useState<string | null>(null);
  const bigThoughtFlowState = useBigThoughtFlowState();
  const { auditProgress, setAuditProgress, bigThoughtChecklists, fixingBigThoughtCodes, generateChecklist } =
    bigThoughtFlowState;
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "master"; id: string }
    | { kind: "bigThought"; id: string }
    | { kind: "territory"; id: string; bigThoughtId: string }
    | { kind: "angle"; id: string; territoryId: string }
    | { kind: "idea"; id: string; angleId: string }
    | { kind: "execution"; id: string }
    | null
  >(null);
  const [editingMasterId, setEditingMasterId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(() => storedView?.composerOpen ?? true);
  const [showManualBigThought, setShowManualBigThought] = useState(false);
  const [focus, setFocus] = useState<LabFocus | null>(() => storedView?.focus ?? null);
  const skipAutoSelect = useRef(false);
  const selected = masters.data?.find((row) => row.id === selectedId) ?? null;
  /** Names of the selected Master Thought's catalog; null until a category is linked. */
  const selectedCatalog = selected ? catalogContext(selected.catalog, catalogs.data ?? []) : null;
  const catalogRequiredMessage = () =>
    t("thinkingLab.catalog.required", "Pilih kategori katalog dulu sebelum menyimpan Master Thought.");
  const thoughts = useBigThoughts(selected?.id ?? null);
  const lockedTree = useLockedLabTree();
  const showContent = useDebouncedReady(!masters.hasPendingLoad && !lockedTree.isLoading, 200);
  const locked = selected?.mtStatus === "locked";
  const setRecord = useMemo(() => readBigThoughtSetRecord(selected?.lastAudit), [selected?.lastAudit]);
  const ready = selected ? parentIsReady(selected) : false;
  const masterSubject = selected?.canonicalSemantic?.subject?.trim() ?? "";
  const masterDescription = selected
    ? masterBeliefDescription(selected.statement || selected.originalInput, selected.audience)
    : "";
  const editingBelief = selected != null && editingMasterId === selected.id;
  const showBeliefField = Boolean(selected) && (!ready || !masterSubject || editingBelief) && !locked;
  const hasMasters = (masters.data?.length ?? 0) > 0;
  const showComposer = !hasMasters || composerOpen;
  const parentFp = selected ? parentFingerprint(selected) : null;

  useEffect(() => {
    if (skipAutoSelect.current) return;
    if (!selectedId && masters.data?.[0]) setSelectedId(masters.data[0].id);
  }, [masters.data, selectedId]);

  // A restored view from another organization, or one whose Master Thought is gone, starts fresh.
  const storedViewChecked = useRef(false);
  useEffect(() => {
    if (storedViewChecked.current || !storedView || !masters.organizationId || !masters.data) return;
    storedViewChecked.current = true;
    const sameOrg = storedView.organizationId === masters.organizationId;
    const masterExists = storedView.selectedId == null || masters.data.some((row) => row.id === storedView.selectedId);
    if (sameOrg && masterExists) return;
    setSelectedId(null);
    setFocus(null);
    setComposerOpen(true);
  }, [storedView, masters.organizationId, masters.data]);

  useEffect(() => {
    if (!masters.organizationId) return;
    if (storedView && !storedViewChecked.current) return;
    writeStoredLabView({ organizationId: masters.organizationId, selectedId, focus, composerOpen });
  }, [masters.organizationId, selectedId, focus, composerOpen, storedView]);

  useEffect(() => {
    setOriginalDraft(selected?.originalInput ?? "");
    setPriorDraft(selected?.priorBelief ?? "");
    setAudienceDraft(selected?.audience ?? "");
    setShowManualBigThought(false);
  }, [selected?.id, selected?.originalInput, selected?.priorBelief, selected?.audience]);

  useEffect(() => {
    setNotice(null);
    setAuditProgress(null);
  }, [selected?.id]);

  useEffect(() => {
    if (!locked || !selected?.id) return;
    setEditingMasterId((current) => (current === selected.id ? null : current));
  }, [locked, selected?.id]);

  const active = useMemo(() => activeBigThoughts(thoughts.data ?? []), [thoughts.data]);
  const labelFlight = useRef(false);
  const labeledAttempt = useRef(new Set<string>());

  useEffect(() => {
    if (labelFlight.current || busy || !selected || !thoughts.organizationId) return;
    const missing = (thoughts.data ?? []).filter(
      (row) =>
        row.status !== "rejected" &&
        !labeledAttempt.current.has(row.id) &&
        (!row.label.trim() || bigThoughtLabelIsOpen(row.label) || bigThoughtLabelRestates(row.label, row.statement)),
    );
    if (missing.length === 0) return;
    labelFlight.current = true;
    const ids = missing.map((row) => row.id);
    const masterThoughtId = selected.id;
    void (async () => {
      try {
        setThinkingAuditScope({ masterThoughtId, action: "lab_label", target: "Big Thought" });
        const script = await askThinkingLab(
          buildBigThoughtLabelPrompt(missing.map((row) => ({ code: row.code, statement: row.statement }))),
          0,
        );
        const parsed = parseBigThoughtLabels(script ? parseModelJson(script) : null);
        const labels = missing.flatMap((row) => {
          const label = parsed.get(row.code.toUpperCase());
          if (!label || bigThoughtLabelIsOpen(label) || bigThoughtLabelRestates(label, row.statement)) return [];
          return [{ id: row.id, label }];
        });
        if (labels.length > 0) await thoughts.saveLabels.mutateAsync(labels);
        } catch {
        // The Key Belief stays as stored. The next visit can ask for the heading again.
      } finally {
        for (const id of ids) labeledAttempt.current.add(id);
        labelFlight.current = false;
        void queryClient.invalidateQueries({ queryKey: ["content-ai-usage", "master", masterThoughtId] });
      }
    })();
  }, [busy, selected, thoughts.data, thoughts.organizationId, thoughts.saveLabels]);
  const territoryParentIds = useMemo(() => active.map((row) => row.id), [active]);
  const descriptionFlight = useRef(new Set<string>());
  const labTerritories = useLabTerritories(territoryParentIds);

  useEffect(() => {
    if (busy || !thoughts.organizationId) return;
    const parents = new Map((thoughts.data ?? []).map((row) => [row.id, row]));
    const missing = (labTerritories.data ?? []).filter((row) => {
      if (row.admission !== "GENERATE_VALID" || descriptionFlight.current.has(row.id)) return false;
      const parent = parents.get(row.bigThoughtId);
      const area = territoryDescriptions(row.statement, row.canonicalSemantic.whatItSays, parent?.statement ?? "").area;
      return !area || !row.canonicalSemantic.areaQuestion?.trim();
    });
    if (missing.length === 0) return;
    for (const row of missing) descriptionFlight.current.add(row.id);
    void Promise.all(
      missing.map(async (row) => {
        const parent = parents.get(row.bigThoughtId);
        if (!parent) return;
        const stored = parent.canonicalSemantic;
        const question =
          stored?.answeredQuestionVersion === ANSWERED_QUESTION_VERSION ? stored.answeredQuestion?.trim() ?? "" : "";
        try {
          if (selected?.id) {
            setThinkingAuditScope({ masterThoughtId: selected.id, action: "lab_territory_area", target: "Territory" });
          }
          const written = await writeTerritoryAreaSentence({
            territory: row.statement,
            parentStatement: parent.statement,
            masterStatement: selected?.statement,
            audience: selected?.audience,
            answeredQuestion: question,
            siblings: (labTerritories.data ?? [])
              .filter(
                (item) =>
                  item.id !== row.id && item.bigThoughtId === row.bigThoughtId && item.admission === "GENERATE_VALID",
              )
              .map((item) => item.statement),
            ask: (prompt) => askThinkingLab(prompt, 0.2),
          });
          if (!written.sentence || !written.question) return;
          await labTerritories.saveGloss.mutateAsync({
            bigThoughtId: row.bigThoughtId,
            id: row.id,
            facts: { ...row.canonicalSemantic, whatItSays: written.sentence, areaQuestion: written.question },
          });
        } catch {
          descriptionFlight.current.delete(row.id);
        }
      }),
    ).finally(() => {
      if (selected?.id) void queryClient.invalidateQueries({ queryKey: ["content-ai-usage", "master", selected.id] });
    });
  }, [busy, labTerritories.data, labTerritories.saveGloss, queryClient, selected?.audience, selected?.id, selected?.statement, thoughts.data, thoughts.organizationId]);
  const angleParentIds = useMemo(() => (labTerritories.data ?? []).map((row) => row.id), [labTerritories.data]);
  const labAngles = useLabAngles(angleParentIds);
  const ideaParentIds = useMemo(() => (labAngles.data ?? []).map((row) => row.id), [labAngles.data]);
  const labIdeas = useLabIdeas(ideaParentIds);
  const executionCountIdeaIds = useMemo(() => {
    if (!focus || !("angleId" in focus)) return [];
    const angle = (labAngles.data ?? []).find((row) => row.id === focus.angleId);
    if (!angle) return [];
    return (labIdeas.data ?? [])
      .filter(
        (idea) =>
          idea.angleId === focus.angleId &&
          (idea.validation ?? uncheckedIdeaValidation(idea.statement, angle.statement)).decision === "LOLOS",
      )
      .map((idea) => idea.id);
  }, [focus, labAngles.data, labIdeas.data]);
  const executionCounts = useLabExecutionCounts(executionCountIdeaIds);
  const lockedChildren = useMemo(
    () =>
      buildLockedMapChildren({
        lockedRows: lockedTree.data ?? [],
        selected,
        selectedRows: thoughts.data,
      }),
    [lockedTree.data, selected, thoughts.data],
  );
  const rowViews = useMemo(() => {
    return active.map((row) => {
      const current = parentFp
        ? bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp })
        : "";
      const admission = individualAdmission({
        facts: row.canonicalSemantic,
        factsCurrent: Boolean(parentFp) && fingerprintsMatch(row.semanticFingerprint, current),
      });
      const audit = parentFp ? bigThoughtVerdict(row, setRecord, current) : null;
      const storedFailure =
        audit === "AUDIT_FAIL"
          ? setRecord.audit?.items.find((item) => item.code.toUpperCase() === row.code.toUpperCase())?.gateFailure ?? null
          : null;
      return {
        id: row.id,
        code: row.code,
        label: row.label,
        statement: row.statement,
        status: row.status,
        admission,
        audit,
        facts: row.canonicalSemantic,
        gateFailure: row.canonicalSemantic?.gateFailure ?? null,
        auditGatesChecked: audit === "AUDIT_PASS",
        auditGateFailure: storedFailure ? { ...storedFailure, earlier: "pass" as const } : null,
        canGenerateTerritory: canGenerateTerritory(
          {
            status: row.status,
            statement: row.statement,
            semanticFingerprint: row.semanticFingerprint,
          },
          parentFp,
        ),
        territories: (labTerritories.data ?? [])
          .filter((item) => item.bigThoughtId === row.id && item.admission === "GENERATE_VALID")
          .map((item) => {
            const bigThoughtFingerprintNow = parentFp
              ? bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp })
              : "";
            return {
              id: item.id,
              code: item.code,
              statement: item.statement,
              detail: territoryDescriptions(item.statement, item.canonicalSemantic.whatItSays, row.statement).area,
              question: item.canonicalSemantic.areaQuestion?.trim() || undefined,
              status: item.status,
              canGenerateAngle: canShowGenerateAngle(
                {
                  status: item.status,
                  statement: item.statement,
                  semanticFingerprint: item.semanticFingerprint,
                },
                bigThoughtFingerprintNow,
              ),
              angles: visibleAngles(labAngles.data ?? [], item.id)
                .filter((angle) => fingerprintsMatch(angle.parentTerritoryFingerprint, item.semanticFingerprint))
                .map((angle) => ({
                  id: angle.id,
                  code: angle.code,
                  statement: angle.statement,
                  subject: angle.canonicalSemantic.subject,
                  relation: angle.canonicalSemantic.relationToParent,
                })),
            };
          }),
      };
    });
  }, [active, parentFp, setRecord, labTerritories.data, labAngles.data]);
  const shownRowViews = useMemo(() => rowViews.filter((row) => bigThoughtListed(row)), [rowViews]);

  const focusedThought =
    locked && focus && focus.kind !== "master" && focus.masterId === selected?.id
      ? (shownRowViews.find((row) => row.id === focus.thoughtId) ?? null)
      : null;
  const territorySet = useTerritorySet(focusedThought?.id ?? null);
  const focusedTerritory =
    focus && focus.kind !== "master" && focus.kind !== "bigThought"
      ? ((labTerritories.data ?? []).find((row) => row.id === focus.territoryId) ?? null)
      : null;
  const territoryCopy = focusedTerritory
    ? territoryDescriptions(
        focusedTerritory.statement,
        focusedTerritory.canonicalSemantic.whatItSays,
        focusedThought?.statement ?? "",
      )
    : null;
  const angleSet = useAngleSet(focusedTerritory?.id ?? null);
  const masterStatement = (selected?.statement || selected?.originalInput || "").trim();
  const ideaAudience = {
    audience: selected?.audience ?? "",
    priorBelief: selected?.priorBelief ?? "",
    rootBelief: selected?.rootBelief ?? "",
  };
  const becauseParent = (masterSubject || masterStatement).trim();
  const answeredQuestion = (
    focusedThought?.facts?.answeredQuestionVersion === ANSWERED_QUESTION_VERSION
      ? focusedThought.facts.answeredQuestion?.trim() ?? ""
      : ""
  ).trim();
  const territoryAncestors: AncestorStake[] = masterStatement
    ? [{ label: "Master Thought", statement: masterStatement }]
    : [];
  const angleAncestors: AncestorStake[] = [
    ...(focusedThought?.statement.trim() ? [{ label: "Big Thought", statement: focusedThought.statement.trim() }] : []),
    ...territoryAncestors,
  ];
  const ancestorsWithMaster = (ancestors: AncestorStake[]): AncestorStake[] => {
    const rest = ancestors.filter((row) => row.label !== "Master Thought");
    return masterStatement ? [...rest, { label: "Master Thought", statement: masterStatement }] : ancestors;
  };
  const admittedTerritories = (labTerritories.data ?? []).filter(
    (row) => row.bigThoughtId === focusedThought?.id && row.admission === "GENERATE_VALID",
  );
  const focusedBigThoughtFingerprint =
    focusedThought && parentFp
      ? bigThoughtFingerprint({ statement: focusedThought.statement, masterThoughtFingerprint: parentFp })
      : "";
  const territoryStatementFingerprint = (statement: string) =>
    focusedBigThoughtFingerprint ? territoryFingerprint({ statement, bigThoughtFingerprint: focusedBigThoughtFingerprint }) : "";
  const territoryVerdicts = admittedTerritories.map((row) =>
    territoryVerdict(row, territorySet.data, territoryStatementFingerprint(row.statement)),
  );
  /** Territories of the focused Big Thought that already passed (or are locked), for the "Beda dari Territory lain" check. */
  const territoryPeers = (exceptCode?: string): TerritoryPeer[] =>
    admittedTerritories
      .filter((row, index) => territoryVerdicts[index] === "AUDIT_PASS" && row.code.toUpperCase() !== exceptCode?.toUpperCase())
      .map((row) => ({ code: row.code, statement: row.statement }));
  const territoryLock = evaluateTerritoryLock({ verdicts: territoryVerdicts });
  const territoryStage = selectTerritoryStage({
    verdicts: territoryVerdicts,
    canAdd: admittedTerritories.length < ACTIVE_SET_CAP,
  });
  const admittedSetLocked =
    admittedTerritories.length >= 3 && admittedTerritories.every((row) => row.status === "locked");
  const territoriesPanelClosed =
    admittedTerritories.length > 0 && admittedTerritories.every((row) => row.status === "locked");
  const territoryGenerateThoughtId =
    focus?.kind === "bigThought" &&
    focusedThought?.canGenerateTerritory &&
    admittedTerritories.length === 0 &&
    !admittedSetLocked &&
    territoryStage !== "generate"
      ? focusedThought.id
      : null;
  const admittedAngles = (labAngles.data ?? []).filter(
    (row) => row.territoryId === focusedTerritory?.id && row.admission === "GENERATE_VALID",
  );
  const parentTerritoryFingerprint =
    focusedTerritory && focusedBigThoughtFingerprint
      ? territoryFingerprint({
          statement: focusedTerritory.statement,
          bigThoughtFingerprint: focusedBigThoughtFingerprint,
        })
      : "";
  const angleStatementFingerprint = (statement: string) =>
    parentTerritoryFingerprint ? angleFingerprint({ statement, territoryFingerprint: parentTerritoryFingerprint }) : "";
  const angleVerdicts = admittedAngles.map((row) =>
    angleVerdict(row, angleSet.data, angleStatementFingerprint(row.statement)),
  );
  /** Angles of the focused Territory that already passed (or are locked), for the "Beda dari Angle lain" check. */
  const anglePeers = (exceptCode?: string): AnglePeer[] =>
    admittedAngles
      .filter((row, index) => angleVerdicts[index] === "AUDIT_PASS" && row.code.toUpperCase() !== exceptCode?.toUpperCase())
      .map((row) => ({ code: row.code, statement: row.statement, subject: row.canonicalSemantic.subject ?? "" }));
  const angleLock = evaluateAngleLock({ verdicts: angleVerdicts });
  const angleCardView = (row: (typeof admittedAngles)[number], index: number) => {
    const territoryName = focusedTerritory?.statement ?? "";
    const storedSubject = row.canonicalSemantic.subject ?? "";
    const storedExample = row.canonicalSemantic.example ?? "";
    const subjectProblem = angleSubjectProblem(storedSubject, territoryName);
    const exampleProblem = angleExampleProblem(storedExample, row.statement);
    const liveChecks = angleChecklists[row.code.toUpperCase()]?.checks;
    const liveSettled = (id: string) =>
      (liveChecks ?? []).some((check) => check.id === id && check.state !== "pending");
    const storedItem = angleSet.data?.audit?.items.find(
      (item) => item.code.toUpperCase() === row.code.toUpperCase(),
    );
    const storedChecks = angleChecksFromStored({
      gateFailure: angleVerdicts[index] === "AUDIT_FAIL" ? (storedItem?.gateFailure ?? null) : null,
      passed: angleVerdicts[index] === "AUDIT_PASS",
    });
    const base = liveChecks && liveChecks.length > 0 ? liveChecks : storedChecks;
    const markFailed = (id: "ownSubject" | "livedExample", reason: string) =>
      base.some((check) => check.id === id)
        ? base.map((check) => (check.id === id ? { id, state: "fail" as const, reason } : check))
        : [...base, { id, state: "fail" as const, reason }];
    let checklist: AnglePassCheck[] = base;
    if (subjectProblem && !liveSettled("ownSubject")) checklist = markFailed("ownSubject", subjectProblem);
    else if (exampleProblem && !liveSettled("livedExample")) checklist = markFailed("livedExample", exampleProblem);
    const liveOwn = (liveChecks ?? []).find((check) => check.id === "ownSubject");
    return {
      checklist,
      subject: liveOwn?.state === "fail" ? "" : angleListSubject(storedSubject, territoryName),
      example: normalizeAngleExample(storedExample),
    };
  };
  const angleStage = selectAngleStage({ verdicts: angleVerdicts });
  const angleSetLocked = admittedAngles.length > 0 && admittedAngles.every((row) => row.status === "locked");
  const territoryAlreadySealed = canShowGenerateAngle(focusedTerritory, focusedBigThoughtFingerprint || null);
  const showGenerateAngle = Boolean(
    focusedTerritory?.admission === "GENERATE_VALID" &&
      focusedThought?.canGenerateTerritory &&
      (focusedTerritory.status !== "locked" || territoryAlreadySealed),
  );
  const focusedAngle =
    focus?.kind === "angle" ? ((labAngles.data ?? []).find((row) => row.id === focus.angleId) ?? null) : null;
  const ideaSet = useIdeaSet(
    focus?.kind === "angle" || focus?.kind === "idea" || focus?.kind === "execution" ? focus.angleId : null,
  );
  const focusedTerritoryFingerprint =
    focusedTerritory && focusedBigThoughtFingerprint
      ? territoryFingerprint({ statement: focusedTerritory.statement, bigThoughtFingerprint: focusedBigThoughtFingerprint })
      : "";
  const showGenerateIdea = canShowGenerateIdea(focusedAngle, focusedTerritoryFingerprint || null);
  const angleIdeaRows = (labIdeas.data ?? []).filter((row) => focusedAngle && row.angleId === focusedAngle.id);
  const validationForIdea = (row: (typeof angleIdeaRows)[number]) =>
    row.validation ?? uncheckedIdeaValidation(row.statement, focusedAngle?.statement ?? "");
  const admittedIdeas = angleIdeaRows.filter((row) => validationForIdea(row).decision === "LOLOS");
  const openIdeas = admittedIdeas.filter((row) => row.status !== "locked");
  useEffect(() => {
    if (!masters.organizationId || !focusedAngle) return;
    const angleId = focusedAngle.id;
    const angleStatement = focusedAngle.statement;
    const pending = (labIdeas.data ?? []).filter(
      (row) => row.angleId === angleId && !row.validation && !legacyIdeaSaveRef.current.has(row.id),
    );
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      let failed = false;
      for (const row of pending) {
        legacyIdeaSaveRef.current.add(row.id);
        const validation = uncheckedIdeaValidation(row.statement, angleStatement);
        try {
          await saveIdeaValidation({
            organizationId: masters.organizationId as string,
            angleId: row.angleId,
            id: row.id,
            validation,
            admission: admissionForDecision(validation.decision),
          });
        } catch {
          failed = true;
        }
      }
      if (cancelled) return;
      if (failed) {
        setNotice(t("thinkingLab.idea.historyUnsaved", "This history could not be saved."));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["thinking-lab-ideas", masters.organizationId] });
    })();
    return () => {
      cancelled = true;
    };
  }, [focusedAngle, labIdeas.data, masters.organizationId, queryClient, t]);
  const parentAngleFingerprint =
    focusedAngle && focusedTerritoryFingerprint
      ? angleFingerprint({ statement: focusedAngle.statement, territoryFingerprint: focusedTerritoryFingerprint })
      : "";
  const ideaFingerprintNow = ideaSetFingerprint({
    angleFingerprint: parentAngleFingerprint,
    ideaFingerprints: admittedIdeas.map((row) =>
      ideaFingerprint({ statement: row.statement, angleFingerprint: parentAngleFingerprint }),
    ),
  });
  /** Every open Idea already carries a pass mark for its current sentence, so Lock does not save one again. */
  const ideaAuditSaved = openIdeas.every((row) => {
    const item = ideaSet.data?.audit?.items.find((entry) => entry.code.toUpperCase() === row.code.toUpperCase());
    return (
      item?.verdict === "AUDIT_PASS" &&
      item.statementFingerprint === ideaFingerprint({ statement: row.statement, angleFingerprint: parentAngleFingerprint })
    );
  });
  const ideaSetLocked = admittedIdeas.length > 0 && admittedIdeas.every((row) => row.status === "locked");
  const focusedIdea =
    focus?.kind === "idea" || focus?.kind === "pillar" || focus?.kind === "execution"
      ? ((labIdeas.data ?? []).find((row) => row.id === focus.ideaId) ?? null)
      : null;
  const focusedIdeaAngle = focusedIdea
    ? ((labAngles.data ?? []).find((row) => row.id === focusedIdea.angleId) ?? null)
    : null;
  const focusedIdeaPassed = Boolean(
    focusedIdea &&
      focusedIdeaAngle &&
      (focusedIdea.validation ?? uncheckedIdeaValidation(focusedIdea.statement, focusedIdeaAngle.statement)).decision === "LOLOS",
  );
  const labExecutions = useLabExecutions(focusedIdeaPassed && focusedIdea?.status === "locked" ? focusedIdea.id : null);
  const contentPillars = useOrgContentPillars(masters.organizationId, locked);
  const pillarMediums = usePillarMediumDefaults(masters.organizationId);
  const executionState = useExecutionState();
  const { pillarPickerOpen, setPillarPickerOpen, executionDirect, creativeReviews, setCreativeReviews, creativeReviewReady, setCreativeReviewReady, leadMagnetStep, creativePillarId, setCreativePillarId, creativeFormat, setCreativeFormat, scriptConfirm, setScriptConfirm, masterSells, setMasterSells, executionChecklists, executionRunChecks, executionLineOffer, executionPassProposal, executionRepairNote, executionDraft, executionProgress, pillarChoices, fixingLineId, setFixingLineId, scriptTableOpen, setScriptTableOpen, planSaveOpen, setPlanSaveOpen, characterGenerate, setCharacterGenerate, characterVisualDelete, setCharacterVisualDelete, characterVisualSave, setCharacterVisualSave, executionCancel, confirmToken } = executionState;
  useEffect(() => {
    const latest = [...(focusedIdea?.developmentPaths ?? [])].sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0];
    setCreativePillarId(latest?.contentPillarId ?? null);
    setCreativeFormat(latest?.format ?? null);
    setCreativeReviews(latest && latest.reviews.length > 0 ? latest.reviews : null);
    setCreativeReviewReady(Boolean(latest && latest.reviews.length > 0));
  }, [focusedIdea?.id, setCreativeFormat, setCreativePillarId, setCreativeReviewReady, setCreativeReviews]);
  const recommendationAttempt = useRef(new Set<string>());
  useEffect(() => {
    setMasterSells("unknown");
  }, [selected?.id, setMasterSells]);
  useEffect(() => {
    setScriptTableOpen(false);
    setPlanSaveOpen(false);
    setCharacterGenerate(null);
    setCharacterVisualDelete(null);
    setCharacterVisualSave(null);
    setFixingLineId(null);
  }, [focus?.kind === "execution" ? focus.executionId : null, setCharacterGenerate, setCharacterVisualDelete, setCharacterVisualSave, setFixingLineId, setPlanSaveOpen, setScriptTableOpen]);

  const bigThoughtVerdicts = shownRowViews.map((row) => row.audit);
  const lockDecision = evaluateLock({ verdicts: bigThoughtVerdicts });
  const stageAction = selectStageAction({ verdicts: bigThoughtVerdicts });
  /** Big Thoughts that already passed (or are locked), for the "Beda dari BT lain" check. */
  const bigThoughtPeers = (exceptCode?: string) =>
    shownRowViews
      .filter((row) => row.audit === "AUDIT_PASS" && row.code.toUpperCase() !== exceptCode?.toUpperCase())
      .map((row) => ({ code: row.code, statement: row.statement, label: row.label }));
  const bigThoughtStatementFingerprint = (statement: string) =>
    parentFp ? bigThoughtFingerprint({ statement, masterThoughtFingerprint: parentFp }) : "";
  const showGenerateBigThought = Boolean(
    ready && masterSubject && !locked && stageAction !== "generate",
  );
  const masterMenuStage = stageAction;
  const labTarget = (action?: string | null): string | null => {
    if (!action) return null;
    if (action === "save-master" || action === "suggest-belief") return "Master Thought";
    if (action === "generate" || action === "manual-big-thought" || action === "audit" || action === "fix") return "Big Thought";
    if (action.includes("angle")) return "Angle";
    if (action.includes("idea")) return "Idea";
    if (action.includes("territory")) return "Territory";
    if (action.startsWith("execution")) return "Execution";
    return null;
  };
  const bindUsage = (action?: string | null, masterThoughtId?: string | null, target?: string | null) => {
    setThinkingAuditScope({
      masterThoughtId: masterThoughtId ?? selected?.id ?? focus?.masterId ?? null,
      action: action ? `lab_${action}` : null,
      target: target || labTarget(action) || "Master Thought",
    });
  };
  const askScoped = (action: string, target: string, prompt: string, temperature: 0 | 0.2 = 0) => {
    setThinkingAuditScope({
      masterThoughtId: selected?.id ?? focus?.masterId ?? null,
      action: `lab_${action}`,
      target,
    });
    return askThinkingLab(prompt, temperature);
  };

  const run = async (work: () => Promise<void>, action?: string, target?: string) => {
    if (!masters.organizationId || labRunRef.current) return;
    labRunRef.current = true;
    const masterThoughtId = selected?.id ?? focus?.masterId ?? null;
    bindUsage(action, masterThoughtId, target);
    setBusy(true);
    setBusyAction(action ?? null);
    setNotice(null);
    try {
      await work();
    } catch (error) {
      reportStepError(error);
    } finally {
      labRunRef.current = false;
      setBusy(false);
      setBusyAction(null);
      if (masterThoughtId) void queryClient.invalidateQueries({ queryKey: ["content-ai-usage", "master", masterThoughtId] });
    }
  };

  const reportStepError = (error: unknown) => {
    if (isGeminiBillingNoticeError(error)) return;
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code === "23505") {
      toast.error(t("thinkingLab.error.duplicateCode", "That Big Thought code is already saved. Run Generate again."));
      return;
    }
    toast.error(error instanceof Error ? error.message : t("thinkingLab.error.generic", "Thinking Lab could not finish that step."));
  };

  const runManual = async (action: string, work: () => Promise<string | null>, target?: string): Promise<string | null> => {
    if (!masters.organizationId || labRunRef.current) return null;
    labRunRef.current = true;
    const masterThoughtId = selected?.id ?? focus?.masterId ?? null;
    bindUsage(action, masterThoughtId, target);
    setBusy(true);
    setBusyAction(action);
    setNotice(null);
    try {
      return await work();
    } catch (error) {
      if (isGeminiBillingNoticeError(error)) return null;
      const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
      const message = code === "23505"
        ? t("thinkingLab.error.duplicateCode", "That Big Thought code is already saved. Run Generate again.")
        : error instanceof Error ? error.message : t("thinkingLab.error.generic", "Thinking Lab could not finish that step.");
      toast.error(message);
      return message;
    } finally {
      labRunRef.current = false;
      setBusy(false);
      setBusyAction(null);
      if (masterThoughtId) void queryClient.invalidateQueries({ queryKey: ["content-ai-usage", "master", masterThoughtId] });
    }
  };

  const { onCreate, onSuggestBeliefs, onSaveMaster } = createMasterThoughtActions({
    t,
    masters,
    skipFor,
    catalogRequiredMessage,
    selected,
    selectedCatalog,
    originalDraft,
    priorDraft,
    audienceDraft,
    reasonPool,
    newPrior,
    setNewPrior,
    newPlanted,
    setNewPlanted,
    newAudience,
    setNewAudience,
    setReasonPool,
    newCatalog,
    setNewCatalog,
    catalogs,
    setComposerOpen,
    setSelectedId,
    skipAutoSelect,
    setEditingMasterId,
    bindUsage,
    run,
    runManual,
  });

  const closeComposer = () => {
    setComposerOpen(false);
    setNewPrior("");
    setNewPlanted("");
    setNewAudience("");
    setReasonPool(null);
    setNewCatalog(EMPTY_CATALOG_LINK);
  };

  const confirmDelete = () => {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    if (target.kind === "master") {
      const deletingSelected = selectedId === target.id;
    if (deletingSelected) skipAutoSelect.current = true;
    void run(async () => {
      try {
          await masters.remove.mutateAsync(target.id);
        if (deletingSelected) setSelectedId(null);
      } catch (error) {
        if (deletingSelected) skipAutoSelect.current = false;
        throw error;
      }
      });
      return;
    }
    if (target.kind === "bigThought") {
      const removed = (thoughts.data ?? []).find((item) => item.id === target.id);
      void run(async () => {
        await thoughts.remove.mutateAsync(target.id);
        if (removed && selected) {
          await masters.saveSet.mutateAsync({
            id: selected.id,
            lastAudit: withoutBigThought(readBigThoughtSetRecord(selected.lastAudit), removed.code),
          });
        }
        setFocus((current) =>
          current && current.kind !== "master" && current.thoughtId === target.id
            ? { kind: "master", masterId: current.masterId }
            : current,
        );
      });
      return;
    }
    if (target.kind === "execution") {
      void run(async () => {
        await labExecutions.remove.mutateAsync(target.id);
        setScriptTableOpen(false);
        setFocus((current) =>
          current?.kind === "execution" && current.executionId === target.id
            ? {
                kind: "idea",
                masterId: current.masterId,
                thoughtId: current.thoughtId,
                territoryId: current.territoryId,
                angleId: current.angleId,
                ideaId: current.ideaId,
              }
            : current,
        );
      });
      return;
    }
    if (target.kind === "angle") {
      void run(async () => {
        const removed = (labAngles.data ?? []).find((row) => row.id === target.id);
        await labAngles.remove.mutateAsync({ territoryId: target.territoryId, id: target.id });
        if (removed && masters.organizationId) {
          const stored = await loadAngleSet(masters.organizationId, target.territoryId);
          await saveAngleSet({ organizationId: masters.organizationId, territoryId: target.territoryId, record: withoutAngle(stored, removed.code) });
        }
        setFocus((current) =>
          current && "angleId" in current && current.angleId === target.id
            ? {
                kind: "territory",
                masterId: current.masterId,
                thoughtId: current.thoughtId,
                territoryId: current.territoryId,
              }
            : current,
        );
      });
      return;
    }
    if (target.kind === "idea") {
      void run(async () => {
        await labIdeas.remove.mutateAsync({ angleId: target.angleId, id: target.id });
        setFocus((current) =>
          current && "ideaId" in current && current.ideaId === target.id
            ? {
                kind: "angle",
                masterId: current.masterId,
                thoughtId: current.thoughtId,
                territoryId: current.territoryId,
                angleId: current.angleId,
              }
            : current,
        );
      });
      return;
    }
    void run(async () => {
      const removed = (labTerritories.data ?? []).find((row) => row.id === target.id);
      await labTerritories.remove.mutateAsync({ bigThoughtId: target.bigThoughtId, id: target.id });
      if (removed && masters.organizationId) {
        const stored = await loadTerritorySet(masters.organizationId, target.bigThoughtId);
        await saveTerritorySet({
          organizationId: masters.organizationId,
          bigThoughtId: target.bigThoughtId,
          record: withoutTerritory(stored, removed.code),
        });
      }
      setFocus((current) =>
        current?.kind === "territory" && current.territoryId === target.id
          ? { kind: "bigThought", masterId: current.masterId, thoughtId: current.thoughtId }
          : current,
      );
    });
  };

  const focusedExecution =
    focus?.kind === "execution" ? ((labExecutions.data ?? []).find((row) => row.id === focus.executionId) ?? null) : null;

  useEffect(() => {
    if (!focusedExecution || !focusedIdea || busy || executionProgress) return;
    const facts = focusedExecution.canonicalSemantic;
    if (pillarHopStopped(focusedExecution.pillarName, focusedExecution.script, focusedExecution.id)) return;
    if (!pillarNeedsRecommendation(facts.relationToParent) || facts.recommendation) return;
    if ((contentPillars.data ?? []).length === 0) return;
    if (recommendationAttempt.current.has(focusedExecution.id)) return;
    recommendationAttempt.current.add(focusedExecution.id);
    const execution = focusedExecution;
    const idea = focusedIdea;
    const token = executionCancel.current;
    void run(async () => {
      const { ancestors } = ideaParentFor(idea.angleId);
      const next = await withPillarRecommendation(facts, execution.pillarName, idea.statement, ancestors, token);
      if (!next.recommendation || executionCancel.current !== token) return;
      await labExecutions.save.mutateAsync({
        ideaId: idea.id,
        pillar: execution.contentPillarId ?? execution.pillar,
        contentPillarId: execution.contentPillarId,
        pillarName: execution.pillarName,
        statement: execution.statement,
        script: execution.script,
        facts: next,
      });
    }, "execution-recommend");
  }, [focusedExecution, focusedIdea, busy, executionProgress, contentPillars.data]);

  const onGenerateCharacter = (handle: string) => {
    const execution = focusedExecution;
    const organizationId = masters.organizationId;
    if (!execution?.script || !organizationId || characterGenerate || characterVisualDelete || characterVisualSave) return;
    void (async () => {
      setCharacterGenerate({ handle, phase: "portrait" });
      try {
        const script = await generateCharacterVisuals({
          organizationId,
          executionId: execution.id,
          script: execution.script,
          handle,
          onPhase: (phase) => setCharacterGenerate({ handle, phase }),
        });
        await labExecutions.patchScript.mutateAsync({ id: execution.id, script });
        toast.success(t("thinkingLab.execution.characterReady", "Portrait and character sheet are saved."));
      } catch (error) {
        if (error instanceof CharacterSheetError) {
          try {
            await labExecutions.patchScript.mutateAsync({ id: execution.id, script: error.script });
          } catch (saveError) {
            if (!isGeminiBillingNoticeError(saveError)) {
              toast.error(saveError instanceof Error ? saveError.message : t("thinkingLab.execution.characterFailed", "The character image could not be made."));
            }
            return;
          }
          if (!isGeminiBillingNoticeMessage(error.message)) {
            toast.error(t("thinkingLab.execution.characterPortraitOnly", "The portrait is saved. The character sheet could not be made."));
          }
          return;
        }
        if (isGeminiBillingNoticeError(error)) return;
        toast.error(error instanceof Error && error.message && error.message !== "AUTH" && error.message !== "EMPTY"
          ? error.message
          : t("thinkingLab.execution.characterFailed", "The character image could not be made."));
      } finally {
        setCharacterGenerate(null);
      }
    })();
  };

  const onDeleteCharacterVisual = (handle: string, kind: CharacterVisualKind) => {
    const execution = focusedExecution;
    if (!execution?.script || characterGenerate || characterVisualDelete || characterVisualSave) return;
    const character = execution.script.assets.characters.find((item) => item.handle === handle);
    const path = kind === "portrait" ? character?.portraitPath : kind === "body" ? character?.bodyPath : character?.sheetPath;
    if (!path) return;
    void (async () => {
      setCharacterVisualDelete({ handle, kind });
      try {
        const script = withoutCharacterVisual(execution.script, handle, kind);
        await labExecutions.patchScript.mutateAsync({ id: execution.id, script });
        try {
          await removeCharacterVisual(path);
        } catch {
          // The script no longer points at this file.
        }
        toast.success(t("thinkingLab.execution.characterVisualDeleted", "Character image removed."));
      } catch (error) {
        toast.error(error instanceof Error && error.message
          ? error.message
          : t("thinkingLab.execution.characterVisualDeleteFailed", "The character image could not be removed."));
      } finally {
        setCharacterVisualDelete(null);
      }
    })();
  };

  const onStoreCharacterVisual = (handle: string, kind: CharacterStudioTab, source: File | { storagePath: string }) => {
    const execution = focusedExecution;
    const organizationId = masters.organizationId;
    if (!execution?.script || !organizationId || characterGenerate || characterVisualDelete || characterVisualSave) return;
    const character = execution.script.assets.characters.find((item) => item.handle === handle);
    if (!character) return;
    void (async () => {
      setCharacterVisualSave({ handle, kind });
      try {
        const previousPath = kind === "portrait" ? character.portraitPath : character.bodyPath;
        const stored = {
          organizationId,
          executionId: execution.id,
          handle,
          kind,
          previousPath,
        };
        const path = source instanceof File
          ? await storeCharacterVisual({ ...stored, file: source })
          : await copyStoredCharacterVisual({ ...stored, sourcePath: source.storagePath });
        const script = withCharacterVisuals(
          execution.script,
          handle,
          kind === "portrait" ? { portraitPath: path } : { bodyPath: path },
        );
        await labExecutions.patchScript.mutateAsync({ id: execution.id, script });
        toast.success(t("thinkingLab.execution.characterUploaded", "Character image saved."));
      } catch (error) {
        toast.error(error instanceof Error && error.message
          ? error.message
          : t("thinkingLab.execution.characterUploadFailed", "The character image could not be uploaded."));
      } finally {
        setCharacterVisualSave(null);
      }
    })();
  };

  const pillarCardsFor = (idea: LabIdea) => {
    const live = focusedIdea?.id === idea.id;
    const cards = lockedPillarCards(idea.developmentPaths, live ? creativeReviews : null);
    if (!live || !creativePillarId) return cards;
    const review =
      (creativeReviews ?? []).find((item) => item.contentPillarId === creativePillarId) ??
      idea.developmentPaths.flatMap((path) => path.reviews).find((item) => item.contentPillarId === creativePillarId);
    const saved = cards.find((card) => card.contentPillarId === creativePillarId);
    if (!review && !saved) return cards;
    return mergeLockedPillar(cards, {
      contentPillarId: creativePillarId,
      pillarName:
        review?.pillarName ||
        saved?.pillarName ||
        (contentPillars.data ?? []).find((pillar) => pillar.id === creativePillarId)?.name ||
        "",
      development: review?.development || saved?.development || "",
      reason: review?.reason || saved?.reason || "",
      format: creativeFormat,
      leadMagnet: review ? Boolean(review.offer?.trim()) : Boolean(saved?.leadMagnet),
    });
  };

  const pathUp = (() => {
    if (!selected || !locked || !focus || focus.masterId !== selected.id || focus.kind === "master") return undefined;
    const masterTitle = (masterStatement || masterSubject || selected.originalInput).trim();
    const masterItem = { label: t("thinkingLab.tree.masterThought", "Master Thought"), title: masterTitle };
    const thought =
      shownRowViews.find((row) => row.id === focus.thoughtId) ??
      lockedChildren.get(selected.id)?.find((row) => row.id === focus.thoughtId);
    const thoughtItem = {
      label: t("thinkingLab.tree.bigThought", "Big Thought"),
      title: (thought?.label?.trim() || thought?.statement || "").trim(),
    };
    if (focus.kind === "bigThought") return [masterItem];
    const territory = (labTerritories.data ?? []).find((row) => row.id === focus.territoryId);
    const territoryItem = {
      label: t("thinkingLab.tree.territory", "Territory"),
      title: territory?.statement.trim() ?? "",
    };
    if (focus.kind === "territory") return [thoughtItem, masterItem];
    const angle = (labAngles.data ?? []).find((row) => row.id === focus.angleId);
    const angleItem = {
      label: t("thinkingLab.tree.angle", "Angle"),
      title: angle ? angleListSubject(angle.canonicalSemantic.subject ?? "", territory?.statement ?? "") : "",
    };
    if (focus.kind === "angle") return [territoryItem, thoughtItem, masterItem];
    if (focus.kind === "pillar") {
      return [
        {
          label: t("thinkingLab.idea.list", "Idea"),
          title: ideaLabel(focusedIdea?.statement ?? "", focusedIdea?.canonicalSemantic.subject),
        },
        angleItem,
        territoryItem,
        thoughtItem,
        masterItem,
      ];
    }
    return [angleItem, territoryItem, thoughtItem, masterItem];
  })();
  const focusedPillarCard =
    focus?.kind === "pillar" && focusedIdea
      ? (pillarCardsFor(focusedIdea).find((card) => card.contentPillarId === focus.contentPillarId) ?? null)
      : null;

  const handleTabChange = (newTab: string) => {
    navigate(`/digital-marketing/social-media/${newTab}`);
  };


  const {
    onGenerate,
    onManualBigThought,
    onEditBigThought,
    onFixBigThought,
    onAudit,
    onLock,
    onUnlock,
  } = createBigThoughtActions({
    ...bigThoughtFlowState,
    t,
    skipFor,
    run,
    runManual,
    setNotice,
    askScoped,
    masters,
    selected,
    thoughts,
    active,
    parentFp,
    ready,
    masterSubject,
    becauseParent,
    shownRowViews,
    bigThoughtPeers,
    bigThoughtStatementFingerprint,
    lockDecision,
    setFocus,
    labRunRef,
    queryClient,
    reportStepError,
  });

  const { onGenerateTerritory, onEditTerritory, onFixTerritory, onTerritoryStage, onLockTerritories } = createTerritoryActions({
    ...territoryFlowState,
    t,
    skipFor,
    run,
    runManual,
    setNotice,
    askScoped,
    masters,
    selected,
    parentFp,
    focusedThought,
    labTerritories,
    thoughts,
    territorySet,
    admittedTerritories,
    territoryVerdicts,
    territoryPeers,
    territoryAncestors,
    territoryStage,
    territoryLock,
    focusedBigThoughtFingerprint,
    territoryStatementFingerprint,
    answeredQuestion,
    descriptionFlight,
    labRunRef,
    queryClient,
    reportStepError,
  });

  const { onGenerateAngle, onEditAngle, onFixAngle, onAngleStage, onLockAngles } = createAngleActions({
    ...angleFlowState,
    t,
    skipFor,
    run,
    runManual,
    setNotice,
    masters,
    parentFp,
    focus,
    setFocus,
    focusedTerritory,
    focusedThought,
    labTerritories,
    labAngles,
    angleSet,
    territorySet,
    admittedAngles,
    angleVerdicts,
    anglePeers,
    angleAncestors,
    angleStage,
    angleLock,
    parentTerritoryFingerprint,
    angleStatementFingerprint,
    labRunRef,
    queryClient,
    reportStepError,
  });

  const {
    ideaDiscover,
    setIdeaDiscover,
    ideaDiscoverToken,
    ideaParentFor,
    onGenerateIdea,
    onManualIdea,
    onEditIdea,
    onReviseIdea,
    writeGeneratedIdeas,
    onLockIdeas,
  } = createIdeaActions({
    ...ideaFlowState,
    focus,
    setFocus,
    masters,
    parentFp,
    labAngles,
    labTerritories,
    labIdeas,
    ideaSet,
    angleSet,
    active,
    focusedAngle,
    focusedTerritory,
    focusedThought,
    masterStatement,
    masterSubject,
    selected,
    ideaAudience,
    ancestorsWithMaster,
    parentTerritoryFingerprint,
    parentAngleFingerprint,
    openIdeas,
    ideaAuditSaved,
    ideaFingerprintNow,
    skippedMark,
    skipFor,
    run,
    runManual,
    t,
    queryClient,
    setNotice,
    labRunRef,
  });

  const { onStopExecution, onOpenPillarPicker, loadScriptConfirm, askScriptDiscovery, withPillarRecommendation, pillarHopStopped, onGenerateExecutions, onReviewCreativePillars, onReviewLeadMagnetPillars, rememberedDevelopment, onLockCreativePillar, onLockAllCreativePillars, onOpenExecutionSettings, onToggleExecutionPass, onAcceptPassProposal, onDeclinePassProposal, onRegenerateExecution, onRewriteExecution, onUseRecommendation, onRegenerateLine, onFixLine, onUseExecutionOffer, onRetrySelling, onRepairExecution } = createExecutionActions({ ...executionState, focus, focusedIdea, masterSubject, labExecutions, run, ideaParentFor, selected, contentPillars, masterStatement, masters, t, setFocus, pillarCardsFor, labRunRef, reportStepError, queryClient });

    const labWorkspaceGridProps = buildLabWorkspaceGridProps({
      masterComposer: {
        t,
        busy,
        busyAction,
        newCatalog,
        setNewCatalog,
        catalogs,
        setReasonPool,
        newPrior,
        setNewPrior,
        newPlanted,
        setNewPlanted,
        newAudience,
        setNewAudience,
        onCreate,
      },
      masterSavedList: {
        masters,
        catalogs,
        closeComposer,
        skipAutoSelect,
        setSelectedId,
        setFocus,
        setPendingDelete,
      },
      masterSection: {
        t,
        masters,
        selected,
        hasMasters,
        showComposer,
        ready,
        locked,
        showBeliefField,
        editingBelief,
        masterMenuStage,
        showGenerateBigThought,
        busy,
        busyAction,
        masterSubject,
        masterDescription,
        catalogs,
        onGenerate,
        onAudit,
        onLock,
        onSuggestBeliefs,
        onSaveMaster,
        priorDraft,
        originalDraft,
        audienceDraft,
        setPriorDraft,
        setOriginalDraft,
        setAudienceDraft,
        showManualBigThought,
        setShowManualBigThought,
        onManualBigThought,
        becauseParent,
        shownRowViews,
        notice,
        auditProgress,
        generateChecklist,
        onGenerateTerritory,
        onEditBigThought,
        setPendingDelete,
        onFixBigThought,
        bigThoughtChecklists,
        fixingBigThoughtCodes,
      },
      shared: {
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
      },
      map: {
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
      },
      execution: {
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
      },
      inspector: {
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
      },
    });


  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className={cn("flex min-h-0 min-w-0 w-full flex-1", !showContent && "pointer-events-none invisible select-none")} aria-hidden={!showContent}>
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="relative mb-1 flex-shrink-0">
            <HeaderAndTab activeMainTab="thinking-lab" handleTabChange={handleTabChange} />
            <div className="absolute right-1 top-3 z-20 flex items-center gap-2">
              <CheckSettingsDialog organizationId={masters.organizationId} />
            {hasMasters ? (
              <div>
                {!composerOpen ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setComposerOpen(true)}>
                    {t("thinkingLab.action.newMaster", "New Master Thought")}
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="ghost" onClick={closeComposer}>
                    {t("thinkingLab.action.closeComposer", "Close")}
                  </Button>
                )}
              </div>
            ) : null}
            </div>
          </div>
          <div className="mt-0 flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
                <ModuleShellContentGate pagePath="/thinking-lab" className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col">
                  {scriptTableOpen && focusedExecution?.script ? (
                    <ExecutionScriptTable
                      pillarName={focusedExecution.pillarName}
                      script={focusedExecution.script}
                      onClose={() => setScriptTableOpen(false)}
                      pending={busy}
                      fixingLineId={fixingLineId}
                      onRegenerateLine={onRegenerateLine}
                      onDelete={
                        focus?.kind === "execution"
                          ? () => setPendingDelete({ kind: "execution", id: focus.executionId })
                          : undefined
                      }
                      onSaveToPlan={() => setPlanSaveOpen(true)}
                      onGenerateCharacter={onGenerateCharacter}
                      onStoreCharacterVisual={onStoreCharacterVisual}
                      onDeleteCharacterVisual={onDeleteCharacterVisual}
                      generatingCharacter={characterGenerate}
                      deletingCharacterVisual={characterVisualDelete}
                      savingCharacterVisual={characterVisualSave}
                    />
                  ) : (
                    <LabWorkspaceGrid {...labWorkspaceGridProps} />
                  )}
                </ModuleShellContentGate>
          </div>
        </div>
      </div>
      <LabDialogs
        t={t}
        queryClient={queryClient}
        organizationId={masters.organizationId}
        busy={busy}
        pendingDelete={pendingDelete}
        setPendingDelete={setPendingDelete}
        confirmDelete={confirmDelete}
        pillarPickerOpen={pillarPickerOpen}
        setPillarPickerOpen={setPillarPickerOpen}
        contentPillars={contentPillars.data ?? []}
        masterSells={masterSells}
        pillarMediums={pillarMediums.data ?? {}}
        executionDirect={executionDirect}
        loadScriptConfirm={loadScriptConfirm}
        rememberedDevelopment={rememberedDevelopment}
        scriptConfirm={scriptConfirm}
        setScriptConfirm={setScriptConfirm}
        confirmToken={confirmToken}
        askScriptDiscovery={askScriptDiscovery}
        onGenerateExecutions={onGenerateExecutions}
        ideaDiscover={ideaDiscover}
        setIdeaDiscover={setIdeaDiscover}
        ideaDiscoverToken={ideaDiscoverToken}
        onGenerateIdea={onGenerateIdea}
        writeGeneratedIdeas={writeGeneratedIdeas}
        planSaveOpen={planSaveOpen}
        setPlanSaveOpen={setPlanSaveOpen}
        focusedExecution={focusedExecution}
        focusedIdea={focusedIdea}
        pillarCardsFor={pillarCardsFor}
        creativeReviews={creativeReviews}
      />

      {!showContent ? (
        <div className="absolute inset-0 z-20 overflow-hidden" aria-busy>
          <ThinkingLabPageSkeleton />
        </div>
      ) : null}
    </div>
  );
}
