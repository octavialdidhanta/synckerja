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
import {
  ACTIVE_SET_CAP,
  BT_FIX_MAX_ATTEMPTS,
  BT_FIX_REPLACE_AFTER,
  BT_FIX_SAME_GATE_STOP,
  BT_FIX_STUCK_LESSONS,
  THINKING_PARALLEL_CHECKS,
} from "@/thinking-lab/shared/limits";
import { startLimited } from "@/thinking-lab/shared/pool";
import type { AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import {
  bigThoughtFingerprint,
  fingerprintsMatch,
  incumbentSetFingerprint,
  angleFingerprint,
  angleSetFingerprint,
  ideaFingerprint,
  ideaSetFingerprint,
  territoryFingerprint,
  territorySetFingerprint,
} from "@/thinking-lab/shared/fingerprint";
import {
  fixAttemptCap,
  fixScopeFromChecks,
  scopeFromHistory,
  type FixScope,
} from "@/thinking-lab/shared/fixScope";
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
  beginSiblingCheck,
  finishSiblingCheck,
  fixPriorForNextTerritoryName,
  readTerritoryGeneratePasses,
  runTerritoryAdmissionChecks,
  runTerritoryIndividualChecks,
  runTerritoryOpenChecks,
  territoryAdmissionChecks,
  territoryChecksFromStored,
  type TerritoryPassCheck,
  type TerritoryPassCheckId,
} from "@/thinking-lab/territory/passChecklist";
import { ANSWERED_QUESTION_VERSION, resolveAnsweredQuestion } from "@/thinking-lab/big-thought/answeredQuestion";
import type { BeliefOption, LabMasterThought, MasterCatalogContext } from "@/thinking-lab/master-thought/types";
import { useMasterThought } from "@/thinking-lab/master-thought/useMasterThought";
import {
  clearSetConclusions,
  displayedAuditVerdict,
  keptPassingAuditItems,
  emptySetRecord,
  nextAuthoritativeSetRecord,
  parseLabSetRecord,
  mergeFixLessons,
  mergeGenerateLessons,
  dropFixLessons,
  stuckBigThoughtFixes,
  auditSiblingGate,
  siblingSetIsCurrent,
} from "@/thinking-lab/big-thought/audit";
import {
  buildChallengerPrompt,
  challengerCanRun,
  currentMissingWhy,
  parseChallenger,
} from "@/thinking-lab/big-thought/challenger";
import {
  buildGeneratePrompt,
  countGenerateValid,
  keepGroundedBigThoughts,
  nextBigThoughtCode,
  parseGeneratedBigThoughts,
  runGenerateRounds,
  shownBigThoughtFacts,
} from "@/thinking-lab/big-thought/generate";
import {
  checkingSiblingFrame,
  checklistFrame,
  attachLesson,
  checklistFromFailure,
  completeChecklist,
  bigThoughtListed,
  readGateFailure,
  readGeneratePasses,
  waitForChecklistReport,
  type GateLesson,
  type PassChecklist,
} from "@/thinking-lab/big-thought/checklist";
import {
  buildBigThoughtFixPrompt,
  factsForGenerateAdmission,
  fixPriorForNextSentence,
  generateDuplicateFailure,
  parseBigThoughtFixStatement,
  runBigThoughtIndividualChecks,
  runBigThoughtOpenChecks,
  runGenerateAdmissionChecks,
  bigThoughtFixMode,
  type BigThoughtFixMode,
} from "@/thinking-lab/big-thought/passChecks";
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
import { manualRejection, ManualStatementForm } from "@/thinking-lab/section/ManualStatementForm";
import { activeBigThoughts } from "@/thinking-lab/big-thought/repository";
import { judgeSiblingSet } from "@/thinking-lab/big-thought/semantic";
import type { BigThoughtFacts, LabSetRecord } from "@/thinking-lab/big-thought/types";
import { useBigThoughts, useLockedLabTree } from "@/thinking-lab/big-thought/useBigThoughts";
import { canShowGenerateAngle } from "@/thinking-lab/angle/eligibility";
import {
  angleReplacementPasses,
  buildAngleExamplePrompt,
  buildAngleFixOptionsPrompt,
  buildAngleSubjectPrompt,
  parseAngleExampleScript,
  parseAngleFixOptionsScript,
  parseAngleSubjectScript,
} from "@/thinking-lab/angle/fix";
import {
  angleAdmissionChecks,
  angleChecksFromStored,
  beginAngleSiblingCheck,
  finishAngleSiblingCheck,
  fixPriorForNextAngleStatement,
  readAngleGeneratePasses,
  runAngleAdmissionChecks,
  runAngleIndividualChecks,
  runAngleOpenChecks,
  type AnglePassCheck,
} from "@/thinking-lab/angle/passChecklist";
import {
  nextAngleCode,
  proposeAngleStatements,
  runAngleGenerate,
  shownAngleFacts,
} from "@/thinking-lab/angle/generate";
import { evaluateAngleLock, selectAngleStage } from "@/thinking-lab/angle/lock";
import { admitAngle, visibleAngles } from "@/thinking-lab/angle/policy";
import { angleExampleProblem, normalizeAngleExample } from "@/thinking-lab/angle/example";
import { angleListSubject, angleSubjectProblem } from "@/thinking-lab/angle/subject";
import { loadAngleParentGate, loadAngleSet, saveAngleSet } from "@/thinking-lab/angle/repository";
import {
  angleFailureLessons,
  angleSetIsCurrent,
  angleCodesHeldPass,
  buildAngleSiblingPrompt,
  emptyAngleSetRecord,
  mergeAngleAuditLessons,
  parseAngleSet,
  scoreAngleAudit,
  usableAngleFixLessons,
} from "@/thinking-lab/angle/setAudit";
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
import { developmentForPillar, latestPathReviews, leadMagnetBriefForPillar, lockedPillarCards, mergeLockedPillar } from "@/thinking-lab/creative-idea/paths";
import { leadMagnetPassChecklist, reviewContentPillars, reviewsToStore, type LeadMagnetReviewStep } from "@/thinking-lab/creative-idea/recommend";
import { saveDevelopmentPath } from "@/thinking-lab/creative-idea/repository";
import type { CreativeExecutionLink, CreativeFormat, DevelopmentPath, StoredPillarReview } from "@/thinking-lab/creative-idea/types";
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
import { buildExecutionGeneratePrompt, judgeAndSealExecution } from "@/thinking-lab/execution/generate";
import { buildImageGeneratePrompt } from "@/thinking-lab/execution/imageGenerate";
import {
  buildImageSlideRepairPrompt,
  buildImageSpeechRepairPrompt,
  imageChecksAfterSlideRewrite,
  imageChecksFromAudit,
  imageFailureMoved,
  imageLessons,
  imageRecheckClaim,
  imageRewriteFromFailure,
  imageSlideRepairLine,
  imageSlideRepairReady,
  imageSpeechRepairLines,
  ensureImageLegacySwitches,
  mergeImageSlideRepair,
  parseImageSlideRepair,
  parseImageSpeechRepairs,
  runImageMeaningChecks,
  runImageOpenChecks,
} from "@/thinking-lab/execution/imageChecklist";
import { savePillarMediumDefault, usePillarMediumDefaults } from "@/thinking-lab/execution/pillarDefaults";
import {
  applyPassSwitchScript,
  buildExecutionMeaningRepairPrompt,
  buildNarrationLineRegeneratePrompt,
  buildPassSwitchRewritePrompt,
  checksImplementedBySwitch,
  emptyExecutionPassChecklist,
  ensureVideoPassChecks,
  executionChecklistPassed,
  executionChecksFromAudit,
  executionFactsFromChecks,
  executionFailureMoved,
  factsForPassChecks,
  openPassResume,
  regeneratePassPrior,
  togglePassCheck,
  lessonFromMeaningAudit,
  meaningLineRepairReady,
  mergeExecutionAuditLessons,
  narrationChangeRows,
  parseExecutionNarrationReplacements,
  passSwitchOutcome,
  switchRewriteLines,
  runExecutionMeaningChecks,
  runExecutionOpenChecks,
  EXECUTION_LINE_REPAIR_IDS,
  type ExecutionPassCheck,
  type NarrationChange,
} from "@/thinking-lab/execution/passChecklist";
import {
  buildExecutionConfirmPrompt,
  parseDiscoveredQuestions,
  type DiscoveryMode,
  type ExecutionConfirmQuestion,
  type ScriptDecision,
} from "@/thinking-lab/execution/confirm";
import { useOrgContentPillars, type LabContentPillar } from "@/thinking-lab/execution/pillars";
import { buildPillarFitChoicePrompt, limitPillarChoices, parsePillarFitChoice, PILLAR_CHOICE_LIMIT, pillarNeedsRecommendation, pillarWasRecommended } from "@/thinking-lab/execution/recommend";
import { isFailedMeaningAudit, type ExecutionAuditLesson, type ExecutionSemanticFacts } from "@/thinking-lab/execution/types";
import {
  buildContinuityAuditPrompt,
  buildLineAuditPrompt,
  buildViewpointAuditPrompt,
  buildLineRepairPrompt,
  buildMasterSellsPrompt,
  buildProductionRepairPrompt,
  mergeNarrationRepairs,
  buildPlanScript,
  buildSpeechRepairPrompt,
  flattenVoiceOver,
  imageContentTypeName,
  keepCharacterVisuals,
  mergeRepairedLines,
  mergeSpeechRepairs,
  parseLineIssues,
  parseLineReplacements,
  parseMasterSells,
  parseSpeechRepairs,
  ensureBrandMention,
  chainNarrationLines,
  linesForProductionRecheck,
  storyVoiceOver,
  detachCallToAction,
  callToActionSceneReady,
  attachCtaScene,
  parseCtaScene,
  buildCtaScenePrompt,
  parseVoiceOverScript,
  scriptLineRepairReady,
  scriptMentionsBrand,
  speechNeedsRepair,
  stampImageScript,
  withCharacterVisuals,
  withSpeech,
  withoutCharacterVisual,
  type CharacterVisualKind,
  type ScriptAudio,
  type ScriptLook,
  type ImageSettings,
  type ScriptSpeech,
  type VoiceOverScript,
} from "@/thinking-lab/execution/script";
import { useLabExecutionCounts, useLabExecutions } from "@/thinking-lab/execution/useExecutions";
import { canGenerateTerritory } from "@/thinking-lab/territory/eligibility";
import {
  buildTerritoryFixOptionsPrompt,
  parseTerritoryFixOptionsScript,
  territoryReplacementPasses,
} from "@/thinking-lab/territory/fix";
import {
  admittedTerritorySetChanged,
  nextTerritoryCode,
  proposeTerritoryStatements,
  runTerritoryGenerate,
  shownTerritoryFacts,
  TERRITORY_ACTIVITY_REASON,
  TERRITORY_NAME_LENGTH_REASON,
  territoryNameIsActivity,
  territoryNameTooLong,
  territoryRejectionReason,
} from "@/thinking-lab/territory/generate";
import { loadTerritoryParentGate, loadTerritorySet, saveTerritorySet } from "@/thinking-lab/territory/repository";
import { evaluateTerritoryLock, selectTerritoryStage } from "@/thinking-lab/territory/lock";
import {
  buildTerritorySiblingPrompt,
  emptyTerritorySetRecord,
  parseTerritorySet,
  territoryCodesHeldPass,
  mergeTerritoryAuditLessons,
  scoreTerritoryAudit,
  territoryFailureLessons,
  territorySetIsCurrent,
  usableTerritoryFixLessons,
} from "@/thinking-lab/territory/setAudit";
import type { AngleSemanticFacts } from "@/thinking-lab/angle/types";
import type { TerritorySemanticFacts } from "@/thinking-lab/territory/types";
import { useLabTerritories, useTerritorySet } from "@/thinking-lab/territory/useTerritories";
import { ThinkingLabPageSkeleton } from "@/thinking-lab/page/ThinkingLabPageSkeleton";
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
import { ExecutionScriptPanel, ExecutionScriptTable, type CharacterGenerateState } from "@/thinking-lab/section/ExecutionScriptPanel";
import type { CharacterStudioTab } from "@/thinking-lab/section/CharacterVisualStudio";
import { CharacterSheetError, copyStoredCharacterVisual, generateCharacterVisuals, removeCharacterVisual, storeCharacterVisual } from "@/thinking-lab/execution/generateCharacterVisual";
import { invalidateContentPillarQueries } from "@/6-1-dashboard/lib/contentPillarTracker";
import { HeaderAndTab } from "@/6-1-content-calendar/container/HeaderAndTab";
import { SaveToPlanModal } from "@/6-1-script-generator/components/SaveToPlanModal";
import { PillarPickerSheet, type ExecutionSettingsDirect } from "@/thinking-lab/section/PillarPickerSheet";
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

type LabFocus =
  | { kind: "master"; masterId: string }
  | { kind: "bigThought"; masterId: string; thoughtId: string }
  | { kind: "territory"; masterId: string; thoughtId: string; territoryId: string }
  | { kind: "angle"; masterId: string; thoughtId: string; territoryId: string; angleId: string }
  | { kind: "idea"; masterId: string; thoughtId: string; territoryId: string; angleId: string; ideaId: string }
  | { kind: "pillar"; masterId: string; thoughtId: string; territoryId: string; angleId: string; ideaId: string; contentPillarId: string }
  | { kind: "execution"; masterId: string; thoughtId: string; territoryId: string; angleId: string; ideaId: string; executionId: string };

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
  const [territoryFixOffers, setTerritoryFixOffers] = useState<
    Array<{ thoughtId: string; failedCode: string; statement: string; facts: TerritorySemanticFacts }>
  >([]);
  const [angleFixOffers, setAngleFixOffers] = useState<
    Array<{ territoryId: string; failedCode: string; statement: string; facts: AngleSemanticFacts }>
  >([]);
  const [auditProgress, setAuditProgress] = useState<AuditProgress | null>(null);
  const [bigThoughtChecklists, setBigThoughtChecklists] = useState<Record<string, PassChecklist>>({});
  const fixingBigThoughtRef = useRef(new Set<string>());
  const bigThoughtFixLessonsRef = useRef(new Map<string, Array<{ statement: string; reason: string }>>());
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
  const setRecord = parseLabSetRecord(selected?.lastAudit);
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
    setTerritoryFixOffers([]);
    setAngleFixOffers([]);
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
      const sibling = setRecord?.siblingSet ?? null;
      const audit = parentFp
        ? displayedAuditVerdict(
            setRecord?.audit?.items,
            setRecord?.audit?.setFingerprint,
            incumbentSetFingerprint({
              masterThoughtFingerprint: parentFp,
              bigThoughtFingerprints: active.map((item) =>
                bigThoughtFingerprint({ statement: item.statement, masterThoughtFingerprint: parentFp }),
              ),
            }),
            row.code,
            { siblingSet: sibling, activeCodes: active.map((item) => item.code) },
            current,
          )
        : null;
      const code = row.code.toUpperCase();
      const reasonContribution =
        sibling?.reasonContributions?.find((item) => item.code.toUpperCase() === code)?.reasonContribution ?? null;
      return {
        id: row.id,
        code: row.code,
        label: row.label,
        statement: row.statement,
        status: row.status,
        admission,
        audit,
        facts: row.canonicalSemantic,
        siblingDistinct: sibling?.distinct ?? null,
        siblingPairs: sibling
          ? sibling.duplicatePairs.filter(
              (pair) => pair.a.toUpperCase() === code || pair.b.toUpperCase() === code,
            )
          : null,
        reasonContribution,
        siblingUnresolvedReasons: sibling?.unresolvedReasons ?? null,
        gateFailure: row.canonicalSemantic?.gateFailure ?? null,
        auditGatesChecked:
          audit === "AUDIT_PASS" &&
          setRecord?.audit?.items?.some(
            (item) => item.code.toUpperCase() === code && item.gatesChecked === true,
          ) === true,
        auditGateFailure:
          audit === "AUDIT_PASS"
            ? null
            : readGateFailure(
                setRecord?.audit?.items?.find((item) => item.code.toUpperCase() === code)?.gateFailure,
              ),
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
  const territoryFingerprintNow = territorySetFingerprint({
    bigThoughtFingerprint: focusedBigThoughtFingerprint,
    territoryFingerprints: admittedTerritories.map((row) =>
      territoryFingerprint({ statement: row.statement, bigThoughtFingerprint: focusedBigThoughtFingerprint }),
    ),
  });
  const storedTerritorySet = territorySet.data?.siblingSet ?? null;
  const territoryAuditCurrent =
    territorySetIsCurrent(storedTerritorySet, territoryFingerprintNow) &&
    fingerprintsMatch(territorySet.data?.audit?.fingerprint, territoryFingerprintNow);
  const rescoredTerritoryAudit =
    territoryAuditCurrent && storedTerritorySet
      ? scoreTerritoryAudit({
          codes: admittedTerritories.map((row) => row.code),
          siblingSet: storedTerritorySet,
          siblingSetCurrent: true,
        })
      : null;
  const territoryVerdicts = admittedTerritories.map((row) => {
    const statementFingerprint = focusedBigThoughtFingerprint
      ? territoryFingerprint({ statement: row.statement, bigThoughtFingerprint: focusedBigThoughtFingerprint })
      : "";
    const stored = territorySet.data?.audit?.items.find((item) => item.code.toUpperCase() === row.code.toUpperCase());
    if (
      stored?.statementFingerprint === statementFingerprint &&
      (stored.verdict === "AUDIT_PASS" || stored.verdict === "AUDIT_FAIL")
    ) {
      return stored.verdict;
    }
    return rescoredTerritoryAudit?.find((item) => item.code.toUpperCase() === row.code.toUpperCase())?.verdict ?? null;
  });
  const territoryLock = evaluateTerritoryLock({ verdicts: territoryVerdicts });
  const territoryStoredCount = admittedTerritories.length;
  const territoryStage = selectTerritoryStage({
    admittedCount: admittedTerritories.length,
    verdicts: territoryVerdicts,
    canAdd: territoryStoredCount < ACTIVE_SET_CAP,
    repairsUsed: (territorySet.data?.repairCount ?? 0) > 0,
    lockOk: territoryLock.ok,
  });
  const territoryNotes = [
    ...(storedTerritorySet && territorySetIsCurrent(storedTerritorySet, territoryFingerprintNow)
      ? [
          ...storedTerritorySet.materialOverlapPairs.map((pair) => ({
            kind: "overlap" as const,
            a: pair.territoryCodeA,
            b: pair.territoryCodeB,
            explanation: pair.explanation,
          })),
          ...storedTerritorySet.containmentPairs.map((pair) => ({
            kind: "containment" as const,
            container: pair.containerCode,
            contained: pair.containedCode,
            explanation: pair.explanation,
          })),
        ]
      : []),
    ...(territoryVerdicts.some((verdict) => verdict === "AUDIT_FAIL") &&
    (territorySet.data?.repairCount ?? 0) > 0 &&
    !(
      storedTerritorySet &&
      territorySetIsCurrent(storedTerritorySet, territoryFingerprintNow) &&
      (storedTerritorySet.containmentPairs.length > 0 || storedTerritorySet.materialOverlapPairs.length > 0)
    )
      ? [
          {
            kind: "notice" as const,
            text: t("thinkingLab.territory.repairStopped", "Fix already ran once. This set stays open until an audit passes."),
          },
        ]
      : []),
  ];
  const admittedSetLocked =
    admittedTerritories.length >= 3 && admittedTerritories.every((row) => row.status === "locked");
  const territoriesPanelClosed =
    admittedTerritories.length > 0 && admittedTerritories.every((row) => row.status === "locked");
  const territoryGenerateThoughtId =
    focus?.kind === "bigThought" &&
    focusedThought?.canGenerateTerritory &&
    admittedTerritories.length === 0 &&
    !admittedSetLocked &&
    territoryStage !== "fix" &&
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
  const angleFingerprintNow = angleSetFingerprint({
    territoryFingerprint: parentTerritoryFingerprint,
    angleFingerprints: admittedAngles.map((row) =>
      angleFingerprint({ statement: row.statement, territoryFingerprint: parentTerritoryFingerprint }),
    ),
  });
  const storedAngleSet = angleSet.data?.siblingSet ?? null;
  const angleAuditCurrent =
    angleSetIsCurrent(storedAngleSet, angleFingerprintNow) &&
    fingerprintsMatch(angleSet.data?.audit?.fingerprint, angleFingerprintNow);
  const rescoredAngleAudit =
    angleAuditCurrent && storedAngleSet
      ? scoreAngleAudit({
          codes: admittedAngles.map((row) => row.code),
          siblingSet: storedAngleSet,
          siblingSetCurrent: true,
        })
      : null;
  const angleVerdicts = admittedAngles.map((row) => {
    if (row.status === "locked") return "AUDIT_PASS" as const;
    const statementFingerprint = parentTerritoryFingerprint
      ? angleFingerprint({ statement: row.statement, territoryFingerprint: parentTerritoryFingerprint })
      : "";
    const stored = angleSet.data?.audit?.items.find((item) => item.code.toUpperCase() === row.code.toUpperCase());
    if (
      stored?.statementFingerprint === statementFingerprint &&
      (stored.verdict === "AUDIT_PASS" || stored.verdict === "AUDIT_FAIL")
    ) {
      return stored.verdict;
    }
    return rescoredAngleAudit?.find((item) => item.code.toUpperCase() === row.code.toUpperCase())?.verdict ?? null;
  });
  const angleLock = evaluateAngleLock({ verdicts: angleVerdicts });
  const angleExampleOpen = admittedAngles.some((row) =>
    Boolean(angleExampleProblem(row.canonicalSemantic.example ?? "", row.statement)),
  );
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
      generatePasses: row.canonicalSemantic.generatePasses,
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
  const angleStage = selectAngleStage({
    admittedCount: admittedAngles.length,
    verdicts: angleVerdicts,
    repairsUsed: (angleSet.data?.repairCount ?? 0) > 0,
    lockOk: angleLock.ok && !angleExampleOpen,
  });
  const angleNotes = [
    ...(storedAngleSet && angleSetIsCurrent(storedAngleSet, angleFingerprintNow)
      ? [
          ...storedAngleSet.materialOverlapPairs.map((pair) => `${pair.angleCodeA} · ${pair.angleCodeB}: ${pair.explanation}`),
          ...storedAngleSet.containmentPairs.map((pair) => `${pair.containerCode} · ${pair.containedCode}: ${pair.explanation}`),
        ]
      : []),
    ...(angleVerdicts.some((verdict) => verdict === "AUDIT_FAIL") && (angleSet.data?.repairCount ?? 0) > 0
      ? [t("thinkingLab.angle.repairStopped", "Fix already ran once. This set stays open until an audit passes.")]
      : []),
  ];
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
  const [pillarPickerOpen, setPillarPickerOpen] = useState(false);
  const [executionDirect, setExecutionDirect] = useState<ExecutionSettingsDirect | null>(null);
  const [creativeReviews, setCreativeReviews] = useState<StoredPillarReview[] | null>(null);
  const [creativeReviewReady, setCreativeReviewReady] = useState(false);
  const [leadMagnetStep, setLeadMagnetStep] = useState<LeadMagnetReviewStep | null>(null);
  const [creativePillarId, setCreativePillarId] = useState<string | null>(null);
  const [creativeFormat, setCreativeFormat] = useState<CreativeFormat | null>(null);
  const creativePathSave = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    const latest = [...(focusedIdea?.developmentPaths ?? [])].sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0];
    setCreativePillarId(latest?.contentPillarId ?? null);
    setCreativeFormat(latest?.format ?? null);
    setCreativeReviews(latest && latest.reviews.length > 0 ? latest.reviews : null);
    setCreativeReviewReady(Boolean(latest && latest.reviews.length > 0));
  }, [focusedIdea?.id]);
  const [scriptConfirm, setScriptConfirm] = useState<{
    pillars: LabContentPillar[];
    audio: ScriptAudio;
    look?: ScriptLook;
    speech?: ScriptSpeech;
    durationSeconds: number | null;
    brandName: string | null;
    cta: string | null;
    image: ImageSettings | null;
    pillarDevelopment: string | null;
    phase: "mode" | "questions";
    discovery: DiscoveryMode | null;
    questions: ExecutionConfirmQuestion[] | null;
    loading: boolean;
    failed: boolean;
  } | null>(null);
  const [masterSells, setMasterSells] = useState<true | false | "unresolved" | "unknown">("unknown");
  const [executionChecklists, setExecutionChecklists] = useState<Record<string, ExecutionPassCheck[]>>({});
  const [executionRunChecks, setExecutionRunChecks] = useState<ExecutionPassCheck[] | null>(null);
  const [executionLineOffer, setExecutionLineOffer] = useState<{
    executionId: string;
    script: VoiceOverScript;
    facts: ExecutionSemanticFacts;
  } | null>(null);
  const [executionPassProposal, setExecutionPassProposal] = useState<{
    executionId: string;
    checks: ExecutionPassCheck[];
    script: VoiceOverScript;
    changes: NarrationChange[];
    previousChecks: ExecutionPassCheck[] | null;
    implemented: boolean;
  } | null>(null);
  const [executionRepairNote, setExecutionRepairNote] = useState<string | null>(null);
  const [executionDraft, setExecutionDraft] = useState<VoiceOverScript | null>(null);
  const [executionProgress, setExecutionProgress] = useState<{
    phase: "write" | "audit" | "repair" | "line" | "recommend" | "switch";
    pillarName: string;
    medium?: "image";
  } | null>(null);
  const [pillarChoices, setPillarChoices] = useState<Array<{ pillarName: string; reason: string }>>([]);
  const [fixingLineId, setFixingLineId] = useState<string | null>(null);
  const [scriptTableOpen, setScriptTableOpen] = useState(false);
  const [planSaveOpen, setPlanSaveOpen] = useState(false);
  const [characterGenerate, setCharacterGenerate] = useState<CharacterGenerateState>(null);
  const [characterVisualDelete, setCharacterVisualDelete] = useState<{ handle: string; kind: CharacterVisualKind } | null>(null);
  const [characterVisualSave, setCharacterVisualSave] = useState<{ handle: string; kind: CharacterStudioTab } | null>(null);
  const executionCancel = useRef(0);
  const pillarUseWait = useRef<number | null>(null);
  const confirmToken = useRef(0);
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
  }, [selected?.id]);
  useEffect(() => {
    setScriptTableOpen(false);
    setPlanSaveOpen(false);
    setCharacterGenerate(null);
    setCharacterVisualDelete(null);
    setCharacterVisualSave(null);
    setFixingLineId(null);
  }, [focus?.kind === "execution" ? focus.executionId : null]);

  const generateValidCount = countGenerateValid(shownRowViews);
  const auditPassCount = shownRowViews.filter((row) => row.audit === "AUDIT_PASS").length;
  const anyFail = shownRowViews.some((row) => row.audit === "AUDIT_FAIL");
  const anyStale = shownRowViews.some((row) => row.admission === "STALE" || row.audit === "STALE");
  const anyUnresolved = shownRowViews.some((row) => row.admission === "UNRESOLVED" || row.audit === "UNRESOLVED");
  const setFingerprint = parentFp
    ? incumbentSetFingerprint({
        masterThoughtFingerprint: parentFp,
        bigThoughtFingerprints: shownRowViews.map((row) =>
          bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp }),
        ),
      })
    : "";
  const siblingFingerprint = parentFp
    ? incumbentSetFingerprint({
        masterThoughtFingerprint: parentFp,
        bigThoughtFingerprints: active.map((row) =>
          bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp }),
        ),
      })
    : "";
  const listedAllPass =
    shownRowViews.length > 0 && shownRowViews.every((row) => row.audit === "AUDIT_PASS");
  const siblingCurrent =
    listedAllPass ||
    siblingSetIsCurrent(setRecord?.siblingSet ?? null, siblingFingerprint) ||
    siblingSetIsCurrent(setRecord?.siblingSet ?? null, setFingerprint);
  const missingWhy = currentMissingWhy(setRecord?.challenger ?? null, setFingerprint);
  const challengerReady = challengerCanRun({
    auditPassCount,
    activeCount: shownRowViews.length,
    anyFail,
    anyStale,
    anyUnresolved,
  });
  const lockDecision = evaluateLock({
    auditPassCount,
    activeCount: shownRowViews.length,
    anyFail,
    anyStale,
    anyUnresolved,
    siblingCurrent,
    challenger: setRecord?.challenger ?? null,
    challengerCurrent: Boolean(setRecord?.challenger && setRecord.challenger.setFingerprint === setFingerprint),
  });
  const challenger = setRecord?.challenger ?? null;
  const challengerComplete = Boolean(
    challenger &&
      challenger.setFingerprint === setFingerprint &&
      challenger.status === "COMPLETE" &&
      challenger.resolution === "RESOLVED" &&
      challenger.unresolvedReasons.length === 0,
  );
  const awaitingVerdict = shownRowViews.some(
    (row) => row.audit == null || row.audit === "STALE" || row.audit === "UNRESOLVED",
  );
  const stageAction = selectStageAction({
    anyFail,
    awaitingVerdict,
    generateValidCount,
    activeCount: shownRowViews.length,
    missingWhy: Boolean(missingWhy),
    auditPassCount,
    anyStale,
    anyUnresolved,
    siblingCurrent,
    challengerComplete,
    lockOk: lockDecision.ok,
  });
  const showGenerateBigThought = Boolean(
    ready && masterSubject && !locked && stageAction !== "generate",
  );
  const masterMenuStage = stageAction;
  const labTarget = (action?: string | null): string | null => {
    if (!action) return null;
    if (action === "save-master" || action === "suggest-belief") return "Master Thought";
    if (action === "generate" || action === "manual-big-thought" || action === "audit" || action === "challenger" || action === "fix") return "Big Thought";
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
          bigThoughtFixLessonsRef.current.delete(removed.code.toUpperCase());
          const current = parseLabSetRecord(selected.lastAudit);
          const fixLessons = dropFixLessons(current?.fixLessons, [removed.code]);
          if (current && fixLessons.length !== (current.fixLessons ?? []).length) {
            await masters.saveSet.mutateAsync({
              id: selected.id,
              lastAudit: { ...current, fixLessons },
            });
          }
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
        await labAngles.remove.mutateAsync({ territoryId: target.territoryId, id: target.id });
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
      await labTerritories.remove.mutateAsync({ bigThoughtId: target.bigThoughtId, id: target.id });
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
      let record = parseLabSetRecord(selected.lastAudit) ?? emptySetRecord();
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
      const lessons: GateLesson[] = (record.generateLessons ?? []).map((lesson) => ({ ...lesson }));
      const seededLessonCount = lessons.length;
      let blockedKnownSentence = false;
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
        const next = mergeGenerateLessons(record.generateLessons, [{ gate: lesson.gate, statement, reason }]);
        const previous = record.generateLessons ?? [];
        const same =
          next.length === previous.length &&
          next.every((item, itemIndex) => {
            const stored = previous[itemIndex];
            return stored?.gate === item.gate && stored.statement === item.statement && stored.reason === item.reason;
          });
        if (same) return;
        record = { ...record, generateLessons: next };
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
        missingWhy,
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
              missingWhy: plan.missingWhy,
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
            generateDuplicateFailure(`Same Big Thought as ${repeated.code}.`),
            candidate.statement,
          );
          const reason = checklist.failure?.reason ?? "";
          if (reason) await rememberGenerateLesson({ gate: "duplicate", statement: candidate.statement, reason });
          await showGenerateChecklist(checklist);
        },
        judge: async (statement) => {
          const checklist = await runGenerateAdmissionChecks({
            skip: skipFor("bigThought"),
            batch: true,
            statement,
            parentStatement: becauseParent,
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
          return factsForGenerateAdmission(statement, checklist);
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
          const keptPasses = keptPassingAuditItems({
            items: record?.audit?.items,
            rows: known.map((row) => ({
              code: row.code,
              statementFingerprint: bigThoughtFingerprint({
                statement: row.statement,
                masterThoughtFingerprint: parentFp,
              }),
            })),
          });
          record = {
            ...clearSetConclusions(record),
            audit: keptPasses.length > 0 ? { setFingerprint: record?.audit?.setFingerprint ?? "", items: keptPasses } : null,
          };
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
      let setRecord = storedSet ?? emptyTerritorySetRecord();
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
            const gate = repeated?.reason.split(":")[0]?.trim();
            publishLive(
              territoryAdmissionChecks(
                gate === "audienceLanguage"
                  ? { id: "audienceLanguage", reason: repeated?.reason ?? "" }
                  : { id: "partOfBigThought", reason: repeated?.reason || "This name already failed." },
              ),
            );
            const relation = gate === "audienceLanguage" ? "INTERNAL_LANGUAGE" : "OUT_OF_PARENT_SCOPE";
            return failFacts(relation, repeated?.reason || "partOfBigThought: This name already failed.");
          }
          if (territoryNameTooLong(statement) || territoryNameIsActivity(statement)) {
            const reason = territoryNameTooLong(statement) ? TERRITORY_NAME_LENGTH_REASON : TERRITORY_ACTIVITY_REASON;
            publishLive(territoryAdmissionChecks({ id: "partOfBigThought", reason }));
            return failFacts(
              territoryNameTooLong(statement) ? "UNBOUNDED_SPACE" : "OUT_OF_PARENT_SCOPE",
              `partOfBigThought: ${reason}`,
            );
          }
          const checked = await runTerritoryAdmissionChecks({
            skip: skipFor("territory"),
            batch: true,
            statement,
            parentStatement: parent.statement,
            audience: parent.audience || selected?.audience,
            ask: (prompt) => askScoped("generate", code, prompt, 0),
            onStep: publishLive,
          });
          if (!checked.passed) {
            const failedCheck = checked.checks.find((check) => check.state === "fail");
            const gate = failedCheck?.id === "audienceLanguage" ? "audienceLanguage" : "partOfBigThought";
            const reason = failedCheck?.reason?.trim() || "This check could not be decided.";
            return failFacts(
              gate === "audienceLanguage" ? "INTERNAL_LANGUAGE" : "OUT_OF_PARENT_SCOPE",
              `${gate}: ${reason}`,
            );
          }
          const passed: TerritorySemanticFacts = {
            ...shownTerritoryFacts(code, statement),
            generatePasses: ["partOfBigThought", "audienceLanguage"],
          };
          publishTerritoryChecklist(code, checked.checks);
          return passed;
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
            facts: {
              ...facts,
              generatePasses: ["partOfBigThought", "audienceLanguage"],
            },
            admission,
          });
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
        judge: async (parent, code, statement) => {
          const failFacts = async (reason: string) => {
            await rememberGenerateLesson({ code, statement, reason });
            return { ...shownAngleFacts(code, statement), relationToParent: "BIG_THOUGHT_LIKE" as const };
          };
          if (bannedNames.has(statement.trim().toLowerCase())) {
            const repeated = learned.find(
              (lesson) => lesson.statement.trim().toLowerCase() === statement.trim().toLowerCase(),
            );
            publishLive(angleAdmissionChecks({ id: "observation", reason: repeated?.reason || "This sentence already failed." }));
            return failFacts(repeated?.reason || "observation: This sentence already failed.");
          }
          const checked = await runAngleAdmissionChecks({
            skip: skipFor("angle"),
            batch: true,
            statement,
            parentStatement: parent.statement,
            ancestors: parent.ancestors,
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: publishLive,
          });
          if (!checked.passed) {
            const failedCheck = checked.checks.find((check) => check.state === "fail");
            const reason = failedCheck?.reason?.trim() || "This check could not be decided.";
            return failFacts(`observation: ${reason}`);
          }
          publishAngleChecklist(code, checked.checks);
          return {
            ...shownAngleFacts(code, statement),
            generatePasses: ["observation"],
          };
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
            facts: {
              ...facts,
              generatePasses: ["observation"],
            },
            admission,
          });
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
  const admitBigThought = async (input: {
    code: string;
    label: string;
    statement: string;
    siblings: Array<{ code: string; statement: string; label?: string }>;
  }): Promise<{ facts: BigThoughtFacts; rejection: null } | { facts: null; rejection: string }> => {
    const repeated = input.siblings.find((row) => bigThoughtRepeats({ label: input.label, statement: input.statement }, row));
    if (repeated) return { facts: null, rejection: `duplicate: Same Big Thought as ${repeated.code}.` };
    const checklist = await runGenerateAdmissionChecks({
      skip: skipFor("bigThought"),
      batch: true,
      statement: input.statement,
      parentStatement: becauseParent,
      ask: (prompt) => askScoped("manual-big-thought", input.code, prompt, 0),
    });
    if (checklist.failure) return { facts: null, rejection: `${checklist.failure.gate}: ${checklist.failure.reason}` };
    return { facts: { ...factsForGenerateAdmission(input.statement, checklist), code: input.code }, rejection: null };
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
      const siblings = rowViews
        .filter((row) => row.admission === "GENERATE_VALID")
        .map((row) => ({ code: row.code, statement: row.statement, label: row.label }));
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
      await masters.saveSet.mutateAsync({
        id: selected.id,
        lastAudit: clearSetConclusions(parseLabSetRecord(selected.lastAudit)),
      });
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
        siblings: rowViews
          .filter((item) => item.admission === "GENERATE_VALID" && item.id !== id)
          .map((item) => ({ code: item.code, statement: item.statement })),
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
      const kept = keptPassingAuditItems({
        items: parseLabSetRecord(selected.lastAudit)?.audit?.items,
        rows: active.map((item) => ({
          code: item.code,
          statementFingerprint: bigThoughtFingerprint({
            statement: item.code.toUpperCase() === row.code.toUpperCase() ? clause : item.statement,
            masterThoughtFingerprint: parentFp,
          }),
        })),
        editedCode: row.code,
      });
      const current = clearSetConclusions(parseLabSetRecord(selected.lastAudit));
      bigThoughtFixLessonsRef.current.delete(row.code.toUpperCase());
      await masters.saveSet.mutateAsync({
        id: selected.id,
        lastAudit: {
          ...current,
          audit: kept.length > 0 ? { setFingerprint: "held", items: kept } : null,
          fixLessons: dropFixLessons(current.fixLessons, [row.code]),
        },
      });
      return null;
    });

  const onEditTerritory = (id: string, statement: string) =>
    runManual("manual-territory", async () => {
      if (!focusedThought || !parentFp) return null;
      const row = (labTerritories.data ?? []).find((item) => item.id === id && item.bigThoughtId === focusedThought.id);
      if (!row || row.status !== "candidate") return null;
      if (territoryNameTooLong(statement)) return TERRITORY_NAME_LENGTH_REASON;
      if (territoryNameIsActivity(statement)) return TERRITORY_ACTIVITY_REASON;
      // Same checks as Generate. The other checks run at Audit.
      const checked = await runTerritoryAdmissionChecks({
        skip: skipFor("territory"),
        batch: true,
        statement,
        parentStatement: focusedThought.statement,
        audience: selected?.audience,
        ask: (prompt) => askThinkingLab(prompt, 0),
        onStep: () => undefined,
      });
      if (!checked.passed) {
        return checked.checks.find((check) => check.state === "fail")?.reason?.trim() || "This check could not be decided.";
      }
      await labTerritories.replace.mutateAsync({
        bigThoughtId: focusedThought.id,
        id,
        statement,
        facts: { ...shownTerritoryFacts(row.code, statement), generatePasses: ["partOfBigThought", "audienceLanguage"] },
        admission: "GENERATE_VALID",
      });
      await territorySet.save.mutateAsync({
        ...emptyTerritorySetRecord(),
        auditLessons: territorySet.data?.auditLessons ?? [],
      });
      publishTerritoryChecklist(row.code, checked.checks);
      // The area description and question belonged to the old name; let them be written again.
      descriptionFlight.current.delete(row.id);
      return null;
    });

  const onEditAngle = (id: string, statement: string) =>
    runManual("manual-angle", async () => {
      if (!focusedTerritory || !parentFp) return null;
      const row = (labAngles.data ?? []).find((item) => item.id === id && item.territoryId === focusedTerritory.id);
      if (!row || row.status !== "candidate") return null;
      // Same check as Generate: the observation. The other checks run at Audit.
      const checked = await runAngleAdmissionChecks({
        skip: skipFor("angle"),
        batch: true,
        statement,
        parentStatement: focusedTerritory.statement,
        ancestors: angleAncestors,
        ask: (prompt) => askThinkingLab(prompt, 0),
        onStep: () => undefined,
      });
      if (!checked.passed) {
        return checked.checks.find((check) => check.state === "fail")?.reason?.trim() || "This check could not be decided.";
      }
      await labAngles.replace.mutateAsync({
        territoryId: focusedTerritory.id,
        id,
        statement,
        facts: {
          ...shownAngleFacts(row.code, statement, row.canonicalSemantic.subject ?? "", row.canonicalSemantic.example ?? ""),
          generatePasses: ["observation"],
        },
        admission: "GENERATE_VALID",
      });
      await angleSet.save.mutateAsync({
        ...emptyAngleSetRecord(),
        auditLessons: angleSet.data?.auditLessons ?? [],
      });
      // The card showed the checks of the old sentence; show the check the new sentence just passed.
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

  const onStopExecution = () => {
    executionCancel.current += 1;
    setExecutionProgress(null);
    setExecutionDraft(null);
    setExecutionRunChecks(null);
    setFixingLineId(null);
  };

  const onOpenPillarPicker = () => {
    setExecutionDirect(null);
    setPillarPickerOpen(true);
    if (masterSells !== "unknown" || !masterStatement) return;
    void (async () => {
      const raw = await askThinkingLab(buildMasterSellsPrompt(masterStatement), 0);
      setMasterSells(parseMasterSells(raw ? parseModelJson(raw) : null));
    })();
  };

  const loadScriptConfirm = (settings: {
    pillars: LabContentPillar[];
    audio: ScriptAudio;
    look?: ScriptLook;
    speech?: ScriptSpeech;
    durationSeconds: number | null;
    brandName: string | null;
    cta: string | null;
    image: ImageSettings | null;
    pillarDevelopment?: string | null;
  }) => {
    if (!focusedIdea || focusedIdea.status !== "locked") return;
    const pillarDevelopment = settings.pillarDevelopment?.trim() || null;
    confirmToken.current += 1;
    setPillarPickerOpen(false);
    setExecutionDirect(null);
    setScriptConfirm({
      ...settings,
      pillarDevelopment,
      phase: "mode",
      discovery: null,
      questions: null,
      loading: false,
      failed: false,
    });
  };

  const askScriptDiscovery = (
    settings: {
      pillars: LabContentPillar[];
      audio: ScriptAudio;
      look?: ScriptLook;
      speech?: ScriptSpeech;
      durationSeconds: number | null;
      brandName: string | null;
      cta: string | null;
      image: ImageSettings | null;
      pillarDevelopment: string | null;
    },
    discovery: DiscoveryMode,
  ) => {
    if (!focusedIdea || focusedIdea.status !== "locked") return;
    const idea = focusedIdea;
    const token = ++confirmToken.current;
    const pillarDevelopment = settings.pillarDevelopment;
    setScriptConfirm({
      ...settings,
      pillarDevelopment,
      phase: "questions",
      discovery,
      questions: null,
      loading: true,
      failed: false,
    });
    if (!masters.organizationId) {
      setScriptConfirm({
        ...settings,
        pillarDevelopment,
        phase: "questions",
        discovery,
        questions: null,
        loading: false,
        failed: true,
      });
      return;
    }
    let writeNow = false;
    void run(async () => {
      try {
        const { ancestors, angle } = ideaParentFor(idea.angleId);
        const raw = await askThinkingLab(
          buildExecutionConfirmPrompt({
            masterStatement,
            masterSubject,
            priorBelief: selected?.priorBelief,
            angleStatement: angle?.statement,
            ideaStatement: idea.statement,
            pillars: settings.pillars.map((pillar) => ({
              name: pillar.name,
              funnel: pillar.funnel,
              category: pillar.category,
            })),
            ancestors,
            speech: settings.speech,
            look: settings.look,
            durationSeconds: settings.durationSeconds,
            brandName: settings.brandName,
            cta: settings.cta,
            pillarDevelopment,
            discovery,
          }),
          0.2,
        );
        if (confirmToken.current !== token) return;
        const discovered = parseDiscoveredQuestions(raw ? parseModelJson(raw) : null);
        if (!discovered.ok) {
          setScriptConfirm((current) => {
            if (!current || confirmToken.current !== token) return current;
            return { ...current, loading: false, questions: null, failed: true };
          });
          return;
        }
        const questions = discovery === "follow" ? discovered.questions.filter((question) => question.binds !== "story") : discovered.questions;
        if (questions.length === 0) {
          writeNow = true;
          setScriptConfirm(null);
          return;
        }
        setScriptConfirm((current) => {
          if (!current || confirmToken.current !== token) return current;
          return { ...current, phase: "questions", loading: false, questions, failed: false };
        });
      } catch {
        if (confirmToken.current !== token) return;
        setScriptConfirm((current) => {
          if (!current || confirmToken.current !== token) return current;
          return { ...current, loading: false, questions: null, failed: true };
        });
      }
    }, "execution-confirm").then(() => {
      if (!writeNow || confirmToken.current !== token) return;
      onGenerateExecutions(
        settings.pillars,
        settings.audio,
        settings.look,
        settings.speech,
        null,
        settings.durationSeconds,
        settings.brandName,
        settings.cta,
        null,
        [],
        false,
        null,
        settings.image,
        false,
        null,
        null,
        pillarDevelopment,
      );
    });
  };

  const pillarFormat = (name: string) => {
    const match = (contentPillars.data ?? []).find(
      (pillar) => pillar.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    return {
      pillarCategory: match?.category ?? null,
      pillarDescription: match?.description ?? null,
    };
  };

  const withPillarRecommendation = async (
    facts: ExecutionSemanticFacts,
    failedPillar: string,
    ideaStatement: string,
    ancestors: AncestorStake[],
    token: number,
  ): Promise<ExecutionSemanticFacts> => {
    if (!pillarNeedsRecommendation(facts.relationToParent)) return facts;
    const options = (contentPillars.data ?? []).filter(
      (pillar) => pillar.name.trim().toLowerCase() !== failedPillar.trim().toLowerCase(),
    );
    if (options.length === 0) return facts;
    setExecutionProgress({ phase: "recommend", pillarName: failedPillar });
    setPillarChoices([]);
    const choices: Array<{ pillarName: string; reason: string }> = [];
    for (const pillar of options) {
      if (choices.length >= PILLAR_CHOICE_LIMIT) break;
      if (executionCancel.current !== token) return facts;
      const raw = await askThinkingLab(
        buildPillarFitChoicePrompt({
          masterStatement,
          ideaStatement,
          failedPillar,
          explanation: facts.whatItSays,
          ancestors,
          pillar: {
            name: pillar.name,
            funnel: pillar.funnel === "middle" ? "Consideration" : pillar.funnel === "bottom" ? "Conversion" : "Awareness",
            category: pillar.category,
            description: pillar.description,
          },
        }),
        0,
      );
      if (executionCancel.current !== token) return facts;
      const choice = parsePillarFitChoice(raw ? parseModelJson(raw) : null, pillar.name);
      if (!choice) continue;
      choices.push(choice);
      setPillarChoices(limitPillarChoices(choices));
    }
    const offered = limitPillarChoices(choices);
    const first = offered[0];
    return first ? { ...facts, recommendation: { pillarName: first.pillarName, reason: first.reason, choices: offered } } : facts;
  };

  const pillarHopStopped = (pillarName: string, script?: { followedRecommendation?: boolean } | null, exceptId?: string) =>
    Boolean(script?.followedRecommendation) ||
    pillarWasRecommended(
      pillarName,
      (labExecutions.data ?? [])
        .filter((row) => row.id !== exceptId)
        .map((row) => row.canonicalSemantic.recommendation?.pillarName),
    );

  const onGenerateExecutions = (
    chosen: LabContentPillar[],
    audio: ScriptAudio,
    look?: ScriptLook,
    speech?: ScriptSpeech,
    previousScript?: VoiceOverScript | null,
    durationSeconds?: number | null,
    brandName?: string | null,
    cta?: string | null,
    pointOfView?: string | null,
    decisions?: ScriptDecision[] | null,
    fromRecommendation = false,
    carriedLessons?: readonly ExecutionAuditLesson[] | null,
    image: ImageSettings | null = null,
    fresh = false,
    keptSwitches?: readonly ExecutionPassCheck[] | null,
    creativeLink?: CreativeExecutionLink | null,
    pillarDevelopment?: string | null,
  ) => {
    if (!focus || (focus.kind !== "idea" && focus.kind !== "pillar" && focus.kind !== "execution") || !focusedIdea || focusedIdea.status !== "locked") return;
    if (executionPassProposal) {
      const proposal = executionPassProposal;
      setExecutionPassProposal(null);
      setExecutionChecklists((lists) => {
        if (proposal.previousChecks) return { ...lists, [proposal.executionId]: proposal.previousChecks };
        if (!(proposal.executionId in lists)) return lists;
        const next = { ...lists };
        delete next[proposal.executionId];
        return next;
      });
    }
    const origin = focus;
    const idea = focusedIdea;
    const resolvedAudio: ScriptAudio = speech === "mix" || speech === "dialog" ? { ...audio, sound: true } : audio;
    const targetSeconds = durationSeconds ?? previousScript?.durationSeconds ?? null;
    const lockedDecisions = (decisions ?? previousScript?.decisions ?? []).filter((row) => row.answer.trim());
    const lockedView = (
      pointOfView ??
      lockedDecisions.find((row) => row.binds === "viewpoint")?.answer ??
      previousScript?.pointOfView ??
      ""
    ).trim();
    const token = executionCancel.current;
    setPillarPickerOpen(false);
    void run(async () => {
      let lastId: string | null = null;
      const { ancestors } = ideaParentFor(idea.angleId);
      const creativePrompt = creativeLink
        ? {
            creativeIdea: {
              statement: creativeLink.statement,
              concept: creativeLink.concept,
              mechanism: creativeLink.mechanism,
              value: creativeLink.value,
            },
          }
        : {};
      for (const pillar of chosen) {
        if (executionCancel.current !== token) return;
        setExecutionDraft(null);
        const existing = creativeLink
          ? undefined
          : (labExecutions.data ?? []).find((row) => {
              if (row.ideaId !== idea.id || row.creativeIdeaId) return false;
              if (pillar.id && (row.contentPillarId === pillar.id || row.pillar === pillar.id)) return true;
              return row.pillarName.trim().toLowerCase() === pillar.name.trim().toLowerCase();
            });
        const priorLessons = fresh
          ? []
          : mergeExecutionAuditLessons(existing?.canonicalSemantic.auditLessons ?? [], carriedLessons ?? []);
        const trackedId = existing?.id ?? null;
        const imageSettings = image ?? (previousScript?.medium === "image" ? previousScript.image ?? null : null);
        const enabled = (keptSwitches ?? []).flatMap((check) => (check.enabled === false ? [] : [check.id]));
        if (imageSettings) {
          setExecutionProgress({ phase: "write", pillarName: pillar.name, medium: "image" });
          const imageRaw = await askThinkingLab(
            buildImageGeneratePrompt({
              masterStatement,
              ideaStatement: idea.statement,
              pillar: pillar.name,
              pillarCategory: pillar.category,
              pillarDescription: pillar.description,
              ancestors,
              image: imageSettings,
              pointOfView: lockedView || null,
              decisions: lockedDecisions,
              lessons: imageLessons(priorLessons),
              pillarDevelopment,
              enabled,
              ...creativePrompt,
            }),
            0.2,
          );
          if (executionCancel.current !== token) return;
          const imageParsed = parseVoiceOverScript(imageRaw ? parseModelJson(imageRaw) : null);
          if (!imageParsed) continue;
          const current = stampImageScript(
            {
              ...imageParsed,
              ...(lockedView ? { pointOfView: lockedView } : {}),
              ...(lockedDecisions.length > 0 ? { decisions: lockedDecisions } : {}),
              ...(fromRecommendation ? { followedRecommendation: true } : {}),
            },
            imageSettings,
          );
          if (!current.scenes.some((scene) => scene.lines.some((line) => line.narration.trim()))) continue;
          setExecutionDraft(current);
          setExecutionProgress({ phase: "audit", pillarName: pillar.name, medium: "image" });
          let liveChecks: ExecutionPassCheck[] = [];
          const imageCheckInput = {
            pillar: pillar.name,
            pillarCategory: pillar.category,
            pillarDescription: pillar.description,
            masterStatement,
            ideaStatement: idea.statement,
            ancestors,
            pillarDevelopment,
            script: current,
            image: imageSettings,
            masterSells: masterSells === "unknown" ? "unresolved" : masterSells,
            auditLessons: imageLessons(priorLessons),
            ask: (prompt: string) => askThinkingLab(prompt, 0),
            onStep: (checks: ExecutionPassCheck[]) => {
              liveChecks = checks;
              setExecutionRunChecks(checks);
              if (!trackedId) return;
              setExecutionChecklists((lists) => ({ ...lists, [trackedId]: checks }));
            },
          };
          const checked = await (keptSwitches
            ? runImageOpenChecks({ ...imageCheckInput, prior: keptSwitches })
            : runImageMeaningChecks(imageCheckInput));
          if (executionCancel.current !== token) return;
          const lesson = lessonFromMeaningAudit(checked.facts, current);
          const withLesson = lesson
            ? { ...checked.facts, auditLessons: mergeExecutionAuditLessons(checked.facts.auditLessons ?? [], [lesson]) }
            : checked.facts;
          const recommended =
            fromRecommendation || pillarHopStopped(pillar.name, current)
              ? withLesson
              : await withPillarRecommendation(withLesson, pillar.name, idea.statement, ancestors, token);
          if (executionCancel.current !== token) return;
          const saved = await labExecutions.save.mutateAsync({
            ideaId: idea.id,
            pillar: pillar.id,
            contentPillarId: pillar.id,
            pillarName: pillar.name,
            statement: flattenVoiceOver(current),
            script: current,
            facts: recommended,
            ...(creativeLink ? { creativeLink } : {}),
          });
          setExecutionChecklists((currentLists) => ({ ...currentLists, [saved.id]: liveChecks }));
          setExecutionLineOffer(null);
          setExecutionRepairNote(null);
          lastId = saved.id;
          continue;
        }
        setExecutionProgress({ phase: "write", pillarName: pillar.name });
        const raw = await askThinkingLab(
          buildExecutionGeneratePrompt({
            masterStatement,
            masterSubject,
            priorBelief: selected?.priorBelief,
            ideaStatement: idea.statement,
            pillar: pillar.name,
            pillarCategory: pillar.category,
            pillarDescription: pillar.description,
            ancestors,
            speech,
            durationSeconds: targetSeconds,
            brandName: brandName ?? previousScript?.brandName ?? null,
            cta: cta ?? previousScript?.cta ?? null,
            pointOfView: lockedView || null,
            decisions: lockedDecisions,
            lessons: priorLessons,
            pillarDevelopment,
            enabled,
            ...creativePrompt,
          }),
          0.2,
        );
        if (executionCancel.current !== token) return;
        const parsed = parseVoiceOverScript(raw ? parseModelJson(raw) : null);
        if (!parsed) continue;
        const namedBrand = (brandName ?? previousScript?.brandName ?? "").trim();
        const chosenCta = (cta ?? previousScript?.cta ?? "").trim();
        const stamped = {
          ...parsed,
          audio: resolvedAudio,
          ...(look ? { look } : {}),
          ...(namedBrand ? { brandName: namedBrand } : {}),
          ...(chosenCta ? { cta: chosenCta } : {}),
          ...(lockedView ? { pointOfView: lockedView } : {}),
          ...(lockedDecisions.length > 0 ? { decisions: lockedDecisions } : {}),
          ...(fromRecommendation ? { followedRecommendation: true } : {}),
        };
        let current = speech ? withSpeech(stamped, speech) : stamped;
        if (
          speechNeedsRepair(current, speech) ||
          (namedBrand && !scriptMentionsBrand(current, namedBrand))
        ) {
          const repairSpeech = speech === "mix" || speech === "dialog" || speech === "silent" ? speech : "vo";
          setExecutionProgress({ phase: "repair", pillarName: pillar.name });
          const repairRaw = await askThinkingLab(
            buildSpeechRepairPrompt({
              ideaStatement: idea.statement,
              pillarName: pillar.name,
              speech: repairSpeech,
              script: current,
            }),
            0.2,
          );
          if (executionCancel.current !== token) return;
          const repaired = mergeSpeechRepairs(current, parseSpeechRepairs(repairRaw ? parseModelJson(repairRaw) : null));
          current = speech ? withSpeech(repaired, speech) : repaired;
        }
        if (namedBrand) current = ensureBrandMention(current, namedBrand);
        if (chosenCta) {
          current = detachCallToAction(current, chosenCta);
          if (!callToActionSceneReady(current, chosenCta)) {
            setExecutionProgress({ phase: "write", pillarName: pillar.name });
            const ctaRaw = await askThinkingLab(
              buildCtaScenePrompt({
                ideaStatement: idea.statement,
                masterStatement,
                pointOfView: lockedView || null,
                decisions: lockedDecisions,
                action: chosenCta,
                speech,
                brandName: namedBrand || null,
              }),
              0.2,
            );
            if (executionCancel.current !== token) return;
            const ctaScene = parseCtaScene(ctaRaw ? parseModelJson(ctaRaw) : null, speech);
            if (ctaScene && callToActionSceneReady({ ...current, scenes: [...current.scenes, ctaScene] }, chosenCta)) {
              current = attachCtaScene(current, ctaScene);
            }
          }
        }
        if (targetSeconds) current = { ...current, durationSeconds: targetSeconds };
        const narrationLines = () =>
          current.scenes.flatMap((scene) => scene.lines.map((line) => ({ id: line.id, narration: line.narration })));
        setExecutionDraft(current);
        let viewpointIssues: Array<{ lineId: string; reason: string }> = [];
        if (lockedView) {
          setExecutionProgress({ phase: "audit", pillarName: pillar.name });
          const viewpointRaw = await askThinkingLab(
            buildViewpointAuditPrompt({
              ideaStatement: idea.statement,
              pointOfView: lockedView,
              lines: narrationLines(),
            }),
            0,
          );
          if (executionCancel.current !== token) return;
          viewpointIssues = parseLineIssues(viewpointRaw ? parseModelJson(viewpointRaw) : null, current);
          if (viewpointIssues.length > 0) {
            setExecutionProgress({ phase: "repair", pillarName: pillar.name });
            const repairRaw = await askThinkingLab(
              buildLineRepairPrompt({
                ideaStatement: idea.statement,
                masterStatement,
                priorBelief: selected?.priorBelief,
                ancestors,
                pillarName: pillar.name,
                script: { ...current, lineIssues: viewpointIssues },
              }),
              0.2,
            );
            if (executionCancel.current !== token) return;
            const repaired = mergeRepairedLines(current, parseLineReplacements(repairRaw ? parseModelJson(repairRaw) : null));
            const named = namedBrand ? ensureBrandMention(repaired, namedBrand) : repaired;
            const voiced = chosenCta ? detachCallToAction(named, chosenCta) : named;
            current = speech ? withSpeech({ ...voiced, pointOfView: lockedView }, speech) : { ...voiced, pointOfView: lockedView };
            const recheckRaw = await askThinkingLab(
              buildViewpointAuditPrompt({
                ideaStatement: idea.statement,
                pointOfView: lockedView,
                lines: narrationLines(),
              }),
              0,
            );
            if (executionCancel.current !== token) return;
            viewpointIssues = parseLineIssues(recheckRaw ? parseModelJson(recheckRaw) : null, current);
          }
        }
        setExecutionProgress({ phase: "audit", pillarName: pillar.name });
        const continuityRaw = await askThinkingLab(
          buildContinuityAuditPrompt({
            ideaStatement: idea.statement,
            lines: chainNarrationLines(current),
          }),
          0,
        );
        if (executionCancel.current !== token) return;
        const seen = new Set(viewpointIssues.map((issue) => issue.lineId));
        const productionIssues = [
          ...viewpointIssues.map((issue) => ({ ...issue, kind: "viewpoint" as const })),
          ...parseLineIssues(continuityRaw ? parseModelJson(continuityRaw) : null, current)
            .filter((issue) => !seen.has(issue.lineId))
            .map((issue) => ({ ...issue, kind: "continuity" as const })),
        ];
        const { productionIssues: _droppedProduction, ...withoutProduction } = current;
        current = {
          ...withoutProduction,
          lineIssues: [],
          ...(productionIssues.length > 0 ? { productionIssues } : {}),
        };
        const statement = storyVoiceOver(current);
        if (!statement) continue;
        setExecutionDraft(current);
        let liveChecks: ExecutionPassCheck[] = [];
        const videoCheckInput = {
          pillar: pillar.name,
          pillarCategory: pillar.category,
          pillarDescription: pillar.description,
          masterStatement,
          masterSubject,
          ideaStatement: idea.statement,
          ancestors,
          pillarDevelopment,
          script: current,
          masterSells,
          auditLessons: priorLessons,
          ask: (prompt: string) => askThinkingLab(prompt, 0),
          resolveSelling: async () => {
            const raw = await askThinkingLab(buildMasterSellsPrompt(masterStatement), 0);
            const value = parseMasterSells(raw ? parseModelJson(raw) : null);
            setMasterSells(value);
            return value;
          },
          onStep: (checks: ExecutionPassCheck[]) => {
            liveChecks = checks;
            setExecutionRunChecks(checks);
            if (!trackedId) return;
            setExecutionChecklists((lists) => ({ ...lists, [trackedId]: checks }));
          },
        };
        const checked = await (keptSwitches
          ? runExecutionOpenChecks({ ...videoCheckInput, prior: keptSwitches })
          : runExecutionMeaningChecks(videoCheckInput));
        if (executionCancel.current !== token) return;
        const lesson = lessonFromMeaningAudit(checked.facts, current);
        const withLesson = lesson
          ? { ...checked.facts, auditLessons: mergeExecutionAuditLessons(checked.facts.auditLessons ?? [], [lesson]) }
          : checked.facts;
        const recommended =
          fromRecommendation || pillarHopStopped(pillar.name, current)
            ? withLesson
            : await withPillarRecommendation(withLesson, pillar.name, idea.statement, ancestors, token);
        if (executionCancel.current !== token) return;
        const script = keepCharacterVisuals(current, previousScript ?? null);
        const saved = await labExecutions.save.mutateAsync({
          ideaId: idea.id,
          pillar: pillar.id,
          contentPillarId: pillar.id,
          pillarName: pillar.name,
          statement: flattenVoiceOver(script),
          script,
          facts: recommended,
          ...(creativeLink ? { creativeLink } : {}),
        });
        setExecutionChecklists((currentLists) => ({ ...currentLists, [saved.id]: liveChecks }));
        setExecutionLineOffer(null);
        setExecutionRepairNote(null);
        lastId = saved.id;
      }
      if (executionCancel.current !== token) return;
      if (!lastId) {
        toast.error(t("thinkingLab.execution.unreadable", "The script could not be read. Try that pillar again."));
        return;
      }
      setFocus({
        kind: "execution",
        masterId: origin.masterId,
        thoughtId: origin.thoughtId,
        territoryId: origin.territoryId,
        angleId: origin.angleId,
        ideaId: origin.ideaId,
        executionId: lastId,
      });
    }, "execution").finally(() => {
      if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
    });
  };

  const creativeContextFor = (idea: LabIdea) => {
    const { angle, ancestors } = ideaParentFor(idea.angleId);
    const named = (label: string) => ancestors.find((item) => item.label === label)?.statement ?? "";
    return {
      parentCode: idea.code,
      parentStatement: idea.statement,
      parentConcept: idea.validation?.concept ?? "",
      parentMechanism: idea.validation?.mechanism ?? "",
      parentValue: idea.validation?.value ?? "",
      masterThought: masterStatement,
      audience: selected?.audience ?? "",
      priorBelief: selected?.priorBelief ?? "",
      rootBelief: selected?.rootBelief ?? "",
      bigThought: named("Big Thought"),
      territory: named("Territory"),
      angle: angle?.statement ?? "",
    };
  };

  const onReviewCreativePillars = () => {
    if (!focusedIdea || focusedIdea.status !== "locked") return;
    const idea = focusedIdea;
    setLeadMagnetStep(null);
    void run(async () => {
      const context = creativeContextFor(idea);
      const locked = pillarCardsFor(idea);
      const reviews = await reviewContentPillars({
        pillars: contentPillars.data ?? [],
        excludeIds: locked.map((card) => card.contentPillarId),
        keep: 3,
        context: [context.masterThought, context.bigThought, context.territory, context.angle, context.parentStatement]
          .filter(Boolean)
          .join("\n"),
        ask: (prompt) => askThinkingLab(prompt, 0),
      });
      setCreativeReviews(reviewsToStore(reviews));
      setCreativeReviewReady(true);
    }, "creative-review");
  };

  const onReviewLeadMagnetPillars = () => {
    if (!focusedIdea || focusedIdea.status !== "locked") return;
    const idea = focusedIdea;
    setLeadMagnetStep({ pillarName: "", drafting: true, checks: leadMagnetPassChecklist() });
    void run(async () => {
      setCreativeReviews([]);
      setCreativeReviewReady(false);
      const context = creativeContextFor(idea);
      const locked = pillarCardsFor(idea);
      const passed: Awaited<ReturnType<typeof reviewContentPillars>> = [];
      let reviews: Awaited<ReturnType<typeof reviewContentPillars>> = [];
      try {
        reviews = await reviewContentPillars({
          pillars: contentPillars.data ?? [],
          excludeIds: locked.map((card) => card.contentPillarId),
          keep: 3,
          purpose: "lead_magnet",
          context: [context.masterThought, context.bigThought, context.territory, context.angle, context.parentStatement]
            .filter(Boolean)
            .join("\n"),
          ask: (prompt) => askThinkingLab(prompt, 0),
          onStep: (step) => setLeadMagnetStep(step),
          onPass: (review) => {
            passed.push(review);
            setCreativeReviews(reviewsToStore(passed));
            setCreativeReviewReady(true);
          },
        });
        setCreativeReviews(reviewsToStore(reviews));
        setCreativeReviewReady(true);
      } finally {
        const passed = reviews.length > 0;
        setLeadMagnetStep((current) => {
          if (passed) {
            return {
              pillarName: "",
              drafting: false,
              checks: leadMagnetPassChecklist().map((check) => ({ ...check, state: "pass" })),
            };
          }
          if (!current) return current;
          return {
            ...current,
            drafting: false,
            checks: current.checks.map((check) => (check.state === "running" ? { ...check, state: "pending" } : check)),
          };
        });
      }
    }, "creative-review-lead-magnet");
  };

  const rememberedDevelopment = (contentPillarId: string | null | undefined) => {
    if (!focusedIdea || !contentPillarId) return null;
    const text = developmentForPillar(focusedIdea.developmentPaths, contentPillarId, creativeReviews ?? undefined);
    return text || null;
  };

  const rememberCreativePath = (ideaId: string, organizationId: string, path: DevelopmentPath) => {
    creativePathSave.current = creativePathSave.current
      .catch(() => undefined)
      .then(() => saveDevelopmentPath({ organizationId, ideaId, path }))
      .then((paths) => {
        queryClient.setQueriesData<LabIdea[]>({ queryKey: ["thinking-lab-ideas", organizationId] }, (current) =>
          current?.map((row) => (row.id === ideaId ? { ...row, developmentPaths: paths } : row)),
        );
      })
      .catch(reportStepError);
  };

  const onLockCreativePillar = (contentPillarId: string) => {
    if (!focusedIdea || !masters.organizationId) return;
    const reviews = creativeReviews ?? latestPathReviews(focusedIdea.developmentPaths);
    const review = reviews.find((item) => item.contentPillarId === contentPillarId);
    if (!review?.development.trim() || !review.reason.trim() || review.status !== "RECOMMENDED") return;
    setCreativePillarId(contentPillarId);
    setCreativeFormat(null);
    if (focus?.kind === "idea" && focus.ideaId === focusedIdea.id) {
      setFocus({
        kind: "pillar",
        masterId: focus.masterId,
        thoughtId: focus.thoughtId,
        territoryId: focus.territoryId,
        angleId: focus.angleId,
        ideaId: focus.ideaId,
        contentPillarId,
      });
    }
    rememberCreativePath(focusedIdea.id, masters.organizationId, {
      contentPillarId,
      pillarName: review.pillarName,
      format: null,
      status: "RECOMMENDED",
      reason: review.reason,
      reviews,
      savedAt: new Date().toISOString(),
    });
  };

  const onOpenExecutionSettings = (format: CreativeFormat) => {
    if (!focusedIdea || !masters.organizationId || !creativePillarId) return;
    const pillar = (contentPillars.data ?? []).find((item) => item.id === creativePillarId);
    if (!pillar) return;
    const idea = focusedIdea;
    const organizationId = masters.organizationId;
    const reviews = creativeReviews ?? latestPathReviews(idea.developmentPaths);
    const review = reviews.find((item) => item.contentPillarId === pillar.id);
    setCreativeFormat(format);
    setExecutionDirect({
      token: Date.now(),
      pillarId: pillar.id,
      medium: format === "video" ? "video" : "image",
      imageFormat: format === "carousel" ? "carousel" : "single",
    });
    rememberCreativePath(idea.id, organizationId, {
      contentPillarId: pillar.id,
      pillarName: pillar.name,
      format,
      status: review?.status ?? "NOT_REVIEWED",
      reason: review?.reason ?? "",
      reviews,
      savedAt: new Date().toISOString(),
    });
  };

  const listedExecutionChecks = (execution: {
    id: string;
    script: VoiceOverScript | null;
    canonicalSemantic: ExecutionSemanticFacts;
  }): ExecutionPassCheck[] => {
    const live = executionChecklists[execution.id];
    if (live?.length) return execution.script?.medium === "image" ? ensureImageLegacySwitches(live) : ensureVideoPassChecks(live);
    const stored = execution.canonicalSemantic.passChecks;
    if (stored?.length) {
      const checks = stored.map((check) => ({
        id: check.id,
        state: check.state,
        enabled: check.enabled,
        reason: check.reason,
        lineIds: check.lineIds,
      }));
      return execution.script?.medium === "image" ? ensureImageLegacySwitches(checks) : ensureVideoPassChecks(checks);
    }
    if (execution.script?.medium === "image") return ensureImageLegacySwitches(imageChecksFromAudit(execution.canonicalSemantic.meaningAudit));
    return execution.canonicalSemantic.meaningAudit ? executionChecksFromAudit(execution.canonicalSemantic.meaningAudit) : [];
  };

  const saveExecutionFacts = (
    execution: {
      id: string;
      ideaId: string;
      pillar: string;
      contentPillarId: string | null;
      pillarName: string;
      script: VoiceOverScript | null;
    },
    facts: ExecutionSemanticFacts,
  ) => {
    const scriptNow = execution.script;
    if (!scriptNow) return Promise.resolve();
    return labExecutions.save.mutateAsync({
      ideaId: execution.ideaId,
      pillar: execution.contentPillarId ?? execution.pillar,
      contentPillarId: execution.contentPillarId,
      pillarName: execution.pillarName,
      statement: flattenVoiceOver(scriptNow),
      script: scriptNow,
      facts,
    });
  };

  const onResumeOpenExecution = () => {
    if (focus?.kind !== "execution" || !focusedIdea) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution?.script) return;
    const idea = focusedIdea;
    const current = execution;
    const scriptNow = current.script;
    if (!scriptNow) return;
    const prior = listedExecutionChecks(current);
    if (!openPassResume(prior)) return;
    const token = executionCancel.current;
    void run(async () => {
      const { ancestors } = ideaParentFor(idea.angleId);
      setExecutionDraft(scriptNow);
      setExecutionProgress({ phase: "audit", pillarName: current.pillarName, medium: scriptNow.medium === "image" ? "image" : undefined });
      const imageSettings = scriptNow.medium === "image" ? scriptNow.image : null;
      let liveChecks: ExecutionPassCheck[] = [];
      const checked = imageSettings
        ? await runImageOpenChecks({
            pillar: current.pillarName,
            ...pillarFormat(current.pillarName),
            masterStatement,
            ideaStatement: idea.statement,
            ancestors,
            pillarDevelopment: rememberedDevelopment(current.contentPillarId),
            script: scriptNow,
            image: imageSettings,
            masterSells: masterSells === "unknown" ? "unresolved" : masterSells,
            auditLessons: imageLessons(current.canonicalSemantic.auditLessons ?? []),
            prior,
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => {
              liveChecks = checks;
              setExecutionRunChecks(checks);
              setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
            },
          })
        : await runExecutionOpenChecks({
            pillar: current.pillarName,
            ...pillarFormat(current.pillarName),
            masterStatement,
            masterSubject,
            ideaStatement: idea.statement,
            ancestors,
            pillarDevelopment: rememberedDevelopment(current.contentPillarId),
            script: scriptNow,
            masterSells,
            auditLessons: current.canonicalSemantic.auditLessons,
            prior,
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => {
              liveChecks = checks;
              setExecutionRunChecks(checks);
              setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
            },
          });
      if (executionCancel.current !== token) return;
      const recommended = pillarHopStopped(current.pillarName, scriptNow, current.id)
        ? checked.facts
        : await withPillarRecommendation(checked.facts, current.pillarName, idea.statement, ancestors, token);
      if (executionCancel.current !== token) return;
      await saveExecutionFacts(current, {
        ...current.canonicalSemantic,
        ...recommended,
        recommendation: recommended.recommendation ?? current.canonicalSemantic.recommendation,
      });
      setExecutionChecklists((lists) => ({ ...lists, [current.id]: liveChecks.length > 0 ? liveChecks : checked.checks }));
    }, "execution-pass").finally(() => {
      if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
    });
  };

  const restorePassChecks = (executionId: string, previous: ExecutionPassCheck[] | null) => {
    setExecutionChecklists((lists) => {
      if (previous) return { ...lists, [executionId]: previous };
      if (!(executionId in lists)) return lists;
      const next = { ...lists };
      delete next[executionId];
      return next;
    });
  };

  const auditCommittedScript = async (
    current: {
      id: string;
      ideaId: string;
      pillar: string;
      contentPillarId: string | null;
      pillarName: string;
      canonicalSemantic: ExecutionSemanticFacts;
    },
    idea: { statement: string; angleId: string },
    script: VoiceOverScript,
    checks: ExecutionPassCheck[],
    rerunOn: boolean,
    token: number,
  ) => {
    const { ancestors } = ideaParentFor(idea.angleId);
    setExecutionDraft(script);
    setExecutionProgress({
      phase: "audit",
      pillarName: current.pillarName,
      medium: script.medium === "image" ? "image" : undefined,
    });
    const prior = rerunOn
      ? checks.map((check) =>
          check.enabled === false
            ? { ...check, state: "pass" as const, enabled: false }
            : { ...check, state: "pending" as const, enabled: true },
        )
      : checks;
    const imageSettings = script.medium === "image" ? script.image : null;
    let liveChecks: ExecutionPassCheck[] = [];
    const checked = imageSettings
      ? await runImageOpenChecks({
          pillar: current.pillarName,
          ...pillarFormat(current.pillarName),
          masterStatement,
          ideaStatement: idea.statement,
          ancestors,
          pillarDevelopment: rememberedDevelopment(current.contentPillarId),
          script,
          image: imageSettings,
          masterSells: masterSells === "unknown" ? "unresolved" : masterSells,
          auditLessons: imageLessons(current.canonicalSemantic.auditLessons ?? []),
          prior,
          ask: (prompt) => askThinkingLab(prompt, 0),
          onStep: (next) => {
            liveChecks = next;
            setExecutionRunChecks(next);
            setExecutionChecklists((lists) => ({ ...lists, [current.id]: next }));
          },
        })
      : await runExecutionOpenChecks({
          pillar: current.pillarName,
          ...pillarFormat(current.pillarName),
          masterStatement,
          masterSubject,
          ideaStatement: idea.statement,
          ancestors,
          pillarDevelopment: rememberedDevelopment(current.contentPillarId),
          script,
          masterSells,
          auditLessons: current.canonicalSemantic.auditLessons,
          prior,
          ask: (prompt) => askThinkingLab(prompt, 0),
          onStep: (next) => {
            liveChecks = next;
            setExecutionRunChecks(next);
            setExecutionChecklists((lists) => ({ ...lists, [current.id]: next }));
          },
        });
    if (executionCancel.current !== token) return;
    const recommended = pillarHopStopped(current.pillarName, script, current.id)
      ? checked.facts
      : await withPillarRecommendation(checked.facts, current.pillarName, idea.statement, ancestors, token);
    if (executionCancel.current !== token) return;
    await labExecutions.save.mutateAsync({
      ideaId: current.ideaId,
      pillar: current.contentPillarId ?? current.pillar,
      contentPillarId: current.contentPillarId,
      pillarName: current.pillarName,
      statement: flattenVoiceOver(script),
      script,
      facts: {
        ...current.canonicalSemantic,
        ...recommended,
        recommendation: recommended.recommendation ?? current.canonicalSemantic.recommendation,
      },
    });
    setExecutionChecklists((lists) => ({ ...lists, [current.id]: liveChecks.length > 0 ? liveChecks : checked.checks }));
  };

  const onToggleExecutionPass = (id: string, enabled: boolean) => {
    if (focus?.kind !== "execution" || !focusedIdea || executionProgress || executionPassProposal) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution?.script) return;
    const toggled = togglePassCheck(listedExecutionChecks(execution), id, enabled);
    const switched = toggled.checks.find((check) => check.id === id);
    if (!switched) return;
    const idea = focusedIdea;
    const current = execution;
    const scriptNow = current.script;
    if (!scriptNow) return;
    const previousChecks = executionChecklists[current.id] ?? null;
    const token = executionCancel.current;
    void run(async () => {
      const lines = switchRewriteLines(scriptNow, switched.id);
      let committed = false;
      let proposed = false;
      const commitSwitch = async (checks: ExecutionPassCheck[]) => {
        setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
        await saveExecutionFacts(current, factsForPassChecks(current.canonicalSemantic, checks));
        committed = true;
      };
      try {
        if (lines.length === 0) {
          await commitSwitch(enabled ? checksImplementedBySwitch(toggled.checks) : toggled.checks);
          return;
        }
        setExecutionChecklists((lists) => ({
          ...lists,
          [current.id]: toggled.checks.map((check) => (check.id === switched.id ? { ...check, state: "running" } : check)),
        }));
        setExecutionDraft(scriptNow);
        setExecutionProgress({
          phase: "switch",
          pillarName: current.pillarName,
          medium: scriptNow.medium === "image" ? "image" : undefined,
        });
        const raw = await askThinkingLab(
          buildPassSwitchRewritePrompt({
            checkId: switched.id,
            enabled,
            enabledIds: toggled.checks.flatMap((check) => (check.enabled === false ? [] : [check.id])),
            surface: scriptNow.medium === "image" ? "image" : "video",
            ideaStatement: idea.statement,
            masterStatement,
            pillarName: current.pillarName,
            ...pillarFormat(current.pillarName),
            pillarDevelopment: rememberedDevelopment(current.contentPillarId),
            ancestors: ideaParentFor(idea.angleId).ancestors,
            lines,
          }),
          0.2,
        );
        if (executionCancel.current !== token) return;
        const allowed = new Set(lines.map((line) => line.id));
        const nextScript = applyPassSwitchScript(
          scriptNow,
          parseExecutionNarrationReplacements(raw ? parseModelJson(raw) : null).filter((row) => allowed.has(row.lineId)),
        );
        const changes = narrationChangeRows(lines, switchRewriteLines(nextScript, switched.id));
        if (passSwitchOutcome(changes) === "save-switch") {
          await commitSwitch(enabled ? checksImplementedBySwitch(toggled.checks) : toggled.checks);
          return;
        }
        proposed = true;
        setExecutionPassProposal({
          executionId: current.id,
          checks: toggled.checks,
          script: nextScript,
          changes,
          previousChecks,
          implemented: enabled,
        });
        setExecutionChecklists((lists) => ({ ...lists, [current.id]: toggled.checks }));
      } catch (error) {
        if (!committed) restorePassChecks(current.id, previousChecks);
        throw error;
      } finally {
        if (executionCancel.current === token) {
          setExecutionProgress(null);
          setExecutionDraft(null);
          setExecutionRunChecks(null);
        } else if (!committed && !proposed) {
          restorePassChecks(current.id, previousChecks);
        }
      }
    }, "execution-pass");
  };

  const onAcceptPassProposal = () => {
    const proposal = executionPassProposal;
    if (!proposal || focus?.kind !== "execution" || !focusedIdea || focus.executionId !== proposal.executionId || executionProgress) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === proposal.executionId);
    if (!execution) return;
    const idea = focusedIdea;
    const token = executionCancel.current;
    void run(async () => {
      const checks = proposal.implemented ? checksImplementedBySwitch(proposal.checks) : proposal.checks;
      await labExecutions.save.mutateAsync({
        ideaId: execution.ideaId,
        pillar: execution.contentPillarId ?? execution.pillar,
        contentPillarId: execution.contentPillarId,
        pillarName: execution.pillarName,
        statement: flattenVoiceOver(proposal.script),
        script: proposal.script,
        facts: factsForPassChecks(execution.canonicalSemantic, checks),
      });
      if (executionCancel.current !== token) return;
      setExecutionPassProposal(null);
      setExecutionChecklists((lists) => ({ ...lists, [proposal.executionId]: checks }));
      if (!proposal.implemented) {
        await auditCommittedScript(execution, idea, proposal.script, proposal.checks, true, token);
      }
    }, "execution-pass").finally(() => {
      if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
    });
  };

  const onDeclinePassProposal = () => {
    const proposal = executionPassProposal;
    if (!proposal) return;
    restorePassChecks(proposal.executionId, proposal.previousChecks);
    setExecutionPassProposal(null);
  };

  const onRegenerateExecution = () => {
    if (focus?.kind !== "execution") return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution) return;
    const match = (contentPillars.data ?? []).find(
      (pillar) => pillar.id === execution.contentPillarId || pillar.id === execution.pillar || pillar.name === execution.pillarName,
    );
    const pillar: LabContentPillar = match ?? {
      id: execution.contentPillarId ?? execution.pillar,
      name: execution.pillarName,
      funnel: "top",
      category: null,
      isDefault: false,
    };
    const switches = regeneratePassPrior(listedExecutionChecks(execution));
    onGenerateExecutions(
      [pillar],
      execution.script?.audio ?? { sound: false, music: false },
      execution.script?.look,
      execution.script?.speech,
      execution.script,
      execution.script?.durationSeconds,
      execution.script?.brandName,
      execution.script?.cta,
      undefined,
      undefined,
      false,
      null,
      execution.script?.medium === "image" ? execution.script.image ?? null : null,
      true,
      switches,
      null,
      rememberedDevelopment(pillar.id),
    );
  };

  const onRewriteExecution = () => {
    if (focus?.kind !== "execution") return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution) return;
    const match = (contentPillars.data ?? []).find(
      (pillar) => pillar.id === execution.contentPillarId || pillar.id === execution.pillar || pillar.name === execution.pillarName,
    );
    const pillar: LabContentPillar = match ?? {
      id: execution.contentPillarId ?? execution.pillar,
      name: execution.pillarName,
      funnel: "top",
      category: null,
      isDefault: false,
    };
    if (execution.script?.medium === "image" && imageRewriteFromFailure(execution.canonicalSemantic.meaningAudit)) {
      onRepairExecution();
      return;
    }
    if (
      execution.script?.medium !== "image" &&
      isFailedMeaningAudit(execution.canonicalSemantic.meaningAudit) &&
      (execution.canonicalSemantic.meaningAudit.id === "soundsSpoken" ||
        execution.canonicalSemantic.meaningAudit.id === "usesSlang") &&
      meaningLineRepairReady(execution.canonicalSemantic)
    ) {
      onRepairExecution();
      return;
    }
    if (openPassResume(listedExecutionChecks(execution))) {
      onResumeOpenExecution();
      return;
    }
    loadScriptConfirm({
      pillars: [pillar],
      audio: execution.script?.audio ?? { sound: false, music: false },
      look: execution.script?.look,
      speech: execution.script?.speech,
      durationSeconds: execution.script?.durationSeconds ?? null,
      brandName: execution.script?.brandName ?? null,
      cta: execution.script?.cta ?? null,
      image: execution.script?.medium === "image" ? execution.script.image ?? null : null,
      pillarDevelopment: rememberedDevelopment(pillar.id),
    });
  };

  const onUseRecommendation = (pillarName?: string) => {
    if (focus?.kind !== "execution") return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    const name = (pillarName ?? execution?.canonicalSemantic.recommendation?.pillarName ?? "").trim();
    if (!execution || !name) return;
    const match = (contentPillars.data ?? []).find((pillar) => pillar.name.trim().toLowerCase() === name.toLowerCase());
    if (!match) return;
    executionCancel.current += 1;
    const start = () => {
      if (pillarUseWait.current !== null) {
        window.clearInterval(pillarUseWait.current);
        pillarUseWait.current = null;
      }
      onGenerateExecutions(
        [match],
        execution.script?.audio ?? { sound: false, music: false },
        execution.script?.look,
        execution.script?.speech,
        execution.script,
        execution.script?.durationSeconds,
        execution.script?.brandName,
        execution.script?.cta,
        execution.script?.pointOfView,
        execution.script?.decisions,
        true,
        execution.canonicalSemantic.auditLessons,
        execution.script?.medium === "image" ? execution.script.image ?? null : null,
        false,
        null,
        null,
        rememberedDevelopment(match.id),
      );
    };
    if (!labRunRef.current) {
      start();
      return;
    }
    if (pillarUseWait.current !== null) window.clearInterval(pillarUseWait.current);
    pillarUseWait.current = window.setInterval(() => {
      if (labRunRef.current) return;
      start();
    }, 100);
  };

  const onRegenerateLine = (lineId: string) => {
    if (focus?.kind !== "execution" || !focusedIdea || executionProgress) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution?.script || execution.script.medium === "image") return;
    const line = execution.script.scenes.flatMap((scene) => scene.lines).find((row) => row.id === lineId);
    if (!line?.narration.trim()) return;
    const idea = focusedIdea;
    const current = execution;
    const scriptNow = current.script;
    const token = executionCancel.current;
    void run(async () => {
      setFixingLineId(lineId);
      const previousChecks = listedExecutionChecks(current).map((check) => ({ ...check }));
      try {
        const { ancestors } = ideaParentFor(idea.angleId);
        const format = pillarFormat(current.pillarName);
        const listed = previousChecks.length > 0 ? previousChecks : emptyExecutionPassChecklist();
        const enabled = listed.filter((check) => check.enabled !== false).map((check) => check.id);
        const refused = new Set<string>([line.narration.trim().toLowerCase()]);
        const learned = [...(current.canonicalSemantic.auditLessons ?? [])];
        const learnedDuring: typeof learned = [];
        let working = scriptNow;
        let failure: { id: ExecutionPassCheck["id"]; reason: string } | null = null;
        let kept: ExecutionPassCheck["id"][] = [];
        let passed = false;
        for (let attempt = 0; attempt < fixAttemptCap() && !passed; attempt += 1) {
          if (executionCancel.current !== token) return;
          setExecutionProgress({ phase: "line", pillarName: current.pillarName });
          const raw = await askThinkingLab(
            failure
              ? buildExecutionMeaningRepairPrompt({
                  ideaStatement: idea.statement,
                  masterStatement,
                  masterSubject,
                  ancestors,
                  pillarName: current.pillarName,
                  ...format,
                  pillarDevelopment: rememberedDevelopment(current.contentPillarId),
                  checkId: failure.id,
                  reason: failure.reason,
                  script: working,
                  lineIds: [lineId],
                  lessons: learned,
                  scope: {
                    preserve: kept,
                    repair: [{ id: failure.id, reason: failure.reason }],
                  },
                })
              : buildNarrationLineRegeneratePrompt({
                  lineId,
                  enabled,
                  ideaStatement: idea.statement,
                  masterStatement,
                  masterSubject,
                  ancestors,
                  pillarName: current.pillarName,
                  ...format,
                  pillarDevelopment: rememberedDevelopment(current.contentPillarId),
                  script: working,
                  refused: [...refused],
                }),
            0.2,
          );
          if (executionCancel.current !== token) return;
          const replacement = parseExecutionNarrationReplacements(raw ? parseModelJson(raw) : null).find((row) => row.lineId === lineId);
          const narration = replacement?.narration.trim() ?? "";
          if (!narration || refused.has(narration.toLowerCase())) {
            failure = failure ?? { id: enabled[0] ?? "soundsSpoken", reason: "The new line repeated a narration that already failed." };
            continue;
          }
          refused.add(narration.toLowerCase());
          working = mergeNarrationRepairs(working, [{ lineId, narration }]);
          setExecutionDraft(working);
          setExecutionProgress({ phase: "audit", pillarName: current.pillarName });
          let liveChecks: ExecutionPassCheck[] = [];
          const checked = await runExecutionOpenChecks({
            pillar: current.pillarName,
            ...format,
            masterStatement,
            masterSubject,
            ideaStatement: idea.statement,
            ancestors,
            pillarDevelopment: rememberedDevelopment(current.contentPillarId),
            script: working,
            masterSells,
            auditLessons: learned,
            prior: regeneratePassPrior(listed),
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => {
              liveChecks = checks;
              setExecutionRunChecks(checks);
              setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
            },
          });
          if (executionCancel.current !== token) return;
          if (checked.passed) {
            const lessons = mergeExecutionAuditLessons(learned, learnedDuring);
            await labExecutions.save.mutateAsync({
              ideaId: idea.id,
              pillar: current.contentPillarId ?? current.pillar,
              contentPillarId: current.contentPillarId,
              pillarName: current.pillarName,
              statement: flattenVoiceOver(working),
              script: working,
              facts: {
                ...current.canonicalSemantic,
                ...checked.facts,
                recommendation: current.canonicalSemantic.recommendation,
                auditLessons: lessons,
              },
            });
            setExecutionChecklists((lists) => ({ ...lists, [current.id]: liveChecks.length > 0 ? liveChecks : checked.checks }));
            setExecutionRepairNote(null);
            setExecutionLineOffer(null);
            passed = true;
            return;
          }
          const failedCheck = checked.checks.find((check) => check.enabled !== false && check.state === "fail");
          if (!failedCheck) break;
          failure = { id: failedCheck.id, reason: failedCheck.reason ?? "This line no longer passes." };
          kept = checked.checks.filter((check) => check.enabled !== false && check.state === "pass").map((check) => check.id);
          const lesson = lessonFromMeaningAudit(checked.facts, working);
          if (lesson) {
            learned.push(lesson);
            learnedDuring.push(lesson);
          }
        }
        if (executionCancel.current !== token || passed) return;
        setExecutionChecklists((lists) => ({ ...lists, [current.id]: previousChecks }));
        setExecutionRunChecks(null);
        setExecutionRepairNote(
          failure?.reason
            ? `${t("thinkingLab.execution.lineKept", "This line was left as it was. The new wording did not pass the requirements that are switched on.")} ${failure.reason}`
            : t("thinkingLab.execution.lineKept", "This line was left as it was. The new wording did not pass the requirements that are switched on."),
        );
      } finally {
        setFixingLineId((currentId) => (currentId === lineId ? null : currentId));
        if (executionCancel.current === token) {
          setExecutionProgress(null);
          setExecutionDraft(null);
          setExecutionRunChecks(null);
        }
      }
    }, "execution-regenerate-line");
  };

  const onFixLine = (lineId: string) => {
    if (focus?.kind !== "execution" || !focusedIdea) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    const production = execution?.script?.productionIssues?.find((row) => row.lineId === lineId);
    const issue = production ?? (execution?.canonicalSemantic.meaningAudit ? undefined : execution?.script?.lineIssues.find((row) => row.lineId === lineId));
    if (!execution?.script || !issue) return;
    const idea = focusedIdea;
    const current = execution;
    const scriptNow = current.script as NonNullable<typeof current.script>;
    const token = executionCancel.current;
    void run(async () => {
      setFixingLineId(lineId);
      try {
      if (production) {
        const line = scriptNow.scenes.flatMap((scene) => scene.lines).find((row) => row.id === lineId);
        if (!line) return;
        setExecutionProgress({ phase: "repair", pillarName: current.pillarName });
        const raw = await askThinkingLab(
          buildProductionRepairPrompt({
            ideaStatement: idea.statement,
            pointOfView: scriptNow.pointOfView,
            lineId,
            narration: line.narration,
            reason: production.reason,
            kind: production.kind,
          }),
          0.2,
        );
        if (executionCancel.current !== token) return;
        const replacement = parseExecutionNarrationReplacements(raw ? parseModelJson(raw) : null).find((row) => row.lineId === lineId);
        if (!replacement) return;
        const merged = mergeNarrationRepairs(scriptNow, [replacement]);
        const narration = merged.scenes.flatMap((scene) => scene.lines.map((row) => ({ id: row.id, narration: row.narration })));
        const useViewpoint = production.kind === "viewpoint" && Boolean(merged.pointOfView?.trim());
        const recheckRaw = await askThinkingLab(
          useViewpoint
            ? buildViewpointAuditPrompt({
                ideaStatement: idea.statement,
                pointOfView: merged.pointOfView ?? "",
                lines: linesForProductionRecheck(narration, lineId, "viewpoint"),
              })
            : buildContinuityAuditPrompt({
                ideaStatement: idea.statement,
                lines: linesForProductionRecheck(chainNarrationLines(merged), lineId, "continuity"),
              }),
          0,
        );
        if (executionCancel.current !== token) return;
        const nextIssue = parseLineIssues(recheckRaw ? parseModelJson(recheckRaw) : null, merged).find((row) => row.lineId === lineId) ?? null;
        const productionIssues = [
          ...(scriptNow.productionIssues ?? []).filter((row) => row.lineId !== lineId),
          ...(nextIssue ? [{ ...nextIssue, kind: production.kind }] : []),
        ];
        await labExecutions.save.mutateAsync({
          ideaId: idea.id,
          pillar: current.contentPillarId ?? current.pillar,
          contentPillarId: current.contentPillarId,
          pillarName: current.pillarName,
          statement: flattenVoiceOver(merged),
          script: { ...merged, ...(productionIssues.length > 0 ? { productionIssues } : { productionIssues: undefined }) },
          facts: current.canonicalSemantic,
        });
        return;
      }
      const { ancestors } = ideaParentFor(idea.angleId);
      setExecutionProgress({ phase: "repair", pillarName: current.pillarName });
      const raw = await askThinkingLab(
        buildLineRepairPrompt({
          ideaStatement: idea.statement,
          masterStatement,
          priorBelief: selected?.priorBelief,
          ancestors,
          pillarName: current.pillarName,
          script: { ...scriptNow, lineIssues: [issue] },
        }),
        0.2,
      );
      if (executionCancel.current !== token) return;
      const replacements = parseLineReplacements(raw ? parseModelJson(raw) : null).filter((row) => row.lineId === lineId);
      if (replacements.length === 0) return;
      const merged = detachCallToAction(
        ensureBrandMention(mergeRepairedLines(scriptNow, replacements), scriptNow.brandName ?? ""),
        scriptNow.cta ?? "",
      );
      const narration = merged.scenes.flatMap((scene) => scene.lines.map((line) => ({ id: line.id, narration: line.narration })));
      let nextIssue: { lineId: string; reason: string } | null = null;
      if (merged.pointOfView?.trim()) {
        const viewpointRaw = await askThinkingLab(
          buildViewpointAuditPrompt({
            ideaStatement: idea.statement,
            pointOfView: merged.pointOfView,
            lines: linesForProductionRecheck(narration, lineId, "viewpoint"),
          }),
          0,
        );
        if (executionCancel.current !== token) return;
        nextIssue = parseLineIssues(viewpointRaw ? parseModelJson(viewpointRaw) : null, merged).find((row) => row.lineId === lineId) ?? null;
      }
      if (!nextIssue) {
        const lineRaw = await askThinkingLab(
          buildLineAuditPrompt({
            ideaStatement: idea.statement,
            masterStatement,
            priorBelief: selected?.priorBelief,
            ancestors,
            lines: chainNarrationLines(merged),
          }),
          0,
        );
        if (executionCancel.current !== token) return;
        nextIssue = parseLineIssues(lineRaw ? parseModelJson(lineRaw) : null, merged).find((row) => row.lineId === lineId) ?? null;
      }
      const script = {
        ...merged,
        lineIssues: [...scriptNow.lineIssues.filter((row) => row.lineId !== lineId), ...(nextIssue ? [nextIssue] : [])],
      };
      await labExecutions.save.mutateAsync({
        ideaId: idea.id,
        pillar: current.contentPillarId ?? current.pillar,
        contentPillarId: current.contentPillarId,
        pillarName: current.pillarName,
        statement: flattenVoiceOver(script),
        script,
        facts: current.canonicalSemantic,
      });
      } finally {
        setFixingLineId((currentId) => (currentId === lineId ? null : currentId));
        if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
      }
    }, "execution-fix-line");
  };

  const onUseExecutionOffer = () => {
    if (focus?.kind !== "execution" || !executionLineOffer || executionLineOffer.executionId !== focus.executionId) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    const offer = executionLineOffer;
    if (!execution) return;
    void run(async () => {
      await labExecutions.save.mutateAsync({
        ideaId: execution.ideaId,
        pillar: execution.contentPillarId ?? execution.pillar,
        contentPillarId: execution.contentPillarId,
        pillarName: execution.pillarName,
        statement: flattenVoiceOver(offer.script),
        script: offer.script,
        facts: offer.facts,
      });
      setExecutionLineOffer(null);
      setExecutionRepairNote(null);
    }, "execution-offer");
  };

  const onRetrySelling = () => {
    if (focus?.kind !== "execution" || !focusedIdea || !masterStatement) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution?.script) return;
    const idea = focusedIdea;
    const current = execution;
    const token = executionCancel.current;
    void run(async () => {
      const { ancestors } = ideaParentFor(idea.angleId);
      setExecutionProgress({ phase: "audit", pillarName: current.pillarName });
      const raw = await askThinkingLab(buildMasterSellsPrompt(masterStatement), 0);
      if (executionCancel.current !== token) return;
      const selling = parseMasterSells(raw ? parseModelJson(raw) : null);
      setMasterSells(selling);
      const scriptNow = current.script as NonNullable<typeof current.script>;
      setExecutionDraft(scriptNow);
      let liveChecks: ExecutionPassCheck[] = [];
      const checked = await runExecutionMeaningChecks({
        pillar: current.pillarName,
        ...pillarFormat(current.pillarName),
        masterStatement,
        masterSubject,
        ideaStatement: idea.statement,
        ancestors,
        pillarDevelopment: rememberedDevelopment(current.contentPillarId),
        script: scriptNow,
        masterSells: selling,
        auditLessons: current.canonicalSemantic.auditLessons,
        prior: listedExecutionChecks(current),
        ask: (prompt) => askThinkingLab(prompt, 0),
        onStep: (checks) => {
          liveChecks = checks;
          setExecutionRunChecks(checks);
          setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
        },
      });
      if (executionCancel.current !== token) return;
      const lesson = lessonFromMeaningAudit(checked.facts, scriptNow);
      const withLesson = lesson
        ? { ...checked.facts, auditLessons: mergeExecutionAuditLessons(checked.facts.auditLessons ?? [], [lesson]) }
        : checked.facts;
      const recommended = pillarHopStopped(current.pillarName, scriptNow, current.id)
        ? withLesson
        : await withPillarRecommendation(withLesson, current.pillarName, idea.statement, ancestors, token);
      if (executionCancel.current !== token) return;
      await labExecutions.save.mutateAsync({
        ideaId: idea.id,
        pillar: current.contentPillarId ?? current.pillar,
        contentPillarId: current.contentPillarId,
        pillarName: current.pillarName,
        statement: flattenVoiceOver(scriptNow),
        script: scriptNow,
        facts: recommended,
      });
      setExecutionChecklists((lists) => ({ ...lists, [current.id]: liveChecks }));
    }, "execution-selling").finally(() => {
      if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
    });
  };

  const onRepairExecution = () => {
    if (focus?.kind !== "execution" || !focusedIdea) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution?.script) return;
    if (execution.script.medium === "image") {
      if (!execution.script.image || !isFailedMeaningAudit(execution.canonicalSemantic.meaningAudit)) return;
      const idea = focusedIdea;
      const current = execution;
      const audit = current.canonicalSemantic.meaningAudit;
      const settings = execution.script.image;
      if (!isFailedMeaningAudit(audit)) return;
      const token = executionCancel.current;
      void run(async () => {
        const { ancestors } = ideaParentFor(idea.angleId);
        const scriptNow = current.script as NonNullable<typeof current.script>;
        setExecutionRepairNote(null);
        setExecutionLineOffer(null);
        const startingChecks = imageRecheckClaim(listedExecutionChecks(current));
        let script = scriptNow;
        let shown = startingChecks;
        const learned = imageLessons(current.canonicalSemantic.auditLessons ?? []);
        const learnedDuring: typeof learned = [];
        const refused = new Set(learned.flatMap((lesson) => lesson.lines.map((line) => line.trim().toLowerCase())));
        let passed = false;
        let latestChecks = startingChecks;
        let latestScript = scriptNow;
        let latestFacts = current.canonicalSemantic;
        const format = pillarFormat(current.pillarName);
        const saveScript = async (
          nextScript: typeof scriptNow,
          facts: ExecutionSemanticFacts,
          checks: ExecutionPassCheck[],
        ) => {
          const recommended = pillarHopStopped(current.pillarName, nextScript, current.id)
            ? facts
            : await withPillarRecommendation(facts, current.pillarName, idea.statement, ancestors, token);
          if (executionCancel.current !== token) return false;
          await labExecutions.save.mutateAsync({
            ideaId: idea.id,
            pillar: current.contentPillarId ?? current.pillar,
            contentPillarId: current.contentPillarId,
            pillarName: current.pillarName,
            statement: flattenVoiceOver(nextScript),
            script: nextScript,
            facts: {
              ...current.canonicalSemantic,
              ...recommended,
              recommendation: recommended.recommendation ?? current.canonicalSemantic.recommendation,
            },
          });
          setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
          return true;
        };
        for (let attempt = 0; attempt < fixAttemptCap() + 1 && !passed; attempt += 1) {
          if (attempt > 0) {
            const failedCheck = shown.find((check) => check.state === "fail");
            if (failedCheck?.id === "soundsSpoken") {
              const speechLines = imageSpeechRepairLines(script, failedCheck.lineIds);
              if (speechLines.length === 0) break;
              const speechLessons = learned.filter(
                (lesson) => lesson.checkId === failedCheck.id || !shown.some((check) => check.id === lesson.checkId && check.state === "pass"),
              );
              for (const speechLineId of speechLines) {
                const line = script.scenes.flatMap((scene) => scene.lines).find((row) => row.id === speechLineId);
                if (line?.narration.trim()) refused.add(line.narration.trim().toLowerCase());
              }
              setExecutionProgress({ phase: "repair", pillarName: current.pillarName, medium: "image" });
              const rawSpeech = await askThinkingLab(
                buildImageSpeechRepairPrompt({
                  pillar: current.pillarName,
                  ...format,
                  masterStatement,
                  ideaStatement: idea.statement,
                  ancestors,
                  script,
                  image: settings,
                  lineIds: speechLines,
                  reason: failedCheck.reason ?? "",
                  lessons: speechLessons,
                }),
                0.2,
              );
              if (executionCancel.current !== token) return;
              const freshSpeech = parseImageSpeechRepairs(rawSpeech ? parseModelJson(rawSpeech) : null).filter(
                (row) => speechLines.includes(row.lineId) && row.narration.trim() && !refused.has(row.narration.trim().toLowerCase()),
              );
              if (freshSpeech.length === 0) {
                const lesson = {
                  checkId: failedCheck.id,
                  reason: "No replacement came back.",
                  lines: speechLines.flatMap((id) => {
                    const line = script.scenes.flatMap((scene) => scene.lines).find((row) => row.id === id);
                    return line?.narration.trim() ? [line.narration.trim()] : [];
                  }),
                };
                learned.push(lesson);
                learnedDuring.push(lesson);
                continue;
              }
              for (const row of freshSpeech) script = mergeImageSlideRepair(script, row, settings);
              shown = imageChecksAfterSlideRewrite(shown, failedCheck.id);
            } else {
            const captionRepair =
              failedCheck?.id === "emotionalTone" &&
              failedCheck.lineIds?.length === 1 &&
              failedCheck.lineIds[0] === "caption" &&
              settings.format === "single";
            const lineId = captionRepair
              ? "caption"
              : failedCheck
                ? imageSlideRepairLine(script, failedCheck.lineIds, failedCheck.reason)
                : null;
            const ready = captionRepair
              ? true
              : failedCheck && lineId
                ? imageSlideRepairReady(
                    {
                      ...current.canonicalSemantic,
                      meaningAudit: { id: failedCheck.id, reason: failedCheck.reason ?? "", lineIds: [lineId] },
                    },
                    { ...script, medium: "image", image: settings },
                  )
                : false;
            if (!failedCheck || !lineId || !ready) break;
            if (captionRepair) {
              const oldCaption = script.caption.trim();
              refused.add(oldCaption.toLowerCase());
              setExecutionProgress({ phase: "repair", pillarName: current.pillarName, medium: "image" });
              const rawCaption = await askThinkingLab(
                buildImageSlideRepairPrompt({
                  id: failedCheck.id,
                  pillar: current.pillarName,
                  ...format,
                  masterStatement,
                  ideaStatement: idea.statement,
                  ancestors,
                  pillarDevelopment: rememberedDevelopment(current.contentPillarId),
                  script,
                  image: settings,
                  lineId,
                  reason: failedCheck.reason ?? "",
                  lessons: learned.filter((lesson) => lesson.checkId === failedCheck.id || !shown.some((check) => check.id === lesson.checkId && check.state === "pass")),
                }),
                0.2,
              );
              if (executionCancel.current !== token) return;
              const captionReplacement = parseImageSlideRepair(rawCaption ? parseModelJson(rawCaption) : null);
              const caption = captionReplacement?.narration.trim() ?? "";
              if (!captionReplacement || captionReplacement.lineId !== "caption" || !caption || caption.toLowerCase() === oldCaption.toLowerCase() || refused.has(caption.toLowerCase())) {
                const lesson = {
                  checkId: failedCheck.id,
                  reason: "No replacement came back.",
                  lines: [oldCaption],
                };
                learned.push(lesson);
                learnedDuring.push(lesson);
                continue;
              }
              script = { ...script, caption };
              shown = imageChecksAfterSlideRewrite(shown, failedCheck.id);
            } else {
            const line = script.scenes.flatMap((scene) => scene.lines).find((row) => row.id === lineId);
            if (!line) break;
            const oldNarration = line.narration.trim();
            const oldPrompt = line.shots.find((shot) => shot.prompt.trim())?.prompt.trim() ?? "";
            refused.add(oldNarration.toLowerCase());
            setExecutionProgress({ phase: "repair", pillarName: current.pillarName, medium: "image" });
            const raw = await askThinkingLab(
              buildImageSlideRepairPrompt({
                id: failedCheck.id,
                pillar: current.pillarName,
                ...format,
                masterStatement,
                ideaStatement: idea.statement,
                ancestors,
                pillarDevelopment: rememberedDevelopment(current.contentPillarId),
                script,
                image: settings,
                lineId,
                reason: failedCheck.reason ?? "",
                lessons: learned.filter((lesson) => lesson.checkId === failedCheck.id || !shown.some((check) => check.id === lesson.checkId && check.state === "pass")),
              }),
              0.2,
            );
            if (executionCancel.current !== token) return;
            const replacement = parseImageSlideRepair(raw ? parseModelJson(raw) : null);
            const narration = failedCheck.id === "imagePrompt" ? oldNarration : replacement?.narration ?? "";
            const prompt = replacement?.prompt.trim() ?? "";
            const repeated =
              failedCheck.id === "imagePrompt"
                ? !prompt || prompt.toLowerCase() === oldPrompt.toLowerCase()
                : !narration || narration.toLowerCase() === oldNarration.toLowerCase() || refused.has(narration.toLowerCase());
            if (!replacement || replacement.lineId !== lineId || repeated) {
              const lesson = {
                checkId: failedCheck.id,
                reason: "No replacement came back.",
                lines: [oldNarration],
              };
              learned.push(lesson);
              learnedDuring.push(lesson);
              continue;
            }
            script = mergeImageSlideRepair(script, { lineId, narration, prompt }, settings);
            shown = imageChecksAfterSlideRewrite(shown, failedCheck.id);
            }
            }
          }
          setExecutionDraft(script);
          setExecutionProgress({ phase: "audit", pillarName: current.pillarName, medium: "image" });
          let liveChecks: ExecutionPassCheck[] = [];
          const checked = await runImageOpenChecks({
            pillar: current.pillarName,
            ...format,
            masterStatement,
            ideaStatement: idea.statement,
            ancestors,
            pillarDevelopment: rememberedDevelopment(current.contentPillarId),
            script,
            image: settings,
            masterSells: masterSells === "unknown" ? "unresolved" : masterSells,
            auditLessons: learned,
            prior: shown,
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => {
              liveChecks = checks;
              setExecutionRunChecks(checks);
              setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
            },
          });
          if (executionCancel.current !== token) return;
          latestChecks = liveChecks.length > 0 ? liveChecks : checked.checks;
          latestScript = script;
          latestFacts = checked.facts;
          if (!checked.passed) {
            const lesson = lessonFromMeaningAudit(checked.facts, script);
            if (lesson) {
              learned.push(lesson);
              learnedDuring.push(lesson);
              for (const line of lesson.lines) refused.add(line.trim().toLowerCase());
            }
            shown = checked.checks;
            continue;
          }
          const saved = await saveScript(script, {
            ...checked.facts,
            auditLessons: mergeExecutionAuditLessons(learned, learnedDuring),
          }, checked.checks);
          if (!saved) return;
          setExecutionLineOffer(null);
          passed = true;
        }
        if (passed || executionCancel.current !== token) return;
        const lessons = mergeExecutionAuditLessons(current.canonicalSemantic.auditLessons ?? [], learnedDuring);
        if (latestScript !== scriptNow || imageFailureMoved(audit.id, latestChecks)) {
          await saveScript(latestScript, { ...latestFacts, auditLessons: lessons }, latestChecks);
          return;
        }
        await labExecutions.save.mutateAsync({
          ideaId: idea.id,
          pillar: current.contentPillarId ?? current.pillar,
          contentPillarId: current.contentPillarId,
          pillarName: current.pillarName,
          statement: flattenVoiceOver(scriptNow),
          script: scriptNow,
          facts: { ...current.canonicalSemantic, auditLessons: lessons },
        });
        setExecutionChecklists((lists) => ({ ...lists, [current.id]: startingChecks }));
      }, "execution-repair").finally(() => {
        if (executionCancel.current === token) {
          setExecutionProgress(null);
          setExecutionDraft(null);
          setExecutionRunChecks(null);
        }
      });
      return;
    }
    if (meaningLineRepairReady(execution.canonicalSemantic)) {
      const idea = focusedIdea;
      const current = execution;
      const audit = current.canonicalSemantic.meaningAudit;
      if (!isFailedMeaningAudit(audit)) return;
      const token = executionCancel.current;
      void run(async () => {
        const { ancestors } = ideaParentFor(idea.angleId);
        const scriptNow = current.script as NonNullable<typeof current.script>;
        setExecutionRepairNote(null);
        setExecutionLineOffer(null);
        const storedChecks = executionChecklists[current.id];
        const startingChecks =
          storedChecks?.some((check) => check.state === "pass" || check.state === "fail")
            ? storedChecks
            : executionChecksFromAudit(audit);
        let script = scriptNow;
        let shown = startingChecks;
        const learned = [...(current.canonicalSemantic.auditLessons ?? [])];
        const learnedDuring: typeof learned = [];
        const refused = new Set(learned.flatMap((lesson) => lesson.lines.map((line) => line.trim().toLowerCase())));
        let passed = false;
        let latestChecks = startingChecks;
        let latestScript = scriptNow;
        for (let attempt = 0; attempt < fixAttemptCap() && !passed; attempt += 1) {
          const failedCheck = shown.find((check) => check.state === "fail");
          const lineIds = failedCheck?.lineIds ?? [];
          if (!failedCheck || !EXECUTION_LINE_REPAIR_IDS.some((id) => id === failedCheck.id) || lineIds.length === 0) break;
          const failingLines = script.scenes
            .flatMap((scene) => scene.lines)
            .filter((line) => lineIds.includes(line.id));
          for (const line of failingLines) refused.add(line.narration.trim().toLowerCase());
          const scope: FixScope = {
            preserve: shown.filter((check) => check.state === "pass").map((check) => check.id),
            repair: [{ id: failedCheck.id, reason: failedCheck.reason }],
          };
          setExecutionProgress({ phase: "repair", pillarName: current.pillarName });
          const raw = await askThinkingLab(
            buildExecutionMeaningRepairPrompt({
              ideaStatement: idea.statement,
              masterStatement,
              masterSubject,
              ancestors,
              pillarName: current.pillarName,
              ...pillarFormat(current.pillarName),
              pillarDevelopment: rememberedDevelopment(current.contentPillarId),
              checkId: failedCheck.id,
              reason: failedCheck.reason ?? "",
              script,
              lineIds,
              lessons: learned.filter((lesson) => !scope.preserve.includes(lesson.checkId)),
              scope,
            }),
            0.2,
          );
          if (executionCancel.current !== token) return;
          const replacements = parseExecutionNarrationReplacements(raw ? parseModelJson(raw) : null).filter((row) =>
            lineIds.includes(row.lineId),
          );
          const fresh = replacements.filter((row) => !refused.has(row.narration.trim().toLowerCase()));
          const speechRepair = failedCheck.id === "soundsSpoken" || failedCheck.id === "usesSlang";
          if (fresh.length === 0 || (!speechRepair && fresh.length !== replacements.length)) {
            const lesson = {
              checkId: failedCheck.id,
              reason: replacements.length === 0 ? "No replacement came back." : "This narration was offered again after it already failed.",
              lines: replacements.map((row) => row.narration.trim()).filter(Boolean),
            };
            learned.push(lesson);
            learnedDuring.push(lesson);
            continue;
          }
          const merged = mergeNarrationRepairs(script, fresh);
          setExecutionDraft(merged);
          setExecutionProgress({ phase: "audit", pillarName: current.pillarName });
          let liveChecks: ExecutionPassCheck[] = [];
          const checked = await runExecutionOpenChecks({
            pillar: current.pillarName,
        ...pillarFormat(current.pillarName),
            masterStatement,
            masterSubject,
            ideaStatement: idea.statement,
            ancestors,
            pillarDevelopment: rememberedDevelopment(current.contentPillarId),
            script: merged,
            masterSells,
            auditLessons: learned,
            prior: shown,
            ask: (prompt) => askThinkingLab(prompt, 0),
            resolveSelling: async () => {
              const sellingRaw = await askThinkingLab(buildMasterSellsPrompt(masterStatement), 0);
              const value = parseMasterSells(sellingRaw ? parseModelJson(sellingRaw) : null);
              setMasterSells(value);
              return value;
            },
            onStep: (checks) => {
              liveChecks = checks;
              setExecutionRunChecks(checks);
              setExecutionChecklists((lists) => ({ ...lists, [current.id]: checks }));
            },
          });
          if (executionCancel.current !== token) return;
          latestChecks = liveChecks.length > 0 ? liveChecks : checked.checks;
          latestScript = merged;
          if (!checked.passed) {
            const lesson = lessonFromMeaningAudit(checked.facts, merged);
            if (lesson) {
              learned.push(lesson);
              learnedDuring.push(lesson);
              for (const line of lesson.lines) refused.add(line.trim().toLowerCase());
            }
            shown = checked.checks;
            script = merged;
            continue;
          }
          await labExecutions.save.mutateAsync({
            ideaId: idea.id,
            pillar: current.contentPillarId ?? current.pillar,
            contentPillarId: current.contentPillarId,
            pillarName: current.pillarName,
            statement: flattenVoiceOver(merged),
            script: merged,
            facts: {
              ...current.canonicalSemantic,
              ...checked.facts,
              recommendation: current.canonicalSemantic.recommendation,
              auditLessons: mergeExecutionAuditLessons(learned, learnedDuring),
            },
          });
          setExecutionChecklists((lists) => ({ ...lists, [current.id]: checked.checks }));
          setExecutionLineOffer(null);
          passed = true;
        }
        if (passed || executionCancel.current !== token) return;
        const moved =
          (audit.id === "soundsSpoken" && latestScript !== scriptNow) ||
          (latestScript !== scriptNow && executionFailureMoved(audit.id, latestChecks));
        const lessons = mergeExecutionAuditLessons(current.canonicalSemantic.auditLessons ?? [], learnedDuring);
        if (moved) {
          const carriedFacts = executionFactsFromChecks({
            pillar: current.pillarName,
            checks: latestChecks,
            masterSells: current.canonicalSemantic.masterSells,
            auditLessons: lessons,
          });
          await labExecutions.save.mutateAsync({
            ideaId: idea.id,
            pillar: current.contentPillarId ?? current.pillar,
            contentPillarId: current.contentPillarId,
            pillarName: current.pillarName,
            statement: flattenVoiceOver(latestScript),
            script: latestScript,
            facts: {
              ...current.canonicalSemantic,
              ...carriedFacts,
              recommendation: current.canonicalSemantic.recommendation,
            },
          });
          setExecutionChecklists((lists) => ({ ...lists, [current.id]: latestChecks }));
          return;
        }
        await labExecutions.save.mutateAsync({
          ideaId: idea.id,
          pillar: current.contentPillarId ?? current.pillar,
          contentPillarId: current.contentPillarId,
          pillarName: current.pillarName,
          statement: flattenVoiceOver(scriptNow),
          script: scriptNow,
          facts: {
            ...current.canonicalSemantic,
            auditLessons: lessons,
          },
        });
        setExecutionChecklists((lists) => ({ ...lists, [current.id]: startingChecks }));
      }, "execution-repair").finally(() => {
        if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
      });
      return;
    }
    if (!scriptLineRepairReady(execution.canonicalSemantic, execution.script)) return;
    const idea = focusedIdea;
    const current = execution;
    const token = executionCancel.current;
    void run(async () => {
      const { ancestors } = ideaParentFor(idea.angleId);
      const scriptNow = current.script as NonNullable<typeof current.script>;
      const lines = chainNarrationLines(scriptNow);
      setExecutionDraft(scriptNow);
      setExecutionProgress({ phase: "audit", pillarName: current.pillarName });
      const firstRaw = await askThinkingLab(
        buildLineAuditPrompt({
          ideaStatement: idea.statement,
          masterStatement,
          priorBelief: selected?.priorBelief,
          ancestors,
          lines,
        }),
        0,
      );
      if (executionCancel.current !== token) return;
      const issues = parseLineIssues(firstRaw ? parseModelJson(firstRaw) : null, scriptNow);
      if (issues.length === 0) {
        const statement = storyVoiceOver(scriptNow);
        if (!statement) return;
        const facts = await judgeAndSealExecution({
          masterStatement,
          masterSubject,
          ideaStatement: idea.statement,
          pillar: current.pillarName,
          ancestors,
          statement,
          ask: (prompt) => askThinkingLab(prompt, 0),
        });
        if (executionCancel.current !== token) return;
        const recommended = pillarHopStopped(current.pillarName, scriptNow, current.id)
          ? facts
          : await withPillarRecommendation(facts, current.pillarName, idea.statement, ancestors, token);
        if (executionCancel.current !== token) return;
        await labExecutions.save.mutateAsync({
          ideaId: idea.id,
          pillar: current.contentPillarId ?? current.pillar,
          contentPillarId: current.contentPillarId,
          pillarName: current.pillarName,
          statement,
          script: { ...scriptNow, lineIssues: [] },
          facts: recommended,
        });
        return;
      }
      setExecutionProgress({ phase: "repair", pillarName: current.pillarName });
      const raw = await askThinkingLab(
        buildLineRepairPrompt({
          ideaStatement: idea.statement,
          masterStatement,
          priorBelief: selected?.priorBelief,
          ancestors,
          pillarName: current.pillarName,
          script: { ...scriptNow, lineIssues: issues },
        }),
        0.2,
      );
      if (executionCancel.current !== token) return;
      const merged = detachCallToAction(
        ensureBrandMention(
          mergeRepairedLines(scriptNow, parseLineReplacements(raw ? parseModelJson(raw) : null)),
          scriptNow.brandName ?? "",
        ),
        scriptNow.cta ?? "",
      );
      const statement = storyVoiceOver(merged);
      if (!statement) return;
      setExecutionDraft(merged);
      setExecutionProgress({ phase: "audit", pillarName: current.pillarName });
      const facts = await judgeAndSealExecution({
        masterStatement,
        masterSubject,
        ideaStatement: idea.statement,
        pillar: current.pillarName,
        ancestors,
        statement,
        ask: (prompt) => askThinkingLab(prompt, 0),
      });
      if (executionCancel.current !== token) return;
      const lineRaw = await askThinkingLab(
        buildLineAuditPrompt({
          ideaStatement: idea.statement,
          masterStatement,
          priorBelief: selected?.priorBelief,
          ancestors,
          lines: chainNarrationLines(merged),
        }),
        0,
      );
      if (executionCancel.current !== token) return;
      const recommended = pillarHopStopped(current.pillarName, merged, current.id)
        ? facts
        : await withPillarRecommendation(facts, current.pillarName, idea.statement, ancestors, token);
      if (executionCancel.current !== token) return;
      const script = { ...merged, lineIssues: parseLineIssues(lineRaw ? parseModelJson(lineRaw) : null, merged) };
      await labExecutions.save.mutateAsync({
        ideaId: idea.id,
        pillar: current.contentPillarId ?? current.pillar,
        contentPillarId: current.contentPillarId,
        pillarName: current.pillarName,
        statement: flattenVoiceOver(script),
        script,
        facts: recommended,
      });
    }, "execution-repair").finally(() => {
      if (executionCancel.current === token) {
        setExecutionProgress(null);
        setExecutionDraft(null);
        setExecutionRunChecks(null);
      }
    });
  };

  const repairFailedAngles = async (onlyCode?: string) => {
    if (!focusedTerritory || !masters.organizationId || !parentFp || admittedAngles.length === 0) return;
    const subjectOpen = (row: (typeof admittedAngles)[number]) =>
      Boolean(angleSubjectProblem(row.canonicalSemantic.subject ?? "", focusedTerritory.statement));
    const exampleOpen = (row: (typeof admittedAngles)[number]) =>
      Boolean(angleExampleProblem(row.canonicalSemantic.example ?? "", row.statement));
    const failed = admittedAngles.filter((row, index) => {
      const checklistFailed = (angleChecklists[row.code.toUpperCase()]?.checks ?? []).some(
        (check) => check.state === "fail",
      );
      if (angleVerdicts[index] !== "AUDIT_FAIL" && !checklistFailed && !subjectOpen(row) && !exampleOpen(row)) return false;
      return !onlyCode || row.code.toUpperCase() === onlyCode.toUpperCase();
    });
    if (failed.length === 0) return;
    const keepers = admittedAngles.filter(
      (row, index) => angleVerdicts[index] === "AUDIT_PASS" && !subjectOpen(row) && !exampleOpen(row),
    );
    const applied = new Map<string, string>();
    let setRecord = {
      schema: "thinking-lab/angle-set/v1" as const,
      repairCount: angleSet.data?.repairCount ?? 0,
      siblingSet: storedAngleSet,
      audit: angleSet.data?.audit ?? null,
      challenger: angleSet.data?.challenger ?? null,
      auditLessons: [...(angleSet.data?.auditLessons ?? [])],
    };
    for (const row of failed) {
      const learned = [...usableAngleFixLessons(setRecord.auditLessons, row.code)];
      const refused = new Set(setRecord.auditLessons.map((lesson) => lesson.statement.trim().toLowerCase()));
      refused.add(row.statement.trim().toLowerCase());
      const storedFailure = setRecord.audit?.items.find((item) => item.code.toUpperCase() === row.code.toUpperCase());
      const alreadyPassed =
        storedFailure?.verdict === "AUDIT_PASS" ||
        angleVerdicts[admittedAngles.findIndex((item) => item.id === row.id)] === "AUDIT_PASS";
      let shown = angleChecklists[row.code.toUpperCase()]?.checks ?? [];
      if (shown.length === 0) {
        shown = angleChecksFromStored({
          generatePasses: row.canonicalSemantic.generatePasses,
          gateFailure: alreadyPassed || storedFailure?.verdict !== "AUDIT_FAIL" ? null : (storedFailure.gateFailure ?? null),
          passed: alreadyPassed,
        });
      }
      let scope: FixScope = scopeFromHistory(shown, learned);
      const rememberFixLesson = async (lesson: { code: string; statement: string; reason: string }) => {
        learned.push(lesson);
        refused.add(lesson.statement.trim().toLowerCase());
        setRecord = {
          ...setRecord,
          auditLessons: mergeAngleAuditLessons(setRecord.auditLessons, [lesson]),
        };
        await angleSet.save.mutateAsync(setRecord);
      };
      const sealAnglePass = async (statement: string, subject: string, example: string) => {
        await labAngles.replace.mutateAsync({
          territoryId: focusedTerritory.id,
          id: row.id,
          statement,
          facts: {
            ...row.canonicalSemantic,
            ...shownAngleFacts(row.code, statement, subject, example),
            code: row.code,
            generatePasses: ["observation"],
          },
          admission: "GENERATE_VALID",
        });
        const codeKey = row.code.toUpperCase();
        const statementFingerprint = angleFingerprint({
          statement,
          territoryFingerprint: parentTerritoryFingerprint,
        });
        const previousItems = setRecord.audit?.items ?? [];
        const items = previousItems.some((item) => item.code.toUpperCase() === codeKey)
          ? previousItems.map((item) =>
              item.code.toUpperCase() === codeKey
                ? { code: row.code, verdict: "AUDIT_PASS" as const, statementFingerprint, ...skippedMark("angle") }
                : item,
            )
          : [...previousItems, { code: row.code, verdict: "AUDIT_PASS" as const, statementFingerprint, ...skippedMark("angle") }];
        setRecord = {
          ...setRecord,
          audit: { fingerprint: setRecord.audit?.fingerprint ?? "", items },
        };
        await angleSet.save.mutateAsync(setRecord);
        applied.set(codeKey, statement);
      };
      const judgeFixSibling = async (statement: string, checks: AnglePassCheck[]) => {
        const siblingRows = [
          ...keepers
            .filter((item) => item.code.toUpperCase() !== row.code.toUpperCase())
            .map((item) => ({ code: item.code, statement: item.statement })),
          { code: row.code, statement },
        ];
        if (siblingRows.length < 2 || skipFor("angle").includes("siblingsDistinct")) {
          return { pass: true, reason: "", settled: finishAngleSiblingCheck(checks, true, "") };
        }
        const siblingFingerprint = angleSetFingerprint({
          territoryFingerprint: parentTerritoryFingerprint,
          angleFingerprints: siblingRows.map((item) =>
            angleFingerprint({ statement: item.statement, territoryFingerprint: parentTerritoryFingerprint }),
          ),
        });
        const siblingScript = await askThinkingLab(
          buildAngleSiblingPrompt({ parentStatement: focusedTerritory.statement, rows: siblingRows }),
          0,
        );
        const siblingSet = parseAngleSet(siblingScript, siblingFingerprint);
        const pass = angleReplacementPasses(siblingSet, row.code);
        const reason = pass
          ? ""
          : (angleFailureLessons({
              rows: [{ code: row.code, statement }],
              items: [{ code: row.code, verdict: "AUDIT_FAIL" }],
              siblingSet,
            })[0]?.reason ?? "Sibling audit failed this Angle.");
        return { pass, reason, settled: finishAngleSiblingCheck(checks, pass, reason) };
      };
      const subjectProblem = angleSubjectProblem(row.canonicalSemantic.subject ?? "", focusedTerritory.statement);
      const exampleProblem = angleExampleProblem(row.canonicalSemantic.example ?? "", row.statement);
      const otherFail = shown.some((check) => check.state === "fail" && check.id !== "ownSubject");
      const storedPass = alreadyPassed;
      if (subjectProblem && !otherFail) {
        shown = shown.some((check) => check.id === "ownSubject")
          ? shown.map((check) =>
              check.id === "ownSubject" ? { id: "ownSubject", state: "fail" as const, reason: subjectProblem } : check,
            )
          : [...shown, { id: "ownSubject", state: "fail" as const, reason: subjectProblem }];
        const livePassed = shown.filter((check) => check.state === "pass").map((check) => check.id);
        const passed =
          livePassed.length > 0
            ? livePassed
            : storedPass
              ? ["stakeHolds", "observation", "rightSize", "siblingsDistinct"]
              : [];
        scope = {
          preserve: [...new Set([...scope.preserve, ...passed])],
          repair: [{ id: "ownSubject", reason: subjectProblem }],
        };
      } else if (exampleProblem && !shown.some((check) => check.state === "fail" && check.id !== "livedExample")) {
        shown = shown.some((check) => check.id === "livedExample")
          ? shown.map((check) =>
              check.id === "livedExample" ? { id: "livedExample", state: "fail" as const, reason: exampleProblem } : check,
            )
          : [...shown, { id: "livedExample", state: "fail" as const, reason: exampleProblem }];
        const livePassed = shown.filter((check) => check.state === "pass").map((check) => check.id);
        const passed =
          livePassed.length > 0
            ? livePassed
            : storedPass
              ? [
                  "stakeHolds",
                  "observation",
                  "rightSize",
                  "ownSubject",
                  "siblingsDistinct",
                ]
              : [];
        scope = {
          preserve: [...new Set([...scope.preserve, ...passed])],
          repair: [{ id: "livedExample", reason: exampleProblem }],
        };
      }
      let currentStatement = row.statement;
      let currentSubject = row.canonicalSemantic.subject ?? "";
      let currentExample = row.canonicalSemantic.example ?? "";
      let offered = false;
      for (let attempt = 0; attempt < fixAttemptCap() && !offered; attempt += 1) {
        if (scope.repair.length === 1 && scope.repair[0]?.id === "ownSubject") {
          const subjectScript = await askThinkingLab(
            buildAngleSubjectPrompt({ territory: focusedTerritory.statement, statement: currentStatement }),
            0.2,
          );
          const subject = parseAngleSubjectScript(subjectScript);
          const problem = angleSubjectProblem(subject, focusedTerritory.statement);
          if (!subject || problem) {
            const reason = problem || "No subject came back.";
            await rememberFixLesson({
              code: row.code,
              statement: subject || currentStatement,
              reason: `ownSubject: ${reason}`,
            });
            continue;
          }
          currentSubject = subject;
          const prior: AnglePassCheck[] =
            shown.length > 0
              ? shown
              : scope.preserve.map((id) => ({ id: id as AnglePassCheck["id"], state: "pass" as const }));
          const checked = await runAngleOpenChecks({
            skip: skipFor("angle"),
            batch: true,
            statement: currentStatement,
            parentStatement: focusedTerritory.statement,
            ancestors: angleAncestors,
            subject,
            example: currentExample,
            prior,
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => publishAngleChecklist(row.code, checks),
          });
          if (!checked.passed) {
            const failedCheck = checked.checks.find((check) => check.state === "fail");
            const reason = failedCheck
              ? `${failedCheck.id}: ${failedCheck.reason ?? ""}`.trim()
              : "This check could not be decided.";
            await rememberFixLesson({ code: row.code, statement: currentStatement, reason });
            shown = checked.checks;
            scope = fixScopeFromChecks(checked.checks);
            continue;
          }
          const siblingPassed = scope.preserve.includes("siblingsDistinct");
          if (siblingPassed) {
            const passedChecks = checked.checks.map((check) =>
              check.id === "siblingsDistinct" ? { id: check.id, state: "pass" as const } : check,
            );
            publishAngleChecklist(row.code, passedChecks);
            await sealAnglePass(currentStatement, subject, currentExample);
            offered = true;
            continue;
          }
          publishAngleChecklist(row.code, beginAngleSiblingCheck(checked.checks));
          const sibling = await judgeFixSibling(currentStatement, checked.checks);
          if (!sibling.pass) {
            await rememberFixLesson({
              code: row.code,
              statement: currentStatement,
              reason: `siblingsDistinct: ${sibling.reason}`,
            });
            shown = sibling.settled;
            publishAngleChecklist(row.code, sibling.settled);
            scope = fixScopeFromChecks(sibling.settled);
            continue;
          }
          publishAngleChecklist(row.code, sibling.settled);
          await sealAnglePass(currentStatement, subject, currentExample);
          offered = true;
          continue;
        }
        if (scope.repair.length === 1 && scope.repair[0]?.id === "livedExample") {
          const exampleScript = await askThinkingLab(
            buildAngleExamplePrompt({
              territory: focusedTerritory.statement,
              statement: currentStatement,
              refused: [...refused],
            }),
            0.2,
          );
          const example = parseAngleExampleScript(exampleScript);
          const problem = angleExampleProblem(example, currentStatement);
          if (!example || problem || refused.has(example.trim().toLowerCase())) {
            const reason = problem || "No example came back.";
            await rememberFixLesson({
              code: row.code,
              statement: example || currentStatement,
              reason: `livedExample: ${reason}`,
            });
            continue;
          }
          currentExample = example;
          const prior: AnglePassCheck[] =
            shown.length > 0
              ? shown
              : scope.preserve.map((id) => ({ id: id as AnglePassCheck["id"], state: "pass" as const }));
          const checked = await runAngleOpenChecks({
            skip: skipFor("angle"),
            batch: true,
            statement: currentStatement,
            parentStatement: focusedTerritory.statement,
            ancestors: angleAncestors,
            subject: currentSubject,
            example,
            prior,
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => publishAngleChecklist(row.code, checks),
          });
          if (!checked.passed) {
            const failedCheck = checked.checks.find((check) => check.state === "fail");
            const reason = failedCheck
              ? `${failedCheck.id}: ${failedCheck.reason ?? ""}`.trim()
              : "This check could not be decided.";
            await rememberFixLesson({ code: row.code, statement: currentStatement, reason });
            shown = checked.checks;
            scope = fixScopeFromChecks(checked.checks);
            continue;
          }
          const siblingPassed = scope.preserve.includes("siblingsDistinct");
          if (siblingPassed) {
            const passedChecks = checked.checks.map((check) =>
              check.id === "siblingsDistinct" ? { id: check.id, state: "pass" as const } : check,
            );
            publishAngleChecklist(row.code, passedChecks);
            await sealAnglePass(currentStatement, currentSubject, example);
            offered = true;
            continue;
          }
          publishAngleChecklist(row.code, beginAngleSiblingCheck(checked.checks));
          const sibling = await judgeFixSibling(currentStatement, checked.checks);
          if (!sibling.pass) {
            await rememberFixLesson({
              code: row.code,
              statement: currentStatement,
              reason: `siblingsDistinct: ${sibling.reason}`,
            });
            shown = sibling.settled;
            publishAngleChecklist(row.code, sibling.settled);
            scope = fixScopeFromChecks(sibling.settled);
            continue;
          }
          publishAngleChecklist(row.code, sibling.settled);
          await sealAnglePass(currentStatement, currentSubject, example);
          offered = true;
          continue;
        }
        const script = await askThinkingLab(
          buildAngleFixOptionsPrompt({
            parentStatement: focusedTerritory.statement,
            ancestors: angleAncestors,
            failed: { code: row.code, statement: currentStatement },
            keepers: keepers
              .filter((keeper) => keeper.code.toUpperCase() !== row.code.toUpperCase())
              .map((keeper) => ({ code: keeper.code, statement: keeper.statement })),
            conflicts: angleNotes,
            lessons: learned,
            scope,
          }),
          0.2,
        );
        const candidates = parseAngleFixOptionsScript(script);
        const namedSubject = parseAngleSubjectScript(script);
        const namedExample = parseAngleExampleScript(script);
        const subjectForCheck = namedSubject || currentSubject;
        const exampleForCheck = scope.preserve.includes("livedExample") ? currentExample : namedExample;
        const statement = candidates.find((candidate) => !refused.has(candidate.trim().toLowerCase()));
        if (!statement) {
          if (candidates.length === 0) {
            await rememberFixLesson({ code: row.code, statement: row.statement, reason: "No replacement came back." });
          } else {
            for (const candidate of candidates) {
              await rememberFixLesson({
                code: row.code,
                statement: candidate,
                reason: "This sentence was offered again after it already failed.",
              });
            }
          }
          continue;
        }
        const checked = await runAngleOpenChecks({
          skip: skipFor("angle"),
          batch: true,
          statement,
          parentStatement: focusedTerritory.statement,
          ancestors: angleAncestors,
          subject: subjectForCheck,
          example: exampleForCheck,
          prior: fixPriorForNextAngleStatement(shown, currentStatement, statement),
          ask: (prompt) => askThinkingLab(prompt, 0),
          onStep: (checks) => publishAngleChecklist(row.code, checks),
        });
        if (!checked.passed) {
          const failedCheck = checked.checks.find((check) => check.state === "fail");
          const reason = failedCheck ? `${failedCheck.id}: ${failedCheck.reason ?? ""}`.trim() : "This check could not be decided.";
          await rememberFixLesson({ code: row.code, statement, reason });
          if (exampleForCheck) refused.add(exampleForCheck.trim().toLowerCase());
          shown = checked.checks;
          scope = fixScopeFromChecks(checked.checks);
          continue;
        }
        publishAngleChecklist(row.code, beginAngleSiblingCheck(checked.checks));
        const sibling = await judgeFixSibling(statement, checked.checks);
        if (!sibling.pass) {
          await rememberFixLesson({ code: row.code, statement, reason: `siblingsDistinct: ${sibling.reason}` });
          shown = sibling.settled;
          publishAngleChecklist(row.code, sibling.settled);
          scope = fixScopeFromChecks(sibling.settled);
          continue;
        }
        publishAngleChecklist(row.code, sibling.settled);
        await sealAnglePass(statement, subjectForCheck, exampleForCheck);
        offered = true;
      }
    }
    const replaced = new Set(failed.map((row) => row.code.toUpperCase()));
    setAngleFixOffers((current) =>
      current.filter(
        (offer) => offer.territoryId !== focusedTerritory.id || !replaced.has(offer.failedCode.toUpperCase()),
      ),
    );
    const covered = applied.size;
    if (covered > 0) {
      const items = admittedAngles.flatMap((row, index) => {
        const code = row.code.toUpperCase();
        const previous = setRecord.audit?.items.find((item) => item.code.toUpperCase() === code);
        const statement = applied.get(code) ?? row.statement;
        const verdict = applied.has(code) ? ("AUDIT_PASS" as const) : angleVerdicts[index];
        if (verdict !== "AUDIT_PASS" && verdict !== "AUDIT_FAIL") return [];
        return [
          {
            code: row.code,
            verdict,
            statementFingerprint: angleFingerprint({
              statement,
              territoryFingerprint: parentTerritoryFingerprint,
            }),
            ...(verdict === "AUDIT_FAIL" && previous?.gateFailure ? { gateFailure: previous.gateFailure } : {}),
          },
        ];
      });
      await angleSet.save.mutateAsync({
        ...setRecord,
        repairCount: setRecord.repairCount + 1,
        siblingSet: null,
        audit: items.length > 0 ? { fingerprint: "", items } : setRecord.audit,
        challenger: null,
      });
    }
    if (covered < failed.length) {
      setNotice(
        t("thinkingLab.angle.noSafeReplacement", "NO_SAFE_REPLACEMENT {{count}}/{{failed}}", {
          count: covered,
          failed: failed.length,
        }),
      );
    } else {
      setNotice(null);
    }
  };

  const onFixAngle = (code: string) => {
    const key = code.trim().toUpperCase();
    if (!key || fixingAngleCodesRef.current.has(key)) return;
    fixingAngleCodesRef.current.add(key);
    setFixingAngleCodes(new Set(fixingAngleCodesRef.current));
    void (async () => {
      try {
        await repairFailedAngles(code);
      } catch (error) {
        reportStepError(error);
      } finally {
        fixingAngleCodesRef.current.delete(key);
        setFixingAngleCodes(new Set(fixingAngleCodesRef.current));
      }
    })();
  };

  const onAngleStage = () =>
    run(async () => {
      if (!focusedTerritory || !masters.organizationId || !parentFp || admittedAngles.length === 0) return;
      if (angleStage === "fix") {
        await repairFailedAngles();
        return;
      }
      if (angleStage === "audit") {
        const heldPass = new Set(
          angleCodesHeldPass(admittedAngles, angleVerdicts).map((code) => code.toUpperCase()),
        );
        const lessons = [...(angleSet.data?.auditLessons ?? [])];
        const passedCodes = new Set<string>(heldPass);
        const failedByCode = new Map<string, { gate: AnglePassCheck["id"]; reason: string }>();
        let siblingSet = storedAngleSet;
        let resolvedSibling: { fingerprint: string; set: NonNullable<typeof siblingSet> } | null = null;
        // Each Angle's own checks run a few at once; the sibling check stays in order below.
        const individualRuns = startLimited(
          admittedAngles.filter((row) => !heldPass.has(row.code.toUpperCase())),
          (row) => row.code.toUpperCase(),
          THINKING_PARALLEL_CHECKS,
          (row) => runAngleIndividualChecks({
            skip: skipFor("angle"),
            batch: true,
            statement: row.statement,
            parentStatement: focusedTerritory.statement,
            ancestors: angleAncestors,
            subject: row.canonicalSemantic.subject,
            example: row.canonicalSemantic.example,
            carried: readAngleGeneratePasses(row.canonicalSemantic.generatePasses),
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => publishAngleChecklist(row.code, checks),
          }),
        );
        for (const row of admittedAngles) {
          const codeKey = row.code.toUpperCase();
          if (heldPass.has(codeKey)) continue;
          const run = await individualRuns.get(codeKey)!;
          if (!run.passed) {
            const failedCheck = run.checks.find((check) => check.state === "fail");
            const gate = failedCheck?.id ?? "stakeHolds";
            const reason = failedCheck?.reason?.trim() || "This check could not be decided.";
            failedByCode.set(codeKey, { gate, reason });
            lessons.push({ code: row.code, statement: row.statement, reason: `${gate}: ${reason}` });
            continue;
          }
          const siblingRows = [
            ...admittedAngles
              .filter((item) => passedCodes.has(item.code.toUpperCase()))
              .map((item) => ({ code: item.code, statement: item.statement })),
            { code: row.code, statement: row.statement },
          ];
          publishAngleChecklist(row.code, beginAngleSiblingCheck(run.checks));
          let siblingPass = skipFor("angle").includes("siblingsDistinct") || siblingRows.length < 2;
          let siblingReason = "";
          if (!siblingPass) {
            const fingerprint = angleSetFingerprint({
              territoryFingerprint: parentTerritoryFingerprint,
              angleFingerprints: siblingRows.map((item) =>
                angleFingerprint({ statement: item.statement, territoryFingerprint: parentTerritoryFingerprint }),
              ),
            });
            const judged =
              resolvedSibling?.fingerprint === fingerprint &&
              resolvedSibling.set.resolution === "RESOLVED" &&
              resolvedSibling.set.unresolvedReasons.length === 0
                ? resolvedSibling.set
                : await (async () => {
                    const siblingScript = await askThinkingLab(
                      buildAngleSiblingPrompt({ parentStatement: focusedTerritory.statement, rows: siblingRows }),
                      0,
                    );
                    const parsed = parseAngleSet(siblingScript, fingerprint);
                    if (parsed.resolution === "RESOLVED" && parsed.unresolvedReasons.length === 0) {
                      resolvedSibling = { fingerprint, set: parsed };
                    }
                    return parsed;
                  })();
            if (siblingRows.length === admittedAngles.length) siblingSet = judged;
            siblingPass = angleReplacementPasses(judged, row.code);
            siblingReason = siblingPass
              ? ""
              : angleFailureLessons({
                  rows: [{ code: row.code, statement: row.statement }],
                  items: [{ code: row.code, verdict: "AUDIT_FAIL" }],
                  siblingSet: judged,
                })[0]?.reason || "Sibling audit failed this Angle.";
          }
          const settled = finishAngleSiblingCheck(run.checks, siblingPass, siblingReason);
          publishAngleChecklist(row.code, settled);
          if (!siblingPass) {
            failedByCode.set(codeKey, { gate: "siblingsDistinct", reason: siblingReason });
            lessons.push({ code: row.code, statement: row.statement, reason: `siblingsDistinct: ${siblingReason}` });
            continue;
          }
          passedCodes.add(codeKey);
        }
        const previousItems = angleSet.data?.audit?.items ?? [];
        const items = admittedAngles.map((row) => {
          const codeKey = row.code.toUpperCase();
          const statementFingerprint = angleFingerprint({
            statement: row.statement,
            territoryFingerprint: parentTerritoryFingerprint,
          });
          if (heldPass.has(codeKey)) {
            const previous = previousItems.find((item) => item.code.toUpperCase() === codeKey);
            if (previous?.verdict === "AUDIT_PASS") {
              return {
                code: row.code,
                verdict: "AUDIT_PASS" as const,
                statementFingerprint: previous.statementFingerprint ?? statementFingerprint,
                ...(previous.skipped ? { skipped: previous.skipped } : {}),
              };
            }
          }
          if (passedCodes.has(codeKey)) return { code: row.code, verdict: "AUDIT_PASS" as const, statementFingerprint, ...skippedMark("angle") };
          const failure = failedByCode.get(codeKey);
          return {
            code: row.code,
            verdict: "AUDIT_FAIL" as const,
            statementFingerprint,
            ...(failure ? { gateFailure: failure } : {}),
          };
        });
        await angleSet.save.mutateAsync({
          schema: "thinking-lab/angle-set/v1",
          repairCount: failedByCode.size > 0 ? (angleSet.data?.repairCount ?? 0) : 0,
          siblingSet,
          audit: { fingerprint: angleFingerprintNow, items },
          challenger: null,
          auditLessons: mergeAngleAuditLessons(angleSet.data?.auditLessons ?? [], lessons),
        });
        return;
      }
      if (angleStage === "lock" && angleLock.ok) {
        await angleSet.lock.mutateAsync({
          territoryFingerprint: parentTerritoryFingerprint,
          ids: admittedAngles.map((row) => row.id),
        });
      }
    }, angleStage ?? "audit", "Angle");

  const onPickAngleFixOffer = (failedCode: string, statement: string) =>
    run(async () => {
      if (!focusedTerritory || !masters.organizationId) return;
      const offer = angleFixOffers.find(
        (row) =>
          row.territoryId === focusedTerritory.id &&
          row.failedCode.toUpperCase() === failedCode.toUpperCase() &&
          row.statement === statement,
      );
      const previous = admittedAngles.find((row) => row.code.toUpperCase() === failedCode.toUpperCase());
      if (!offer || !previous) return;
      await labAngles.replace.mutateAsync({
        territoryId: focusedTerritory.id,
        id: previous.id,
        statement: offer.statement,
        facts: offer.facts,
        admission: "GENERATE_VALID",
      });
      const nextFingerprint = angleFingerprint({
        statement: offer.statement,
        territoryFingerprint: parentTerritoryFingerprint,
      });
      const items = (angleSet.data?.audit?.items ?? []).map((item) =>
        item.code.toUpperCase() === failedCode.toUpperCase()
          ? { code: item.code, verdict: "AUDIT_PASS" as const, statementFingerprint: nextFingerprint }
          : item,
      );
      if (!items.some((item) => item.code.toUpperCase() === failedCode.toUpperCase())) {
        items.push({ code: previous.code, verdict: "AUDIT_PASS", statementFingerprint: nextFingerprint });
      }
      await angleSet.save.mutateAsync({
        schema: "thinking-lab/angle-set/v1",
        repairCount: angleSet.data?.repairCount ?? 0,
        siblingSet: null,
        audit: { fingerprint: "", items },
        challenger: null,
        auditLessons: angleSet.data?.auditLessons ?? [],
      });
      setAngleFixOffers((current) =>
        current.filter(
          (row) => row.territoryId !== focusedTerritory.id || row.failedCode.toUpperCase() !== failedCode.toUpperCase(),
        ),
      );
      setNotice(null);
    }, "pick-angle-fix");

  const onLockAngles = () =>
    run(async () => {
      if (!focusedTerritory || admittedAngles.length === 0 || !parentTerritoryFingerprint) return;
      if (!angleVerdicts.every((verdict) => verdict === "AUDIT_PASS") || angleExampleOpen) return;
      await angleSet.lock.mutateAsync({
        territoryFingerprint: parentTerritoryFingerprint,
        ids: admittedAngles.map((row) => row.id),
      });
    }, "lock");

  const ensureAnsweredQuestion = async (thought: NonNullable<typeof focusedThought>) => {
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

  const repairFailedTerritories = async (onlyCode?: string) => {
    if (!focusedThought || !masters.organizationId || !parentFp || admittedTerritories.length === 0) return;
    const questionForCheck = await ensureAnsweredQuestion(focusedThought);
    const failed = admittedTerritories.filter((row, index) => {
      const checklistFailed = (territoryChecklists[row.code.toUpperCase()]?.checks ?? []).some(
        (check) => check.state === "fail",
      );
      if (territoryVerdicts[index] !== "AUDIT_FAIL" && !checklistFailed) return false;
      return !onlyCode || row.code.toUpperCase() === onlyCode.toUpperCase();
    });
    if (failed.length === 0) return;
    const keepers = admittedTerritories.filter(
      (item, index) => item.status === "locked" || territoryVerdicts[index] === "AUDIT_PASS",
    );
    const conflicts = territoryNotes.flatMap((note) =>
      note.kind === "overlap"
        ? [`${note.a} · ${note.b}: ${note.explanation}`]
        : note.kind === "containment"
          ? [`${note.container} · ${note.contained}: ${note.explanation}`]
          : [],
    );
    const applied = new Map<string, string>();
    let setRecord = {
      schema: "thinking-lab/territory-set/v1" as const,
      repairCount: territorySet.data?.repairCount ?? 0,
      siblingSet: storedTerritorySet,
      audit: territorySet.data?.audit ?? null,
      challenger: territorySet.data?.challenger ?? null,
      auditLessons: [...(territorySet.data?.auditLessons ?? [])],
    };
    for (const row of failed) {
      const learned = [...usableTerritoryFixLessons(setRecord.auditLessons, row.code)];
      const refused = new Set(setRecord.auditLessons.map((lesson) => lesson.statement.trim().toLowerCase()));
      refused.add(row.statement.trim().toLowerCase());
      const storedFailure = setRecord.audit?.items.find((item) => item.code.toUpperCase() === row.code.toUpperCase());
      let shown = territoryChecklists[row.code.toUpperCase()]?.checks ?? [];
      if (shown.length === 0) {
        shown = territoryChecksFromStored({
          generatePasses: row.canonicalSemantic.generatePasses,
          gateFailure: storedFailure?.verdict === "AUDIT_FAIL" ? storedFailure.gateFailure ?? null : null,
        });
      }
      const checklistAtStart = shown.map((check) => ({ ...check }));
      const liveScope = fixScopeFromChecks(shown);
      let scope: FixScope =
        liveScope.preserve.length > 0 || liveScope.repair.length > 0 ? liveScope : scopeFromHistory(shown, learned);
      const rememberFixLesson = async (lesson: { code: string; statement: string; reason: string }) => {
        learned.push(lesson);
        refused.add(lesson.statement.trim().toLowerCase());
        setRecord = {
          ...setRecord,
          auditLessons: mergeTerritoryAuditLessons(setRecord.auditLessons, [lesson]),
        };
        await territorySet.save.mutateAsync(setRecord);
      };
      let draft = row.statement;
      let offered = false;
      for (let attempt = 0; attempt < fixAttemptCap() && !offered; attempt += 1) {
        const script = await askThinkingLab(
          buildTerritoryFixOptionsPrompt({
            parentStatement: focusedThought.statement,
            ancestors: territoryAncestors,
            audience: selected?.audience,
            answeredQuestion,
            failed: { code: row.code, statement: draft },
            keepers: keepers
              .filter((keeper) => keeper.code.toUpperCase() !== row.code.toUpperCase())
              .map((keeper) => ({ code: keeper.code, statement: keeper.statement })),
            conflicts,
            lessons: learned,
            scope,
          }),
          0.2,
        );
        const candidates = parseTerritoryFixOptionsScript(script);
        const statement = candidates.find((candidate) => !refused.has(candidate.trim().toLowerCase()));
        if (!statement) {
          if (candidates.length === 0) {
            await rememberFixLesson({ code: row.code, statement: draft, reason: "No replacement came back." });
          } else {
            for (const candidate of candidates) {
              await rememberFixLesson({
                code: row.code,
                statement: candidate,
                reason: "This name was offered again after it already failed.",
              });
            }
          }
          continue;
        }
        if (territoryNameTooLong(statement) || territoryNameIsActivity(statement)) {
          const reason = territoryNameTooLong(statement) ? TERRITORY_NAME_LENGTH_REASON : TERRITORY_ACTIVITY_REASON;
          await rememberFixLesson({ code: row.code, statement, reason: `partOfBigThought: ${reason}` });
          continue;
        }
        const prior = fixPriorForNextTerritoryName(shown, draft, statement);
        const checked = await runTerritoryOpenChecks({
          skip: skipFor("territory"),
          batch: true,
          statement,
          parentStatement: focusedThought.statement,
          audience: selected?.audience,
          question: questionForCheck,
          prior,
          ask: (prompt) => askThinkingLab(prompt, 0),
          onStep: (checks) => publishTerritoryChecklist(row.code, checks),
        });
        if (!checked.passed) {
          const failedCheck = checked.checks.find((check) => check.state === "fail");
          const reason = failedCheck ? `${failedCheck.id}: ${failedCheck.reason ?? ""}`.trim() : "This check could not be decided.";
          await rememberFixLesson({ code: row.code, statement, reason });
          shown = checked.checks;
          draft = statement;
          scope = fixScopeFromChecks(shown);
          continue;
        }
        const siblingAlreadyPassed = checked.checks.some(
          (check) => check.id === "siblingsDistinct" && check.state === "pass",
        );
        const siblingRows = [
          ...keepers
            .filter((item) => item.code.toUpperCase() !== row.code.toUpperCase())
            .map((item) => ({ code: item.code, statement: item.statement })),
          { code: row.code, statement },
        ];
        let siblingPass = skipFor("territory").includes("siblingsDistinct") || siblingAlreadyPassed || siblingRows.length < 2;
        let siblingReason = "";
        if (!siblingPass) {
          publishTerritoryChecklist(row.code, beginSiblingCheck(checked.checks));
          const fingerprint = territorySetFingerprint({
            bigThoughtFingerprint: focusedBigThoughtFingerprint,
            territoryFingerprints: siblingRows.map((item) =>
              territoryFingerprint({ statement: item.statement, bigThoughtFingerprint: focusedBigThoughtFingerprint }),
            ),
          });
          const siblingScript = await askThinkingLab(
            buildTerritorySiblingPrompt({ parentStatement: focusedThought.statement, rows: siblingRows }),
            0,
          );
          const siblingSet = parseTerritorySet(siblingScript, fingerprint);
          siblingPass = territoryReplacementPasses(siblingSet, row.code);
          siblingReason = siblingPass
            ? ""
            : territoryFailureLessons({
                rows: [{ code: row.code, statement }],
                items: [{ code: row.code, verdict: "AUDIT_FAIL" }],
                siblingSet,
              })[0]?.reason ?? "Sibling audit failed this Territory.";
        }
        if (!siblingPass) {
          await rememberFixLesson({ code: row.code, statement, reason: `siblingsDistinct: ${siblingReason}` });
          const failedSibling = finishSiblingCheck(checked.checks, false, siblingReason);
          shown = failedSibling;
          draft = statement;
          publishTerritoryChecklist(row.code, failedSibling);
          scope = fixScopeFromChecks(shown);
          continue;
        }
        const passedChecks = finishSiblingCheck(checked.checks, true, "");
        publishTerritoryChecklist(row.code, passedChecks);
        const sameArea =
          scope.preserve.includes("questionArises") && scope.repair.every((item) => item.id === "audienceLanguage");
        const written = await writeTerritoryAreaSentence({
          territory: statement,
          parentStatement: focusedThought.statement,
          masterStatement: selected?.statement,
          audience: selected?.audience,
          answeredQuestion: questionForCheck || answeredQuestion,
          siblings: keepers
            .filter((item) => item.code.toUpperCase() !== row.code.toUpperCase())
            .map((item) => item.statement),
          ask: (prompt) => askThinkingLab(prompt, 0.2),
        });
        const areaQuestion = sameArea
          ? row.canonicalSemantic.areaQuestion || written.question || checked.question
          : written.question || checked.question || row.canonicalSemantic.areaQuestion;
        await labTerritories.replace.mutateAsync({
          bigThoughtId: focusedThought.id,
          id: row.id,
          statement,
          facts: {
            ...row.canonicalSemantic,
            ...shownTerritoryFacts(row.code, statement),
            generatePasses: ["partOfBigThought", "audienceLanguage"],
            areaQuestion,
            whatItSays: written.sentence.trim() || (sameArea ? row.canonicalSemantic.whatItSays : statement),
          },
          admission: "GENERATE_VALID",
        });
        const codeKey = row.code.toUpperCase();
        const statementFingerprint = territoryFingerprint({
          statement,
          bigThoughtFingerprint: focusedBigThoughtFingerprint,
        });
        const previousItems = setRecord.audit?.items ?? [];
        const items = previousItems.some((item) => item.code.toUpperCase() === codeKey)
          ? previousItems.map((item) =>
              item.code.toUpperCase() === codeKey
                ? { code: row.code, verdict: "AUDIT_PASS" as const, statementFingerprint, ...skippedMark("territory") }
                : item,
            )
          : [...previousItems, { code: row.code, verdict: "AUDIT_PASS" as const, statementFingerprint, ...skippedMark("territory") }];
        setRecord = {
          ...setRecord,
          audit: { fingerprint: setRecord.audit?.fingerprint ?? "", items },
        };
        await territorySet.save.mutateAsync(setRecord);
        applied.set(codeKey, statement);
        offered = true;
      }
      if (!offered && checklistAtStart.length > 0) publishTerritoryChecklist(row.code, checklistAtStart);
    }
    const replaced = new Set(failed.map((row) => row.code.toUpperCase()));
    setTerritoryFixOffers((current) =>
      current.filter((offer) => offer.thoughtId !== focusedThought.id || !replaced.has(offer.failedCode.toUpperCase())),
    );
    const covered = applied.size;
    if (covered > 0) {
      const items = admittedTerritories.flatMap((row, index) => {
        const code = row.code.toUpperCase();
        const previous = setRecord.audit?.items.find((item) => item.code.toUpperCase() === code);
        const statement = applied.get(code) ?? row.statement;
        const verdict = applied.has(code) ? ("AUDIT_PASS" as const) : territoryVerdicts[index];
        if (verdict !== "AUDIT_PASS" && verdict !== "AUDIT_FAIL") return [];
        return [
          {
            code: row.code,
            verdict,
            statementFingerprint: territoryFingerprint({
              statement,
              bigThoughtFingerprint: focusedBigThoughtFingerprint,
            }),
            ...(verdict === "AUDIT_FAIL" && previous?.gateFailure ? { gateFailure: previous.gateFailure } : {}),
          },
        ];
      });
      setRecord = {
        ...setRecord,
        repairCount: setRecord.repairCount + 1,
        siblingSet: null,
        audit: items.length > 0 ? { fingerprint: "", items } : null,
        challenger: null,
      };
      await territorySet.save.mutateAsync(setRecord);
    }
    if (covered < failed.length) {
      setNotice(
        t("thinkingLab.territory.noSafeReplacement", "NO_SAFE_REPLACEMENT {{count}}/{{failed}}", {
          count: covered,
          failed: failed.length,
        }),
      );
    } else {
      setNotice(null);
    }
  };

  const onFixTerritory = (code: string) => {
    const key = code.trim().toUpperCase();
    if (!key || fixingTerritoryCodesRef.current.has(key)) return;
    fixingTerritoryCodesRef.current.add(key);
    setFixingTerritoryCodes(new Set(fixingTerritoryCodesRef.current));
    void (async () => {
      try {
        await repairFailedTerritories(code);
      } catch (error) {
        reportStepError(error);
      } finally {
        fixingTerritoryCodesRef.current.delete(key);
        setFixingTerritoryCodes(new Set(fixingTerritoryCodesRef.current));
      }
    })();
  };

  const onTerritoryStage = () => {
    if (territoryStage === "generate" && focusedThought) {
      onGenerateTerritory(focusedThought.id);
      return;
    }
    return run(async () => {
      if (!focusedThought || !masters.organizationId || !parentFp || admittedTerritories.length === 0) return;
      if (territoryStage === "fix") {
        await repairFailedTerritories();
        return;
      }
      if (territoryStage === "audit") {
        const questionForAudit = await ensureAnsweredQuestion(focusedThought);
        const heldPass = new Set(
          territoryCodesHeldPass(admittedTerritories, territoryVerdicts).map((code) => code.toUpperCase()),
        );
        const lessons = [...(territorySet.data?.auditLessons ?? [])];
        const passedCodes = new Set<string>(heldPass);
        const failedByCode = new Map<string, { gate: TerritoryPassCheckId; reason: string }>();
        let siblingSet = storedTerritorySet;
        let resolvedSibling: { fingerprint: string; set: NonNullable<typeof siblingSet> } | null = null;
        let shownAuditChecks: TerritoryPassCheck[] = [];
        const publishAudit = (code: string, checks: TerritoryPassCheck[]) => {
          const previous = shownAuditChecks;
          shownAuditChecks = checks.map((check) => ({ ...check }));
          const changed = checks.find((check, index) => check.state !== previous[index]?.state);
          const report =
            changed?.state === "running" || changed?.state === "pass" || changed?.state === "fail"
              ? {
                  gate: changed.id,
                  phase: changed.state === "running" ? ("checking" as const) : ("checked" as const),
                  outcome: changed.state === "fail" ? ("fail" as const) : ("pass" as const),
                }
              : null;
          setTerritoryGenerateRun({ thoughtId: focusedThought.id, checks: shownAuditChecks, report });
          publishTerritoryChecklist(code, checks);
        };
        // The checks of each name do not depend on the others: run a few at once. The sibling
        // check below still goes name by name, against the names that passed before it.
        const glossByCode = new Map<string, { sentence: string; question: string }>();
        const individualRuns = startLimited(
          admittedTerritories.filter((row) => !heldPass.has(row.code.toUpperCase())),
          (row) => row.code.toUpperCase(),
          THINKING_PARALLEL_CHECKS,
          (row) => {
            const passedSiblings = () =>
              admittedTerritories
                .filter((item) => item.id !== row.id && passedCodes.has(item.code.toUpperCase()))
                .map((item) => item.statement);
            return runTerritoryIndividualChecks({
            skip: skipFor("territory"),
            batch: true,
            statement: row.statement,
            parentStatement: focusedThought.statement,
            audience: selected?.audience,
            question: questionForAudit || row.canonicalSemantic.areaQuestion,
            carried: readTerritoryGeneratePasses(row.canonicalSemantic.generatePasses),
            ensureQuestion: async () => {
              if (questionForAudit) return questionForAudit;
              const written = await writeTerritoryAreaSentence({
                territory: row.statement,
                parentStatement: focusedThought.statement,
                masterStatement: selected?.statement,
                audience: selected?.audience,
                answeredQuestion: questionForAudit || answeredQuestion,
                siblings: passedSiblings(),
                ask: (prompt) => askThinkingLab(prompt, 0.2),
              });
              if (written.sentence && written.question) glossByCode.set(row.code.toUpperCase(), written);
              return written.question;
            },
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => publishTerritoryChecklist(row.code, checks),
          });
          },
        );
        for (const row of admittedTerritories) {
          const codeKey = row.code.toUpperCase();
          if (heldPass.has(codeKey)) continue;
          shownAuditChecks = [];
          const run = await individualRuns.get(codeKey)!;
          let gloss: { sentence: string; question: string } | null = glossByCode.get(codeKey) ?? null;
          const passedSiblings = () =>
            admittedTerritories
              .filter((item) => item.id !== row.id && passedCodes.has(item.code.toUpperCase()))
              .map((item) => item.statement);
          publishAudit(row.code, run.checks);
          if (!run.passed) {
            const failedCheck = run.checks.find((check) => check.state === "fail");
            const gate = failedCheck?.id ?? "partOfBigThought";
            const reason = failedCheck?.reason?.trim() || "This check could not be decided.";
            failedByCode.set(codeKey, { gate, reason });
            lessons.push({ code: row.code, statement: row.statement, reason: `${gate}: ${reason}` });
            continue;
          }
          const siblingRows = [
            ...admittedTerritories
              .filter((item) => passedCodes.has(item.code.toUpperCase()))
              .map((item) => ({ code: item.code, statement: item.statement })),
            { code: row.code, statement: row.statement },
          ];
          publishAudit(row.code, beginSiblingCheck(run.checks));
          let siblingPass = skipFor("territory").includes("siblingsDistinct") || siblingRows.length < 2;
          let siblingReason = "";
          if (!siblingPass) {
            const fingerprint = territorySetFingerprint({
              bigThoughtFingerprint: focusedBigThoughtFingerprint,
              territoryFingerprints: siblingRows.map((item) =>
                territoryFingerprint({ statement: item.statement, bigThoughtFingerprint: focusedBigThoughtFingerprint }),
              ),
            });
            const judged =
              resolvedSibling?.fingerprint === fingerprint &&
              resolvedSibling.set.resolution === "RESOLVED" &&
              resolvedSibling.set.unresolvedReasons.length === 0
                ? resolvedSibling.set
                : await (async () => {
                    const siblingScript = await askThinkingLab(
                      buildTerritorySiblingPrompt({ parentStatement: focusedThought.statement, rows: siblingRows }),
                      0,
                    );
                    const parsed = parseTerritorySet(siblingScript, fingerprint);
                    if (parsed.resolution === "RESOLVED" && parsed.unresolvedReasons.length === 0) {
                      resolvedSibling = { fingerprint, set: parsed };
                    }
                    return parsed;
                  })();
            if (siblingRows.length === admittedTerritories.length) siblingSet = judged;
            siblingPass = territoryReplacementPasses(judged, row.code);
            siblingReason = siblingPass
              ? ""
              : territoryFailureLessons({
                  rows: [{ code: row.code, statement: row.statement }],
                  items: [{ code: row.code, verdict: "AUDIT_FAIL" }],
                  siblingSet: judged,
                })[0]?.reason || "This Territory overlaps another.";
          }
          const settled = finishSiblingCheck(run.checks, siblingPass, siblingReason);
          publishAudit(row.code, settled);
          if (!siblingPass) {
            failedByCode.set(codeKey, { gate: "siblingsDistinct", reason: siblingReason });
            lessons.push({ code: row.code, statement: row.statement, reason: `siblingsDistinct: ${siblingReason}` });
            continue;
          }
          const hasGloss =
            Boolean(row.canonicalSemantic.areaQuestion?.trim()) &&
            row.canonicalSemantic.whatItSays.trim().toLowerCase() !== row.statement.trim().toLowerCase();
          if (gloss || !hasGloss) {
            const written =
              gloss ??
              (await writeTerritoryAreaSentence({
                territory: row.statement,
                parentStatement: focusedThought.statement,
                masterStatement: selected?.statement,
                audience: selected?.audience,
                answeredQuestion: questionForAudit || answeredQuestion,
                siblings: passedSiblings(),
                ask: (prompt) => askThinkingLab(prompt, 0.2),
              }));
            if (written.sentence && written.question) {
              await labTerritories.saveGloss.mutateAsync({
                bigThoughtId: row.bigThoughtId,
                id: row.id,
                facts: { ...row.canonicalSemantic, whatItSays: written.sentence, areaQuestion: written.question },
              });
            }
          }
          passedCodes.add(codeKey);
        }
        const previousItems = territorySet.data?.audit?.items ?? [];
        const items = admittedTerritories.map((row) => {
          const codeKey = row.code.toUpperCase();
          const statementFingerprint = territoryFingerprint({
            statement: row.statement,
            bigThoughtFingerprint: focusedBigThoughtFingerprint,
          });
          if (heldPass.has(codeKey)) {
            const previous = previousItems.find((item) => item.code.toUpperCase() === codeKey);
            if (previous?.verdict === "AUDIT_PASS") {
              return {
                code: row.code,
                verdict: "AUDIT_PASS" as const,
                statementFingerprint: previous.statementFingerprint ?? statementFingerprint,
                ...(previous.skipped ? { skipped: previous.skipped } : {}),
              };
            }
          }
          if (passedCodes.has(codeKey)) return { code: row.code, verdict: "AUDIT_PASS" as const, statementFingerprint, ...skippedMark("territory") };
          const failure = failedByCode.get(codeKey);
          return {
            code: row.code,
            verdict: "AUDIT_FAIL" as const,
            statementFingerprint,
            ...(failure ? { gateFailure: failure } : {}),
          };
        });
        await territorySet.save.mutateAsync({
          schema: "thinking-lab/territory-set/v1",
          repairCount: failedByCode.size > 0 ? (territorySet.data?.repairCount ?? 0) : 0,
          siblingSet,
          audit: { fingerprint: territoryFingerprintNow, items },
          challenger: null,
          auditLessons: mergeTerritoryAuditLessons(territorySet.data?.auditLessons ?? [], lessons),
        });
        setTerritoryGenerateRun((current) => {
          if (!current || current.thoughtId !== focusedThought.id) return current;
          return current.checks.some((check) => check.state === "fail") ? current : null;
        });
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
      if (!focusedThought || !focusedBigThoughtFingerprint || admittedTerritories.length === 0) return;
      if (!territoryVerdicts.every((verdict) => verdict === "AUDIT_PASS")) return;
      await territorySet.lock.mutateAsync({
        bigThoughtFingerprint: focusedBigThoughtFingerprint,
        ids: admittedTerritories.map((row) => row.id),
      });
    }, "lock");

  const onPickTerritoryFixOffer = (failedCode: string, statement: string) =>
    run(async () => {
      if (!focusedThought || !masters.organizationId) return;
      const offer = territoryFixOffers.find(
        (row) =>
          row.thoughtId === focusedThought.id &&
          row.failedCode.toUpperCase() === failedCode.toUpperCase() &&
          row.statement === statement,
      );
      const previous = admittedTerritories.find((row) => row.code.toUpperCase() === failedCode.toUpperCase());
      if (!offer || !previous) return;
      await labTerritories.replace.mutateAsync({
        bigThoughtId: focusedThought.id,
        id: previous.id,
        statement: offer.statement,
        facts: offer.facts,
        admission: "GENERATE_VALID",
      });
      const nextFingerprint = territoryFingerprint({
        statement: offer.statement,
        bigThoughtFingerprint: focusedBigThoughtFingerprint,
      });
      const items = (territorySet.data?.audit?.items ?? []).map((item) =>
        item.code.toUpperCase() === failedCode.toUpperCase()
          ? { code: item.code, verdict: "AUDIT_PASS" as const, statementFingerprint: nextFingerprint }
          : item,
      );
      if (!items.some((item) => item.code.toUpperCase() === failedCode.toUpperCase())) {
        items.push({ code: previous.code, verdict: "AUDIT_PASS", statementFingerprint: nextFingerprint });
      }
      await territorySet.save.mutateAsync({
        schema: "thinking-lab/territory-set/v1",
        repairCount: territorySet.data?.repairCount ?? 0,
        siblingSet: null,
        audit: { fingerprint: "", items },
        challenger: null,
        auditLessons: territorySet.data?.auditLessons ?? [],
      });
      setTerritoryFixOffers((current) =>
        current.filter(
          (row) => row.thoughtId !== focusedThought.id || row.failedCode.toUpperCase() !== failedCode.toUpperCase(),
        ),
      );
      setNotice(null);
    }, "pick-territory-fix");

  const publishBigThoughtChecklist = async (code: string, statement: string, checklist: PassChecklist, done: number, total: number) => {
    setBigThoughtChecklists((current) => ({ ...current, [code.toUpperCase()]: checklist }));
    setAuditProgress({ done, total, current: { code, statement }, checklist });
    await waitForChecklistReport(checklist);
  };

  const repairFailedBigThought = async (code: string, force?: BigThoughtFixMode) => {
    if (!selected || !parentFp) return;
    const row = active.find((item) => item.code.toUpperCase() === code.toUpperCase());
    if (!row || row.status === "locked") return;
    const key = row.code.toUpperCase();
    const storedFailure = readGateFailure(
      setRecord?.audit?.items?.find((item) => item.code.toUpperCase() === key)?.gateFailure,
    );
    let shown = bigThoughtChecklists[key] ?? (storedFailure ? checklistFromFailure(storedFailure) : null);
    if (!shown) return;
    const keepers = shownRowViews
      .filter((item) => item.code.toUpperCase() !== key && (item.status === "locked" || item.audit === "AUDIT_PASS"))
      .map((item) => ({ code: item.code, statement: item.statement, label: item.label }));
    let record = setRecord ?? emptySetRecord();
    const seeded = mergeFixLessons(record.fixLessons, [
      ...(bigThoughtFixLessonsRef.current.get(key) ?? []).map((lesson) => ({ code: row.code, ...lesson })),
      ...(shown.failure
        ? [{ code: row.code, statement: row.statement, reason: `${shown.failure.gate}: ${shown.failure.reason}` }]
        : []),
    ]);
    if (seeded.length !== (record.fixLessons ?? []).length) {
      record = { ...record, fixLessons: seeded };
      await masters.saveSet.mutateAsync({ id: selected.id, lastAudit: record });
    }
    const learned = seeded
      .filter((lesson) => lesson.code.toUpperCase() === key)
      .map((lesson) => ({ statement: lesson.statement, reason: lesson.reason }));
    bigThoughtFixLessonsRef.current.set(key, learned);
    const remember = async (lesson: { statement: string; reason: string }) => {
      const alreadyKnown = learned.some(
        (item) =>
          item.statement.trim().toLowerCase() === lesson.statement.trim().toLowerCase() && item.reason === lesson.reason,
      );
      if (alreadyKnown) return;
      learned.push(lesson);
      bigThoughtFixLessonsRef.current.set(key, [...learned]);
      record = { ...record, fixLessons: mergeFixLessons(record.fixLessons, [{ code: row.code, ...lesson }]) };
      await masters.saveSet.mutateAsync({ id: selected.id, lastAudit: record });
    };
    const closedNotice = () =>
      setNotice(
        t(
          "thinkingLab.bt.fixClosed",
          "Fix closed for {{code}}: it failed {{count}} times. Rewrite the reason, edit it by hand, or delete it.",
        )
          .replace("{{code}}", row.code)
          .replace("{{count}}", String(learned.length)),
      );
    if (!force && learned.length >= BT_FIX_STUCK_LESSONS) {
      closedNotice();
      return;
    }
    const refused = new Set<string>(learned.map((lesson) => lesson.statement.trim().toLowerCase()));
    refused.add(row.statement.trim().toLowerCase());
    let statement = row.statement;
    let scope = fixScopeFromChecks(shown.items);
    let replaced = false;
    const publishFixChecklist = async (checklist: PassChecklist) => {
      setBigThoughtChecklists((current) => ({ ...current, [key]: checklist }));
      await waitForChecklistReport(checklist);
    };
    // Same check failing again and again: more rewrites only spend calls.
    let lastGate = "";
    let sameGateRuns = 0;
    let stuckGate = "";
    let stuckReason = "";
    const noteGate = (gate: string, reason: string): boolean => {
      sameGateRuns = gate && gate === lastGate ? sameGateRuns + 1 : 1;
      lastGate = gate;
      if (gate && sameGateRuns >= BT_FIX_SAME_GATE_STOP) {
        stuckGate = gate;
        stuckReason = reason;
        return true;
      }
      return false;
    };
    let lastMode: BigThoughtFixMode | null = null;
    let closed = false;
    for (let attempt = 0; attempt < BT_FIX_MAX_ATTEMPTS && !replaced; attempt += 1) {
      if (!force && learned.length >= BT_FIX_STUCK_LESSONS) {
        closed = true;
        break;
      }
      const mode = bigThoughtFixMode({
        gate: shown.failure?.gate ?? "",
        lessons: learned,
        replaceAfter: BT_FIX_REPLACE_AFTER,
        force,
      });
      // A new way of fixing gets its own tries before the same-check stop.
      if (lastMode && mode !== lastMode) {
        lastGate = "";
        sameGateRuns = 0;
      }
      lastMode = mode;
      const script = await askScoped(
        "fix",
        row.code,
        buildBigThoughtFixPrompt({
          parentStatement: becauseParent,
          failed: { code: row.code, statement },
          keepers,
          scope,
          lessons: learned,
          mode,
        }),
        0.2,
      );
      const next = parseBigThoughtFixStatement(script, becauseParent);
      if (!next || refused.has(next.trim().toLowerCase())) {
        await remember({ statement: next || statement, reason: "No replacement came back." });
        continue;
      }
      const checked = await runBigThoughtOpenChecks({
        skip: skipFor("bigThought"),
        batch: true,
        statement: next,
        parentStatement: becauseParent,
        others: keepers,
        // A new reason is a new sentence: none of the old sentence's passes carry over.
        prior:
          mode === "replace"
            ? shown.items.map((item) => ({ id: item.id, state: "pending" as const, reason: "" }))
            : fixPriorForNextSentence(shown.items, statement, next),
        lessons: learned,
        ask: (prompt) => askScoped("fix", row.code, prompt, 0),
        onStep: (checklist) => publishFixChecklist(checklist),
      });
      if (!checked.passed) {
        const reason = checked.failure ? `${checked.failure.gate}: ${checked.failure.reason}` : "This check could not be decided.";
        await remember({ statement: next, reason });
        refused.add(next.trim().toLowerCase());
        statement = next;
        shown = checked;
        scope = fixScopeFromChecks(shown.items);
        if (noteGate(checked.failure?.gate ?? "", checked.failure?.reason ?? "")) break;
        continue;
      }
      const siblingRows = [
        ...keepers.map((item) => ({ code: item.code, statement: item.statement })),
        { code: row.code, statement: next },
      ];
      let siblingPass = skipFor("bigThought").includes("sibling") || siblingRows.length < 2;
      let siblingReason = "";
      if (!siblingPass) {
        const fingerprint = incumbentSetFingerprint({
          masterThoughtFingerprint: parentFp,
          bigThoughtFingerprints: siblingRows.map((item) =>
            bigThoughtFingerprint({ statement: item.statement, masterThoughtFingerprint: parentFp }),
          ),
        });
        const checking = checkingSiblingFrame(checked);
        await publishFixChecklist(checking);
        const sibling = await judgeSiblingSet(
          { parentStatement: selected.statement, rows: siblingRows, fingerprint },
          (prompt) => askScoped("fix", row.code, prompt, 0),
        );
        const gate = auditSiblingGate({
          code: row.code,
          siblingSet: sibling,
          siblingSetCurrent: true,
          activeCodes: siblingRows.map((item) => item.code),
        });
        siblingPass = gate.passed;
        siblingReason = gate.reason;
        const settled = completeChecklist(checked, gate);
        await publishFixChecklist(checklistFrame(settled, "sibling", "checked"));
        if (!siblingPass) {
          await remember({ statement: next, reason: `sibling: ${siblingReason}` });
          refused.add(next.trim().toLowerCase());
          statement = next;
          shown = settled;
          scope = fixScopeFromChecks(shown.items);
          if (noteGate("sibling", siblingReason)) break;
          continue;
        }
      } else {
        const settled = completeChecklist(checked, { passed: true, reason: "" });
        await publishFixChecklist(checklistFrame(settled, "sibling", "checked"));
      }
      const facts: BigThoughtFacts = {
        ...shownBigThoughtFacts(row.code, next),
        generatePasses: ["resolved", "relation"],
        answeredQuestion: row.canonicalSemantic?.answeredQuestion,
        answeredQuestionVersion: row.canonicalSemantic?.answeredQuestionVersion,
      };
      await thoughts.updateFacts.mutateAsync({
        id: row.id,
        statement: next,
        facts,
        masterFingerprint: parentFp,
      });
      const statementFingerprint = bigThoughtFingerprint({
        statement: next,
        masterThoughtFingerprint: parentFp,
      });
      const previous = record.audit?.items ?? [];
      const items = previous.some((item) => item.code.toUpperCase() === key)
        ? previous.map((item) =>
            item.code.toUpperCase() === key
              ? { code: row.code, verdict: "AUDIT_PASS" as const, statementFingerprint, gatesChecked: true as const, ...skippedMark("bigThought") }
              : item,
          )
        : [...previous, { code: row.code, verdict: "AUDIT_PASS" as const, statementFingerprint, gatesChecked: true as const, ...skippedMark("bigThought") }];
      const nextRecord = nextAuthoritativeSetRecord({
        record,
        parentFingerprint: parentFp,
        siblingSet: record.siblingSet,
        audit: { setFingerprint: record.audit?.setFingerprint ?? "", items },
        challenger: record.challenger,
      });
      await masters.saveSet.mutateAsync({
        id: selected.id,
        lastAudit: { ...nextRecord, fixLessons: dropFixLessons(nextRecord.fixLessons, [key]) },
      });
      bigThoughtFixLessonsRef.current.delete(key);
      replaced = true;
    }
    if (!replaced && (closed || (!force && learned.length >= BT_FIX_STUCK_LESSONS))) {
      closedNotice();
    } else if (!replaced) {
      setNotice(
        stuckGate
          ? t(
            "thinkingLab.bt.fixStuck",
            "Fix stopped: the {{gate}} check failed again ({{reason}}). Edit this Big Thought by hand, or change the Master Thought, before trying again.",
          )
            .replace("{{gate}}", stuckGate)
            .replace("{{reason}}", stuckReason.slice(0, 160) || "-")
          : t(
            "thinkingLab.bt.fixStillOpen",
            "This Big Thought is still failing. Fix stays on this card, and the failures stay as lessons for the next round.",
          ),
      );
    }
  };

  const onFixBigThought = (code: string, force?: BigThoughtFixMode) => {
    const key = code.trim().toUpperCase();
    if (!key || labRunRef.current || fixingBigThoughtRef.current.has(key)) return;
    labRunRef.current = true;
    fixingBigThoughtRef.current.add(key);
    setFixingBigThoughtCodes([...fixingBigThoughtRef.current]);
    void (async () => {
      try {
        await repairFailedBigThought(key, force);
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

  const onAudit = () =>
    run(async () => {
      if (!selected || !parentFp) return;
      const listed = active.flatMap((row) => {
        const fingerprint = bigThoughtFingerprint({
          statement: row.statement,
          masterThoughtFingerprint: parentFp,
        });
        const admission = individualAdmission({
          facts: row.canonicalSemantic,
          factsCurrent: fingerprintsMatch(row.semanticFingerprint, fingerprint),
        });
        if (admission !== "GENERATE_VALID" || row.canonicalSemantic?.gateFailure || row.status === "locked") return [];
        return [{ ...row }];
      });
      if (listed.length === 0) return;
      const heldPass = new Set(
        listed.flatMap((row) => {
          const fingerprint = bigThoughtFingerprint({
            statement: row.statement,
            masterThoughtFingerprint: parentFp,
          });
          const stored = setRecord?.audit?.items?.find((item) => item.code.toUpperCase() === row.code.toUpperCase());
          return stored?.verdict === "AUDIT_PASS" &&
            stored.statementFingerprint &&
            fingerprintsMatch(stored.statementFingerprint, fingerprint)
            ? [row.code.toUpperCase()]
            : [];
        }),
      );
      const total = listed.length;
      let done = heldPass.size;
      setBigThoughtChecklists((current) => {
        const next = { ...current };
        for (const code of heldPass) delete next[code];
        return next;
      });
      setAuditProgress({ done, total, current: null, checklist: null });
      const failures = new Map<string, NonNullable<PassChecklist["failure"]>>();
      const passedIndividual = new Map<string, PassChecklist>();
      try {
        for (const row of listed) {
          const codeKey = row.code.toUpperCase();
          if (heldPass.has(codeKey)) continue;
          const fingerprint = bigThoughtFingerprint({
            statement: row.statement,
            masterThoughtFingerprint: parentFp,
          });
          const carried = readGeneratePasses(
            fingerprintsMatch(row.semanticFingerprint, fingerprint) ? row.canonicalSemantic?.generatePasses : undefined,
          );
          const others = listed
            .filter((item) => {
              const other = item.code.toUpperCase();
              return other !== codeKey && (heldPass.has(other) || passedIndividual.has(other));
            })
            .map((item) => ({ code: item.code, statement: item.statement, label: item.label }));
          const lessons = [
            ...(bigThoughtFixLessonsRef.current.get(codeKey) ?? []),
            ...(setRecord?.fixLessons ?? [])
              .filter((lesson) => lesson.code.toUpperCase() === codeKey)
              .map((lesson) => ({ statement: lesson.statement, reason: lesson.reason })),
          ];
          const checked = await runBigThoughtIndividualChecks({
            skip: skipFor("bigThought"),
            batch: true,
            statement: row.statement,
            parentStatement: becauseParent,
            others,
            carried,
            lessons,
            ask: (prompt) => askScoped("audit", row.code, prompt, 0),
            onStep: (checklist) => publishBigThoughtChecklist(row.code, row.statement, checklist, done, total),
          });
          if (!checked.passed) {
            if (checked.failure) failures.set(codeKey, checked.failure);
            continue;
          }
          passedIndividual.set(codeKey, checked);
          done += 1;
        }
        const siblingRows = listed.filter(
          (row) => heldPass.has(row.code.toUpperCase()) || passedIndividual.has(row.code.toUpperCase()),
        );
        let sibling = setRecord?.siblingSet ?? null;
        if (passedIndividual.size > 0 && siblingRows.length >= 2 && !skipFor("bigThought").includes("sibling")) {
          const fingerprint = incumbentSetFingerprint({
            masterThoughtFingerprint: parentFp,
            bigThoughtFingerprints: siblingRows.map((row) =>
              bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp }),
            ),
          });
          for (const row of listed) {
            const prior = passedIndividual.get(row.code.toUpperCase());
            if (!prior) continue;
            await publishBigThoughtChecklist(row.code, row.statement, checkingSiblingFrame(prior), done, total);
          }
          sibling = await judgeSiblingSet(
            {
              parentStatement: selected.statement,
              rows: siblingRows.map((row) => ({ code: row.code, statement: row.statement })),
              fingerprint,
            },
            (prompt) => askScoped("audit", "Big Thought", prompt, 0),
          );
          for (const row of listed) {
            const prior = passedIndividual.get(row.code.toUpperCase());
            if (!prior) continue;
            const gate = auditSiblingGate({
              code: row.code,
              siblingSet: sibling,
              siblingSetCurrent: true,
              activeCodes: siblingRows.map((item) => item.code),
            });
            const settled = completeChecklist(prior, gate);
            await publishBigThoughtChecklist(row.code, row.statement, checklistFrame(settled, "sibling", "checked"), done, total);
            if (!settled.passed && settled.failure) {
              failures.set(row.code.toUpperCase(), settled.failure);
              passedIndividual.delete(row.code.toUpperCase());
            } else {
              passedIndividual.set(row.code.toUpperCase(), settled);
            }
          }
        } else {
          for (const row of listed) {
            const prior = passedIndividual.get(row.code.toUpperCase());
            if (!prior) continue;
            const settled = completeChecklist(prior, { passed: true, reason: "" });
            await publishBigThoughtChecklist(row.code, row.statement, checklistFrame(settled, "sibling", "checked"), done, total);
            passedIndividual.set(row.code.toUpperCase(), settled);
          }
        }
        const items = listed.map((row) => {
          const codeKey = row.code.toUpperCase();
          const statementFingerprint = bigThoughtFingerprint({
            statement: row.statement,
            masterThoughtFingerprint: parentFp,
          });
          if (heldPass.has(codeKey) || passedIndividual.has(codeKey)) {
            const skipped = heldPass.has(codeKey) ? [] : skipFor("bigThought");
            return {
              code: row.code,
              verdict: "AUDIT_PASS" as const,
              statementFingerprint,
              gatesChecked: true as const,
              ...(skipped.length ? { skipped } : {}),
            };
          }
          const failure = failures.get(codeKey);
          return {
            code: row.code,
            verdict: "AUDIT_FAIL" as const,
            statementFingerprint,
            ...(failure ? { gateFailure: failure } : {}),
          };
        });
        const nextSetFingerprint = incumbentSetFingerprint({
          masterThoughtFingerprint: parentFp,
          bigThoughtFingerprints: listed.map((row) =>
            bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp }),
          ),
        });
        const saved = nextAuthoritativeSetRecord({
          record: setRecord,
          parentFingerprint: parentFp,
          siblingSet: sibling,
          audit: { setFingerprint: nextSetFingerprint, items },
          challenger: setRecord?.challenger?.setFingerprint === nextSetFingerprint ? setRecord.challenger : null,
        });
        const passedCodes = items.filter((item) => item.verdict === "AUDIT_PASS").map((item) => item.code);
        for (const code of passedCodes) bigThoughtFixLessonsRef.current.delete(code.toUpperCase());
        await masters.saveSet.mutateAsync({
          id: selected.id,
          lastAudit: { ...saved, fixLessons: dropFixLessons(saved.fixLessons, passedCodes) },
        });
      } finally {
        setAuditProgress(null);
      }
    }, "audit", "Big Thought");


  const onChallenger = () =>
    run(async () => {
      if (!selected || !parentFp || !challengerReady) return;
      const passing = shownRowViews.filter((row) => row.audit === "AUDIT_PASS");
      const script = await askThinkingLab(
        buildChallengerPrompt({
          parentStatement: selected.statement,
          rows: passing.map((row) => ({ code: row.code, statement: row.statement })),
        }),
      );
      const challenger = parseChallenger(script, setFingerprint);
      const next: LabSetRecord = {
        ...(setRecord ?? emptySetRecord()),
        challenger,
      };
      await masters.saveSet.mutateAsync({ id: selected.id, lastAudit: next });
      setNotice(challenger.status);
    }, "challenger", "Big Thought");

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
                                  admittedAngles.length < ACTIVE_SET_CAP &&
                                  angleStage !== "fix"
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
                                onFixFailedAngles={
                                  focus.kind === "territory" &&
                                  !angleSetLocked &&
                                  angleVerdicts.some((verdict) => verdict === "AUDIT_FAIL")
                                    ? () => void run(() => repairFailedAngles(), "fix-angles")
                                    : undefined
                                }
                                fixingAngleCodes={
                                  focus.kind === "territory" && !angleSetLocked ? [...fixingAngleCodes] : undefined
                                }
                                onLockAngles={
                                  focus.kind === "territory" &&
                                  !angleSetLocked &&
                                  admittedAngles.length > 0 &&
                                  angleVerdicts.every((verdict) => verdict === "AUDIT_PASS") &&
                                  !angleExampleOpen
                                    ? () => void onLockAngles()
                                    : undefined
                                }
                                angleNotes={focus.kind === "territory" && !angleSetLocked ? angleNotes : undefined}
                                angleFixOffers={
                                  focus.kind === "territory" && !angleSetLocked
                                    ? angleFixOffers
                                        .filter((offer) => offer.territoryId === focusedTerritory?.id)
                                        .map((offer) => ({ failedCode: offer.failedCode, statement: offer.statement }))
                                    : undefined
                                }
                                onPickAngleFixOffer={
                                  focus.kind === "territory" && !angleSetLocked
                                    ? (code, statement) => void onPickAngleFixOffer(code, statement)
                                    : undefined
                                }
                                territories={
                                  focus.kind === "bigThought" && !territoriesPanelClosed
                                    ? (focusedThought?.territories ?? []).map((row) => {
                                        const liveChecks = territoryChecklists[row.code.toUpperCase()]?.checks;
                                        const storedRow = (labTerritories.data ?? []).find((item) => item.id === row.id);
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
                                                  generatePasses: storedRow?.canonicalSemantic.generatePasses,
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
                                  admittedTerritories.length > 0 &&
                                  territoryVerdicts.length === admittedTerritories.length &&
                                  territoryVerdicts.every((verdict) => verdict === "AUDIT_PASS")
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
                                onRemoveCoveringTerritory={
                                  focus.kind === "bigThought" &&
                                  !territoriesPanelClosed &&
                                  (territorySet.data?.repairCount ?? 0) > 0 &&
                                  storedTerritorySet &&
                                  territorySetIsCurrent(storedTerritorySet, territoryFingerprintNow) &&
                                  (storedTerritorySet.containmentPairs.length > 0 ||
                                    storedTerritorySet.materialOverlapPairs.length > 0)
                                    ? (code) => {
                                        const row = admittedTerritories.find(
                                          (item) => item.code.toUpperCase() === code.toUpperCase(),
                                        );
                                        if (!row || !focusedThought) return;
                                        setPendingDelete({
                                          kind: "territory",
                                          id: row.id,
                                          bigThoughtId: focusedThought.id,
                                        });
                                      }
                                    : undefined
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
                                territoryNotes={focus.kind === "bigThought" && !territoriesPanelClosed ? territoryNotes : undefined}
                                territoryFixOffers={
                                  focus.kind === "bigThought" && !territoriesPanelClosed
                                    ? territoryFixOffers
                                        .filter((offer) => offer.thoughtId === focusedThought?.id)
                                        .map((offer) => ({
                                          failedCode: offer.failedCode,
                                          statement: offer.statement,
                                        }))
                                    : undefined
                                }
                                onPickTerritoryFixOffer={
                                  focus.kind === "bigThought" && !territoriesPanelClosed
                                    ? (code, statement) => void onPickTerritoryFixOffer(code, statement)
                                    : undefined
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
                                                  else if (masterMenuStage === "challenger") void onChallenger();
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
                                                  : masterMenuStage === "challenger"
                                                    ? t("thinkingLab.action.challenger", "Challenger")
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
                                      missingWhy={missingWhy}
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
                                      onRewriteBigThought={(code) => onFixBigThought(code, "replace")}
                                      stuckFixes={stuckBigThoughtFixes(setRecord?.fixLessons, BT_FIX_STUCK_LESSONS)}
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
