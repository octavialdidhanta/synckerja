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
import {
  beliefsMatch,
  collectBeliefOptions,
  checkWrittenBelief,
  confirmedFingerprint,
  confirmedParentReady,
} from "@/thinking-lab/master-thought/semantic";
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
import type { BeliefOption, LabMasterThought, MasterCatalogContext } from "@/thinking-lab/master-thought/types";
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
import {
  buildIdeaDiscoveryPrompt,
  ideaDiscoveryMatches,
  parseIdeaDiscoveryQuestions,
  type IdeaDiscoveryQuestion,
} from "@/thinking-lab/idea/discover";
import { sameIdeaConcept } from "@/thinking-lab/idea/conceptIdentity";
import { IDEA_ACTIVE_CAP, nextIdeaCode, parseGeneratedIdeaDrafts, proposeIdea, runIdeaGenerate, type IdeaDraft } from "@/thinking-lab/idea/generate";
import { ideaFacts } from "@/thinking-lab/idea/facts";
import { loadIdeaComparisonHistory, loadIdeaParentGate, loadIdeaSet, saveIdeaSet, saveIdeaValidation, type LabIdea } from "@/thinking-lab/idea/repository";
import {  latestPathReviews, leadMagnetBriefForPillar, lockedPillarCards, mergeLockedPillar } from "@/thinking-lab/creative-idea/paths";
import {
  admissionForDecision,
  checksFromValidation,
  ideaHistorySummary,
  uncheckedIdeaValidation,
  type IdeaValidation,
} from "@/thinking-lab/idea/check/record";
import { failureItemsFromIdeas, failureMemoryFromValidation, peersFromIdeas, type FailureMemoryItem } from "@/thinking-lab/idea/check/memory";
import { runIdeaChecks } from "@/thinking-lab/idea/check/run";
import { buildIdeaRevisionPrompt, canReviseIdea, revisionCount } from "@/thinking-lab/idea/revise";
import { emptyIdeaSetRecord, type IdeaDiscovery } from "@/thinking-lab/idea/ideaSet";
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
import type { LabFocus } from "@/thinking-lab/page/labFocus";
import { createExecutionActions, useExecutionState } from "@/thinking-lab/page/executionFlow";
import {
  LAB_MT_CARD,
  LAB_LEFT_COL,
  LAB_LEFT_SECTION,
  LAB_MAIN_GRID,
  LAB_RIGHT_CARD,
  LAB_RIGHT_COL,
  LAB_SECTION,
} from "@/thinking-lab/page/thinkingLabLayout";
import { BigThoughtSection, type AuditProgress } from "@/thinking-lab/section/BigThoughtSection";
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

function ideaLiveReport(
  checks: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>,
  previous: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>,
): { gate: string; phase: "checking" | "checked"; outcome: "pass" | "fail" | "unverified" } | null {
  const changed = checks.find((check, index) => check.state !== previous[index]?.state || check.reason !== previous[index]?.reason);
  if (changed?.state === "running") return { gate: changed.id, phase: "checking", outcome: "pass" };
  if (changed?.state === "pass") return { gate: changed.id, phase: "checked", outcome: "pass" };
  if (changed?.state === "fail") return { gate: changed.id, phase: "checked", outcome: "fail" };
  if (changed?.reason?.trim()) return { gate: changed.id, phase: "checked", outcome: "unverified" };
  const latest = [...checks].reverse().find((check) => check.state === "pass" || check.state === "fail" || Boolean(check.reason?.trim()));
  if (!latest) return null;
  if (latest.state === "fail") return { gate: latest.id, phase: "checked", outcome: "fail" };
  if (latest.state === "pass") return { gate: latest.id, phase: "checked", outcome: "pass" };
  return { gate: latest.id, phase: "checked", outcome: "unverified" };
}

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


/** The open node survives a remount of the page (e.g. an auth/access re-check), so the user is not sent back to the start. */
const LAB_VIEW_KEY = "thinking-lab:view";
/** True when this item was saved while some pass checks of its level were switched OFF. */
function savedUnchecked(
  items: ReadonlyArray<{ code: string; skipped?: string[] }> | null | undefined,
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  const item = items?.find((entry) => entry.code.toUpperCase() === code.toUpperCase());
  return Boolean(item?.skipped?.length);
}

/** True when an ancestor of this item was rewritten (from chat) after it passed. */
function savedParentChanged(
  items: ReadonlyArray<{ code: string; parentChanged?: true }> | null | undefined,
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  return items?.find((entry) => entry.code.toUpperCase() === code.toUpperCase())?.parentChanged === true;
}

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
  const generatingTerritoryIdsRef = useRef(new Set<string>());
  const [generatingTerritoryIds, setGeneratingTerritoryIds] = useState<ReadonlySet<string>>(() => new Set());
  const legacyIdeaSaveRef = useRef(new Set<string>());
  const fixingAngleCodesRef = useRef(new Set<string>());
  const [fixingAngleCodes, setFixingAngleCodes] = useState<ReadonlySet<string>>(() => new Set());
  const fixingTerritoryCodesRef = useRef(new Set<string>());
  const [fixingTerritoryCodes, setFixingTerritoryCodes] = useState<ReadonlySet<string>>(() => new Set());
  const [territoryChecklists, setTerritoryChecklists] = useState<
    Record<string, { checks: TerritoryPassCheck[]; note?: string }>
  >({});
  const [territoryGenerateRun, setTerritoryGenerateRun] = useState<{
    thoughtId: string;
    checks: TerritoryPassCheck[];
    report: { gate: TerritoryPassCheck["id"]; phase: "checking" | "checked"; outcome: "pass" | "fail" } | null;
  } | null>(null);
  const publishTerritoryChecklist = (code: string, checks: TerritoryPassCheck[], note?: string) => {
    const key = code.trim().toUpperCase();
    setTerritoryChecklists((current) => ({
      ...current,
      [key]: note ? { checks, note } : { checks },
    }));
  };
  const [angleChecklists, setAngleChecklists] = useState<
    Record<string, { checks: AnglePassCheck[]; note?: string }>
  >({});
  const [angleGenerateRun, setAngleGenerateRun] = useState<{
    territoryId: string;
    checks: AnglePassCheck[];
    report: { gate: AnglePassCheck["id"]; phase: "checking" | "checked"; outcome: "pass" | "fail" } | null;
  } | null>(null);
  const publishAngleChecklist = (code: string, checks: AnglePassCheck[], note?: string) => {
    const key = code.trim().toUpperCase();
    setAngleChecklists((current) => ({
      ...current,
      [key]: note ? { checks, note } : { checks },
    }));
  };
  const [ideaGenerateRun, setIdeaGenerateRun] = useState<{
    angleId: string;
    checks: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>;
    report: { gate: string; phase: "checking" | "checked"; outcome: "pass" | "fail" | "unverified" } | null;
  } | null>(null);
  const [ideaRevisionTarget, setIdeaRevisionTarget] = useState<{
    nonce: number;
    decision: "LOLOS" | "DITOLAK" | "BELUM_TERVERIFIKASI";
  } | null>(null);
  const ideaPassPrevious = useRef<Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>>([]);
  const publishLiveIdea = (
    angleId: string,
    checks: Array<{ id: string; state: "pending" | "running" | "pass" | "fail"; reason?: string }>,
  ) => {
    const previous = ideaPassPrevious.current;
    const next = checks.map((check) => ({ ...check }));
    ideaPassPrevious.current = next;
    setIdeaGenerateRun({ angleId, checks: next, report: ideaLiveReport(next, previous) });
  };
  const [notice, setNotice] = useState<string | null>(null);
  const [auditProgress, setAuditProgress] = useState<AuditProgress | null>(null);
  const [bigThoughtChecklists, setBigThoughtChecklists] = useState<Record<string, PassChecklist>>({});
  const fixingBigThoughtRef = useRef(new Set<string>());
  const [fixingBigThoughtCodes, setFixingBigThoughtCodes] = useState<string[]>([]);
  const [generateChecklist, setGenerateChecklist] = useState<PassChecklist | null>(null);
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
  const ideaDiscoverToken = useRef(0);
  const [ideaDiscover, setIdeaDiscover] = useState<{
    angleId: string;
    angleFingerprint: string;
    questions: IdeaDiscoveryQuestion[] | null;
    loading: boolean;
    failed: boolean;
  } | null>(null);
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

  /** The reasons a belief could not be saved, in words the user can act on. */
  const masterCheckMessage = (reasons: string[]): string =>
    reasons
      .map((reason) => {
        if (reason === "CATALOG_REQUIRED") return catalogRequiredMessage();
        if (reason === "PRIOR_REQUIRED") return t("thinkingLab.master.priorRequired", "Tulis keyakinan lama dulu.");
        if (reason === "SAME_BELIEF") {
          return t("thinkingLab.master.sameBelief", "The old belief and the new belief say the same thing. Change the new belief.");
        }
        if (reason === "UNDECIDED") return t("thinkingLab.mt.writtenUndecided", "The check could not be decided.");
        return reason;
      })
      .join(" ");

  /**
   * The only way a Master Thought is saved: the switched-on checks first, then the drafts and the
   * confirmation. A failed check leaves the stored Master Thought as it was.
   */
  const saveMasterBelief = async (input: {
    id: string;
    planted: string;
    priorBelief: string;
    audience: string;
    catalog: MasterCatalogContext | null;
    options: BeliefOption[];
  }): Promise<boolean> => {
    const check = await checkWrittenBelief(
      { belief: input.planted, priorBelief: input.priorBelief, catalog: input.catalog, skip: skipFor("master") },
      (prompt) => askThinkingLab(prompt, 0),
    );
    if (!check.pass) {
      toast.error(
        t(
          "thinkingLab.mt.saveFailed",
          "Master Thought belum bisa disimpan: {{reasons}} Edit kalimatnya, atau pakai Bantu rumuskan.",
        ).replace("{{reasons}}", masterCheckMessage(check.reasons)),
        { duration: 12000 },
      );
      return false;
    }
    await masters.saveOriginal.mutateAsync({
      id: input.id,
      planted: input.planted,
      priorBelief: input.priorBelief,
      audience: input.audience,
    });
    await masters.confirm.mutateAsync({
      id: input.id,
      statement: input.planted,
      source: input.options.some((option) => beliefsMatch(option.belief, input.planted)) ? "recommendation" : "original",
    });
    return true;
  };

  const onCreate = () =>
    run(async () => {
      const planted = newPlanted.trim();
      const priorBelief = newPrior.trim();
      const audience = newAudience.trim();
      const catalog = catalogContext(newCatalog, catalogs.data ?? []);
      if (!catalog) throw new Error(catalogRequiredMessage());
      const created = await masters.create.mutateAsync({
        planted,
        priorBelief,
        audience,
        productReasonPool: reasonPool,
        catalog: newCatalog,
      });
      bindUsage("save-master", created.id);
      setNewPrior("");
      setNewPlanted("");
      setNewAudience("");
      setReasonPool(null);
      setNewCatalog(EMPTY_CATALOG_LINK);
      setComposerOpen(false);
      skipAutoSelect.current = false;
      setSelectedId(created.id);
      await saveMasterBelief({ id: created.id, planted, priorBelief, audience, catalog, options: [] });
    }, "save-master");

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

  /** "Bantu rumuskan": three options that already pass the switched-on checks. Nothing else is saved. */
  const onSuggestBeliefs = () =>
    run(async () => {
      if (!selected) return;
      if (!selectedCatalog) throw new Error(catalogRequiredMessage());
      const options = await collectBeliefOptions(
        {
          planted: originalDraft,
          priorBelief: priorDraft.trim(),
          audience: audienceDraft,
          catalog: selectedCatalog,
          skip: skipFor("master"),
        },
        (prompt) => askThinkingLab(prompt, 0.2),
        (prompt) => askThinkingLab(prompt, 0),
      );
      await masters.saveOptions.mutateAsync({ id: selected.id, options });
      if (options.length === 0) {
        toast.error(
          t("thinkingLab.master.noOptions", "Tidak ada opsi yang lolos syarat. Edit kalimatnya sendiri, lalu coba lagi."),
        );
      }
    }, "suggest-belief");

  const onSaveMaster = () =>
    run(async () => {
      if (!selected) return;
      const saved = await saveMasterBelief({
        id: selected.id,
        planted: originalDraft.trim(),
        priorBelief: priorDraft.trim(),
        audience: audienceDraft.trim(),
        catalog: selectedCatalog,
        options: selected.canonicalSemantic?.beliefOptions ?? [],
      });
      if (saved) setEditingMasterId(null);
    }, "save-master");

  const onGenerate = () =>
    run(async () => {
      setAuditProgress(null);
      if (!selected || !parentFp || !ready) return;
      if (!masterSubject) {
        setNotice(
          t(
            "thinkingLab.master.subjectMissing",
            "The Master Thought subject is not sealed yet. New Big Thoughts wait for that subject.",
          ),
        );
        return;
      }
      const known = [...(thoughts.data ?? [])];
      const codes = known.map((row) => row.code);
      let sort = known.reduce((max, row) => Math.max(max, row.sortOrder), 0);
      let record: BigThoughtSetRecord = readBigThoughtSetRecord(selected.lastAudit);
      const pool = selected.productReasonPool;
      if (pool && pool.items.length === 0) {
        setNotice(
          t(
            "thinkingLab.product.noSupport",
            "Produk ini tidak menopang Master Thought. Tidak ada alasan tersimpan yang menyelesaikan keyakinan ini.",
          ),
        );
        return;
      }
      const started = shownRowViews.length;
      const beforeValid = countGenerateValid(shownRowViews);
      const lessons: GateLesson[] = generateLessons(record).flatMap((lesson) => {
        const gate = readBigThoughtCheckId(lesson.reason.split(":")[0]?.trim());
        return gate ? [{ gate, statement: lesson.statement, reason: lesson.reason.slice(lesson.reason.indexOf(":") + 1).trim() }] : [];
      });
      const seededLessonCount = lessons.length;
      let blockedKnownSentence = false;
      // Big Thoughts that already passed; each new sentence must carry a different basic reason.
      let runPeers = bigThoughtPeers();
      const rememberGenerateLesson = async (lesson: GateLesson) => {
        const statement = lesson.statement.trim();
        const reason = lesson.reason.trim();
        if (!statement || !reason) return;
        const key = `${statement.toLocaleLowerCase()}\n${lesson.gate}`;
        const index = lessons.findIndex(
          (item) => `${item.statement.trim().toLocaleLowerCase()}\n${item.gate}` === key,
        );
        if (index >= 0) lessons[index] = { gate: lesson.gate, statement, reason };
        else lessons.push({ gate: lesson.gate, statement, reason });
        const next = mergeBigThoughtLessons(record.auditLessons, [
          { code: GENERATE_LESSON_CODE, statement, reason: `${lesson.gate}: ${reason}` },
        ]);
        if (next.length === record.auditLessons.length) return;
        record = { ...record, auditLessons: next };
        await masters.saveSet.mutateAsync({ id: selected.id, lastAudit: record });
      };
      let generated: Awaited<ReturnType<typeof runGenerateRounds>> | null = null;
      const showGenerateChecklist = async (checklist: PassChecklist) => {
        setGenerateChecklist(checklist);
        await waitForChecklistReport(checklist);
      };
      try {
      generated = await runGenerateRounds({
        parentStatement: becauseParent,
        incumbents: shownRowViews.map((row) => ({
          code: row.code,
          statement: row.statement,
          label: row.label,
          admission: row.admission,
        })),
        activeCount: shownRowViews.length,
        topUp: true,
        propose: async (plan, incumbents) => {
          const script = await askScoped(
            "generate",
            "Big Thought",
            buildGeneratePrompt({
              parentStatement: becauseParent,
              incumbents: incumbents
                .filter((row) => row.admission === "GENERATE_VALID")
                .map((row) => ({ code: row.code, statement: row.statement, label: row.label })),
              needed: plan.needed,
              lessons,
              reasonPool: pool,
            }),
            0.2,
          );
          const parsed = parseGeneratedBigThoughts(script ? parseModelJson(script) : null, becauseParent, pool);
          const learned = new Set(lessons.map((lesson) => lesson.statement.trim().toLowerCase()));
          const grounded = keepGroundedBigThoughts(parsed, pool);
          const fresh = grounded.filter((item) => !learned.has(item.statement.trim().toLowerCase()));
          if (fresh.length < grounded.length) blockedKnownSentence = true;
          return fresh;
        },
        onRepeat: async (candidate, repeated) => {
          const checklist = attachLesson(
            checklistFromFailure({ gate: "duplicate", reason: `Same Big Thought as ${repeated.code}.`, earlier: "unchecked" }),
            candidate.statement,
          );
          const reason = checklist.failure?.reason ?? "";
          if (reason) await rememberGenerateLesson({ gate: "duplicate", statement: candidate.statement, reason });
          await showGenerateChecklist(checklist);
        },
        judge: async (statement) => {
          const checklist = await runBigThoughtChecks({
            skip: skipFor("bigThought"),
            statement,
            parentStatement: becauseParent,
            others: runPeers,
            ask: (prompt) => askScoped("generate", "Big Thought", prompt, 0),
            onStep: (step) => showGenerateChecklist(attachLesson(step, statement)),
          });
          if (!checklist.passed && checklist.failure) {
            await rememberGenerateLesson({
              gate: checklist.failure.gate,
              statement,
              reason: checklist.failure.reason,
            });
          }
          return factsForBigThoughtChecks("NEW", statement, checklist);
        },
        persist: async (candidate, facts) => {
          if (individualAdmission({ facts, factsCurrent: true }) !== "GENERATE_VALID") {
            return {
              code: "SKIP",
              statement: candidate.statement,
              label: candidate.label,
              admission: "GENERATE_REJECT" as const,
            };
          }
          const code = nextBigThoughtCode(codes);
          codes.push(code);
          sort += 1;
          const saved = await thoughts.insert.mutateAsync({
            code,
            statement: candidate.statement,
            label:
              bigThoughtLabelIsOpen(candidate.label) || bigThoughtLabelRestates(candidate.label, candidate.statement)
                ? ""
                : candidate.label,
            sortOrder: sort,
            facts: { ...facts, code },
            masterFingerprint: parentFp,
          });
          if (!codes.includes(saved.code)) codes.push(saved.code);
          // Every check already passed at Generate: the card is saved with its pass mark.
          record = withBigThoughtResult(record, {
            code: saved.code,
            statement: saved.statement,
            statementFingerprint: bigThoughtStatementFingerprint(saved.statement),
            failure: null,
            skipped: skipFor("bigThought"),
          });
          runPeers = [...runPeers, { code: saved.code, statement: saved.statement, label: saved.label }];
          await masters.saveSet.mutateAsync({ id: selected.id, lastAudit: record });
          return {
            code: saved.code,
            statement: saved.statement,
            label: saved.label,
            admission: individualAdmission({ facts: { ...facts, code }, factsCurrent: true }),
          };
        },
      });
      if (pool && generated && generated.incumbents.length === started) {
        setNotice(
          t(
            "thinkingLab.product.noSupport",
            "Produk ini tidak menopang Master Thought. Tidak ada alasan tersimpan yang menyelesaikan keyakinan ini.",
          ),
        );
      } else if (
        generated &&
        countGenerateValid(generated.incumbents) === beforeValid &&
        (lessons.length > seededLessonCount || blockedKnownSentence)
      ) {
        setNotice(
          t(
            "thinkingLab.bt.generateNoneAdmitted",
            "No new Big Thought passed the generate checks.",
          ),
        );
      }
      } finally {
        setGenerateChecklist(null);
      }
    }, "generate");

  const generateTerritory = async (bigThoughtId: string) => {
      if (!masters.organizationId || !parentFp) return;
      const storedSet =
        bigThoughtId === focusedThought?.id
          ? (territorySet.data ?? null)
          : await loadTerritorySet(masters.organizationId, bigThoughtId);
      const auditLessons = storedSet?.auditLessons ?? [];
      const known = (labTerritories.data ?? []).filter((row) => row.bigThoughtId === bigThoughtId);
      let sort = known.reduce((max, row) => Math.max(max, row.sortOrder), 0);
      const source = (thoughts.data ?? []).find((row) => row.id === bigThoughtId);
      const storedFacts = source?.canonicalSemantic;
      const question =
        storedFacts?.answeredQuestionVersion === ANSWERED_QUESTION_VERSION
          ? storedFacts.answeredQuestion?.trim() ?? ""
          : "";
      const learned = [...auditLessons];
      let setRecord: TerritorySetRecord = storedSet ?? emptyTerritorySetRecord();
      const thoughtFingerprint = bigThoughtFingerprint({
        statement: source?.statement ?? "",
        masterThoughtFingerprint: parentFp,
      });
      // Territories under this Big Thought that already passed; each new name must be a different area.
      let runPeers: TerritoryPeer[] = known
        .filter(
          (row) =>
            row.admission === "GENERATE_VALID" &&
            territoryVerdict(
              row,
              setRecord,
              territoryFingerprint({ statement: row.statement, bigThoughtFingerprint: thoughtFingerprint }),
            ) === "AUDIT_PASS",
        )
        .map((row) => ({ code: row.code, statement: row.statement }));
      const bannedNames = new Set(
        [
          ...learned.map((lesson) => lesson.statement.trim().toLowerCase()),
          ...known
            .filter((row) => row.admission === "GENERATE_REJECT")
            .map((row) => row.statement.trim().toLowerCase()),
        ].filter(Boolean),
      );
      const rememberGenerateLesson = async (lesson: { code: string; statement: string; reason: string }) => {
        const statement = lesson.statement.trim();
        const reason = lesson.reason.trim();
        if (!statement || !reason) return;
        const key = statement.toLowerCase();
        if (!learned.some((item) => item.statement.trim().toLowerCase() === key && item.reason === reason)) {
          learned.push({ code: lesson.code, statement, reason });
        }
        bannedNames.add(key);
        const next = mergeTerritoryAuditLessons(setRecord.auditLessons, [{ code: lesson.code, statement, reason }]);
        const same =
          next.length === setRecord.auditLessons.length &&
          next.every((item, index) => {
            const stored = setRecord.auditLessons[index];
            return stored?.statement === item.statement && stored.reason === item.reason && stored.code === item.code;
          });
        if (same) return;
        setRecord = { ...setRecord, auditLessons: next };
        await saveTerritorySet({
          organizationId: masters.organizationId as string,
          bigThoughtId,
          record: setRecord,
        });
      };
      let answered = question;
      let shownChecks: TerritoryPassCheck[] = [];
      const publishLive = (checks: TerritoryPassCheck[]) => {
        const previous = shownChecks;
        shownChecks = checks.map((check) => ({ ...check }));
        const changed = checks.find((check, index) => check.state !== previous[index]?.state);
        const report =
          changed?.state === "running" || changed?.state === "pass" || changed?.state === "fail"
            ? {
                gate: changed.id,
                phase: changed.state === "running" ? ("checking" as const) : ("checked" as const),
                outcome: changed.state === "fail" ? ("fail" as const) : ("pass" as const),
              }
            : null;
        setTerritoryGenerateRun({ thoughtId: bigThoughtId, checks: shownChecks, report });
      };
      let result: Awaited<ReturnType<typeof runTerritoryGenerate>> | null = null;
      try {
      result = await runTerritoryGenerate({
        loadParent: () =>
          loadTerritoryParentGate({
            organizationId: masters.organizationId as string,
            bigThoughtId,
            masterThoughtFingerprint: parentFp,
          }),
        // TR codes are unique per Master Thought, so the mind map and the run log name one Territory each.
        reservedCodes: (labTerritories.data ?? []).map((row) => row.code),
        incumbents: known.map((row) => ({
          code: row.code,
          statement: row.statement,
          admission: row.admission,
          bigThoughtId: row.bigThoughtId,
          relationToParent: row.canonicalSemantic.relationToParent,
        })),
        topUp: true,
        carryLessons: true,
        propose: async (plan, parent, incumbents) => {
          const statements = await proposeTerritoryStatements({
            parentStatement: parent.statement,
            ancestors: parent.ancestors,
            audience: parent.audience || selected?.audience,
            answeredQuestion: answered,
            incumbents: incumbents
              .filter((row) => row.admission === "GENERATE_VALID")
              .map((row) => ({
                code: row.code,
                statement: row.statement,
                admission: row.admission,
                relationToParent: row.relationToParent,
              })),
            lessons: [
              ...learned,
              ...known
                .filter(
                  (row) =>
                    row.admission === "GENERATE_REJECT" &&
                    !learned.some((lesson) => lesson.statement.trim().toLowerCase() === row.statement.trim().toLowerCase()),
                )
                .map((row) => ({
                  code: row.code,
                  statement: row.statement,
                  reason:
                    territoryRejectionReason(row.canonicalSemantic.relationToParent) ??
                    "partOfBigThought: This name already failed.",
                })),
            ],
            needed: plan.needed,
            ask: async (prompt) => {
              const script = await askScoped("generate", "Territory", prompt, 0.2);
              if (!script) throw new Error(t("thinkingLab.error.generic", "Thinking Lab could not finish that step."));
              return script;
            },
          });
          return statements.filter((item) => !bannedNames.has(item.trim().toLowerCase()));
        },
        judge: async (parent, code, statement) => {
          const failFacts = async (
            relation: TerritorySemanticFacts["relationToParent"],
            reason: string,
          ): Promise<TerritorySemanticFacts> => {
            await rememberGenerateLesson({ code, statement, reason });
            return {
              ...shownTerritoryFacts(code, statement),
              relationToParent: relation,
              whatItSays: statement,
            };
          };
          if (bannedNames.has(statement.trim().toLowerCase())) {
            const repeated = learned.find((lesson) => lesson.statement.trim().toLowerCase() === statement.trim().toLowerCase());
            const reason = repeated?.reason || "partOfBigThought: This name already failed.";
            return failFacts(territoryRelationForGate(reason.split(":")[0]?.trim() ?? ""), reason);
          }
          const checked = await runTerritoryChecks({
            skip: skipFor("territory"),
            statement,
            parentStatement: parent.statement,
            audience: parent.audience || selected?.audience,
            question: answered,
            ensureQuestion: () => (source ? ensureAnsweredQuestion(source) : Promise.resolve("")),
            peers: runPeers,
            ask: (prompt) => askScoped("generate", code, prompt, 0),
            onStep: publishLive,
          });
          if (checked.question) answered = checked.question;
          const failure = firstTerritoryFailure(checked.checks);
          if (failure) return failFacts(territoryRelationForGate(failure.gate), `${failure.gate}: ${failure.reason}`);
          publishTerritoryChecklist(code, checked.checks);
          return shownTerritoryFacts(code, statement);
        },
        persist: async ({ parent, code, statement, facts, admission }) => {
          if (admission !== "GENERATE_VALID") {
            return {
              code,
              statement,
              admission: "GENERATE_REJECT" as const,
              bigThoughtId: parent.id,
              relationToParent: facts.relationToParent,
            };
          }
          sort += 1;
          const saved = await labTerritories.insert.mutateAsync({
            bigThoughtId: parent.id,
            masterThoughtFingerprint: parentFp,
            code,
            statement,
            sortOrder: sort,
            facts,
            admission,
          });
          // Every check already passed at Generate: the card is saved with its pass mark.
          setRecord = withTerritoryResult(setRecord, {
            code: saved.code,
            statement: saved.statement,
            statementFingerprint: territoryFingerprint({ statement: saved.statement, bigThoughtFingerprint: thoughtFingerprint }),
            failure: null,
            skipped: skipFor("territory"),
          });
          runPeers = [...runPeers, { code: saved.code, statement: saved.statement }];
          await saveTerritorySet({ organizationId: masters.organizationId as string, bigThoughtId, record: setRecord });
          return {
            code: saved.code,
            statement: saved.statement,
            admission: saved.admission,
            bigThoughtId: saved.bigThoughtId,
            relationToParent: facts.relationToParent,
          };
        },
      });
      if (result.outcome === "DENIED" && result.reason) {
        toast.error(result.reason);
        return;
      }
      if (
        learned.length !== auditLessons.length ||
        admittedTerritorySetChanged(
          known.map((row) => ({ code: row.code, admission: row.admission })),
          result.incumbents,
        )
      ) {
        await saveTerritorySet({
          organizationId: masters.organizationId,
          bigThoughtId,
          record: setRecord,
        });
        await queryClient.invalidateQueries({
          queryKey: ["thinking-lab-territory-set", masters.organizationId, bigThoughtId],
        });
      }
      } finally {
        setTerritoryGenerateRun((current) => {
          if (!current || current.thoughtId !== bigThoughtId) return current;
          return current.checks.some((check) => check.state === "fail") ? current : null;
        });
      }
  };

  const onGenerateTerritory = (bigThoughtId: string) => {
    if (!masters.organizationId || generatingTerritoryIdsRef.current.has(bigThoughtId)) return;
    generatingTerritoryIdsRef.current.add(bigThoughtId);
    setGeneratingTerritoryIds(new Set(generatingTerritoryIdsRef.current));
    void (async () => {
      try {
        await generateTerritory(bigThoughtId);
      } catch (error) {
        reportStepError(error);
      } finally {
        generatingTerritoryIdsRef.current.delete(bigThoughtId);
        setGeneratingTerritoryIds(new Set(generatingTerritoryIdsRef.current));
      }
    })();
  };

  const onGenerateAngle = (territoryId: string) =>
    run(async () => {
      if (!masters.organizationId || !parentFp) return;
      const territory = (labTerritories.data ?? []).find((row) => row.id === territoryId);
      if (!territory || !focusedThought || focusedThought.id !== territory.bigThoughtId) return;
      if (focus?.kind === "bigThought" && focus.thoughtId === territory.bigThoughtId) {
        setFocus({ kind: "territory", masterId: focus.masterId, thoughtId: focus.thoughtId, territoryId });
      }
      if (territory.status !== "locked") {
        await territorySet.lock.mutateAsync({
          bigThoughtFingerprint: bigThoughtFingerprint({
            statement: focusedThought.statement,
            masterThoughtFingerprint: parentFp,
          }),
          ids: [territory.id],
        });
      }
      const storedSet =
        territoryId === focusedTerritory?.id
          ? (angleSet.data ?? null)
          : await loadAngleSet(masters.organizationId, territoryId);
      const auditLessons = storedSet?.auditLessons ?? [];
      const known = (labAngles.data ?? []).filter((row) => row.territoryId === territoryId);
      let sort = known.reduce((max, row) => Math.max(max, row.sortOrder), 0);
      const learned = [...auditLessons];
      let setRecord = storedSet ?? emptyAngleSetRecord();
      // Angles under this Territory that already passed; each new card must be a different observation.
      let runPeers: AnglePeer[] = known
        .filter((row) => {
          if (row.admission !== "GENERATE_VALID") return false;
          const fp = angleFingerprint({ statement: row.statement, territoryFingerprint: territoryFingerprint({ statement: territory.statement, bigThoughtFingerprint: bigThoughtFingerprint({ statement: focusedThought.statement, masterThoughtFingerprint: parentFp }) }) });
          return angleVerdict(row, setRecord, fp) === "AUDIT_PASS";
        })
        .map((row) => ({ code: row.code, statement: row.statement, subject: row.canonicalSemantic.subject ?? "" }));
      const bannedNames = new Set(
        [
          ...learned.map((lesson) => lesson.statement.trim().toLowerCase()),
          ...known
            .filter((row) => row.admission === "GENERATE_REJECT")
            .map((row) => row.statement.trim().toLowerCase()),
        ].filter(Boolean),
      );
      const rememberGenerateLesson = async (lesson: { code: string; statement: string; reason: string }) => {
        const statement = lesson.statement.trim();
        const reason = lesson.reason.trim();
        if (!statement || !reason) return;
        const key = statement.toLowerCase();
        if (!learned.some((item) => item.statement.trim().toLowerCase() === key && item.reason === reason)) {
          learned.push({ code: lesson.code, statement, reason });
        }
        bannedNames.add(key);
        const next = mergeAngleAuditLessons(setRecord.auditLessons, [{ code: lesson.code, statement, reason }]);
        const same =
          next.length === setRecord.auditLessons.length &&
          next.every((item, index) => {
            const stored = setRecord.auditLessons[index];
            return stored?.statement === item.statement && stored.reason === item.reason && stored.code === item.code;
          });
        if (same) return;
        setRecord = { ...setRecord, auditLessons: next };
        await saveAngleSet({
          organizationId: masters.organizationId as string,
          territoryId,
          record: setRecord,
        });
      };
      let shownChecks: AnglePassCheck[] = [];
      const publishLive = (checks: AnglePassCheck[]) => {
        const previous = shownChecks;
        shownChecks = checks.map((check) => ({ ...check }));
        const changed = checks.find((check, index) => check.state !== previous[index]?.state);
        const report =
          changed?.state === "running" || changed?.state === "pass" || changed?.state === "fail"
            ? {
                gate: changed.id,
                phase: changed.state === "running" ? ("checking" as const) : ("checked" as const),
                outcome: changed.state === "fail" ? ("fail" as const) : ("pass" as const),
              }
            : null;
        setAngleGenerateRun({ territoryId, checks: shownChecks, report });
      };
      let result: Awaited<ReturnType<typeof runAngleGenerate>> | null = null;
      try {
      result = await runAngleGenerate({
        loadParent: () =>
          loadAngleParentGate({
            organizationId: masters.organizationId as string,
            territoryId,
            expectedBigThoughtId: territory.bigThoughtId,
            masterThoughtFingerprint: parentFp,
          }),
        // AN codes are unique per Master Thought.
        reservedCodes: (labAngles.data ?? []).map((row) => row.code),
        incumbents: known.map((row) => ({
          code: row.code,
          statement: row.statement,
          admission: row.admission,
          territoryId: row.territoryId,
        })),
        topUp: true,
        carryLessons: true,
        propose: async (plan, parent, incumbents) => {
          const drafts = await proposeAngleStatements({
            parentStatement: parent.statement,
            ancestors: parent.ancestors,
            incumbents: incumbents
              .filter((row) => row.admission === "GENERATE_VALID")
              .map((row) => ({ code: row.code, statement: row.statement })),
            lessons: [
              ...learned,
              ...known
                .filter(
                  (row) =>
                    row.admission === "GENERATE_REJECT" &&
                    !learned.some((lesson) => lesson.statement.trim().toLowerCase() === row.statement.trim().toLowerCase()),
                )
                .map((row) => ({
                  code: row.code,
                  statement: row.statement,
                  reason: "observation: This sentence already failed.",
                })),
            ],
            needed: plan.needed,
            ask: (prompt) => askThinkingLab(prompt, 0.2),
          });
          return drafts.filter((draft) => !bannedNames.has(draft.statement.trim().toLowerCase()));
        },
        judge: async (parent, code, draft) => {
          const statement = draft.statement;
          const failFacts = async (reason: string) => {
            await rememberGenerateLesson({ code, statement, reason });
            return { ...shownAngleFacts(code, statement), relationToParent: "BIG_THOUGHT_LIKE" as const };
          };
          if (bannedNames.has(statement.trim().toLowerCase())) {
            const repeated = learned.find(
              (lesson) => lesson.statement.trim().toLowerCase() === statement.trim().toLowerCase(),
            );
            return failFacts(repeated?.reason || "This sentence already failed.");
          }
          const checked = await runAngleChecks({
            skip: skipFor("angle"),
            statement,
            subject: draft.subject,
            example: draft.example,
            parentStatement: parent.statement,
            ancestors: parent.ancestors,
            peers: runPeers,
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: publishLive,
          });
          const failure = firstAngleFailure(checked.checks);
          if (failure) return failFacts(`${failure.gate}: ${failure.reason}`);
          publishAngleChecklist(code, checked.checks);
          return shownAngleFacts(code, statement, draft.subject, draft.example);
        },
        persist: async ({ parent, code, statement, facts, admission }) => {
          if (admission !== "GENERATE_VALID") {
            return {
              code,
              statement,
              admission: "GENERATE_REJECT" as const,
              territoryId: parent.id,
            };
          }
          sort += 1;
          const saved = await labAngles.insert.mutateAsync({
            territoryId: parent.id,
            expectedBigThoughtId: territory.bigThoughtId,
            masterThoughtFingerprint: parentFp,
            code,
            statement,
            sortOrder: sort,
            facts,
            admission,
          });
          // Every check already passed at Generate: the card is saved with its pass mark.
          setRecord = withAngleResult(setRecord, {
            code: saved.code,
            statement: saved.statement,
            statementFingerprint: angleFingerprint({ statement: saved.statement, territoryFingerprint: parent.territoryFingerprint }),
            failure: null,
            skipped: skipFor("angle"),
          });
          runPeers = [...runPeers, { code: saved.code, statement: saved.statement, subject: facts.subject ?? "" }];
          await saveAngleSet({ organizationId: masters.organizationId as string, territoryId, record: setRecord });
          return {
            code: saved.code,
            statement: saved.statement,
            admission: saved.admission,
            territoryId: saved.territoryId,
          };
        },
      });
      if (result.outcome === "DENIED" && result.reason) {
        toast.error(result.reason);
        return;
      }
      if (result.outcome === "INSUFFICIENT_VALID_ANGLES") {
        setNotice(
          t("thinkingLab.angle.insufficient", "INSUFFICIENT_VALID_ANGLES {{count}}/{{target}}", {
            count: result.generateValid,
            target: result.target,
          }),
        );
      }
      const beforeValid = known
        .filter((row) => row.admission === "GENERATE_VALID")
        .map((row) => row.code.toUpperCase())
        .sort()
        .join("\0");
      const afterValid = result.incumbents
        .filter((row) => row.admission === "GENERATE_VALID")
        .map((row) => row.code.toUpperCase())
        .sort()
        .join("\0");
      if (learned.length !== auditLessons.length || beforeValid !== afterValid) {
        await saveAngleSet({
          organizationId: masters.organizationId,
          territoryId,
          record: setRecord,
        });
        await queryClient.invalidateQueries({
          queryKey: ["thinking-lab-angle-set", masters.organizationId, territoryId],
        });
      }
      } finally {
        setAngleGenerateRun((current) => {
          if (!current || current.territoryId !== territoryId) return current;
          return current.checks.some((check) => check.state === "fail") ? current : null;
        });
      }
    }, "generate-angle");

  const writeGeneratedIdeas = (angleId: string, discovery: IdeaDiscovery) =>
    run(async () => {
      if (!masters.organizationId || !parentFp) return;
      const organizationId = masters.organizationId;
      const angle =
        (labAngles.data ?? []).find((row) => row.id === angleId) ??
        (focusedAngle?.id === angleId ? focusedAngle : null);
      if (!angle || !focusedTerritory || angle.territoryId !== focusedTerritory.id) return;
      if (focus?.kind === "territory" && focus.territoryId === angle.territoryId) {
        setFocus({
          kind: "angle",
          masterId: focus.masterId,
          thoughtId: focus.thoughtId,
          territoryId: focus.territoryId,
          angleId,
        });
      }
      if (angle.status !== "locked") {
        if (!parentTerritoryFingerprint) return;
        await angleSet.lock.mutateAsync({
          territoryFingerprint: parentTerritoryFingerprint,
          ids: [angle.id],
        });
      }
      const storedSet =
        angleId === focusedAngle?.id && ideaSet.data ? ideaSet.data : await loadIdeaSet(organizationId, angleId);
      const storedDiscovery = storedSet.discovery;
      const discoveryUnchanged =
        storedDiscovery?.angleFingerprint === discovery.angleFingerprint &&
        storedDiscovery.decisions.length === discovery.decisions.length &&
        storedDiscovery.decisions.every(
          (row, index) =>
            row.category === discovery.decisions[index]?.category &&
            row.question === discovery.decisions[index]?.question &&
            row.answer === discovery.decisions[index]?.answer,
        );
      if (discovery.angleFingerprint && !discoveryUnchanged) {
        const record = { ...storedSet, discovery };
        await saveIdeaSet({ organizationId, angleId, record });
        queryClient.setQueryData(["thinking-lab-idea-set", organizationId, angleId], record);
        await queryClient.invalidateQueries({ queryKey: ["thinking-lab-idea-set", organizationId, angleId] });
      }
      const known = (labIdeas.data ?? []).filter((row) => row.angleId === angleId);
      let sort = known.reduce((max, row) => Math.max(max, row.sortOrder), 0);
      const history = await loadIdeaComparisonHistory(organizationId, angleId);
      let memory: FailureMemoryItem[] = failureItemsFromIdeas(history.ideas, angleId);
      let peers = peersFromIdeas(history.ideas);
      let historyUnsaved = false;
      let savedPassed = known.filter(
        (row) => (row.validation ?? uncheckedIdeaValidation(row.statement, angle.statement)).decision === "LOLOS",
      ).length;
      let shownDecision: IdeaValidation["decision"] | null = null;
      const ancestors = (parent: { ancestors?: AncestorStake[] }) => ancestorsWithMaster(parent.ancestors ?? []);
      try {
        const result = await runIdeaGenerate({
          loadParent: () =>
            loadIdeaParentGate({
              organizationId,
              angleId,
              expectedTerritoryId: angle.territoryId,
              masterThoughtFingerprint: parentFp,
            }),
          incumbents: known.map((row) => ({
            code: row.code,
            statement: row.statement,
            admission: row.validation ? row.admission : admissionForDecision(uncheckedIdeaValidation(row.statement, angle.statement).decision),
            angleId: row.angleId,
            locked: row.status === "locked",
          })),
          propose: (parent, incumbents) =>
            proposeIdea({
              parentStatement: parent.statement,
              masterSubject,
              ancestors: ancestors(parent),
              incumbents: incumbents
                .filter((row) => row.admission === "GENERATE_VALID")
                .map((row) => ({ code: row.code, statement: row.statement, locked: row.locked === true })),
              failures: memory,
              decisions: discovery.decisions,
              ask: (prompt) => askThinkingLab(prompt, 0.2),
            }),
          check: (parent, draft) =>
            runIdeaChecks({
              statement: draft.statement,
              title: draft.title,
              concept: draft.concept,
              mechanism: draft.mechanism,
              value: draft.value,
              mechanismKeys: draft.mechanismKeys,
              angle: parent.statement,
              territory: focusedTerritory.statement,
              bigThought: focusedThought?.statement ?? "",
              masterThought: masterStatement,
              masterSubject,
              ...ideaAudience,
              failures: memory,
              peers,
              historyAvailable: history.historyAvailable,
              skip: skipFor("idea"),
              ask: (prompt) => askThinkingLab(prompt, 0),
              onStep: (steps) => publishLiveIdea(angleId, steps),
            }),
          persist: async ({ parent, code, draft, validation, admission }) => {
            sort += 1;
            try {
              const saved = await labIdeas.insert.mutateAsync({
                angleId: parent.id,
                expectedTerritoryId: angle.territoryId,
                masterThoughtFingerprint: parentFp,
                code,
                statement: draft.statement,
                sortOrder: sort,
                facts: ideaFacts({ code, statement: draft.statement, subject: draft.title, mechanismKeys: draft.mechanismKeys }),
                admission,
                validation,
                parentIdeaId: null,
              });
              queryClient.setQueriesData<LabIdea[]>(
                { queryKey: ["thinking-lab-ideas", organizationId] },
                (current) => (current && !current.some((row) => row.id === saved.id) ? [...current, saved] : current),
              );
            } catch {
              historyUnsaved = true;
            }
            if (validation.decision === "LOLOS") {
              savedPassed += 1;
              shownDecision = "LOLOS";
              peers = [...peers, { code, statement: draft.statement, mechanism: validation.mechanism }];
            } else {
              if (shownDecision !== "LOLOS") shownDecision = validation.decision;
              const lesson = failureMemoryFromValidation({ code, statement: draft.statement, angleId: parent.id, validation });
              if (lesson) memory = [lesson, ...memory];
            }
            return { code, statement: draft.statement, admission, angleId: parent.id, locked: false };
          },
        });
        if (result.outcome === "DENIED" && result.reason) {
          toast.error(result.reason);
          return;
        }
        if (historyUnsaved) {
          setNotice(t("thinkingLab.idea.historyUnsaved", "This history could not be saved."));
        } else if (savedPassed < result.target) {
          setNotice(
            t("thinkingLab.idea.insufficient", "INSUFFICIENT_VALID_IDEAS {{count}}/{{target}}", {
              count: savedPassed,
              target: result.target,
            }),
          );
        }
        if (shownDecision) setIdeaRevisionTarget({ nonce: Date.now(), decision: shownDecision });
      } finally {
        setIdeaGenerateRun((current) => {
          if (!current || current.angleId !== angleId) return current;
          const hasResult = current.checks.some((check) => check.state !== "pending" || Boolean(check.reason?.trim()));
          return hasResult ? current : null;
        });
      }
    }, "generate-idea");

  /** Saves a pass mark for each open Idea's current sentence: Lock in chat and the "Tanpa cek" badge read it. */
  const savePassedIdeaAudit = async () => {
    if (!parentAngleFingerprint || openIdeas.length === 0 || ideaAuditSaved) return;
    await ideaSet.save.mutateAsync({
      ...(ideaSet.data ?? emptyIdeaSetRecord()),
      audit: {
        fingerprint: ideaFingerprintNow,
        items: openIdeas.map((row) => ({
          code: row.code,
          verdict: "AUDIT_PASS" as const,
          ...skippedMark("idea"),
          statementFingerprint: ideaFingerprint({
            statement: row.statement,
            angleFingerprint: parentAngleFingerprint,
          }),
        })),
      },
    });
  };

  const onLockIdeas = () =>
    run(async () => {
      if (!focusedAngle || !parentAngleFingerprint || openIdeas.length === 0) return;
      await savePassedIdeaAudit();
      await ideaSet.lock.mutateAsync({
        angleFingerprint: parentAngleFingerprint,
        ids: openIdeas.map((row) => row.id),
      });
    }, "lock");

  const labelFor = async (code: string, statement: string) => {
    try {
      const script = await askThinkingLab(buildBigThoughtLabelPrompt([{ code, statement }]), 0);
      return parseBigThoughtLabels(script ? parseModelJson(script) : null).get(code.toUpperCase()) ?? "";
    } catch {
      return "";
    }
  };

  /**
   * The same admission as Generate: an exact repeat of a passed Big Thought, then the switched-on
   * finished-claim and relation checks. Audit runs the remaining checks later.
   */
  /** The six checks on a sentence written by hand, against the Big Thoughts that already passed. */
  const admitBigThought = async (input: {
    code: string;
    label: string;
    statement: string;
    siblings: Array<{ code: string; statement: string; label?: string }>;
  }): Promise<{ facts: BigThoughtFacts; rejection: null } | { facts: null; rejection: string }> => {
    const repeated = input.siblings.find((row) => bigThoughtRepeats({ label: input.label, statement: input.statement }, row));
    if (repeated) return { facts: null, rejection: `duplicate: Same Big Thought as ${repeated.code}.` };
    const checklist = await runBigThoughtChecks({
      skip: skipFor("bigThought"),
      statement: input.statement,
      parentStatement: becauseParent,
      others: input.siblings,
      ask: (prompt) => askScoped("manual-big-thought", input.code, prompt, 0),
    });
    if (checklist.failure) return { facts: null, rejection: `${checklist.failure.gate}: ${checklist.failure.reason}` };
    return { facts: factsForBigThoughtChecks(input.code, input.statement, checklist), rejection: null };
  };

  /** Stores that this card's current sentence passed its checks. */
  const markBigThoughtPassed = async (code: string, statement: string) => {
    if (!selected) return;
    await masters.saveSet.mutateAsync({
      id: selected.id,
      lastAudit: withBigThoughtResult(readBigThoughtSetRecord(selected.lastAudit), {
        code,
        statement,
        statementFingerprint: bigThoughtStatementFingerprint(statement),
        failure: null,
        skipped: skipFor("bigThought"),
      }),
    });
  };

  const onManualBigThought = (raw: string) =>
    runManual("manual-big-thought", async () => {
      if (!selected || !parentFp || !ready) return null;
      if (!masterSubject) {
        return t(
          "thinkingLab.master.subjectMissing",
          "The Master Thought subject is not sealed yet. New Big Thoughts wait for that subject.",
        );
      }
      if (shownRowViews.length >= ACTIVE_SET_CAP) return t("thinkingLab.manual.cap", "This set is full.");
      const read = readBigThoughtLabel(raw);
      if (read.ok === false) {
        return read.reason === "TOO_LONG" ? t("thinkingLab.manual.labelTooLong", "A label stays within 12 words.") : null;
      }
      const known = thoughts.data ?? [];
      const code = nextBigThoughtCode(known.map((row) => row.code));
      const siblings = bigThoughtPeers();
      const pool = selected.productReasonPool;
      if (pool && pool.items.length === 0) {
        return t(
          "thinkingLab.product.noSupport",
          "Produk ini tidak menopang Master Thought. Tidak ada alasan tersimpan yang menyelesaikan keyakinan ini.",
        );
      }
      let rejectionNote: string | null = null;
      let statement = "";
      let sealed: BigThoughtFacts | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const script = await askThinkingLab(
          buildKeyBeliefFromLabelPrompt({
            parentStatement: becauseParent,
            label: read.label,
            incumbents: siblings,
            rejection: rejectionNote,
            reasonPool: pool,
          }),
          0.2,
        );
        const choice = parseKeyBeliefChoice(script ? parseModelJson(script) : null, becauseParent);
        statement = choice?.statement ?? "";
        if (!statement) return t("thinkingLab.manual.beliefUnreadable", "The Key Belief for this label could not be read. Try again.");
        if (pool && keepGroundedBigThoughts([{ label: "", statement, reasonId: choice?.reasonId }], pool).length === 0) {
          rejectionNote = t(
            "thinkingLab.product.noSupport",
            "Produk ini tidak menopang Master Thought. Tidak ada alasan tersimpan yang menyelesaikan keyakinan ini.",
          );
          if (attempt === 1) return rejectionNote;
          continue;
        }
        const admitted = await admitBigThought({ code, label: read.label, statement, siblings });
        sealed = admitted.facts;
        const rejection = admitted.rejection;
        if (rejection === null) break;
        rejectionNote = rejection;
        if (attempt === 1) return rejection;
      }
      if (!sealed || !statement) return t("thinkingLab.manual.beliefUnreadable", "The Key Belief for this label could not be read. Try again.");
      const sort = known.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
      await thoughts.insert.mutateAsync({
        code,
        statement,
        label: read.label,
        sortOrder: sort,
        facts: sealed,
        masterFingerprint: parentFp,
      });
      await markBigThoughtPassed(code, statement);
      return null;
    });

  const onEditBigThought = (id: string, statement: string) =>
    runManual("manual-big-thought", async () => {
      if (!selected || !parentFp) return null;
      const row = (thoughts.data ?? []).find((item) => item.id === id);
      if (!row || row.status !== "candidate") return null;
      const clause = asBecauseClause(statement, becauseParent);
      if (!clause) return null;
      const admitted = await admitBigThought({
        code: row.code,
        label: "",
        statement: clause,
        siblings: bigThoughtPeers(row.code),
      });
      if (admitted.rejection !== null) return admitted.rejection;
      const sealed = admitted.facts;
      const label = await labelFor(row.code, clause);
      await thoughts.updateFacts.mutateAsync({
        id,
        statement: clause,
        ...(label ? { label } : {}),
        facts: sealed,
        masterFingerprint: parentFp,
      });
      await markBigThoughtPassed(row.code, clause);
      return null;
    });

  const onEditTerritory = (id: string, statement: string) =>
    runManual("manual-territory", async () => {
      if (!focusedThought || !parentFp || !masters.organizationId || !focusedBigThoughtFingerprint) return null;
      const row = (labTerritories.data ?? []).find((item) => item.id === id && item.bigThoughtId === focusedThought.id);
      if (!row || row.status !== "candidate") return null;
      // The same five checks as Generate.
      const checked = await runTerritoryChecks({
        skip: skipFor("territory"),
        statement,
        parentStatement: focusedThought.statement,
        audience: selected?.audience,
        question: answeredQuestion,
        ensureQuestion: () => ensureAnsweredQuestion(focusedThought),
        peers: territoryPeers(row.code),
        ask: (prompt) => askThinkingLab(prompt, 0),
      });
      const failure = firstTerritoryFailure(checked.checks);
      if (failure) return failure.reason;
      await labTerritories.replace.mutateAsync({
        bigThoughtId: focusedThought.id,
        id,
        statement,
        facts: shownTerritoryFacts(row.code, statement),
        admission: "GENERATE_VALID",
      });
      const stored = await loadTerritorySet(masters.organizationId, focusedThought.id);
      await territorySet.save.mutateAsync(
        withTerritoryResult(stored, {
          code: row.code,
          statement,
          statementFingerprint: territoryStatementFingerprint(statement),
          failure: null,
          skipped: skipFor("territory"),
        }),
      );
      publishTerritoryChecklist(row.code, checked.checks);
      // The area description and question belonged to the old name; let them be written again.
      descriptionFlight.current.delete(row.id);
      return null;
    });

  const onEditAngle = (id: string, statement: string) =>
    runManual("manual-angle", async () => {
      if (!focusedTerritory || !parentFp || !masters.organizationId || !parentTerritoryFingerprint) return null;
      const row = (labAngles.data ?? []).find((item) => item.id === id && item.territoryId === focusedTerritory.id);
      if (!row || row.status !== "candidate") return null;
      const subject = row.canonicalSemantic.subject ?? "";
      const example = row.canonicalSemantic.example ?? "";
      // The same six checks as Generate.
      const checked = await runAngleChecks({
        skip: skipFor("angle"),
        statement,
        subject,
        example,
        parentStatement: focusedTerritory.statement,
        ancestors: angleAncestors,
        peers: anglePeers(row.code),
        ask: (prompt) => askThinkingLab(prompt, 0),
      });
      const failure = firstAngleFailure(checked.checks);
      if (failure) return failure.reason;
      await labAngles.replace.mutateAsync({
        territoryId: focusedTerritory.id,
        id,
        statement,
        facts: shownAngleFacts(row.code, statement, subject, example),
        admission: "GENERATE_VALID",
      });
      const stored = await loadAngleSet(masters.organizationId, focusedTerritory.id);
      await angleSet.save.mutateAsync(
        withAngleResult(stored, {
          code: row.code,
          statement,
          statementFingerprint: angleStatementFingerprint(statement),
          failure: null,
          skipped: skipFor("angle"),
        }),
      );
      publishAngleChecklist(row.code, checked.checks);
      return null;
    });

  const ideaParentFor = (angleId: string) => {
    const angle = (labAngles.data ?? []).find((row) => row.id === angleId) ?? null;
    const territory = (labTerritories.data ?? []).find((row) => row.id === angle?.territoryId) ?? null;
    const thought = active.find((row) => row.id === territory?.bigThoughtId) ?? null;
    const ancestors: AncestorStake[] = [
      ...(territory?.statement.trim() ? [{ label: "Territory", statement: territory.statement.trim() }] : []),
      ...(thought?.statement.trim() ? [{ label: "Big Thought", statement: thought.statement.trim() }] : []),
      ...(masterStatement ? [{ label: "Master Thought", statement: masterStatement }] : []),
    ];
    return { angle, ancestors };
  };

  const onGenerateIdea = (angleId: string) => {
    if (!masters.organizationId || !parentFp) return;
    const angle =
      (labAngles.data ?? []).find((row) => row.id === angleId) ??
      (focusedAngle?.id === angleId ? focusedAngle : null);
    if (!angle || !focusedTerritory || angle.territoryId !== focusedTerritory.id) return;
    if (focus?.kind === "territory" && focus.territoryId === angle.territoryId) {
      setFocus({
        kind: "angle",
        masterId: focus.masterId,
        thoughtId: focus.thoughtId,
        territoryId: focus.territoryId,
        angleId,
      });
    }
    const fingerprint = angle.semanticFingerprint?.trim() ?? "";
    const knownDiscovery = angleId === focusedAngle?.id ? (ideaSet.data?.discovery ?? null) : null;
    if (ideaDiscoveryMatches(knownDiscovery, fingerprint)) {
      writeGeneratedIdeas(angleId, knownDiscovery);
      return;
    }
    if (labRunRef.current) return;
    const token = ++ideaDiscoverToken.current;
    setIdeaDiscover({
      angleId,
      angleFingerprint: fingerprint,
      questions: null,
      loading: true,
      failed: false,
    });
    let pending: IdeaDiscovery | null = null;
    void run(async () => {
      try {
        const storedSet =
          angleId === focusedAngle?.id && ideaSet.data
            ? ideaSet.data
            : await loadIdeaSet(masters.organizationId as string, angleId);
        if (ideaDiscoverToken.current !== token) return;
        const matched = storedSet?.discovery;
        if (ideaDiscoveryMatches(matched, fingerprint)) {
          pending = matched;
          setIdeaDiscover(null);
          return;
        }
        const { ancestors } = ideaParentFor(angleId);
        const raw = await askThinkingLab(
          buildIdeaDiscoveryPrompt({
            masterStatement,
            masterSubject,
            priorBelief: selected?.priorBelief,
            angleStatement: angle.statement,
            ancestors,
          }),
          0.2,
        );
        if (ideaDiscoverToken.current !== token) return;
        const discovered = parseIdeaDiscoveryQuestions(raw ? parseModelJson(raw) : null);
        if (!discovered.ok) {
          setIdeaDiscover((current) => {
            if (!current || ideaDiscoverToken.current !== token) return current;
            return { ...current, loading: false, questions: null, failed: true };
          });
          return;
        }
        if (discovered.questions.length === 0) {
          pending = { angleFingerprint: fingerprint, decisions: [] };
          setIdeaDiscover(null);
          return;
        }
        setIdeaDiscover((current) => {
          if (!current || ideaDiscoverToken.current !== token) return current;
          return { ...current, loading: false, questions: discovered.questions, failed: false };
        });
      } catch (error) {
        if (ideaDiscoverToken.current === token) {
          setIdeaDiscover((current) => {
            if (!current || ideaDiscoverToken.current !== token) return current;
            return { ...current, loading: false, questions: null, failed: true };
          });
        }
        throw error;
      }
    }, "idea-discover").then(() => {
      if (!pending || ideaDiscoverToken.current !== token) return;
      writeGeneratedIdeas(angleId, pending);
    });
  };

  /** Runs the switched-on Idea checks on one sentence, compared with the Ideas stored under this Territory. */
  const checkIdeaSentence = async (input: {
    angle: { id: string; statement: string };
    statement: string;
    exceptId?: string;
    draft?: Partial<Pick<IdeaDraft, "title" | "concept" | "mechanism" | "value" | "mechanismKeys">>;
    keptPasses?: IdeaValidation["criteria"];
  }): Promise<IdeaValidation> => {
    const history = await loadIdeaComparisonHistory(masters.organizationId as string, input.angle.id);
    const others = history.ideas.filter((row) => row.id !== input.exceptId);
    return runIdeaChecks({
      statement: input.statement,
      ...input.draft,
      angle: input.angle.statement,
      territory: focusedTerritory?.statement ?? "",
      bigThought: focusedThought?.statement ?? "",
      masterThought: masterStatement,
      masterSubject,
      ...ideaAudience,
      failures: failureItemsFromIdeas(others, input.angle.id),
      peers: peersFromIdeas(others),
      historyAvailable: history.historyAvailable,
      keptPasses: input.keptPasses,
      skip: skipFor("idea"),
      ask: (prompt) => askThinkingLab(prompt, 0),
      onStep: (steps) => publishLiveIdea(input.angle.id, steps),
    });
  };

  const onManualIdea = (statement: string) =>
    runManual("manual-idea", async () => {
      if (!focusedAngle || !focusedTerritory || !masters.organizationId || !parentFp) return null;
      const known = (labIdeas.data ?? []).filter((row) => row.angleId === focusedAngle.id);
      const active = known.filter(
        (row) => (row.validation ?? uncheckedIdeaValidation(row.statement, focusedAngle.statement)).decision !== "DITOLAK",
      );
      if (active.length >= IDEA_ACTIVE_CAP) return t("thinkingLab.manual.cap", "This set is full.");
      if (known.some((row) => sameIdeaConcept(row.statement, statement))) {
        return t(
          "thinkingLab.idea.repeatLocked",
          "This repeats an idea that is already saved. Locked ideas count, so write a different situation.",
        );
      }
      const code = nextIdeaCode(known.map((row) => row.code));
      const validation = await checkIdeaSentence({ angle: focusedAngle, statement });
      await labIdeas.insert.mutateAsync({
        angleId: focusedAngle.id,
        expectedTerritoryId: focusedAngle.territoryId,
        masterThoughtFingerprint: parentFp,
        code,
        statement,
        sortOrder: known.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1,
        facts: ideaFacts({ code, statement }),
        admission: admissionForDecision(validation.decision),
        validation,
      });
      return null;
    });

  const onEditIdea = (id: string, statement: string) =>
    runManual("manual-idea", async () => {
      if (!parentFp || !masters.organizationId) return null;
      const idea = (labIdeas.data ?? []).find((row) => row.id === id);
      if (!idea || idea.status !== "candidate") return null;
      const angle = (labAngles.data ?? []).find((row) => row.id === idea.angleId);
      if (!angle) return null;
      const siblings = (labIdeas.data ?? []).filter((row) => row.angleId === idea.angleId && row.id !== id);
      if (siblings.some((row) => sameIdeaConcept(row.statement, statement))) {
        return t(
          "thinkingLab.idea.repeatLocked",
          "This repeats an idea that is already saved. Locked ideas count, so write a different situation.",
        );
      }
      const validation = await checkIdeaSentence({
        angle,
        statement,
        exceptId: idea.id,
        draft: { title: idea.validation?.title, mechanismKeys: idea.canonicalSemantic.mechanismKeys },
      });
      if (validation.decision !== "LOLOS") {
        return (
          validation.decisionReason ||
          t("thinkingLab.idea.editKept", "This wording did not pass, so the saved idea was left as it was.")
        );
      }
      await labIdeas.replace.mutateAsync({
        angleId: idea.angleId,
        id,
        statement,
        facts: ideaFacts({
          code: idea.code,
          statement,
          subject: idea.canonicalSemantic.subject,
          mechanismKeys: idea.canonicalSemantic.mechanismKeys,
        }),
        admission: admissionForDecision(validation.decision),
        validation,
      });
      return null;
    });

  const onReviseIdea = (id: string) => {
    void run(async () => {
      const angleId = focusedAngle?.id;
      try {
        if (!focusedAngle || !masters.organizationId || !parentFp) {
          toast.error(t("thinkingLab.idea.reviseBlocked", "Revise could not start."));
          return;
        }
        const rows = (labIdeas.data ?? []).filter((row) => row.angleId === focusedAngle.id);
        const idea = rows.find((row) => row.id === id);
        if (!idea) return;
        const current = idea.validation ?? uncheckedIdeaValidation(idea.statement, focusedAngle.statement);
        const repairsUsed = Math.max(revisionCount(idea.id, rows), current.auditHistory.length);
        if (!canReviseIdea(idea, rows, current.decision, repairsUsed)) {
          const closed = t("thinkingLab.idea.revisionClosed", "This idea stays rejected. It has already been revised three times.");
          setNotice(closed);
          toast.error(closed);
          return;
        }
        const script = await askThinkingLab(
          buildIdeaRevisionPrompt({
            angle: focusedAngle.statement,
            statement: idea.statement,
            failed: current.criteria.filter((row) => row.status !== "PASS" && (row.status === "FAIL" || row.reason)),
            passed: current.criteria.filter((row) => row.status === "PASS"),
            revision: repairsUsed + 1,
          }),
          0.2,
        );
        const draft = parseGeneratedIdeaDrafts(script ? parseModelJson(script) : null)[0];
        if (!draft?.statement.trim()) {
          toast.error(t("thinkingLab.idea.reviseEmpty", "The revision did not repair this card."));
          return;
        }
        const revised: IdeaDraft = {
          ...draft,
          title: draft.title || current.title,
          concept: draft.concept || current.concept,
          mechanism: draft.mechanism || current.mechanism,
          value: draft.value || current.value,
          mechanismKeys: draft.mechanismKeys.length > 0 ? draft.mechanismKeys : idea.canonicalSemantic.mechanismKeys,
        };
        const validation = await checkIdeaSentence({
          angle: focusedAngle,
          statement: revised.statement,
          exceptId: idea.id,
          draft: revised,
          keptPasses: current.criteria.filter((row) => row.status === "PASS"),
        });
        const facts = ideaFacts({ code: idea.code, statement: revised.statement, subject: revised.title, mechanismKeys: revised.mechanismKeys });
        const admission = admissionForDecision(validation.decision);
        await labIdeas.replace.mutateAsync({
          angleId: focusedAngle.id,
          id: idea.id,
          statement: revised.statement,
          facts,
          admission,
          validation,
        });
        queryClient.setQueriesData<LabIdea[]>(
          { queryKey: ["thinking-lab-ideas", masters.organizationId] },
          (cached) =>
            cached?.map((row) =>
              row.id === idea.id ? { ...row, statement: revised.statement, admission, validation, canonicalSemantic: facts } : row,
            ) ?? cached,
        );
        setIdeaRevisionTarget({ nonce: Date.now(), decision: validation.decision });
        toast.success(
          t("thinkingLab.idea.reviseSaved", "{{code}} stayed on this card as {{decision}}.", {
            code: idea.code,
            decision: t(`thinkingLab.idea.decision.${validation.decision}`, validation.decision),
          }),
        );
      } finally {
        setIdeaGenerateRun((current) => (current?.angleId === angleId ? null : current));
      }
    }, "revise-idea");
  };

  const checkOrReviseAngle = async (code: string, revise: boolean, extraPeers: readonly AnglePeer[] = []): Promise<AnglePeer | null> => {
    if (!focusedTerritory || !masters.organizationId || !parentTerritoryFingerprint) return null;
    const row = admittedAngles.find((item) => item.code.toUpperCase() === code.toUpperCase());
    if (!row || row.status !== "candidate") return null;
    let record: AngleSetRecord = await loadAngleSet(masters.organizationId, focusedTerritory.id);
    const peers = [...anglePeers(row.code), ...extraPeers.filter((peer) => peer.code.toUpperCase() !== row.code.toUpperCase())];
    let card = {
      statement: row.statement,
      subject: row.canonicalSemantic.subject ?? "",
      example: row.canonicalSemantic.example ?? "",
    };
    const check = (next: typeof card) =>
      runAngleChecks({
        skip: skipFor("angle"),
        ...next,
        parentStatement: focusedTerritory.statement,
        ancestors: angleAncestors,
        peers,
        ask: (prompt) => askThinkingLab(prompt, 0),
        onStep: (checks) => publishAngleChecklist(row.code, checks),
      });
    let checked = revise ? null : await check(card);
    if (revise) {
      if (!canReviseAngle(record, row.code)) {
        setNotice(t("thinkingLab.angle.revisionCap", "This Angle was revised three times. Edit it yourself or delete it."));
      } else {
        const shown =
          checked?.checks ??
          angleChecksFromStored({ gateFailure: record.audit?.items.find((item) => item.code.toUpperCase() === row.code.toUpperCase())?.gateFailure ?? null });
        record = withAngleRevision(record, row.code);
        const script = await askThinkingLab(
          buildAngleRevisionPrompt({
            territory: focusedTerritory.statement,
            ancestors: angleAncestors,
            card,
            checks: shown,
            peers,
            lessons: record.auditLessons.filter((lesson) => lesson.code.toUpperCase() === row.code.toUpperCase()),
            revision: record.revisions[row.code.toUpperCase()] ?? 1,
          }),
          0.2,
        );
        const next = parseAngleRevision(script, card);
        if (next) {
          card = next;
          checked = await check(card);
          await labAngles.replace.mutateAsync({
            territoryId: focusedTerritory.id,
            id: row.id,
            statement: card.statement,
            facts: shownAngleFacts(row.code, card.statement, card.subject, card.example),
            admission: "GENERATE_VALID",
          });
        }
      }
    }
    if (checked) {
      record = withAngleResult(record, {
        code: row.code,
        statement: card.statement,
        statementFingerprint: angleStatementFingerprint(card.statement),
        failure: firstAngleFailure(checked.checks),
        skipped: skipFor("angle"),
      });
    }
    await angleSet.save.mutateAsync(record);
    return checked?.passed ? { code: row.code, statement: card.statement, subject: card.subject } : null;
  };

  const onFixAngle = (code: string) => {
    const key = code.trim().toUpperCase();
    if (!key || fixingAngleCodesRef.current.has(key)) return;
    fixingAngleCodesRef.current.add(key);
    setFixingAngleCodes(new Set(fixingAngleCodesRef.current));
    void run(async () => {
      const index = admittedAngles.findIndex((row) => row.code.toUpperCase() === key);
      await checkOrReviseAngle(code, angleVerdicts[index] === "AUDIT_FAIL");
    }, "fix-angles", "Angle").finally(() => {
      fixingAngleCodesRef.current.delete(key);
      setFixingAngleCodes(new Set(fixingAngleCodesRef.current));
    });
  };

  const onAngleStage = () =>
    run(async () => {
      if (!focusedTerritory || !masters.organizationId || !parentFp || admittedAngles.length === 0) return;
      if (angleStage === "audit") {
        // Cards saved before checks ran at Generate: check each one as it is, in order.
        const unchecked = admittedAngles.filter((_, index) => angleVerdicts[index] == null);
        const passed: AnglePeer[] = [];
        for (const row of unchecked) {
          const peer = await checkOrReviseAngle(row.code, false, passed);
          if (peer) passed.push(peer);
        }
        return;
      }
      if (angleStage === "lock" && angleLock.ok) {
        await angleSet.lock.mutateAsync({
          territoryFingerprint: parentTerritoryFingerprint,
          ids: admittedAngles.map((row) => row.id),
        });
      }
    }, angleStage ?? "audit", "Angle");

  const onLockAngles = () =>
    run(async () => {
      if (!focusedTerritory || admittedAngles.length === 0 || !parentTerritoryFingerprint || !angleLock.ok) return;
      await angleSet.lock.mutateAsync({
        territoryFingerprint: parentTerritoryFingerprint,
        ids: admittedAngles.map((row) => row.id),
      });
    }, "lock");

  const ensureAnsweredQuestion = async (thought: { id: string; statement: string }) => {
    // Stored on the Big Thought row; not part of this view model's type.
    const semantic = (thought as {
      canonicalSemantic?: { answeredQuestionVersion?: unknown; answeredQuestion?: string | null } | null;
    }).canonicalSemantic;
    const stored =
      semantic?.answeredQuestionVersion === ANSWERED_QUESTION_VERSION
        ? semantic.answeredQuestion?.trim() ?? ""
        : "";
    if (stored) return stored;
    const question = await resolveAnsweredQuestion({
      master: selected?.statement ?? "",
      reason: thought.statement,
      audience: selected?.audience,
      ask: (prompt) => askThinkingLab(prompt, 0),
    });
    if (!question || !masters.organizationId) return "";
    await thoughts.saveAnsweredQuestion.mutateAsync({ id: thought.id, question });
    return question;
  };

  /**
   * One card: a card that was never checked is checked as it is. A card that failed is rewritten from its
   * failed check (at most three times per card) and checked again. The card keeps its code either way.
   */
  const checkOrReviseTerritory = async (
    code: string,
    revise: boolean,
    extraPeers: readonly TerritoryPeer[] = [],
  ): Promise<TerritoryPeer | null> => {
    if (!focusedThought || !masters.organizationId || !focusedBigThoughtFingerprint) return null;
    const row = admittedTerritories.find((item) => item.code.toUpperCase() === code.toUpperCase());
    if (!row || row.status !== "candidate") return null;
    let record: TerritorySetRecord = await loadTerritorySet(masters.organizationId, focusedThought.id);
    const peers = [
      ...territoryPeers(row.code),
      ...extraPeers.filter((peer) => peer.code.toUpperCase() !== row.code.toUpperCase()),
    ];
    let question = answeredQuestion;
    let statement = row.statement;
    const check = (name: string) =>
      runTerritoryChecks({
        skip: skipFor("territory"),
        statement: name,
        parentStatement: focusedThought.statement,
        audience: selected?.audience,
        question,
        ensureQuestion: () => ensureAnsweredQuestion(focusedThought),
        peers,
        ask: (prompt) => askThinkingLab(prompt, 0),
        onStep: (checks) => publishTerritoryChecklist(row.code, checks),
      });
    let checked = revise ? null : await check(statement);
    if (revise) {
      if (!canReviseTerritory(record, row.code)) {
        setNotice(t("thinkingLab.territory.revisionCap", "This Territory was revised three times. Edit it yourself or delete it."));
      } else {
        const shown =
          territoryChecklists[row.code.toUpperCase()]?.checks ??
          territoryChecksFromStored({
            gateFailure: record.audit?.items.find((item) => item.code.toUpperCase() === row.code.toUpperCase())?.gateFailure ?? null,
          });
        record = withTerritoryRevision(record, row.code);
        const script = await askThinkingLab(
          buildTerritoryRevisionPrompt({
            bigThought: focusedThought.statement,
            ancestors: territoryAncestors,
            audience: selected?.audience,
            answeredQuestion: question,
            statement,
            checks: shown,
            peers,
            lessons: record.auditLessons.filter((lesson) => lesson.code.toUpperCase() === row.code.toUpperCase()),
            revision: record.revisions[row.code.toUpperCase()] ?? 1,
          }),
          0.2,
        );
        const next = parseTerritoryRevision(script, statement);
        if (next) {
          statement = next;
          checked = await check(statement);
          if (checked.question) question = checked.question;
          await labTerritories.replace.mutateAsync({
            bigThoughtId: focusedThought.id,
            id: row.id,
            statement,
            facts: shownTerritoryFacts(row.code, statement),
            admission: "GENERATE_VALID",
          });
          // The area description and question belonged to the old name; let them be written again.
          descriptionFlight.current.delete(row.id);
        }
      }
    }
    if (checked) {
      record = withTerritoryResult(record, {
        code: row.code,
        statement,
        statementFingerprint: territoryStatementFingerprint(statement),
        failure: firstTerritoryFailure(checked.checks),
        skipped: skipFor("territory"),
      });
    }
    await territorySet.save.mutateAsync(record);
    return checked?.passed ? { code: row.code, statement } : null;
  };

  const onFixTerritory = (code: string) => {
    const key = code.trim().toUpperCase();
    if (!key || fixingTerritoryCodesRef.current.has(key)) return;
    fixingTerritoryCodesRef.current.add(key);
    setFixingTerritoryCodes(new Set(fixingTerritoryCodesRef.current));
    void run(async () => {
      const index = admittedTerritories.findIndex((row) => row.code.toUpperCase() === key);
      await checkOrReviseTerritory(code, territoryVerdicts[index] === "AUDIT_FAIL");
    }, "fix-territories", "Territory").finally(() => {
      fixingTerritoryCodesRef.current.delete(key);
      setFixingTerritoryCodes(new Set(fixingTerritoryCodesRef.current));
    });
  };

  const onTerritoryStage = () => {
    if (territoryStage === "generate" && focusedThought) {
      onGenerateTerritory(focusedThought.id);
      return;
    }
    return run(async () => {
      if (!focusedThought || !masters.organizationId || !parentFp || admittedTerritories.length === 0) return;
      if (territoryStage === "audit") {
        // Cards saved before checks ran at Generate: check each one as it is, in order.
        const unchecked = admittedTerritories.filter((_, index) => territoryVerdicts[index] == null);
        const passed: TerritoryPeer[] = [];
        for (const row of unchecked) {
          const peer = await checkOrReviseTerritory(row.code, false, passed);
          if (peer) passed.push(peer);
        }
        return;
      }
      if (territoryStage === "lock" && territoryLock.ok) {
        await territorySet.lock.mutateAsync({
          bigThoughtFingerprint: focusedBigThoughtFingerprint,
          ids: admittedTerritories.map((row) => row.id),
        });
      }
    }, territoryStage ?? "territory", "Territory");
  };

  const onLockTerritories = () =>
    run(async () => {
      if (!focusedThought || !focusedBigThoughtFingerprint || !territoryLock.ok) return;
      await territorySet.lock.mutateAsync({
        bigThoughtFingerprint: focusedBigThoughtFingerprint,
        ids: admittedTerritories.map((row) => row.id),
      });
    }, "lock");

  const publishBigThoughtChecklist = async (code: string, statement: string, checklist: PassChecklist, done: number, total: number) => {
    setBigThoughtChecklists((current) => ({ ...current, [code.toUpperCase()]: checklist }));
    setAuditProgress({ done, total, current: { code, statement }, checklist });
    await waitForChecklistReport(checklist);
  };

  /**
   * One card: a card that was never checked is checked as it is. A card that failed is rewritten from its
   * failed check (at most three times per card) and checked again. The card keeps its code either way.
   */
  const checkOrReviseBigThought = async (
    code: string,
    revise: boolean,
    options: {
      extraPeers?: ReadonlyArray<{ code: string; statement: string; label?: string }>;
      progress?: { done: number; total: number };
      /** The record a run over several cards has written so far; the stored one otherwise. */
      record?: BigThoughtSetRecord;
    } = {},
  ): Promise<{ peer: { code: string; statement: string; label?: string } | null; record: BigThoughtSetRecord | null }> => {
    if (!selected || !parentFp) return { peer: null, record: null };
    const row = active.find((item) => item.code.toUpperCase() === code.toUpperCase());
    if (!row || row.status !== "candidate") return { peer: null, record: null };
    let record: BigThoughtSetRecord = options.record ?? readBigThoughtSetRecord(selected.lastAudit);
    const progress = options.progress ?? { done: 0, total: 1 };
    const peers = [
      ...bigThoughtPeers(row.code),
      ...(options.extraPeers ?? []).filter((peer) => peer.code.toUpperCase() !== row.code.toUpperCase()),
    ];
    const lessons = record.auditLessons.filter((lesson) => lesson.code.toUpperCase() === row.code.toUpperCase());
    let statement = row.statement;
    let label = row.label;
    const check = (sentence: string) =>
      runBigThoughtChecks({
        skip: skipFor("bigThought"),
        statement: sentence,
        parentStatement: becauseParent,
        others: peers,
        lessons,
        ask: (prompt) => askScoped(revise ? "fix" : "audit", row.code, prompt, 0),
        onStep: (checklist) => publishBigThoughtChecklist(row.code, sentence, checklist, progress.done, progress.total),
      });
    let checked = revise ? null : await check(statement);
    if (revise) {
      if (!canReviseBigThought(record, row.code)) {
        setNotice(t("thinkingLab.bt.revisionCap", "This Big Thought was revised three times. Edit it yourself or delete it."));
      } else {
        const stored = record.audit?.items.find((item) => item.code.toUpperCase() === row.code.toUpperCase())?.gateFailure;
        const shown =
          bigThoughtChecklists[row.code.toUpperCase()]?.items ??
          (stored ? checklistFromFailure({ ...stored, earlier: "pass" }).items : []);
        record = withBigThoughtRevision(record, row.code);
        const script = await askScoped(
          "fix",
          row.code,
          buildBigThoughtRevisionPrompt({
            parentStatement: becauseParent,
            statement,
            checks: shown,
            peers,
            lessons,
            revision: record.revisions[row.code.toUpperCase()] ?? 1,
          }),
          0.2,
        );
        const next = parseBigThoughtRevision(script, becauseParent, statement);
        if (next) {
          statement = next;
          checked = await check(statement);
          label = (await labelFor(row.code, statement)) || label;
          await thoughts.updateFacts.mutateAsync({
            id: row.id,
            statement,
            ...(label ? { label } : {}),
            facts: factsForBigThoughtChecks(row.code, statement, checked),
            masterFingerprint: parentFp,
          });
        }
      }
    }
    if (checked) {
      record = withBigThoughtResult(record, {
        code: row.code,
        statement,
        statementFingerprint: bigThoughtStatementFingerprint(statement),
        failure: checked.failure ? { gate: checked.failure.gate, reason: checked.failure.reason } : null,
        skipped: skipFor("bigThought"),
      });
    }
    await masters.saveSet.mutateAsync({ id: selected.id, lastAudit: record });
    return { peer: checked?.passed ? { code: row.code, statement, label } : null, record };
  };

  const onFixBigThought = (code: string) => {
    const key = code.trim().toUpperCase();
    if (!key || labRunRef.current || fixingBigThoughtRef.current.has(key)) return;
    labRunRef.current = true;
    fixingBigThoughtRef.current.add(key);
    setFixingBigThoughtCodes([...fixingBigThoughtRef.current]);
    void (async () => {
      try {
        const row = shownRowViews.find((item) => item.code.toUpperCase() === key);
        await checkOrReviseBigThought(key, row?.audit === "AUDIT_FAIL");
      } catch (error) {
        reportStepError(error);
      } finally {
        fixingBigThoughtRef.current.delete(key);
        setFixingBigThoughtCodes([...fixingBigThoughtRef.current]);
        setAuditProgress(null);
        labRunRef.current = false;
      }
    })();
  };

  /** Cards saved before checks ran at Generate: check each one as it is, in order. */
  const onAudit = () =>
    run(async () => {
      const unchecked = shownRowViews.filter((row) => row.audit == null && row.status === "candidate");
      const passed: Array<{ code: string; statement: string; label?: string }> = [];
      let record: BigThoughtSetRecord | undefined;
      try {
        for (const [index, row] of unchecked.entries()) {
          const result = await checkOrReviseBigThought(row.code, false, {
            extraPeers: passed,
            progress: { done: index, total: unchecked.length },
            record,
          });
          if (result.peer) passed.push(result.peer);
          if (result.record) record = result.record;
        }
      } finally {
        setAuditProgress(null);
      }
    }, "audit", "Big Thought");

  const onLock = () =>
    run(async () => {
      if (!selected) return;
      if (lockDecision.ok === false) {
        setNotice(lockDecision.reason);
        return;
      }
      const ids = shownRowViews
        .filter((row) => row.audit === "AUDIT_PASS")
        .map((row) => row.id);
      await thoughts.lockMany.mutateAsync(ids);
      await masters.lock.mutateAsync(selected.id);
      setFocus(null);
    });

  const onUnlock = () =>
    run(async () => {
      if (!selected) return;
      await thoughts.unlockAll.mutateAsync();
      await masters.unlock.mutateAsync(selected.id);
      setFocus(null);
    });

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

  const composerForm = (
    <div
      className={cn(
        "scrollbar-hide flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
    >
    <div className="shrink-0">
      <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
        {t("thinkingLab.composer.headline", "Master Thought baru")}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {t(
          "thinkingLab.composer.lead",
          "Pilih kategori, lalu tulis keyakinan lama dan keyakinan barunya.",
        )}
      </p>
    </div>
    <div className="shrink-0 space-y-1 text-sm font-medium text-foreground">
      {t("thinkingLab.catalog.label", "Kategori")}
      <MasterCatalogPicker
        value={newCatalog}
        catalogs={catalogs.data ?? []}
        disabled={busy}
        onChange={setNewCatalog}
      />
      <ProductBeliefSource
        link={newCatalog}
        catalogs={catalogs.data ?? []}
        disabled={busy}
        onPoolChange={setReasonPool}
        onApply={(draft) => {
          setNewPrior(draft.priorBelief);
          setNewPlanted(draft.plantedBelief);
          setNewAudience(draft.audience);
        }}
      />
    </div>
    <label className="shrink-0 space-y-1 text-sm font-medium text-foreground">
      {t("thinkingLab.master.prior", "Old belief (false belief)")}
    <Textarea
        value={newPrior}
        onChange={(event) => setNewPrior(event.target.value)}
        rows={2}
        className="mt-1 font-normal"
        placeholder={t(
          "thinkingLab.master.priorPlaceholder",
          "Example: the fastest bike is the most important thing to chase right now",
        )}
      />
    </label>
    <label className="shrink-0 space-y-1 text-sm font-medium text-foreground">
      {t("thinkingLab.master.planted", "New belief (belief shift)")}
      <Textarea
        value={newPlanted}
        onChange={(event) => setNewPlanted(event.target.value)}
        rows={2}
        className="mt-1 font-normal"
        placeholder={t(
          "thinkingLab.master.plantedPlaceholder",
          "Example: money while young is more valuable when saved",
        )}
      />
    </label>
    <label className="shrink-0 space-y-1 text-sm font-medium text-foreground">
      {t("thinkingLab.master.audience", "Target audience (optional)")}
      <Textarea
        value={newAudience}
        onChange={(event) => setNewAudience(event.target.value)}
        rows={2}
        className="mt-1 font-normal"
        placeholder={t(
          "thinkingLab.master.audiencePlaceholder",
          "Example: teenage boys who love motorbikes",
        )}
      />
    </label>
    <Button
      type="button"
      className="shrink-0"
      onClick={onCreate}
      disabled={
        busy ||
        !newCatalog.serviceId ||
        !newPrior.trim() ||
        !newPlanted.trim() ||
        beliefsMatch(newPrior, newPlanted)
      }
      aria-busy={busyAction === "save-master" || undefined}
    >
      {busyAction === "save-master" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {t("thinkingLab.action.saveMaster", "Simpan Master Thought")}
    </Button>
    </div>
  );
  const savedMasterList = (
    <SavedMasterThoughtList
      masters={masters.data ?? []}
      catalogs={catalogs.data ?? []}
      catalogPending={masters.saveCatalog.isPending}
      onSaveCatalog={(id, catalog) => {
        void masters.saveCatalog.mutateAsync({ id, catalog });
      }}
      onOpen={(id) => {
        const row = masters.data?.find((item) => item.id === id);
        closeComposer();
        skipAutoSelect.current = false;
        setSelectedId(id);
        setFocus(row?.mtStatus === "locked" ? { kind: "master", masterId: id } : null);
      }}
      onDelete={(id) => setPendingDelete({ kind: "master", id })}
    />
  );

  const { onStopExecution, onOpenPillarPicker, loadScriptConfirm, askScriptDiscovery, withPillarRecommendation, pillarHopStopped, onGenerateExecutions, onReviewCreativePillars, onReviewLeadMagnetPillars, rememberedDevelopment, onLockCreativePillar, onOpenExecutionSettings, onToggleExecutionPass, onAcceptPassProposal, onDeclinePassProposal, onRegenerateExecution, onRewriteExecution, onUseRecommendation, onRegenerateLine, onFixLine, onUseExecutionOffer, onRetrySelling, onRepairExecution } = createExecutionActions({ ...executionState, focus, focusedIdea, masterSubject, labExecutions, run, ideaParentFor, selected, contentPillars, masterStatement, masters, t, setFocus, pillarCardsFor, labRunRef, reportStepError, queryClient });

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
                            savedMasterList
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
                              const territoryCountFor = (thoughtId: string) =>
                                (labTerritories.data ?? []).filter(
                                  (row) =>
                                    row.bigThoughtId === thoughtId &&
                                    row.admission === "GENERATE_VALID" &&
                                    row.status === "locked",
                                ).length;
                              const angleCountFor = (territoryId: string) =>
                                (labAngles.data ?? []).filter(
                                  (angle) => angle.territoryId === territoryId && angle.admission === "GENERATE_VALID",
                                ).length;
                              const withWorkingSet = () => {
                                if (!selected) return lockedChildren;
                                const next = new Map(lockedChildren);
                                if (selected.mtStatus === "locked") {
                                  next.set(
                                    selected.id,
                                    (next.get(selected.id) ?? []).map((row) => ({
                                      ...row,
                                      childCount: territoryCountFor(row.id),
                                    })),
                                  );
                                  return next;
                                }
                                next.set(
                                  selected.id,
                                  shownRowViews.map((row) => ({
                                    id: row.id,
                                    code: row.code,
                                    label: row.label,
                                    statement: row.statement,
                                    childCount: territoryCountFor(row.id),
                                  })),
                                );
                                return next;
                              };
                              if (!selected || !focusedThought || !focus) return withWorkingSet();
                              const anglesOpen =
                                focus.kind === "territory" ||
                                focus.kind === "angle" ||
                                focus.kind === "idea" ||
                                focus.kind === "pillar" ||
                                focus.kind === "execution"
                                  ? focus.territoryId
                                  : null;
                              const ideasOpen =
                                focus.kind === "angle" || focus.kind === "idea" || focus.kind === "pillar" || focus.kind === "execution"
                                  ? focus.angleId
                                  : null;
                              const lockedAnglesFor = (territoryId: string) => {
                                if (anglesOpen !== territoryId) return [];
                                return (labAngles.data ?? [])
                                  .filter(
                                    (angle) => angle.territoryId === territoryId && angle.admission === "GENERATE_VALID",
                                  )
                                  .map((angle) => {
                                    const ideas = (labIdeas.data ?? []).filter(
                                      (idea) =>
                                        idea.angleId === angle.id &&
                                        (idea.validation ?? uncheckedIdeaValidation(idea.statement, angle.statement)).decision ===
                                          "LOLOS",
                                    );
                                    const territoryName =
                                      (labTerritories.data ?? []).find((item) => item.id === territoryId)?.statement ?? "";
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
                                      ideas:
                                        ideasOpen === angle.id
                                          ? ideas.map((idea) => {
                                              const open =
                                                focus?.kind === "idea" || focus?.kind === "pillar" || focus?.kind === "execution"
                                                  ? focus.ideaId === idea.id
                                                  : false;
                                              const cards = pillarCardsFor(idea);
                                              const rows = open ? (labExecutions.data ?? []) : [];
                                              const lockedIds = new Set(cards.map((card) => card.contentPillarId));
                                              const executionNode = (row: (typeof rows)[number], leadMagnet = false) => ({
                                                id: row.id,
                                                label: row.script?.title.trim() ?? "",
                                                passed: executionChecklistPassed(
                                                  row.canonicalSemantic,
                                                  row.admission,
                                                  row.script?.lineIssues.length ?? 0,
                                                ),
                                                ...(leadMagnet ? { leadMagnet: true } : {}),
                                              });
                                              return {
                                                id: idea.id,
                                                code: idea.code,
                                                statement: idea.statement,
                                                subject: idea.canonicalSemantic.subject,
                                                recommended: idea.validation?.criteria.some((row) => row.id === "causeLock" && row.status === "PASS") ?? false,
                                                childCount: cards.length > 0 ? cards.length : (executionCounts[idea.id] ?? 0),
                                                pillars: open
                                                  ? cards.map((card) => ({
                                                      id: card.contentPillarId,
                                                      label: card.pillarName,
                                                      leadMagnet: card.leadMagnet,
                                                      executions: rows
                                                        .filter((row) => row.contentPillarId === card.contentPillarId)
                                                        .map((row) => executionNode(row, Boolean(card.leadMagnet))),
                                                    }))
                                                  : [],
                                                executions: open
                                                  ? rows
                                                      .filter((row) => !row.contentPillarId || !lockedIds.has(row.contentPillarId))
                                                      .map((row) => executionNode(row))
                                                  : [],
                                              };
                                            })
                                          : [],
                                    };
                                  });
                              };
                              const passing = admittedTerritories
                                .map((row) => ({
                                  id: row.id,
                                  code: row.code,
                                  statement: row.statement,
                                  childCount: angleCountFor(row.id),
                                  angles: lockedAnglesFor(row.id),
                                }));
                              const next = new Map(withWorkingSet());
                              const children = next.get(selected.id) ?? [];
                              next.set(
                                selected.id,
                                children.map((child) =>
                                  child.id === focusedThought.id
                                    ? { ...child, territories: passing, childCount: passing.length }
                                    : child,
                                ),
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
                            composerForm
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
                          ) : selected ? (
                            <>
                              {(ready || locked) && !showBeliefField ? (
                                <header className="space-y-2 border-b border-border pb-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                      <span>{t("thinkingLab.tree.masterThought", "Master Thought")}</span>
                                      <NodeDefinitionInfo kind="master" />
                                    </p>
                                    {!editingBelief && (masterMenuStage || showGenerateBigThought) && busyAction !== "manual-big-thought" ? (
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
                                          {showGenerateBigThought ? (
                                            <DropdownMenuItem
                                              className="cursor-pointer gap-2"
                                              disabled={busy}
                                              onSelect={() => {
                                                window.setTimeout(() => void onGenerate(), 0);
                                              }}
                                            >
                                              <Sparkles className="h-3.5 w-3.5" />
                                              {t("thinkingLab.bt.generate", "Generate Big Thought")}
                                            </DropdownMenuItem>
                                          ) : null}
                                          {masterMenuStage ? (
                                            <DropdownMenuItem
                                              className="cursor-pointer gap-2"
                                              disabled={busy}
                                              onSelect={() => {
                                                window.setTimeout(() => {
                                                  if (masterMenuStage === "generate") void onGenerate();
                                                  else if (masterMenuStage === "audit") void onAudit();
                                                  else void onLock();
                                                }, 0);
                                              }}
                                            >
                                              {masterMenuStage === "generate" ? <Sparkles className="h-3.5 w-3.5" /> : null}
                                              {masterMenuStage === "audit" ? <ClipboardCheck className="h-3.5 w-3.5" /> : null}
                                              {masterMenuStage === "generate"
                                                ? t("thinkingLab.bt.generate", "Generate Big Thought")
                                                : masterMenuStage === "audit"
                                                  ? t("thinkingLab.action.audit", "Audit")
                                                  : t("thinkingLab.action.lock", "Lock")}
                                            </DropdownMenuItem>
                                          ) : null}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    ) : null}
                                  </div>
                                  <h2 className="max-w-[46rem] whitespace-normal break-words text-base font-semibold leading-snug text-foreground">
                                    {masterSubject || selected.statement || selected.originalInput}
                                  </h2>
                                  {masterSubject && masterDescription.trim() !== masterSubject ? (
                                    <p className="text-sm text-foreground">{masterDescription}</p>
                                  ) : null}
                                  {selected.audience.trim() && masterDescription === (selected.statement || selected.originalInput).trim() ? (
                                    <p className="text-sm text-muted-foreground">
                                      {t("thinkingLab.master.audience", "Target audience (optional)")}: {selected.audience}
                                    </p>
                                  ) : null}
                                  <MasterCatalogField
                                    value={selected.catalog}
                                    catalogs={catalogs.data ?? []}
                                    pending={masters.saveCatalog.isPending}
                                    onSave={(catalog) => {
                                      void masters.saveCatalog.mutateAsync({ id: selected.id, catalog });
                                    }}
                                  />
                                  {selected.productReasonPool ? (
                                    <p className="text-sm text-muted-foreground">
                                      {selected.productReasonPool.items.length > 0
                                        ? t(
                                            "thinkingLab.product.attached",
                                            "{{name}}: {{count}} alasan tersimpan untuk Big Thought.",
                                            {
                                              name: selected.productReasonPool.serviceName,
                                              count: selected.productReasonPool.items.length,
                                            },
                                          )
                                        : t(
                                            "thinkingLab.product.poolEmpty",
                                            "{{name}} belum punya alasan tersimpan. Generate Big Thought akan berhenti.",
                                            { name: selected.productReasonPool.serviceName },
                                          )}
                                    </p>
                                  ) : null}
                                </header>
                              ) : null}
                              {showBeliefField ? (
                                <MasterThoughtSection
                                  locked={locked}
                                  busy={busy}
                                  suggesting={busyAction === "suggest-belief"}
                                  saving={busyAction === "save-master"}
                                  priorDraft={priorDraft}
                                  originalDraft={originalDraft}
                                  audienceDraft={audienceDraft}
                                  options={selected.canonicalSemantic?.beliefOptions ?? []}
                                  confirmedStatement={ready ? selected.statement : null}
                                  onPriorChange={setPriorDraft}
                                  onOriginalChange={setOriginalDraft}
                                  onAudienceChange={setAudienceDraft}
                                  onSuggest={() => void onSuggestBeliefs()}
                                  onSave={() => void onSaveMaster()}
                                />
                              ) : null}
                              {showManualBigThought && (ready || locked) && !editingBelief && selected.statement && busyAction !== "generate" ? (
                                <ManualStatementForm
                                  label={t("thinkingLab.manual.bigThought", "Big Thought label")}
                                  hint={t(
                                    "thinkingLab.manual.bigThoughtHint",
                                    "Type 1–3 words, for example Dish Quality. The AI writes the Key Belief for that label.",
                                  )}
                                  placeholder={t("thinkingLab.manual.bigThoughtPlaceholder", "Dish Quality")}
                                  rows={2}
                                  submitLabel={t("thinkingLab.manual.save", "Save")}
                                  pending={busyAction === "manual-big-thought"}
                                  onSubmit={async (value) => {
                                    const reason = await onManualBigThought(value);
                                    if (!reason) setShowManualBigThought(false);
                                    return reason;
                                  }}
                                />
                              ) : null}
                                  {(ready || locked || shownRowViews.length > 0) && !editingBelief ? (
                                    <BigThoughtSection
                                  parentStatement={becauseParent}
                                      rows={shownRowViews}
                                      notice={notice}
                                      auditProgress={auditProgress}
                                      generateBusy={busy}
                                      generating={busyAction === "generate"}
                                      generateChecklist={generateChecklist}
                                      onGenerateTerritory={(bigThoughtId) => void onGenerateTerritory(bigThoughtId)}
                                  onEditBigThought={onEditBigThought}
                                      onDeleteBigThought={(bigThoughtId) =>
                                    setPendingDelete({ kind: "bigThought", id: bigThoughtId })
                                  }
                                      onFixBigThought={(code) => onFixBigThought(code)}
                                      checklists={bigThoughtChecklists}
                                      fixingCodes={fixingBigThoughtCodes}
                                    />
                                  ) : null}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {(masters.data ?? []).length === 0
                                ? t("thinkingLab.list.empty", "Create a Master Thought to begin.")
                                : t("thinkingLab.list.select", "Select a Master Thought from the list.")}
                            </p>
                          )}
                          {selected && !(showComposer && hasMasters) ? (
                            <Accordion type="single" collapsible className="mt-3">
                              <ContentUsageAudit masterThoughtId={selected.id} />
                            </Accordion>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </ModuleShellContentGate>
          </div>
        </div>
      </div>
      <PillarPickerSheet
        open={pillarPickerOpen}
        pillars={contentPillars.data ?? []}
        masterSells={masterSells}
        pending={busy}
        mediumByPillar={pillarMediums.data ?? {}}
        direct={executionDirect}
        onOpenChange={setPillarPickerOpen}
        onConfirm={(pillars, audio, look, speech, durationSeconds, brandName, cta, image) => {
          const pillar = pillars[0];
          const organizationId = masters.organizationId;
          if (pillar && organizationId) {
            void savePillarMediumDefault(organizationId, pillar.id, image ? "image" : "video").then(() => {
              void queryClient.invalidateQueries({ queryKey: ["thinking-lab-pillar-defaults", organizationId] });
            });
          }
          loadScriptConfirm({
            pillars,
            audio,
            look,
            speech,
            durationSeconds,
            brandName,
            cta,
            image,
            pillarDevelopment: pillar ? rememberedDevelopment(pillar.id) : null,
          });
        }}
      />
      <ExecutionConfirmDialog
        open={scriptConfirm !== null}
        loading={scriptConfirm?.loading ?? false}
        failed={scriptConfirm?.failed ?? false}
        questions={scriptConfirm?.questions ?? null}
        pending={busy}
        choosingMode={scriptConfirm?.phase === "mode"}
        onChooseMode={(mode) => {
          if (!scriptConfirm) return;
          askScriptDiscovery(scriptConfirm, mode);
        }}
        onOpenChange={(open) => {
          if (open) return;
          confirmToken.current += 1;
          setScriptConfirm(null);
        }}
        onRetry={() => {
          if (!scriptConfirm?.discovery) return;
          askScriptDiscovery(scriptConfirm, scriptConfirm.discovery);
        }}
        onConfirm={(answers) => {
          if (!scriptConfirm) return;
          const settings = scriptConfirm;
          confirmToken.current += 1;
          setScriptConfirm(null);
          const questions = settings.questions ?? [];
          const chosenDecisions: ScriptDecision[] = questions.flatMap((question) => {
            const answer = answers.find((item) => item.question === question.prompt)?.answer.trim() ?? "";
            if (!answer) return [];
            return [{ category: question.category, question: question.prompt, answer, binds: question.binds }];
          });
          onGenerateExecutions(
            settings.pillars,
            settings.audio,
            settings.look,
            settings.speech,
            null,
            settings.durationSeconds,
            settings.brandName,
            settings.cta,
            chosenDecisions.find((row) => row.binds === "viewpoint")?.answer ?? null,
            chosenDecisions,
            false,
            null,
            settings.image,
            false,
            null,
            null,
            settings.pillarDevelopment,
          );
        }}
      />
      <ExecutionConfirmDialog
        open={ideaDiscover !== null}
        loading={ideaDiscover?.loading ?? false}
        failed={ideaDiscover?.failed ?? false}
        questions={ideaDiscover?.questions ?? null}
        pending={busy}
        title={t("thinkingLab.idea.discoverTitle", "Confirm the situation")}
        hint={t(
          "thinkingLab.idea.discoverHint",
          "The chain is read first. Choose the situation these Ideas live in, then the sentences are written.",
        )}
        loadingText={t("thinkingLab.idea.discoverLoading", "Reading the chain from the Master Thought through the Angle...")}
        failedText={t("thinkingLab.idea.discoverFailed", "The situation questions could not be read. Try again.")}
        confirmText={t("thinkingLab.idea.discoverWrite", "Write the Ideas")}
        onOpenChange={(open) => {
          if (open) return;
          ideaDiscoverToken.current += 1;
          setIdeaDiscover(null);
        }}
        onRetry={() => {
          if (!ideaDiscover) return;
          onGenerateIdea(ideaDiscover.angleId);
        }}
        onConfirm={(answers) => {
          if (!ideaDiscover) return;
          const pending = ideaDiscover;
          ideaDiscoverToken.current += 1;
          setIdeaDiscover(null);
          const questions = pending.questions ?? [];
          const decisions = questions.flatMap((question) => {
            const answer = answers.find((item) => item.question === question.prompt)?.answer.trim() ?? "";
            if (!answer) return [];
            return [{ category: question.category, question: question.prompt, answer }];
          });
          writeGeneratedIdeas(pending.angleId, { angleFingerprint: pending.angleFingerprint, decisions });
        }}
      />
      <SaveToPlanModal
        isOpen={planSaveOpen && Boolean(focusedExecution?.script)}
        onClose={() => setPlanSaveOpen(false)}
        script={focusedExecution?.script ? buildPlanScript(focusedExecution.script) : ""}
        formDataForPlan={
          focusedExecution?.contentPillarId ? { content_pillar_id: focusedExecution.contentPillarId } : null
        }
        lockedTitle={focusedExecution?.script?.title ?? ""}
        lockedPillarId={focusedExecution?.contentPillarId}
        leadMagnet={
          focusedIdea &&
          focusedExecution?.contentPillarId &&
          pillarCardsFor(focusedIdea).some(
            (card) => card.contentPillarId === focusedExecution.contentPillarId && card.leadMagnet,
          )
            ? leadMagnetBriefForPillar(
                focusedIdea.developmentPaths,
                focusedExecution.contentPillarId,
                creativeReviews,
              )
            : null
        }
        lockedContentTypeName={
          focusedExecution?.script?.medium === "image"
            ? imageContentTypeName(focusedExecution.script.image?.format ?? "single")
            : null
        }
        preserveTableColumns
        syncPlanIdentity
        onSuccess={() => {
          void invalidateContentPillarQueries(queryClient, masters.organizationId);
        }}
      />
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.kind === "territory"
                ? t("thinkingLab.confirm.deleteTerritoryTitle", "Delete this Territory?")
                : pendingDelete?.kind === "angle"
                  ? t("thinkingLab.confirm.deleteAngleTitle", "Delete this Angle?")
                  : pendingDelete?.kind === "bigThought"
                  ? t("thinkingLab.confirm.deleteBigThoughtTitle", "Delete this Big Thought?")
                  : pendingDelete?.kind === "idea"
                    ? t("thinkingLab.confirm.deleteIdeaTitle", "Delete this Idea?")
                  : pendingDelete?.kind === "execution"
                    ? t("thinkingLab.confirm.deleteExecutionTitle", "Delete this Execution?")
                    : t("thinkingLab.confirm.deleteTitle", "Delete this Master Thought?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === "territory"
                ? t(
                    "thinkingLab.confirm.deleteTerritoryBody",
                    "This deletes the Territory and the Angles under it. This cannot be undone.",
                  )
                : pendingDelete?.kind === "angle"
                  ? t(
                      "thinkingLab.confirm.deleteAngleBody",
                      "This deletes the Angle and the Ideas under it. This cannot be undone.",
                    )
                  : pendingDelete?.kind === "bigThought"
                  ? t(
                      "thinkingLab.confirm.deleteBigThoughtBody",
                      "This deletes the Big Thought and the Territories and Angles under it. This cannot be undone.",
                    )
                  : pendingDelete?.kind === "idea"
                    ? t(
                        "thinkingLab.confirm.deleteIdeaBody",
                        "This deletes the Idea and the Executions under it. This cannot be undone.",
                      )
                  : pendingDelete?.kind === "execution"
                    ? t(
                        "thinkingLab.confirm.deleteExecutionBody",
                        "This deletes the Script VO for this pillar. This cannot be undone.",
                      )
                    : t(
                "thinkingLab.confirm.deleteBody",
                "This deletes the Master Thought and everything under it: Big Thoughts, plus any Territories, Angles, and Ideas. This cannot be undone.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              {t("thinkingLab.confirm.deleteAction", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!showContent ? (
        <div className="absolute inset-0 z-20 overflow-hidden" aria-busy>
          <ThinkingLabPageSkeleton />
        </div>
      ) : null}
    </div>
  );
}
