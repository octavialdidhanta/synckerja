import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader2, MoreVertical, Sparkles } from "lucide-react";
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
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { cn } from "@/shared/lib/utils";
import { askThinkingLab, parseModelJson } from "@/thinking-lab/shared/ai";
import { ACTIVE_SET_CAP } from "@/thinking-lab/shared/limits";
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
import { fixAttemptCap, nextFixScope, scopeFromHistory, type FixScope } from "@/thinking-lab/shared/fixScope";
import {
  acceptChosenBelief,
  acceptPlantedBelief,
  assessMasterThought,
  beliefClaim,
  beliefsMatch,
  buildMasterChoicePrompt,
  collectBeliefOptions,
  confirmedFingerprint,
  confirmedParentReady,
  factsMatchStoredFingerprint,
  judgeMasterThought,
  parseMasterChoiceSet,
  type MasterChoiceSet,
  resolveConfirmation,
  understandFingerprint,
} from "@/thinking-lab/master-thought/semantic";
import { masterBeliefDescription } from "@/thinking-lab/master-thought/description";
import { territoryDescriptions, writeTerritoryAreaSentence } from "@/thinking-lab/territory/description";
import {
  beginSiblingCheck,
  emptyPassChecklist,
  finishSiblingCheck,
  runTerritoryIndividualChecks,
  runTerritoryOpenChecks,
  type TerritoryPassCheck,
} from "@/thinking-lab/territory/passChecklist";
import { ANSWERED_QUESTION_VERSION, resolveAnsweredQuestion } from "@/thinking-lab/big-thought/answeredQuestion";
import type { ConfirmationSource, LabMasterThought } from "@/thinking-lab/master-thought/types";
import { useMasterThought } from "@/thinking-lab/master-thought/useMasterThought";
import {
  clearSetConclusions,
  displayedAuditVerdict,
  holdPassingAuditVerdicts,
  heldAuditAfterFix,
  keptPassingAuditItems,
  emptySetRecord,
  exclusionsForParent,
  exclusionsFromSiblingSet,
  mergeExclusionEntries,
  mergeExclusionHistory,
  nextAuthoritativeSetRecord,
  parseLabSetRecord,
  persistedSetRecordAfterFix,
  scoreAudit,
  siblingSetBelongsToParent,
  siblingSetIsCurrent,
  siblingSetNeedsFreshJudgment,
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
  judgeCandidateWithAsk,
  nextBigThoughtCode,
  parseGeneratedBigThoughts,
  runGenerateRounds,
} from "@/thinking-lab/big-thought/generate";
import { asBecauseClause, becauseSentence } from "@/thinking-lab/big-thought/because";
import {
  bigThoughtLabelIsOpen,
  bigThoughtLabelRestates,
  buildBigThoughtLabelPrompt,
  buildKeyBeliefFromLabelPrompt,
  parseBigThoughtLabels,
  parseKeyBeliefFromLabel,
  readBigThoughtLabel,
} from "@/thinking-lab/big-thought/label";
import {
  precheckReplacementCandidate,
  presentFixModelResponse,
  runFixReplacements,
  type FixModelResponse,
  type FixOffer,
} from "@/thinking-lab/big-thought/fix";
import { evaluateLock, selectStageAction } from "@/thinking-lab/big-thought/lock";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import { manualRejection, ManualStatementForm } from "@/thinking-lab/section/ManualStatementForm";
import { activeBigThoughts } from "@/thinking-lab/big-thought/repository";
import { judgeSiblingSet } from "@/thinking-lab/big-thought/semantic";
import type { BigThoughtFacts, LabBigThought, LabSetRecord, SemanticExclusion } from "@/thinking-lab/big-thought/types";
import { useBigThoughts, useLockedLabTree } from "@/thinking-lab/big-thought/useBigThoughts";
import { canShowGenerateAngle } from "@/thinking-lab/angle/eligibility";
import { angleChallengerCanRun, buildAngleChallengerPrompt, coverageFromAngleChallenger, parseAngleChallenger } from "@/thinking-lab/angle/challenger";
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
  beginAngleSiblingCheck,
  emptyAnglePassChecklist,
  finishAngleSiblingCheck,
  runAngleIndividualChecks,
  runAngleOpenChecks,
  type AnglePassCheck,
} from "@/thinking-lab/angle/passChecklist";
import {
  buildAngleGapPrompt,
  judgeAndSealAngle,
  nextAngleCode,
  parseGeneratedAngleDrafts,
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
  applyAngleChallengerCoverage,
  angleCodesHeldPass,
  buildAngleSiblingPrompt,
  emptyAngleSetRecord,
  holdPassingAngleVerdicts,
  mergeAngleAuditLessons,
  parseAngleSet,
  scoreAngleAudit,
  usableAngleFixLessons,
} from "@/thinking-lab/angle/setAudit";
import { useAngleSet, useLabAngles } from "@/thinking-lab/angle/useAngles";
import { canShowGenerateIdea } from "@/thinking-lab/idea/eligibility";
import { ideaLabel } from "@/thinking-lab/idea/subject";
import { buildIdeaFixOptionsPrompt, ideaReplacementPasses, parseIdeaFixDraftScript } from "@/thinking-lab/idea/fix";
import { sameIdeaConcept } from "@/thinking-lab/idea/conceptIdentity";
import {
  IDEA_ACTIVE_CAP,
  judgeAndSealIdea,
  nextIdeaCode,
  proposeIdeaStatements,
  runIdeaGenerate,
  shownIdeaFacts,
} from "@/thinking-lab/idea/generate";
import { evaluateIdeaLock, selectIdeaStage } from "@/thinking-lab/idea/lock";
import { loadIdeaParentGate, loadIdeaSet, saveIdeaSet } from "@/thinking-lab/idea/repository";
import { admitIdea, visibleIdeas } from "@/thinking-lab/idea/policy";
import {
  beginIdeaSiblingCheck,
  emptyIdeaPassChecklist,
  finishIdeaSiblingCheck,
  ideaChecklistPassed,
  ideaVerdictForStage,
  runIdeaIndividualChecks,
  runIdeaOpenChecks,
  type IdeaPassCheck,
} from "@/thinking-lab/idea/passChecklist";
import {
  buildIdeaSiblingPrompt,
  emptyIdeaSetRecord,
  holdPassingIdeaVerdicts,
  ideaCodesHeldPass,
  ideaFailureLessons,
  ideaSetIsCurrent,
  mergeIdeaAuditLessons,
  parseIdeaSet,
  scoreIdeaAudit,
  usableIdeaFixLessons,
} from "@/thinking-lab/idea/setAudit";
import type { IdeaSemanticFacts } from "@/thinking-lab/idea/types";
import { useIdeaSet, useLabIdeas } from "@/thinking-lab/idea/useIdeas";
import { buildExecutionGeneratePrompt, judgeAndSealExecution } from "@/thinking-lab/execution/generate";
import {
  buildExecutionMeaningRepairPrompt,
  executionChecklistPassed,
  executionChecksFromAudit,
  executionFactsFromChecks,
  executionFailureMoved,
  lessonFromMeaningAudit,
  meaningLineRepairReady,
  mergeExecutionAuditLessons,
  parseExecutionNarrationReplacements,
  runExecutionMeaningChecks,
  runExecutionOpenChecks,
  EXECUTION_LINE_REPAIR_IDS,
  type ExecutionPassCheck,
} from "@/thinking-lab/execution/passChecklist";
import {
  buildExecutionConfirmPrompt,
  parseDiscoveredQuestions,
  type ExecutionConfirmQuestion,
  type ScriptDecision,
} from "@/thinking-lab/execution/confirm";
import { useOrgContentPillars, type LabContentPillar } from "@/thinking-lab/execution/pillars";
import { buildPillarRecommendationPrompt, parsePillarRecommendation, pillarNeedsRecommendation, pillarWasRecommended } from "@/thinking-lab/execution/recommend";
import { isFailedMeaningAudit, type ExecutionSemanticFacts } from "@/thinking-lab/execution/types";
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
  withCharacterVisuals,
  withSpeech,
  withoutCharacterVisual,
  type CharacterVisualKind,
  type ScriptAudio,
  type ScriptLook,
  type ScriptSpeech,
  type VoiceOverScript,
} from "@/thinking-lab/execution/script";
import { useLabExecutions } from "@/thinking-lab/execution/useExecutions";
import { canGenerateTerritory } from "@/thinking-lab/territory/eligibility";
import {
  buildTerritoryFixOptionsPrompt,
  parseTerritoryFixOptionsScript,
  territoryReplacementPasses,
} from "@/thinking-lab/territory/fix";
import {
  admittedTerritorySetChanged,
  judgeAndSealTerritory,
  nextTerritoryCode,
  proposeTerritoryStatements,
  runTerritoryGenerate,
  shownTerritoryFacts,
  TERRITORY_ACTIVITY_REASON,
  TERRITORY_NAME_LENGTH_REASON,
  territoryNameIsActivity,
  territoryNameTooLong,
} from "@/thinking-lab/territory/generate";
import { admitTerritory } from "@/thinking-lab/territory/policy";
import { loadTerritoryParentGate, loadTerritorySet, saveTerritorySet } from "@/thinking-lab/territory/repository";
import { buildTerritoryChallengerPrompt, coverageFromChallenger, parseTerritoryChallenger, territoryChallengerCanRun } from "@/thinking-lab/territory/challenger";
import { evaluateTerritoryLock, selectTerritoryStage } from "@/thinking-lab/territory/lock";
import {
  applyChallengerCoverage,
  buildTerritorySiblingPrompt,
  emptyTerritorySetRecord,
  parseTerritorySet,
  holdPassingTerritoryVerdicts,
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
import { ExecutionScriptPanel, ExecutionScriptTable, type CharacterGenerateState } from "@/thinking-lab/section/ExecutionScriptPanel";
import type { CharacterStudioTab } from "@/thinking-lab/section/CharacterVisualStudio";
import { CharacterSheetError, copyStoredCharacterVisual, generateCharacterVisuals, removeCharacterVisual, storeCharacterVisual } from "@/thinking-lab/execution/generateCharacterVisual";
import { invalidateContentPillarQueries } from "@/6-1-dashboard/lib/contentPillarTracker";
import { SaveToPlanModal } from "@/6-1-script-generator/components/SaveToPlanModal";
import { PillarPickerSheet } from "@/thinking-lab/section/PillarPickerSheet";
import { ExecutionConfirmDialog } from "@/thinking-lab/section/ExecutionConfirmDialog";
import { MasterThoughtMapTree } from "@/thinking-lab/section/MasterThoughtMapTree";
import { SavedMasterThoughtList } from "@/thinking-lab/section/SavedMasterThoughtList";
import { MasterThoughtSection } from "@/thinking-lab/section/MasterThoughtSection";
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

export function ThinkingLabPage() {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const masters = useMasterThought();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newPrior, setNewPrior] = useState("");
  const [newPlanted, setNewPlanted] = useState("");
  const [newAudience, setNewAudience] = useState("");
  const [originalDraft, setOriginalDraft] = useState("");
  const [priorDraft, setPriorDraft] = useState("");
  const [audienceDraft, setAudienceDraft] = useState("");
  const [proposalDraft, setProposalDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const generatingTerritoryIdsRef = useRef(new Set<string>());
  const [generatingTerritoryIds, setGeneratingTerritoryIds] = useState<ReadonlySet<string>>(() => new Set());
  const fixingIdeaCodesRef = useRef(new Set<string>());
  const [fixingIdeaCodes, setFixingIdeaCodes] = useState<ReadonlySet<string>>(() => new Set());
  const fixingAngleCodesRef = useRef(new Set<string>());
  const [fixingAngleCodes, setFixingAngleCodes] = useState<ReadonlySet<string>>(() => new Set());
  const fixingTerritoryCodesRef = useRef(new Set<string>());
  const [fixingTerritoryCodes, setFixingTerritoryCodes] = useState<ReadonlySet<string>>(() => new Set());
  const [territoryChecklists, setTerritoryChecklists] = useState<
    Record<string, { checks: TerritoryPassCheck[]; note?: string }>
  >({});
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
  const publishAngleChecklist = (code: string, checks: AnglePassCheck[], note?: string) => {
    const key = code.trim().toUpperCase();
    setAngleChecklists((current) => ({
      ...current,
      [key]: note ? { checks, note } : { checks },
    }));
  };
  const [ideaChecklists, setIdeaChecklists] = useState<Record<string, { checks: IdeaPassCheck[]; note?: string }>>({});
  const publishIdeaChecklist = (code: string, checks: IdeaPassCheck[], note?: string) => {
    const key = code.trim().toUpperCase();
    setIdeaChecklists((current) => ({
      ...current,
      [key]: note ? { checks, note } : { checks },
    }));
  };
  const fixingBigThoughtCodesRef = useRef(new Set<string>());
  const [fixingBigThoughtCodes, setFixingBigThoughtCodes] = useState<ReadonlySet<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [fixResponses, setFixResponses] = useState<FixModelResponse[]>([]);
  const [fixOffers, setFixOffers] = useState<Array<FixOffer & { failedCode: string; label: string }>>([]);
  const [territoryFixOffers, setTerritoryFixOffers] = useState<
    Array<{ thoughtId: string; failedCode: string; statement: string; facts: TerritorySemanticFacts }>
  >([]);
  const [angleFixOffers, setAngleFixOffers] = useState<
    Array<{ territoryId: string; failedCode: string; statement: string; facts: AngleSemanticFacts }>
  >([]);
  const [ideaFixOffers, setIdeaFixOffers] = useState<
    Array<{ angleId: string; failedCode: string; statement: string; facts: IdeaSemanticFacts }>
  >([]);
  const [auditProgress, setAuditProgress] = useState<AuditProgress | null>(null);
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [showManualBigThought, setShowManualBigThought] = useState(false);
  const [focus, setFocus] = useState<
    | { kind: "master"; masterId: string }
    | { kind: "bigThought"; masterId: string; thoughtId: string }
    | { kind: "territory"; masterId: string; thoughtId: string; territoryId: string }
    | { kind: "angle"; masterId: string; thoughtId: string; territoryId: string; angleId: string }
    | { kind: "idea"; masterId: string; thoughtId: string; territoryId: string; angleId: string; ideaId: string }
    | { kind: "execution"; masterId: string; thoughtId: string; territoryId: string; angleId: string; ideaId: string; executionId: string }
    | null
  >(null);
  const skipAutoSelect = useRef(false);
  const selected = masters.data?.find((row) => row.id === selectedId) ?? null;
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

  useEffect(() => {
    setOriginalDraft(selected?.originalInput ?? "");
    setPriorDraft(selected?.priorBelief ?? "");
    setAudienceDraft(selected?.audience ?? "");
    setProposalDraft(selected?.canonicalSemantic?.proposedRootBelief ?? "");
    setShowManualBigThought(false);
  }, [selected?.id, selected?.originalInput, selected?.priorBelief, selected?.audience, selected?.canonicalSemantic?.proposedRootBelief]);

  useEffect(() => {
    setNotice(null);
    setAuditProgress(null);
    setFixResponses([]);
    setFixOffers([]);
    setTerritoryFixOffers([]);
    setAngleFixOffers([]);
    setIdeaFixOffers([]);
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
    void (async () => {
      try {
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
      }
    })();
  }, [busy, selected, thoughts.data, thoughts.organizationId, thoughts.saveLabels]);
  const territoryParentIds = useMemo(() => active.map((row) => row.id), [active]);
  const descriptionFlight = useRef(new Set<string>());
  const labTerritories = useLabTerritories(territoryParentIds);

  useEffect(() => {
    if (!thoughts.organizationId) return;
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
    );
  }, [labTerritories.data, labTerritories.saveGloss, selected?.audience, selected?.statement, thoughts.data, thoughts.organizationId]);
  const angleParentIds = useMemo(() => (labTerritories.data ?? []).map((row) => row.id), [labTerritories.data]);
  const labAngles = useLabAngles(angleParentIds);
  const ideaParentIds = useMemo(() => (labAngles.data ?? []).map((row) => row.id), [labAngles.data]);
  const labIdeas = useLabIdeas(ideaParentIds);
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

  const focusedThought =
    locked && focus && focus.kind !== "master" && focus.masterId === selected?.id
      ? (rowViews.find((row) => row.id === focus.thoughtId) ?? null)
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
  const becauseParent = (masterSubject || masterStatement).trim();
  const answeredQuestion = (
    focusedThought?.facts?.answeredQuestionVersion === ANSWERED_QUESTION_VERSION
      ? focusedThought.facts.answeredQuestion?.trim() ?? ""
      : ""
  ).trim();
  const judgmentCurrent = Boolean(
    selected?.canonicalSemantic &&
    originalDraft.trim() === selected.originalInput.trim() &&
    priorDraft.trim() === selected.priorBelief.trim() &&
    audienceDraft.trim() === selected.audience.trim(),
  );
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
  const territoryChallengerCurrent = fingerprintsMatch(
    territorySet.data?.challenger?.fingerprint,
    territoryFingerprintNow,
  );
  const territoryChallenger = territoryChallengerCurrent ? (territorySet.data?.challenger?.result ?? null) : null;
  const territoryLock = evaluateTerritoryLock({
    verdicts: territoryVerdicts,
    challenger: territoryChallenger,
    challengerCurrent: territoryChallengerCurrent && territoryChallenger?.status === "COMPLETE",
  });
  const territoryMaterialGap = Boolean(
    territoryChallenger?.status === "MATERIAL_GAP" && territoryChallenger.materialGapDescription?.trim(),
  );
  const territoryStoredCount = admittedTerritories.length;
  const territoryStage = selectTerritoryStage({
    admittedCount: admittedTerritories.length,
    verdicts: territoryVerdicts,
    challengerComplete: Boolean(
      territoryChallenger &&
        territoryChallenger.status === "COMPLETE" &&
        territoryChallenger.unresolvedReasons.length === 0,
    ),
    materialGap: territoryMaterialGap,
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
    ...(territoryChallenger?.status === "MATERIAL_GAP" && territoryChallenger.materialGapDescription
      ? [{ kind: "notice" as const, text: territoryChallenger.materialGapDescription }]
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
    territoryStage !== "generate" &&
    !territoryMaterialGap
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
  const angleChallengerCurrent = fingerprintsMatch(angleSet.data?.challenger?.fingerprint, angleFingerprintNow);
  const angleChallenger = angleChallengerCurrent ? (angleSet.data?.challenger?.result ?? null) : null;
  const angleLock = evaluateAngleLock({
    verdicts: angleVerdicts,
    challenger: angleChallenger,
    challengerCurrent: angleChallengerCurrent && angleChallenger?.status === "COMPLETE",
  });
  const angleMaterialGap = Boolean(
    angleChallenger?.status === "MATERIAL_GAP" && angleChallenger.materialGapDescription?.trim(),
  );
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
    const passedSeed = (ids: readonly string[]) => ids.map((id) => ({ id, state: "pass" as const }));
    let checklist: typeof liveChecks = liveChecks;
    if (subjectProblem && !liveSettled("ownSubject")) {
      checklist = [
        ...(liveChecks && liveChecks.some((check) => check.state !== "pending")
          ? liveChecks.filter((check) => check.id !== "ownSubject")
          : angleVerdicts[index] === "AUDIT_PASS"
            ? passedSeed([
                "stakeHolds",
                "observationShape",
                "severalIdeas",
                "clearBoundary",
                "observationJob",
                "siblingsDistinct",
              ])
            : []),
        { id: "ownSubject", state: "fail" as const, reason: subjectProblem },
      ];
    } else if (exampleProblem && !liveSettled("livedExample")) {
      checklist = [
        ...(liveChecks && liveChecks.some((check) => check.state !== "pending")
          ? liveChecks.filter((check) => check.id !== "livedExample")
          : angleVerdicts[index] === "AUDIT_PASS"
            ? passedSeed([
                "stakeHolds",
                "observationShape",
                "severalIdeas",
                "clearBoundary",
                "observationJob",
                "ownSubject",
                "siblingsDistinct",
              ])
            : []),
        { id: "livedExample", state: "fail" as const, reason: exampleProblem },
      ];
    }
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
    challengerComplete: Boolean(
      angleChallenger && angleChallenger.status === "COMPLETE" && angleChallenger.unresolvedReasons.length === 0,
    ),
    materialGap: angleMaterialGap,
    canAdd: admittedAngles.length < ACTIVE_SET_CAP,
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
    ...(angleChallenger?.status === "MATERIAL_GAP" && angleChallenger.materialGapDescription
      ? [angleChallenger.materialGapDescription]
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
  const admittedIdeas = visibleIdeas(labIdeas.data ?? [], focusedAngle?.id ?? "");
  const openIdeas = admittedIdeas.filter((row) => row.status !== "locked");
  const lockedIdeas = admittedIdeas.filter((row) => row.status === "locked");
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
  const storedIdeaSet = ideaSet.data?.siblingSet ?? null;
  const ideaAuditCurrent =
    ideaSetIsCurrent(storedIdeaSet, ideaFingerprintNow) &&
    fingerprintsMatch(ideaSet.data?.audit?.fingerprint, ideaFingerprintNow);
  const rescoredIdeaAudit =
    ideaAuditCurrent && storedIdeaSet
      ? scoreIdeaAudit({
          codes: openIdeas.map((row) => row.code),
          siblingSet: storedIdeaSet,
          siblingSetCurrent: true,
        })
      : null;
  const ideaVerdicts = openIdeas.map((row) => {
    const statementFingerprint = parentAngleFingerprint
      ? ideaFingerprint({ statement: row.statement, angleFingerprint: parentAngleFingerprint })
      : "";
    const stored = ideaSet.data?.audit?.items.find((item) => item.code.toUpperCase() === row.code.toUpperCase());
    if (
      stored?.statementFingerprint === statementFingerprint &&
      (stored.verdict === "AUDIT_PASS" || stored.verdict === "AUDIT_FAIL")
    ) {
      return stored.verdict;
    }
    return rescoredIdeaAudit?.find((item) => item.code.toUpperCase() === row.code.toUpperCase())?.verdict ?? null;
  });
  const shownIdeaVerdicts = openIdeas.map((row, index) =>
    ideaVerdictForStage(ideaVerdicts[index] ?? null, ideaChecklists[row.code.toUpperCase()]?.checks),
  );
  const ideaLock = evaluateIdeaLock({
    admittedCount: openIdeas.length,
    verdicts: shownIdeaVerdicts,
  });
  const ideaStage = selectIdeaStage({
    admittedCount: openIdeas.length,
    verdicts: shownIdeaVerdicts,
    repairsUsed: (ideaSet.data?.repairCount ?? 0) > 0,
    lockOk: ideaLock.ok,
  });
  const ideaNotes = [
    ...(storedIdeaSet && ideaSetIsCurrent(storedIdeaSet, ideaFingerprintNow)
      ? [
          ...storedIdeaSet.materialOverlapPairs.map((pair) => `${pair.ideaCodeA} · ${pair.ideaCodeB}: ${pair.explanation}`),
          ...storedIdeaSet.containmentPairs.map(
            (pair) => `${pair.containerCode} · ${pair.containedCode}: ${pair.explanation}`,
          ),
        ]
      : []),
    ...(ideaVerdicts.some((verdict) => verdict === "AUDIT_FAIL") &&
    (ideaSet.data?.repairCount ?? 0) > 0
      ? [t("thinkingLab.idea.repairStopped", "Fix already ran once. This set stays open until the ideas pass.")]
      : []),
  ];
  const ideaSetLocked = admittedIdeas.length > 0 && admittedIdeas.every((row) => row.status === "locked");
  const focusedIdea =
    focus?.kind === "idea" || focus?.kind === "execution"
      ? ((labIdeas.data ?? []).find((row) => row.id === focus.ideaId) ?? null)
      : null;
  const labExecutions = useLabExecutions(focusedIdea?.status === "locked" ? focusedIdea.id : null);
  const contentPillars = useOrgContentPillars(masters.organizationId, locked);
  const [pillarPickerOpen, setPillarPickerOpen] = useState(false);
  const [scriptConfirm, setScriptConfirm] = useState<{
    pillars: LabContentPillar[];
    audio: ScriptAudio;
    look: ScriptLook;
    speech: ScriptSpeech;
    durationSeconds: number | null;
    brandName: string | null;
    cta: string | null;
    questions: ExecutionConfirmQuestion[] | null;
    loading: boolean;
    failed: boolean;
  } | null>(null);
  const [masterSells, setMasterSells] = useState<true | false | "unresolved" | "unknown">("unknown");
  const [executionChecklists, setExecutionChecklists] = useState<Record<string, ExecutionPassCheck[]>>({});
  const [executionLineOffer, setExecutionLineOffer] = useState<{
    executionId: string;
    script: VoiceOverScript;
    facts: ExecutionSemanticFacts;
  } | null>(null);
  const [executionRepairNote, setExecutionRepairNote] = useState<string | null>(null);
  const [executionProgress, setExecutionProgress] = useState<{
    phase: "write" | "audit" | "repair" | "recommend";
    pillarName: string;
  } | null>(null);
  const [fixingLineId, setFixingLineId] = useState<string | null>(null);
  const [scriptTableOpen, setScriptTableOpen] = useState(false);
  const [planSaveOpen, setPlanSaveOpen] = useState(false);
  const [characterGenerate, setCharacterGenerate] = useState<CharacterGenerateState>(null);
  const [characterVisualDelete, setCharacterVisualDelete] = useState<{ handle: string; kind: CharacterVisualKind } | null>(null);
  const [characterVisualSave, setCharacterVisualSave] = useState<{ handle: string; kind: CharacterStudioTab } | null>(null);
  const executionCancel = useRef(0);
  const confirmToken = useRef(0);
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

  const generateValidCount = countGenerateValid(rowViews);
  const auditPassCount = rowViews.filter((row) => row.audit === "AUDIT_PASS").length;
  const anyFail = rowViews.some((row) => row.audit === "AUDIT_FAIL");
  const anyStale = rowViews.some((row) => row.admission === "STALE" || row.audit === "STALE");
  const anyUnresolved = rowViews.some((row) => row.admission === "UNRESOLVED" || row.audit === "UNRESOLVED");
  const setFingerprint = parentFp
    ? incumbentSetFingerprint({
        masterThoughtFingerprint: parentFp,
        bigThoughtFingerprints: active.map((row) =>
          bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp }),
        ),
      })
    : "";
  const siblingCurrent = siblingSetIsCurrent(setRecord?.siblingSet ?? null, setFingerprint);
  const missingWhy = currentMissingWhy(setRecord?.challenger ?? null, setFingerprint);
  const challengerReady = challengerCanRun({
    auditPassCount,
    activeCount: rowViews.length,
    anyFail,
    anyStale,
    anyUnresolved,
  });
  const lockDecision = evaluateLock({
    auditPassCount,
    activeCount: rowViews.length,
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
  const stageAction = selectStageAction({
    anyFail,
    generateValidCount,
    activeCount: rowViews.length,
    missingWhy: Boolean(missingWhy),
    auditPassCount,
    anyStale,
    anyUnresolved,
    siblingCurrent,
    challengerComplete,
    lockOk: lockDecision.ok,
  });
  const showGenerateBigThought = Boolean(
    ready && masterSubject && !locked && rowViews.length < ACTIVE_SET_CAP && stageAction !== "generate",
  );
  const masterMenuStage = stageAction === "fix" ? null : stageAction;
  const admission = selected
    ? assessMasterThought(
        selected.canonicalSemantic,
        factsMatchStoredFingerprint({
          facts: selected.canonicalSemantic,
          storedFingerprint: selected.semanticFingerprint,
          originalInput: selected.originalInput,
          proposedRootBelief: selected.canonicalSemantic?.proposedRootBelief ?? null,
        }) || parentIsReady(selected),
      )
    : null;

  const run = async (work: () => Promise<void>, action?: string) => {
    if (!masters.organizationId) return;
    setBusy(true);
    setBusyAction(action ?? null);
    setNotice(null);
    setFixResponses([]);
    try {
      await work();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("thinkingLab.error.generic", "Thinking Lab could not finish that step."));
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const runManual = async (action: string, work: () => Promise<string | null>): Promise<string | null> => {
    if (!masters.organizationId) return null;
    setBusy(true);
    setBusyAction(action);
    setNotice(null);
    try {
      return await work();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("thinkingLab.error.generic", "Thinking Lab could not finish that step.");
      toast.error(message);
      return message;
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const onCreate = () =>
    run(async () => {
      const planted = newPlanted.trim();
      const priorBelief = newPrior.trim();
      const audience = newAudience.trim();
      const created = await masters.create.mutateAsync({ planted, priorBelief, audience });
      const facts = await collectBeliefOptions({ planted, priorBelief, audience }, (prompt) => askThinkingLab(prompt, 0.2));
      await masters.saveJudge.mutateAsync({
        id: created.id,
        facts,
        fingerprint: understandFingerprint(planted, null),
      });
      setNewPrior("");
      setNewPlanted("");
      setNewAudience("");
      setComposerOpen(false);
      skipAutoSelect.current = false;
      setSelectedId(created.id);
    }, "formulate");

  const closeComposer = () => {
    setComposerOpen(false);
    setNewPrior("");
    setNewPlanted("");
    setNewAudience("");
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
      void run(async () => {
        await thoughts.remove.mutateAsync(target.id);
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

  const onUnderstand = (clarification?: { question: string; answer: string }) =>
    run(async () => {
      if (!selected) return;
      const prior = priorDraft.trim();
      const audience = audienceDraft.trim();
      const chosen = clarification?.answer.trim() ?? "";
      if (chosen) {
        if (beliefsMatch(chosen, prior)) throw new Error("SAME_BELIEF");
        const planted = originalDraft.trim() || selected.originalInput.trim();
        const facts = acceptChosenBelief(chosen);
        await masters.saveJudge.mutateAsync({
          id: selected.id,
          facts,
          fingerprint: understandFingerprint(planted, null),
        });
        return;
      }
      const text = originalDraft.trim();
      if (
        text !== selected.originalInput.trim() ||
        prior !== selected.priorBelief.trim() ||
        audience !== selected.audience.trim()
      ) {
        await masters.saveOriginal.mutateAsync({
          id: selected.id,
          planted: text,
          priorBelief: prior,
          audience,
        });
      }
      const facts = await collectBeliefOptions({ planted: text, priorBelief: prior, audience }, (prompt) => askThinkingLab(prompt, 0.2));
      await masters.saveJudge.mutateAsync({
        id: selected.id,
        facts,
        fingerprint: understandFingerprint(text, null),
      });
    }, "understand");

  const confirmWith = (source: ConfirmationSource, statement: string, facts: NonNullable<LabMasterThought["canonicalSemantic"]>) =>
    run(async () => {
      if (!selected) return;
      const decision = resolveConfirmation({
        source,
        originalInput: source === "original" ? selected.originalInput : statement,
        proposedRootBelief: statement,
        facts,
        factsCurrent: true,
      });
      if (decision.ok === false) {
        setNotice(decision.admission);
        return;
      }
      await masters.confirm.mutateAsync({
        id: selected.id,
        statement: decision.statement,
        source,
        facts,
        fingerprint: confirmedFingerprint(decision.statement, decision.statement),
      });
      setEditingMasterId(null);
    });

  const onConfirmOriginal = () => {
    if (!selected?.canonicalSemantic) return;
    const plantedDrift = originalDraft.trim() !== selected.originalInput.trim();
    const priorDrift = priorDraft.trim() !== selected.priorBelief.trim();
    const audienceDrift = audienceDraft.trim() !== selected.audience.trim();
    if (plantedDrift || priorDrift || (!selected.confirmationSource && audienceDrift)) {
      setNotice("STALE");
      return;
    }
    if (audienceDrift) {
      void run(async () => {
        await masters.saveOriginal.mutateAsync({
          id: selected.id,
          planted: selected.originalInput,
          priorBelief: selected.priorBelief,
          audience: audienceDraft.trim(),
        });
        const decision = resolveConfirmation({
          source: "original",
          originalInput: selected.originalInput,
          proposedRootBelief: selected.originalInput,
          facts: selected.canonicalSemantic,
          factsCurrent: true,
        });
        if (decision.ok === false || !selected.canonicalSemantic) {
          setNotice(decision.ok === false ? decision.admission : "UNRESOLVED");
          return;
        }
        await masters.confirm.mutateAsync({
          id: selected.id,
          statement: decision.statement,
          source: "original",
          facts: selected.canonicalSemantic,
          fingerprint: confirmedFingerprint(decision.statement, decision.statement),
        });
        setEditingMasterId(null);
      });
      return;
    }
    void confirmWith("original", selected.originalInput, selected.canonicalSemantic);
  };

  const onConfirmProposal = () => {
    if (!selected?.canonicalSemantic?.proposedRootBelief) return;
    void confirmWith("recommendation", selected.canonicalSemantic.proposedRootBelief, selected.canonicalSemantic);
  };

  const onConfirmEdit = () =>
    run(async () => {
      if (!selected) return;
      const facts = await judgeMasterThought(proposalDraft, askThinkingLab, undefined, {
        priorBelief: selected.priorBelief,
        audience: selected.audience,
      });
      const decision = resolveConfirmation({
        source: "edited",
        originalInput: proposalDraft,
        proposedRootBelief: facts.proposedRootBelief,
        facts,
        factsCurrent: true,
      });
      if (decision.ok === false) {
        setNotice(decision.admission);
        return;
      }
      await masters.confirm.mutateAsync({
        id: selected.id,
        statement: decision.statement,
        source: "edited",
        facts,
        fingerprint: confirmedFingerprint(decision.statement, decision.statement),
      });
      setEditingMasterId(null);
    });

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
      let record = parseLabSetRecord(selected.lastAudit);
      await runGenerateRounds({
        parentStatement: becauseParent,
        incumbents: rowViews.map((row) => ({
          code: row.code,
          statement: row.statement,
          label: row.label,
          admission: row.admission,
        })),
        activeCount: rowViews.length,
        missingWhy,
        topUp: true,
        propose: async (plan, incumbents) => {
          const script = await askThinkingLab(
            buildGeneratePrompt({
              parentStatement: becauseParent,
              incumbents: incumbents
                .filter((row) => row.admission === "GENERATE_VALID")
                .map((row) => ({ code: row.code, statement: row.statement, label: row.label })),
              needed: plan.needed,
              missingWhy: plan.missingWhy,
            }),
            0.2,
          );
          return parseGeneratedBigThoughts(script ? parseModelJson(script) : null, becauseParent);
        },
        judge: (statement, siblings) =>
          judgeCandidateWithAsk({
            parentStatement: becauseParent,
            statement,
            code: "NEW",
            siblings,
            ask: askThinkingLab,
          }),
        persist: async (candidate, facts) => {
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
          record = clearSetConclusions(record);
          await masters.saveSet.mutateAsync({ id: selected.id, lastAudit: record });
          return {
            code: saved.code,
            statement: saved.statement,
            label: saved.label,
            admission: individualAdmission({ facts: { ...facts, code }, factsCurrent: true }),
          };
        },
      });
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
      const result = await runTerritoryGenerate({
        loadParent: () =>
          loadTerritoryParentGate({
            organizationId: masters.organizationId as string,
            bigThoughtId,
            masterThoughtFingerprint: parentFp,
          }),
        incumbents: known.map((row) => ({
          code: row.code,
          statement: row.statement,
          admission: row.admission,
          bigThoughtId: row.bigThoughtId,
          relationToParent: row.canonicalSemantic.relationToParent,
        })),
        topUp: true,
        propose: (plan, parent, incumbents) =>
          proposeTerritoryStatements({
            parentStatement: parent.statement,
            ancestors: parent.ancestors,
            audience: parent.audience || selected?.audience,
            answeredQuestion: question,
            incumbents: incumbents.map((row) => ({
              code: row.code,
              statement: row.statement,
              admission: row.admission,
              relationToParent: row.relationToParent,
            })),
            lessons: auditLessons,
            needed: plan.needed,
            ask: async (prompt) => {
              const script = await askThinkingLab(prompt, 0.2);
              if (!script) throw new Error(t("thinkingLab.error.generic", "Thinking Lab could not finish that step."));
              return script;
            },
          }),
        judge: (_parent, code, statement) => Promise.resolve(shownTerritoryFacts(code, statement)),
        persist: async ({ parent, code, statement, facts, admission }) => {
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
        admittedTerritorySetChanged(
          known.map((row) => ({ code: row.code, admission: row.admission })),
          result.incumbents,
        )
      ) {
        await saveTerritorySet({
          organizationId: masters.organizationId,
          bigThoughtId,
          record: {
            ...emptyTerritorySetRecord(),
            audit: storedSet?.audit ?? null,
            auditLessons,
          },
        });
        await queryClient.invalidateQueries({
          queryKey: ["thinking-lab-territory-set", masters.organizationId, bigThoughtId],
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
        toast.error(error instanceof Error ? error.message : t("thinkingLab.error.generic", "Thinking Lab could not finish that step."));
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
      const known = (labAngles.data ?? []).filter((row) => row.territoryId === territoryId);
      let sort = known.reduce((max, row) => Math.max(max, row.sortOrder), 0);
      const result = await runAngleGenerate({
        loadParent: () =>
          loadAngleParentGate({
            organizationId: masters.organizationId as string,
            territoryId,
            expectedBigThoughtId: territory.bigThoughtId,
            masterThoughtFingerprint: parentFp,
          }),
        incumbents: known.map((row) => ({
          code: row.code,
          statement: row.statement,
          admission: row.admission,
          territoryId: row.territoryId,
        })),
        topUp: true,
        propose: (plan, parent, incumbents) =>
          proposeAngleStatements({
            parentStatement: parent.statement,
            ancestors: parent.ancestors,
            incumbents: incumbents.map((row) => ({ code: row.code, statement: row.statement })),
            needed: plan.needed,
            ask: (prompt) => askThinkingLab(prompt, 0.2),
          }),
        judge: (_parent, code, statement) => Promise.resolve(shownAngleFacts(code, statement)),
        persist: async ({ parent, code, statement, facts, admission }) => {
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
      const keptAngleAudit = angleSet.data?.audit ?? null;
      if (territoryId === focusedTerritory?.id) {
        await angleSet.save.mutateAsync({
          ...emptyAngleSetRecord(),
          audit: keptAngleAudit,
          auditLessons: angleSet.data?.auditLessons ?? [],
        });
      } else {
        const storedAngleRecord = await loadAngleSet(masters.organizationId, territoryId);
        await saveAngleSet({
          organizationId: masters.organizationId,
          territoryId,
          record: {
            ...emptyAngleSetRecord(),
            audit: storedAngleRecord?.audit ?? null,
            auditLessons: storedAngleRecord?.auditLessons ?? [],
          },
        });
        await queryClient.invalidateQueries({
          queryKey: ["thinking-lab-angle-set", masters.organizationId, territoryId],
        });
      }
    }, "generate-angle");

  const onGenerateIdea = (angleId: string) =>
    run(async () => {
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
      if (angle.status !== "locked") {
        if (!parentTerritoryFingerprint) return;
        await angleSet.lock.mutateAsync({
          territoryFingerprint: parentTerritoryFingerprint,
          ids: [angle.id],
        });
      }
      const known = (labIdeas.data ?? []).filter((row) => row.angleId === angleId);
      let sort = known.reduce((max, row) => Math.max(max, row.sortOrder), 0);
      const result = await runIdeaGenerate({
        loadParent: () =>
          loadIdeaParentGate({
            organizationId: masters.organizationId as string,
            angleId,
            expectedTerritoryId: angle.territoryId,
            masterThoughtFingerprint: parentFp,
          }),
        incumbents: known.map((row) => ({
          code: row.code,
          statement: row.statement,
          admission: row.admission,
          angleId: row.angleId,
          locked: row.status === "locked",
        })),
        propose: (plan, parent, incumbents) =>
          proposeIdeaStatements({
            parentStatement: parent.statement,
            masterSubject,
            ancestors: ancestorsWithMaster(parent.ancestors ?? []),
            incumbents: incumbents.map((row) => ({
              code: row.code,
              statement: row.statement,
              locked: row.locked === true,
            })),
            needed: plan.needed,
            ask: (prompt) => askThinkingLab(prompt, 0.2),
          }),
        judge: (_parent, code, statement, mechanismKeys) =>
          Promise.resolve(shownIdeaFacts(code, statement, mechanismKeys)),
        persist: async ({ parent, code, statement, facts, admission }) => {
          sort += 1;
          const saved = await labIdeas.insert.mutateAsync({
            angleId: parent.id,
            expectedTerritoryId: angle.territoryId,
            masterThoughtFingerprint: parentFp,
            code,
            statement,
            sortOrder: sort,
            facts,
            admission,
          });
          return {
            code: saved.code,
            statement: saved.statement,
            admission: saved.admission,
            angleId: saved.angleId,
            locked: false,
          };
        },
      });
      if (result.outcome === "DENIED" && result.reason) {
        toast.error(result.reason);
        return;
      }
      if (result.outcome === "INSUFFICIENT_VALID_IDEAS") {
        setNotice(
          t("thinkingLab.idea.insufficient", "INSUFFICIENT_VALID_IDEAS {{count}}/{{target}}", {
            count: result.generateValid,
            target: result.target,
          }),
        );
      }
      if (angleId === focusedAngle?.id) {
        await ideaSet.save.mutateAsync({
          ...emptyIdeaSetRecord(),
          audit: ideaSet.data?.audit ?? null,
          downTop: ideaSet.data?.downTop ?? null,
          auditLessons: ideaSet.data?.auditLessons ?? [],
        });
      } else {
        const storedIdeaRecord = await loadIdeaSet(masters.organizationId, angleId);
        await saveIdeaSet({
          organizationId: masters.organizationId,
          angleId,
          record: {
            ...emptyIdeaSetRecord(),
            audit: storedIdeaRecord.audit,
            downTop: storedIdeaRecord.downTop,
            auditLessons: storedIdeaRecord.auditLessons,
          },
        });
        await queryClient.invalidateQueries({
          queryKey: ["thinking-lab-idea-set", masters.organizationId, angleId],
        });
      }
    }, "generate-idea");

  const repairFailedIdeas = async (onlyCode?: string) => {
    if (!focusedAngle || !focusedThought || !masters.organizationId || !parentFp || openIdeas.length === 0) return;
    const ancestors: AncestorStake[] = [
      ...(focusedTerritory?.statement.trim() ? [{ label: "Territory", statement: focusedTerritory.statement.trim() }] : []),
      ...angleAncestors,
    ];
    const failedAt = (index: number, code: string) =>
      ideaVerdicts[index] === "AUDIT_FAIL" ||
      (ideaChecklists[code.toUpperCase()]?.checks ?? []).some((check) => check.state === "fail");
    const failed = openIdeas.filter((row, index) => {
      if (!failedAt(index, row.code)) return false;
      return !onlyCode || row.code.toUpperCase() === onlyCode.toUpperCase();
    });
    if (failed.length === 0) return;
    const keepers = [
      ...lockedIdeas,
      ...openIdeas.filter((_, index) => ideaVerdicts[index] === "AUDIT_PASS"),
    ];
    const applied = new Map<string, string>();
    const learnedDuringFix: Array<{ code: string; statement: string; reason: string }> = [];
    for (const row of failed) {
      const learned = [...usableIdeaFixLessons(ideaSet.data?.auditLessons ?? [], row.code)];
      const refused = new Set(learned.map((lesson) => lesson.statement.trim().toLowerCase()));
      refused.add(row.statement.trim().toLowerCase());
      let shown = ideaChecklists[row.code.toUpperCase()]?.checks ?? [];
      let scope: FixScope = scopeFromHistory(shown, learned);
      let offered = false;
      for (let attempt = 0; attempt < fixAttemptCap() && !offered; attempt += 1) {
        const script = await askThinkingLab(
          buildIdeaFixOptionsPrompt({
            parentStatement: focusedAngle.statement,
            masterSubject,
            ancestors,
            failed: { code: row.code, statement: row.statement },
            keepers: keepers.map((keeper) => ({ code: keeper.code, statement: keeper.statement })),
            conflicts: ideaNotes,
            lessons: learned,
            scope,
          }),
          0.2,
        );
        const drafts = parseIdeaFixDraftScript(script);
        const draft = drafts.find(
          (candidate) =>
            !refused.has(candidate.statement.trim().toLowerCase()) &&
            !keepers.some((keeper) => sameIdeaConcept(keeper.statement, candidate.statement)),
        );
        if (!draft) {
          const repeated = drafts.map((candidate) => candidate.statement.trim()).filter(Boolean);
          if (repeated.length === 0) {
            const reason = "No replacement came back.";
            const lesson = { code: row.code, statement: row.statement, reason };
            learned.push(lesson);
            learnedDuringFix.push(lesson);
          } else {
            for (const candidate of repeated) {
              const reason = "This sentence was offered again after it already failed.";
              const lesson = { code: row.code, statement: candidate, reason };
              learned.push(lesson);
              learnedDuringFix.push(lesson);
              refused.add(candidate.toLowerCase());
            }
          }
          continue;
        }
        const keepKeys = scope.preserve.includes("causeLock") && row.canonicalSemantic.mechanismKeys.length > 0;
        const mechanismKeys = keepKeys
          ? row.canonicalSemantic.mechanismKeys
          : draft.mechanismKeys.length > 0
            ? draft.mechanismKeys
            : row.canonicalSemantic.mechanismKeys;
        const subject = draft.subject.trim() || row.canonicalSemantic.subject;
        const checked = await runIdeaOpenChecks({
          statement: draft.statement,
          parentStatement: focusedAngle.statement,
          ancestors,
          masterSubject,
          mechanismKeys,
          prior: shown,
          ask: (prompt) => askThinkingLab(prompt, 0),
          onStep: (checks) => publishIdeaChecklist(row.code, checks),
        });
        if (!checked.passed) {
          const failedCheck = checked.checks.find((check) => check.state === "fail");
          const reason = failedCheck ? `${failedCheck.id}: ${failedCheck.reason ?? ""}`.trim() : "This check could not be decided.";
          const lesson = { code: row.code, statement: draft.statement, reason };
          learned.push(lesson);
          learnedDuringFix.push(lesson);
          refused.add(draft.statement.trim().toLowerCase());
          shown = checked.checks;
          scope = nextFixScope(scope, checked.checks);
          continue;
        }
        publishIdeaChecklist(row.code, beginIdeaSiblingCheck(checked.checks));
        const rows = openIdeas.map((item) => ({
          code: item.code,
          statement: item.code.toUpperCase() === row.code.toUpperCase() ? draft.statement : item.statement,
        }));
        const fingerprint = ideaSetFingerprint({
          angleFingerprint: parentAngleFingerprint,
          ideaFingerprints: [
            ...rows.map((item) => ideaFingerprint({ statement: item.statement, angleFingerprint: parentAngleFingerprint })),
            ...lockedIdeas.map((item) =>
              ideaFingerprint({ statement: item.statement, angleFingerprint: parentAngleFingerprint }),
            ),
          ],
        });
        const siblingScript = await askThinkingLab(
          buildIdeaSiblingPrompt({
            parentStatement: focusedAngle.statement,
            rows,
            sealed: lockedIdeas.map((item) => ({ code: item.code, statement: item.statement })),
          }),
          0,
        );
        const siblingSet = parseIdeaSet(siblingScript, fingerprint);
        if (!ideaReplacementPasses(siblingSet, row.code)) {
          const reason =
            ideaFailureLessons({
              rows: [{ code: row.code, statement: draft.statement }],
              items: [{ code: row.code, verdict: "AUDIT_FAIL" }],
              siblingSet,
            })[0]?.reason ?? "Sibling audit failed this Idea.";
          const lesson = { code: row.code, statement: draft.statement, reason: `siblingsDistinct: ${reason}` };
          learned.push(lesson);
          learnedDuringFix.push(lesson);
          refused.add(draft.statement.trim().toLowerCase());
          const failedSibling = finishIdeaSiblingCheck(checked.checks, false, reason);
          shown = failedSibling;
          publishIdeaChecklist(row.code, failedSibling);
          scope = nextFixScope(scope, failedSibling);
          continue;
        }
        const passedChecks = finishIdeaSiblingCheck(checked.checks, true, "");
        publishIdeaChecklist(row.code, passedChecks);
        await labIdeas.replace.mutateAsync({
          angleId: focusedAngle.id,
          id: row.id,
          statement: draft.statement,
          facts: {
            ...row.canonicalSemantic,
            ...shownIdeaFacts(row.code, draft.statement, mechanismKeys, subject),
          },
          admission: "GENERATE_VALID",
        });
        applied.set(row.code.toUpperCase(), draft.statement);
        offered = true;
      }
    }
    const replaced = new Set(failed.map((row) => row.code.toUpperCase()));
    setIdeaFixOffers((current) =>
      current.filter((offer) => offer.angleId !== focusedAngle.id || !replaced.has(offer.failedCode.toUpperCase())),
    );
    const covered = applied.size;
    if (covered === 0) {
      if (learnedDuringFix.length > 0) {
        await ideaSet.save.mutateAsync({
          schema: "thinking-lab/idea-set/v1",
          repairCount: ideaSet.data?.repairCount ?? 0,
          siblingSet: storedIdeaSet,
          audit: ideaSet.data?.audit ?? null,
          downTop: ideaSet.data?.downTop ?? null,
          auditLessons: mergeIdeaAuditLessons(ideaSet.data?.auditLessons ?? [], learnedDuringFix),
        });
      }
    } else {
      const items = openIdeas.flatMap((row, index) => {
        const code = row.code.toUpperCase();
        const statement = applied.get(code) ?? row.statement;
        const verdict =
          applied.has(code) || ideaChecklistPassed(ideaChecklists[code]?.checks)
            ? ("AUDIT_PASS" as const)
            : ideaVerdicts[index];
        if (verdict !== "AUDIT_PASS" && verdict !== "AUDIT_FAIL") return [];
        return [
          {
            code: row.code,
            verdict,
            statementFingerprint: ideaFingerprint({
              statement,
              angleFingerprint: parentAngleFingerprint,
            }),
          },
        ];
      });
      await ideaSet.save.mutateAsync({
        schema: "thinking-lab/idea-set/v1",
        repairCount: (ideaSet.data?.repairCount ?? 0) + 1,
        siblingSet: null,
        audit: items.length > 0 ? { fingerprint: "", items } : null,
        downTop: null,
        auditLessons: mergeIdeaAuditLessons(ideaSet.data?.auditLessons ?? [], learnedDuringFix),
      });
    }
    if (covered < failed.length) {
      setNotice(
        t("thinkingLab.idea.noSafeReplacement", "NO_SAFE_REPLACEMENT {{count}}/{{failed}}", {
          count: covered,
          failed: failed.length,
        }),
      );
    } else {
      setNotice(null);
    }
  };

  const onFixIdea = (code: string) => {
    const key = code.trim().toUpperCase();
    if (!key || fixingIdeaCodesRef.current.has(key)) return;
    fixingIdeaCodesRef.current.add(key);
    setFixingIdeaCodes(new Set(fixingIdeaCodesRef.current));
    void (async () => {
      try {
        await repairFailedIdeas(code);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("thinkingLab.error.generic", "Thinking Lab could not finish that step."));
      } finally {
        fixingIdeaCodesRef.current.delete(key);
        setFixingIdeaCodes(new Set(fixingIdeaCodesRef.current));
      }
    })();
  };

  const savePassedIdeaAudit = async () => {
    if (!parentAngleFingerprint || openIdeas.length === 0) return;
    if (!shownIdeaVerdicts.every((verdict) => verdict === "AUDIT_PASS")) return;
    if (ideaVerdicts.every((verdict) => verdict === "AUDIT_PASS")) return;
    await ideaSet.save.mutateAsync({
      schema: "thinking-lab/idea-set/v1",
      repairCount: ideaSet.data?.repairCount ?? 0,
      siblingSet: storedIdeaSet,
      audit: {
        fingerprint: ideaFingerprintNow,
        items: openIdeas.map((row) => ({
          code: row.code,
          verdict: "AUDIT_PASS" as const,
          statementFingerprint: ideaFingerprint({
            statement: row.statement,
            angleFingerprint: parentAngleFingerprint,
          }),
        })),
      },
      downTop: ideaSet.data?.downTop ?? null,
      auditLessons: ideaSet.data?.auditLessons ?? [],
    });
  };

  const onIdeaStage = () =>
    run(async () => {
      if (!focusedAngle || !focusedThought || !masters.organizationId || !parentFp || openIdeas.length === 0) return;
      if (ideaStage === "fix") {
        await repairFailedIdeas();
        return;
      }
      if (ideaStage === "audit") {
        const ancestors: AncestorStake[] = [
          ...(focusedTerritory?.statement.trim() ? [{ label: "Territory", statement: focusedTerritory.statement.trim() }] : []),
          ...angleAncestors,
        ];
        const heldPass = new Set(ideaCodesHeldPass(openIdeas, shownIdeaVerdicts).map((code) => code.toUpperCase()));
        const eligible: typeof openIdeas = [];
        const checked = new Map<string, IdeaPassCheck[]>();
        const individualFailures: Array<{ code: string; statement: string; reason: string }> = [];
        for (const row of openIdeas) {
          if (heldPass.has(row.code.toUpperCase())) {
            eligible.push(row);
            continue;
          }
          const run = await runIdeaIndividualChecks({
            statement: row.statement,
            parentStatement: focusedAngle.statement,
            ancestors,
            masterSubject,
            mechanismKeys: row.canonicalSemantic.mechanismKeys,
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => publishIdeaChecklist(row.code, checks),
          });
          if (!run.passed) {
            const failedCheck = run.checks.find((check) => check.state === "fail");
            individualFailures.push({
              code: row.code,
              statement: row.statement,
              reason: failedCheck
                ? `${failedCheck.id}: ${failedCheck.reason ?? ""}`.trim()
                : "This check could not be decided.",
            });
            continue;
          }
          checked.set(row.code.toUpperCase(), run.checks);
          eligible.push(row);
          publishIdeaChecklist(row.code, beginIdeaSiblingCheck(run.checks));
        }
        const siblingRows = eligible.map((row) => ({ code: row.code, statement: row.statement }));
        const sealed = lockedIdeas.map((row) => ({ code: row.code, statement: row.statement }));
        const siblingScript =
          siblingRows.length === 0
            ? null
            : await askThinkingLab(
                buildIdeaSiblingPrompt({ parentStatement: focusedAngle.statement, rows: siblingRows, sealed }),
                0,
              );
        const siblingSet = siblingScript ? parseIdeaSet(siblingScript, ideaFingerprintNow) : storedIdeaSet;
        const siblingScores =
          siblingRows.length === 0 || !siblingSet
            ? []
            : scoreIdeaAudit({
                codes: siblingRows.map((row) => row.code),
                siblingSet,
                siblingSetCurrent: true,
              });
        for (const row of eligible) {
          const prior = checked.get(row.code.toUpperCase());
          if (!prior) continue;
          const verdict = siblingScores.find((item) => item.code.toUpperCase() === row.code.toUpperCase())?.verdict;
          const reason =
            ideaFailureLessons({
              rows: [{ code: row.code, statement: row.statement }],
              items: [{ code: row.code, verdict: "AUDIT_FAIL" }],
              siblingSet,
            })[0]?.reason ?? "Sibling audit failed this Idea.";
          publishIdeaChecklist(
            row.code,
            finishIdeaSiblingCheck(
              prior,
              verdict === "AUDIT_PASS",
              verdict === "AUDIT_PASS" ? "" : reason || "This check could not be decided.",
            ),
          );
        }
        const items = holdPassingIdeaVerdicts(
          openIdeas.map((row) => {
            const statementFingerprint = ideaFingerprint({
              statement: row.statement,
              angleFingerprint: parentAngleFingerprint,
            });
            if (individualFailures.some((failure) => failure.code.toUpperCase() === row.code.toUpperCase())) {
              return { code: row.code, verdict: "AUDIT_FAIL" as const, statementFingerprint };
            }
            const scored = siblingScores.find((item) => item.code.toUpperCase() === row.code.toUpperCase());
            return {
              code: row.code,
              verdict: scored?.verdict === "AUDIT_PASS" ? ("AUDIT_PASS" as const) : ("AUDIT_FAIL" as const),
              statementFingerprint,
            };
          }),
          [...heldPass],
        );
        const siblingLessons = ideaFailureLessons({
          rows: siblingRows,
          items,
          siblingSet,
        }).filter((lesson) => !individualFailures.some((failure) => failure.code.toUpperCase() === lesson.code.toUpperCase()));
        await ideaSet.save.mutateAsync({
          schema: "thinking-lab/idea-set/v1",
          repairCount: items.some((item) => item.verdict === "AUDIT_FAIL") ? (ideaSet.data?.repairCount ?? 0) : 0,
          siblingSet,
          audit: { fingerprint: ideaFingerprintNow, items },
          downTop: null,
          auditLessons: mergeIdeaAuditLessons(ideaSet.data?.auditLessons ?? [], [
            ...individualFailures,
            ...siblingLessons,
          ]),
        });
        return;
      }
      if (ideaStage === "lock" && ideaLock.ok) {
        await savePassedIdeaAudit();
        await ideaSet.lock.mutateAsync({
          angleFingerprint: parentAngleFingerprint,
          ids: openIdeas.map((row) => row.id),
        });
      }
    }, ideaStage ?? "audit");

  const onLockIdeas = () =>
    run(async () => {
      if (!focusedAngle || !parentAngleFingerprint || openIdeas.length === 0 || !ideaLock.ok) return;
      if (!shownIdeaVerdicts.every((verdict) => verdict === "AUDIT_PASS")) return;
      await savePassedIdeaAudit();
      await ideaSet.lock.mutateAsync({
        angleFingerprint: parentAngleFingerprint,
        ids: openIdeas.map((row) => row.id),
      });
    }, "lock");

  const onPickIdeaFixOffer = (failedCode: string, statement: string) =>
    run(async () => {
      if (!focusedAngle || !masters.organizationId) return;
      const offer = ideaFixOffers.find(
        (row) =>
          row.angleId === focusedAngle.id &&
          row.failedCode.toUpperCase() === failedCode.toUpperCase() &&
          row.statement === statement,
      );
      const previous = openIdeas.find((row) => row.code.toUpperCase() === failedCode.toUpperCase());
      if (!offer || !previous) return;
      await labIdeas.replace.mutateAsync({
        angleId: focusedAngle.id,
        id: previous.id,
        statement: offer.statement,
        facts: offer.facts,
        admission: "GENERATE_VALID",
      });
      const nextFingerprint = ideaFingerprint({
        statement: offer.statement,
        angleFingerprint: parentAngleFingerprint,
      });
      const items = (ideaSet.data?.audit?.items ?? []).map((item) =>
        item.code.toUpperCase() === failedCode.toUpperCase()
          ? { code: item.code, verdict: "AUDIT_PASS" as const, statementFingerprint: nextFingerprint }
          : item,
      );
      if (!items.some((item) => item.code.toUpperCase() === failedCode.toUpperCase())) {
        items.push({ code: previous.code, verdict: "AUDIT_PASS", statementFingerprint: nextFingerprint });
      }
      await ideaSet.save.mutateAsync({
        schema: "thinking-lab/idea-set/v1",
        repairCount: ideaSet.data?.repairCount ?? 0,
        siblingSet: null,
        audit: { fingerprint: "", items },
        downTop: ideaSet.data?.downTop ?? null,
        auditLessons: ideaSet.data?.auditLessons ?? [],
      });
      setIdeaFixOffers((current) =>
        current.filter(
          (row) => row.angleId !== focusedAngle.id || row.failedCode.toUpperCase() !== failedCode.toUpperCase(),
        ),
      );
      setNotice(null);
    }, "pick-idea-fix");

  const labelFor = async (code: string, statement: string) => {
    try {
      const script = await askThinkingLab(buildBigThoughtLabelPrompt([{ code, statement }]), 0);
      return parseBigThoughtLabels(script ? parseModelJson(script) : null).get(code.toUpperCase()) ?? "";
    } catch {
      return "";
    }
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
      if (active.length >= ACTIVE_SET_CAP) return t("thinkingLab.manual.cap", "This set is full.");
      const read = readBigThoughtLabel(raw);
      if (read.ok === false) {
        return read.reason === "TOO_LONG" ? t("thinkingLab.manual.labelTooLong", "A label stays within 12 words.") : null;
      }
      const known = thoughts.data ?? [];
      const code = nextBigThoughtCode(known.map((row) => row.code));
      const siblings = rowViews
        .filter((row) => row.admission === "GENERATE_VALID")
        .map((row) => ({ code: row.code, statement: row.statement }));
      let rejectionNote: string | null = null;
      let statement = "";
      let sealed = null as Awaited<ReturnType<typeof judgeCandidateWithAsk>> | null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const script = await askThinkingLab(
          buildKeyBeliefFromLabelPrompt({
            parentStatement: becauseParent,
            label: read.label,
            incumbents: siblings,
            rejection: rejectionNote,
          }),
          0.2,
        );
        statement = parseKeyBeliefFromLabel(script ? parseModelJson(script) : null, becauseParent);
        if (!statement) return t("thinkingLab.manual.beliefUnreadable", "The Key Belief for this label could not be read. Try again.");
        const facts = await judgeCandidateWithAsk({
          parentStatement: becauseParent,
          statement,
          code,
          siblings,
          ask: askThinkingLab,
        });
        sealed = { ...facts, code };
        const rejection = manualRejection({
          admission: individualAdmission({ facts: sealed, factsCurrent: true }),
          relation: sealed.relationToParent,
          reasons: sealed.unresolvedReasons,
          note: sealed.judgmentReason,
        });
        if (!rejection) break;
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
      const facts = await judgeCandidateWithAsk({
        parentStatement: becauseParent,
        statement: clause,
        code: row.code,
        siblings: rowViews
          .filter((item) => item.admission === "GENERATE_VALID" && item.id !== id)
          .map((item) => ({ code: item.code, statement: item.statement })),
        ask: askThinkingLab,
      });
      const sealed = { ...facts, code: row.code };
      const admission = individualAdmission({ facts: sealed, factsCurrent: true });
      const rejection = manualRejection({
        admission,
        relation: sealed.relationToParent,
        reasons: sealed.unresolvedReasons,
        note: sealed.judgmentReason,
      });
      if (rejection) return rejection;
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
      await masters.saveSet.mutateAsync({
        id: selected.id,
        lastAudit: {
          ...clearSetConclusions(parseLabSetRecord(selected.lastAudit)),
          audit: kept.length > 0 ? { setFingerprint: "held", items: kept } : null,
        },
      });
      return null;
    });

  const onEditTerritory = (id: string, statement: string) =>
    runManual("manual-territory", async () => {
      if (!focusedThought || !parentFp) return null;
      const row = (labTerritories.data ?? []).find((item) => item.id === id && item.bigThoughtId === focusedThought.id);
      if (!row || row.status !== "candidate") return null;
      const facts = await judgeAndSealTerritory({
            parentStatement: focusedThought.statement,
        ancestors: territoryAncestors,
        audience: selected?.audience,
        answeredQuestion,
        code: row.code,
        statement,
        ask: (prompt) => askThinkingLab(prompt, 0),
      });
      const admission = admitTerritory(facts);
      const rejection = manualRejection({
        admission,
        relation: facts.relationToParent,
        reasons: facts.unresolvedReasons,
      });
      if (rejection) return rejection;
      await labTerritories.replace.mutateAsync({
        bigThoughtId: focusedThought.id,
        id,
        statement,
        facts,
        admission,
      });
      await territorySet.save.mutateAsync({
        ...emptyTerritorySetRecord(),
        auditLessons: territorySet.data?.auditLessons ?? [],
      });
      return null;
    });

  const onEditAngle = (id: string, statement: string) =>
    runManual("manual-angle", async () => {
      if (!focusedTerritory || !parentFp) return null;
      const row = (labAngles.data ?? []).find((item) => item.id === id && item.territoryId === focusedTerritory.id);
      if (!row || row.status !== "candidate") return null;
      const facts = await judgeAndSealAngle({
        parentStatement: focusedTerritory.statement,
        ancestors: angleAncestors,
        code: row.code,
        statement,
        ask: (prompt) => askThinkingLab(prompt, 0),
      });
      const admission = admitAngle(facts);
      const rejection = manualRejection({
        admission,
        relation: facts.relationToParent,
        reasons: facts.unresolvedReasons,
      });
      if (rejection) return rejection;
      await labAngles.replace.mutateAsync({
        territoryId: focusedTerritory.id,
        id,
        statement,
        facts,
        admission,
      });
      await angleSet.save.mutateAsync({
        ...emptyAngleSetRecord(),
        auditLessons: angleSet.data?.auditLessons ?? [],
      });
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

  const onManualIdea = (statement: string) =>
    runManual("manual-idea", async () => {
      if (!focusedAngle || !focusedTerritory || !masters.organizationId || !parentFp) return null;
      const known = (labIdeas.data ?? []).filter((row) => row.angleId === focusedAngle.id);
      if (known.length >= IDEA_ACTIVE_CAP) return t("thinkingLab.manual.cap", "This set is full.");
      if (known.some((row) => sameIdeaConcept(row.statement, statement))) {
        return t(
          "thinkingLab.idea.repeatLocked",
          "This repeats an idea that is already saved. Locked ideas count, so write a different situation.",
        );
      }
      const code = nextIdeaCode(known.map((row) => row.code));
      const { ancestors } = ideaParentFor(focusedAngle.id);
      const facts = await judgeAndSealIdea({
        parentStatement: focusedAngle.statement,
        masterSubject,
        ancestors,
        code,
        statement,
        ask: (prompt) => askThinkingLab(prompt, 0),
      });
      const admission = admitIdea(facts);
      const rejection = manualRejection({
        admission,
        relation: facts.relationToParent,
        reasons: facts.unresolvedReasons,
      });
      if (rejection) return rejection;
      await labIdeas.insert.mutateAsync({
        angleId: focusedAngle.id,
        expectedTerritoryId: focusedAngle.territoryId,
        masterThoughtFingerprint: parentFp,
        code,
        statement,
        sortOrder: known.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1,
        facts,
        admission,
      });
      await ideaSet.save.mutateAsync({
        ...emptyIdeaSetRecord(),
        downTop: ideaSet.data?.downTop ?? null,
        auditLessons: ideaSet.data?.auditLessons ?? [],
      });
      return null;
    });

  const onEditIdea = (id: string, statement: string) =>
    runManual("manual-idea", async () => {
      if (!parentFp) return null;
      const idea = (labIdeas.data ?? []).find((row) => row.id === id);
      if (!idea || idea.status !== "candidate") return null;
      const siblings = (labIdeas.data ?? []).filter((row) => row.angleId === idea.angleId && row.id !== id);
      if (siblings.some((row) => sameIdeaConcept(row.statement, statement))) {
        return t(
          "thinkingLab.idea.repeatLocked",
          "This repeats an idea that is already saved. Locked ideas count, so write a different situation.",
        );
      }
      const { angle, ancestors } = ideaParentFor(idea.angleId);
      if (!angle) return null;
      const facts = await judgeAndSealIdea({
        parentStatement: angle.statement,
        masterSubject,
        ancestors,
        code: idea.code,
        statement,
        ask: (prompt) => askThinkingLab(prompt, 0),
      });
      const admission = admitIdea(facts);
      const rejection = manualRejection({
        admission,
        relation: facts.relationToParent,
        reasons: facts.unresolvedReasons,
      });
      if (rejection) return rejection;
      await labIdeas.replace.mutateAsync({
        angleId: idea.angleId,
        id,
        statement,
        facts,
        admission,
      });
      if (idea.angleId === focusedAngle?.id) {
        await ideaSet.save.mutateAsync({
          ...emptyIdeaSetRecord(),
          downTop: ideaSet.data?.downTop ?? null,
          auditLessons: ideaSet.data?.auditLessons ?? [],
        });
        setIdeaChecklists({});
      }
      return null;
    });

  const onStopExecution = () => {
    executionCancel.current += 1;
    setExecutionProgress(null);
    setFixingLineId(null);
  };

  const onOpenPillarPicker = () => {
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
    look: ScriptLook;
    speech: ScriptSpeech;
    durationSeconds: number | null;
    brandName: string | null;
    cta: string | null;
  }) => {
    if (!focusedIdea || focusedIdea.status !== "locked") return;
    const idea = focusedIdea;
    const token = ++confirmToken.current;
    setPillarPickerOpen(false);
    setScriptConfirm({ ...settings, questions: null, loading: true, failed: false });
    if (!masters.organizationId) {
      setScriptConfirm({ ...settings, questions: null, loading: false, failed: true });
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
        if (discovered.questions.length === 0) {
          writeNow = true;
          setScriptConfirm(null);
          return;
        }
        setScriptConfirm((current) => {
          if (!current || confirmToken.current !== token) return current;
          return { ...current, loading: false, questions: discovered.questions, failed: false };
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
      );
    });
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
    const raw = await askThinkingLab(
      buildPillarRecommendationPrompt({
        masterStatement,
        ideaStatement,
        failedPillar,
        explanation: facts.whatItSays,
        ancestors,
        pillars: options.map((pillar) => ({
          name: pillar.name,
          funnel: pillar.funnel === "middle" ? "Consideration" : pillar.funnel === "bottom" ? "Conversion" : "Awareness",
          category: pillar.category,
          description: pillar.description,
        })),
      }),
      0.2,
    );
    if (executionCancel.current !== token) return facts;
    const recommendation = parsePillarRecommendation(
      raw ? parseModelJson(raw) : null,
      options.map((pillar) => pillar.name),
      failedPillar,
    );
    return recommendation ? { ...facts, recommendation } : facts;
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
  ) => {
    if (!focus || (focus.kind !== "idea" && focus.kind !== "execution") || !focusedIdea || focusedIdea.status !== "locked") return;
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
      for (const pillar of chosen) {
        if (executionCancel.current !== token) return;
        setExecutionProgress({ phase: "write", pillarName: pillar.name });
        const raw = await askThinkingLab(
          buildExecutionGeneratePrompt({
            masterStatement,
            masterSubject,
            priorBelief: selected?.priorBelief,
            ideaStatement: idea.statement,
            pillar: pillar.name,
            ancestors,
            speech,
            durationSeconds: targetSeconds,
            brandName: brandName ?? previousScript?.brandName ?? null,
            cta: cta ?? previousScript?.cta ?? null,
            pointOfView: lockedView || null,
            decisions: lockedDecisions,
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
        const trackedId =
          (labExecutions.data ?? []).find((row) => {
            if (row.ideaId !== idea.id) return false;
            if (pillar.id && (row.contentPillarId === pillar.id || row.pillar === pillar.id)) return true;
            return row.pillarName.trim().toLowerCase() === pillar.name.trim().toLowerCase();
          })?.id ?? null;
        let liveChecks: ExecutionPassCheck[] = [];
        const checked = await runExecutionMeaningChecks({
          pillar: pillar.name,
          masterStatement,
          masterSubject,
          ideaStatement: idea.statement,
          ancestors,
          script: current,
          masterSells,
          ask: (prompt) => askThinkingLab(prompt, 0),
          resolveSelling: async () => {
            const raw = await askThinkingLab(buildMasterSellsPrompt(masterStatement), 0);
            const value = parseMasterSells(raw ? parseModelJson(raw) : null);
            setMasterSells(value);
            return value;
          },
          onStep: (checks) => {
            liveChecks = checks;
            if (!trackedId) return;
            setExecutionChecklists((lists) => ({ ...lists, [trackedId]: checks }));
          },
        });
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
      if (executionCancel.current === token) setExecutionProgress(null);
    });
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
    onGenerateExecutions(
      [pillar],
      execution.script?.audio ?? { sound: false, music: false },
      execution.script?.look,
      execution.script?.speech,
      execution.script,
      execution.script?.durationSeconds,
      execution.script?.brandName,
      execution.script?.cta,
    );
  };

  const onUseRecommendation = () => {
    if (focus?.kind !== "execution") return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    const name = execution?.canonicalSemantic.recommendation?.pillarName.trim();
    if (!execution || !name) return;
    const match = (contentPillars.data ?? []).find((pillar) => pillar.name.trim().toLowerCase() === name.toLowerCase());
    if (!match) return;
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
    );
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
        if (executionCancel.current === token) setExecutionProgress(null);
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
      let liveChecks: ExecutionPassCheck[] = [];
      const checked = await runExecutionMeaningChecks({
        pillar: current.pillarName,
        masterStatement,
        masterSubject,
        ideaStatement: idea.statement,
        ancestors,
        script: scriptNow,
        masterSells: selling,
        auditLessons: current.canonicalSemantic.auditLessons,
        ask: (prompt) => askThinkingLab(prompt, 0),
        onStep: (checks) => {
          liveChecks = checks;
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
      if (executionCancel.current === token) setExecutionProgress(null);
    });
  };

  const onRepairExecution = () => {
    if (focus?.kind !== "execution" || !focusedIdea) return;
    const execution = (labExecutions.data ?? []).find((row) => row.id === focus.executionId);
    if (!execution?.script) return;
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
          if (fresh.length === 0 || fresh.length !== replacements.length) {
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
          setExecutionProgress({ phase: "audit", pillarName: current.pillarName });
          let liveChecks: ExecutionPassCheck[] = [];
          const checked = await runExecutionOpenChecks({
            pillar: current.pillarName,
            masterStatement,
            masterSubject,
            ideaStatement: idea.statement,
            ancestors,
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
        const moved = latestScript !== scriptNow && executionFailureMoved(audit.id, latestChecks);
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
        if (executionCancel.current === token) setExecutionProgress(null);
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
      if (executionCancel.current === token) setExecutionProgress(null);
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
    const learnedDuringFix: Array<{ code: string; statement: string; reason: string }> = [];
    for (const row of failed) {
      const learned = [...usableAngleFixLessons(angleSet.data?.auditLessons ?? [], row.code)];
      const refused = new Set(learned.map((lesson) => lesson.statement.trim().toLowerCase()));
      refused.add(row.statement.trim().toLowerCase());
      let shown = angleChecklists[row.code.toUpperCase()]?.checks ?? [];
      let scope: FixScope = scopeFromHistory(shown, learned);
      const subjectProblem = angleSubjectProblem(row.canonicalSemantic.subject ?? "", focusedTerritory.statement);
      const exampleProblem = angleExampleProblem(row.canonicalSemantic.example ?? "", row.statement);
      const otherFail = shown.some((check) => check.state === "fail" && check.id !== "ownSubject");
      const storedPass = angleVerdicts[admittedAngles.findIndex((item) => item.id === row.id)] === "AUDIT_PASS";
      if (subjectProblem && !otherFail) {
        const livePassed = shown.filter((check) => check.state === "pass").map((check) => check.id);
        const passed =
          livePassed.length > 0
            ? livePassed
            : storedPass
              ? ["stakeHolds", "observationShape", "severalIdeas", "clearBoundary", "observationJob", "siblingsDistinct"]
              : [];
        scope = {
          preserve: [...new Set([...scope.preserve, ...passed])],
          repair: [{ id: "ownSubject", reason: subjectProblem }],
        };
      } else if (exampleProblem && !shown.some((check) => check.state === "fail" && check.id !== "livedExample")) {
        const livePassed = shown.filter((check) => check.state === "pass").map((check) => check.id);
        const passed =
          livePassed.length > 0
            ? livePassed
            : storedPass
              ? [
                  "stakeHolds",
                  "observationShape",
                  "severalIdeas",
                  "clearBoundary",
                  "observationJob",
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
            const lesson = { code: row.code, statement: subject || currentStatement, reason: `ownSubject: ${reason}` };
            learned.push(lesson);
            learnedDuringFix.push(lesson);
            if (subject) refused.add(subject.trim().toLowerCase());
            continue;
          }
          currentSubject = subject;
          const prior =
            shown.length > 0
              ? shown
              : scope.preserve.map((id) => ({ id, state: "pass" as const }));
          const checked = await runAngleOpenChecks({
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
            const lesson = { code: row.code, statement: currentStatement, reason };
            learned.push(lesson);
            learnedDuringFix.push(lesson);
            shown = checked.checks;
            scope = nextFixScope(scope, checked.checks);
            continue;
          }
          const siblingPassed = scope.preserve.includes("siblingsDistinct");
          if (siblingPassed) {
            const passedChecks = checked.checks.map((check) =>
              check.id === "siblingsDistinct" ? { id: check.id, state: "pass" as const } : check,
            );
            publishAngleChecklist(row.code, passedChecks);
            await labAngles.replace.mutateAsync({
              territoryId: focusedTerritory.id,
              id: row.id,
              statement: currentStatement,
              facts: {
                ...row.canonicalSemantic,
                ...shownAngleFacts(row.code, currentStatement, subject, currentExample),
                code: row.code,
              },
              admission: "GENERATE_VALID",
            });
            applied.set(row.code.toUpperCase(), currentStatement);
            offered = true;
            continue;
          }
          publishAngleChecklist(row.code, beginAngleSiblingCheck(checked.checks));
          const siblingRows = admittedAngles.map((item) => ({
            code: item.code,
            statement: item.code.toUpperCase() === row.code.toUpperCase() ? currentStatement : item.statement,
          }));
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
          if (!angleReplacementPasses(siblingSet, row.code)) {
            const reason =
              angleFailureLessons({
                rows: [{ code: row.code, statement: currentStatement }],
                items: [{ code: row.code, verdict: "AUDIT_FAIL" }],
                siblingSet,
              })[0]?.reason ?? "Sibling audit failed this Angle.";
            const lesson = { code: row.code, statement: currentStatement, reason: `siblingsDistinct: ${reason}` };
            learned.push(lesson);
            learnedDuringFix.push(lesson);
            const failedSibling = finishAngleSiblingCheck(checked.checks, false, reason);
            shown = failedSibling;
            publishAngleChecklist(row.code, failedSibling);
            scope = nextFixScope(scope, failedSibling);
            continue;
          }
          publishAngleChecklist(row.code, finishAngleSiblingCheck(checked.checks, true, ""));
          await labAngles.replace.mutateAsync({
            territoryId: focusedTerritory.id,
            id: row.id,
            statement: currentStatement,
            facts: {
              ...row.canonicalSemantic,
              ...shownAngleFacts(row.code, currentStatement, subject, currentExample),
              code: row.code,
            },
            admission: "GENERATE_VALID",
          });
          applied.set(row.code.toUpperCase(), currentStatement);
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
            const lesson = { code: row.code, statement: example || currentStatement, reason: `livedExample: ${reason}` };
            learned.push(lesson);
            learnedDuringFix.push(lesson);
            if (example) refused.add(example.trim().toLowerCase());
            continue;
          }
          currentExample = example;
          const prior =
            shown.length > 0
              ? shown
              : scope.preserve.map((id) => ({ id, state: "pass" as const }));
          const checked = await runAngleOpenChecks({
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
            const lesson = { code: row.code, statement: currentStatement, reason };
            learned.push(lesson);
            learnedDuringFix.push(lesson);
            refused.add(example.trim().toLowerCase());
            shown = checked.checks;
            scope = nextFixScope(scope, checked.checks);
            continue;
          }
          const siblingPassed = scope.preserve.includes("siblingsDistinct");
          if (siblingPassed) {
            const passedChecks = checked.checks.map((check) =>
              check.id === "siblingsDistinct" ? { id: check.id, state: "pass" as const } : check,
            );
            publishAngleChecklist(row.code, passedChecks);
            await labAngles.replace.mutateAsync({
              territoryId: focusedTerritory.id,
              id: row.id,
              statement: currentStatement,
              facts: {
                ...row.canonicalSemantic,
                ...shownAngleFacts(row.code, currentStatement, currentSubject, example),
                code: row.code,
              },
              admission: "GENERATE_VALID",
            });
            applied.set(row.code.toUpperCase(), currentStatement);
            offered = true;
            continue;
          }
          publishAngleChecklist(row.code, beginAngleSiblingCheck(checked.checks));
          const siblingRows = admittedAngles.map((item) => ({
            code: item.code,
            statement: item.code.toUpperCase() === row.code.toUpperCase() ? currentStatement : item.statement,
          }));
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
          if (!angleReplacementPasses(siblingSet, row.code)) {
            const reason =
              angleFailureLessons({
                rows: [{ code: row.code, statement: currentStatement }],
                items: [{ code: row.code, verdict: "AUDIT_FAIL" }],
                siblingSet,
              })[0]?.reason ?? "Sibling audit failed this Angle.";
            const lesson = { code: row.code, statement: currentStatement, reason: `siblingsDistinct: ${reason}` };
            learned.push(lesson);
            learnedDuringFix.push(lesson);
            refused.add(example.trim().toLowerCase());
            const failedSibling = finishAngleSiblingCheck(checked.checks, false, reason);
            shown = failedSibling;
            publishAngleChecklist(row.code, failedSibling);
            scope = nextFixScope(scope, failedSibling);
            continue;
          }
          publishAngleChecklist(row.code, finishAngleSiblingCheck(checked.checks, true, ""));
          await labAngles.replace.mutateAsync({
            territoryId: focusedTerritory.id,
            id: row.id,
            statement: currentStatement,
            facts: {
              ...row.canonicalSemantic,
              ...shownAngleFacts(row.code, currentStatement, currentSubject, example),
              code: row.code,
            },
            admission: "GENERATE_VALID",
          });
          applied.set(row.code.toUpperCase(), currentStatement);
          offered = true;
          continue;
        }
        const script = await askThinkingLab(
          buildAngleFixOptionsPrompt({
            parentStatement: focusedTerritory.statement,
            ancestors: angleAncestors,
            failed: { code: row.code, statement: currentStatement },
            keepers: keepers.map((keeper) => ({ code: keeper.code, statement: keeper.statement })),
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
            const reason = "No replacement came back.";
            const lesson = { code: row.code, statement: row.statement, reason };
            learned.push(lesson);
            learnedDuringFix.push(lesson);
          } else {
            for (const candidate of candidates) {
              const reason = "This sentence was offered again after it already failed.";
              const lesson = { code: row.code, statement: candidate, reason };
              learned.push(lesson);
              learnedDuringFix.push(lesson);
              refused.add(candidate.trim().toLowerCase());
            }
          }
          continue;
        }
        const checked = await runAngleOpenChecks({
          statement,
          parentStatement: focusedTerritory.statement,
          ancestors: angleAncestors,
          subject: subjectForCheck,
          example: exampleForCheck,
          prior: shown,
          ask: (prompt) => askThinkingLab(prompt, 0),
          onStep: (checks) => publishAngleChecklist(row.code, checks),
        });
        if (!checked.passed) {
          const failedCheck = checked.checks.find((check) => check.state === "fail");
          const reason = failedCheck ? `${failedCheck.id}: ${failedCheck.reason ?? ""}`.trim() : "This check could not be decided.";
          const lesson = { code: row.code, statement, reason };
          learned.push(lesson);
          learnedDuringFix.push(lesson);
          refused.add(statement.trim().toLowerCase());
          if (exampleForCheck) refused.add(exampleForCheck.trim().toLowerCase());
          if (failedCheck?.id === "ownSubject" || failedCheck?.id === "livedExample") {
            currentStatement = statement;
            if (subjectForCheck) currentSubject = subjectForCheck;
            if (exampleForCheck) currentExample = exampleForCheck;
          }
          shown = checked.checks;
          scope = nextFixScope(scope, checked.checks);
          continue;
        }
        publishAngleChecklist(row.code, beginAngleSiblingCheck(checked.checks));
        const rows = admittedAngles.map((item) => ({
          code: item.code,
          statement: item.code.toUpperCase() === row.code.toUpperCase() ? statement : item.statement,
        }));
        const fingerprint = angleSetFingerprint({
          territoryFingerprint: parentTerritoryFingerprint,
          angleFingerprints: rows.map((item) =>
            angleFingerprint({ statement: item.statement, territoryFingerprint: parentTerritoryFingerprint }),
          ),
        });
        const siblingScript = await askThinkingLab(
          buildAngleSiblingPrompt({ parentStatement: focusedTerritory.statement, rows }),
          0,
        );
        const siblingSet = parseAngleSet(siblingScript, fingerprint);
        if (!angleReplacementPasses(siblingSet, row.code)) {
          const reason =
            angleFailureLessons({
              rows: [{ code: row.code, statement }],
              items: [{ code: row.code, verdict: "AUDIT_FAIL" }],
              siblingSet,
            })[0]?.reason ?? "Sibling audit failed this Angle.";
          const lesson = { code: row.code, statement, reason: `siblingsDistinct: ${reason}` };
          learned.push(lesson);
          learnedDuringFix.push(lesson);
          refused.add(statement.trim().toLowerCase());
          const failedSibling = finishAngleSiblingCheck(checked.checks, false, reason);
          shown = failedSibling;
          publishAngleChecklist(row.code, failedSibling);
          scope = nextFixScope(scope, failedSibling);
          continue;
        }
        const passedChecks = finishAngleSiblingCheck(checked.checks, true, "");
        publishAngleChecklist(row.code, passedChecks);
        await labAngles.replace.mutateAsync({
          territoryId: focusedTerritory.id,
          id: row.id,
          statement,
          facts: {
            ...row.canonicalSemantic,
            ...shownAngleFacts(row.code, statement, subjectForCheck, exampleForCheck),
            code: row.code,
          },
          admission: "GENERATE_VALID",
        });
        applied.set(row.code.toUpperCase(), statement);
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
    if (covered === 0) {
      if (learnedDuringFix.length > 0) {
        await angleSet.save.mutateAsync({
          schema: "thinking-lab/angle-set/v1",
          repairCount: angleSet.data?.repairCount ?? 0,
          siblingSet: storedAngleSet,
          audit: angleSet.data?.audit ?? null,
          challenger: angleSet.data?.challenger ?? null,
          auditLessons: mergeAngleAuditLessons(angleSet.data?.auditLessons ?? [], learnedDuringFix),
        });
      }
    } else {
      const items = admittedAngles.flatMap((row, index) => {
        const code = row.code.toUpperCase();
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
          },
        ];
      });
      await angleSet.save.mutateAsync({
        schema: "thinking-lab/angle-set/v1",
        repairCount: (angleSet.data?.repairCount ?? 0) + 1,
        siblingSet: null,
        audit: items.length > 0 ? { fingerprint: "", items } : null,
        challenger: null,
        auditLessons: mergeAngleAuditLessons(angleSet.data?.auditLessons ?? [], learnedDuringFix),
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
        toast.error(error instanceof Error ? error.message : t("thinkingLab.error.generic", "Thinking Lab could not finish that step."));
      } finally {
        fixingAngleCodesRef.current.delete(key);
        setFixingAngleCodes(new Set(fixingAngleCodesRef.current));
      }
    })();
  };

  const onAngleStage = () =>
    run(async () => {
      if (!focusedTerritory || !masters.organizationId || !parentFp || admittedAngles.length === 0) return;
      if (angleStage === "generate" && angleChallenger?.materialGapDescription) {
        const known = (labAngles.data ?? []).filter((row) => row.territoryId === focusedTerritory.id);
        if (admittedAngles.length >= ACTIVE_SET_CAP) return;
        const script = await askThinkingLab(
          buildAngleGapPrompt({
            parentStatement: focusedTerritory.statement,
            ancestors: angleAncestors,
            incumbents: known.map((row) => ({ code: row.code, statement: row.statement })),
            gap: angleChallenger.materialGapDescription,
          }),
          0.2,
        );
        const draft = parseGeneratedAngleDrafts(parseModelJson(script))[0];
        if (!draft?.statement) return;
        const code = nextAngleCode(known.map((row) => row.code));
        const facts = shownAngleFacts(code, draft.statement, draft.subject, draft.example);
        const sort = known.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
        await labAngles.insert.mutateAsync({
          territoryId: focusedTerritory.id,
          expectedBigThoughtId: focusedTerritory.bigThoughtId,
          masterThoughtFingerprint: parentFp,
          code,
          statement: draft.statement,
          sortOrder: sort,
          facts,
          admission: admitAngle(facts),
        });
        await angleSet.save.mutateAsync({
          ...emptyAngleSetRecord(),
          audit: angleSet.data?.audit ?? null,
          auditLessons: angleSet.data?.auditLessons ?? [],
        });
        return;
      }
      if (angleStage === "fix") {
        await repairFailedAngles();
        return;
      }
      if (angleStage === "audit") {
        const heldPass = new Set(
          angleCodesHeldPass(admittedAngles, angleVerdicts).map((code) => code.toUpperCase()),
        );
        const eligible: typeof admittedAngles = [];
        const checked = new Map<string, AnglePassCheck[]>();
        const individualFailures: Array<{ code: string; statement: string; reason: string }> = [];
        for (const row of admittedAngles) {
          if (heldPass.has(row.code.toUpperCase())) {
            eligible.push(row);
            continue;
          }
          const run = await runAngleIndividualChecks({
            statement: row.statement,
            parentStatement: focusedTerritory.statement,
            ancestors: angleAncestors,
            subject: row.canonicalSemantic.subject,
            example: row.canonicalSemantic.example,
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => publishAngleChecklist(row.code, checks),
          });
          if (!run.passed) {
            const failedCheck = run.checks.find((check) => check.state === "fail");
            individualFailures.push({
              code: row.code,
              statement: row.statement,
              reason: failedCheck
                ? `${failedCheck.id}: ${failedCheck.reason ?? ""}`.trim()
                : "This check could not be decided.",
            });
            continue;
          }
          checked.set(row.code.toUpperCase(), run.checks);
          eligible.push(row);
          publishAngleChecklist(row.code, beginAngleSiblingCheck(run.checks));
        }
        const siblingRows = eligible.map((row) => ({ code: row.code, statement: row.statement }));
        const siblingScript =
          siblingRows.length === 0
            ? null
            : await askThinkingLab(
                buildAngleSiblingPrompt({ parentStatement: focusedTerritory.statement, rows: siblingRows }),
                0,
              );
        const siblingSet = siblingScript ? parseAngleSet(siblingScript, angleFingerprintNow) : storedAngleSet;
        const siblingScores =
          siblingRows.length === 0 || !siblingSet
            ? []
            : scoreAngleAudit({
                codes: siblingRows.map((row) => row.code),
                siblingSet,
                siblingSetCurrent: true,
              });
        for (const row of eligible) {
          const prior = checked.get(row.code.toUpperCase());
          if (!prior) continue;
          const verdict = siblingScores.find((item) => item.code.toUpperCase() === row.code.toUpperCase())?.verdict;
          const reason =
            angleFailureLessons({
              rows: [{ code: row.code, statement: row.statement }],
              items: [{ code: row.code, verdict: "AUDIT_FAIL" }],
              siblingSet,
            })[0]?.reason ?? "Sibling audit failed this Angle.";
          publishAngleChecklist(
            row.code,
            finishAngleSiblingCheck(
              prior,
              verdict === "AUDIT_PASS",
              verdict === "AUDIT_PASS" ? "" : reason || "This check could not be decided.",
            ),
          );
        }
        const items = holdPassingAngleVerdicts(
          admittedAngles.map((row) => {
            const statementFingerprint = angleFingerprint({
              statement: row.statement,
              territoryFingerprint: parentTerritoryFingerprint,
            });
            if (individualFailures.some((failure) => failure.code.toUpperCase() === row.code.toUpperCase())) {
              return { code: row.code, verdict: "AUDIT_FAIL" as const, statementFingerprint };
            }
            const scored = siblingScores.find((item) => item.code.toUpperCase() === row.code.toUpperCase());
            return {
              code: row.code,
              verdict: scored?.verdict === "AUDIT_PASS" ? ("AUDIT_PASS" as const) : ("AUDIT_FAIL" as const),
              statementFingerprint,
            };
          }),
          [...heldPass],
        );
        const siblingLessons = angleFailureLessons({
          rows: siblingRows,
          items,
          siblingSet,
        }).filter((lesson) => !individualFailures.some((failure) => failure.code.toUpperCase() === lesson.code.toUpperCase()));
        await angleSet.save.mutateAsync({
          schema: "thinking-lab/angle-set/v1",
          repairCount: items.some((item) => item.verdict === "AUDIT_FAIL") ? (angleSet.data?.repairCount ?? 0) : 0,
          siblingSet,
          audit: { fingerprint: angleFingerprintNow, items },
          challenger: null,
          auditLessons: mergeAngleAuditLessons(angleSet.data?.auditLessons ?? [], [
            ...individualFailures,
            ...siblingLessons,
          ]),
        });
        return;
      }
      if (angleStage === "challenger") {
        if (!angleChallengerCanRun(angleVerdicts.flatMap((verdict) => (verdict ? [verdict] : [])))) return;
        const script = await askThinkingLab(
          buildAngleChallengerPrompt({
            parentStatement: focusedTerritory.statement,
            rows: admittedAngles.map((row) => ({ code: row.code, statement: row.statement })),
          }),
          0,
        );
        const result = parseAngleChallenger(script);
        const siblingSet = storedAngleSet ? applyAngleChallengerCoverage(storedAngleSet, coverageFromAngleChallenger(result)) : null;
        await angleSet.save.mutateAsync({
          schema: "thinking-lab/angle-set/v1",
          repairCount: angleSet.data?.repairCount ?? 0,
          siblingSet,
          audit: angleSet.data?.audit ?? null,
          challenger: { fingerprint: angleFingerprintNow, result },
          auditLessons: angleSet.data?.auditLessons ?? [],
        });
        return;
      }
      if (angleStage === "lock" && angleLock.ok) {
        await angleSet.lock.mutateAsync({
          territoryFingerprint: parentTerritoryFingerprint,
          ids: admittedAngles.map((row) => row.id),
        });
      }
    }, angleStage ?? "audit");

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

  const onAcceptGap = () =>
    run(async () => {
      if (!focusedThought || !masters.organizationId || !parentFp || !territoryChallenger?.materialGapDescription) return;
      const known = (labTerritories.data ?? []).filter((row) => row.bigThoughtId === focusedThought.id);
      if (admittedTerritories.length >= ACTIVE_SET_CAP) return;
      const statement = territoryChallenger.materialGapDescription.trim();
      const code = nextTerritoryCode(known.map((row) => row.code));
      const facts = await judgeAndSealTerritory({
        parentStatement: focusedThought.statement,
        ancestors: territoryAncestors,
        audience: selected?.audience,
        answeredQuestion,
        code,
        statement,
        ask: (prompt) => askThinkingLab(prompt, 0),
      });
      const sort = known.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
      await labTerritories.insert.mutateAsync({
        bigThoughtId: focusedThought.id,
        masterThoughtFingerprint: parentFp,
        code,
        statement,
        sortOrder: sort,
        facts,
        admission: "GENERATE_VALID",
      });
      await territorySet.save.mutateAsync({
        ...emptyTerritorySetRecord(),
        auditLessons: territorySet.data?.auditLessons ?? [],
      });
    }, "accept-gap");

  const onSkipGap = () =>
    run(async () => {
      if (!focusedThought) return;
      await territorySet.save.mutateAsync({
        schema: "thinking-lab/territory-set/v1",
        repairCount: territorySet.data?.repairCount ?? 0,
        siblingSet: storedTerritorySet ? applyChallengerCoverage(storedTerritorySet, "SUFFICIENT") : null,
        audit: territorySet.data?.audit ?? null,
        challenger: {
          fingerprint: territoryFingerprintNow,
          result: { status: "COMPLETE", unresolvedReasons: [] },
        },
        auditLessons: territorySet.data?.auditLessons ?? [],
      });
    }, "skip-gap");

  const ensureAnsweredQuestion = async (thought: NonNullable<typeof focusedThought>) => {
    const stored =
      thought.canonicalSemantic?.answeredQuestionVersion === ANSWERED_QUESTION_VERSION
        ? thought.canonicalSemantic.answeredQuestion?.trim() ?? ""
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
    const keepers = admittedTerritories.filter((_, index) => territoryVerdicts[index] === "AUDIT_PASS");
    const conflicts = territoryNotes.flatMap((note) =>
      note.kind === "overlap"
        ? [`${note.a} · ${note.b}: ${note.explanation}`]
        : note.kind === "containment"
          ? [`${note.container} · ${note.contained}: ${note.explanation}`]
          : [],
    );
    const applied = new Map<string, string>();
    const learnedDuringFix: Array<{ code: string; statement: string; reason: string }> = [];
    for (const row of failed) {
      const learned = [...usableTerritoryFixLessons(territorySet.data?.auditLessons ?? [], row.code)];
      const refused = new Set(learned.map((lesson) => lesson.statement.trim().toLowerCase()));
      refused.add(row.statement.trim().toLowerCase());
      let shown = territoryChecklists[row.code.toUpperCase()]?.checks ?? [];
      const checklistAtStart = shown.map((check) => ({ ...check }));
      let scope: FixScope = scopeFromHistory(shown, learned);
      let offered = false;
      for (let attempt = 0; attempt < fixAttemptCap() && !offered; attempt += 1) {
        const script = await askThinkingLab(
          buildTerritoryFixOptionsPrompt({
            parentStatement: focusedThought.statement,
            ancestors: territoryAncestors,
            audience: selected?.audience,
            answeredQuestion,
            failed: { code: row.code, statement: row.statement },
            keepers: keepers.map((keeper) => ({ code: keeper.code, statement: keeper.statement })),
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
            const reason = "No replacement came back.";
            const lesson = { code: row.code, statement: row.statement, reason };
            learned.push(lesson);
            learnedDuringFix.push(lesson);
          } else {
            for (const candidate of candidates) {
              const reason = "This name was offered again after it already failed.";
              const lesson = { code: row.code, statement: candidate, reason };
              learned.push(lesson);
              learnedDuringFix.push(lesson);
              refused.add(candidate.trim().toLowerCase());
            }
          }
          continue;
        }
        if (territoryNameTooLong(statement) || territoryNameIsActivity(statement)) {
          const reason = territoryNameTooLong(statement) ? TERRITORY_NAME_LENGTH_REASON : TERRITORY_ACTIVITY_REASON;
          const lesson = { code: row.code, statement, reason };
          learned.push(lesson);
          learnedDuringFix.push(lesson);
          refused.add(statement.trim().toLowerCase());
          continue;
        }
        let livedSentence = "";
        let freshQuestion = "";
        const checked = await runTerritoryOpenChecks({
          statement,
          parentStatement: focusedThought.statement,
          audience: selected?.audience,
          question: questionForCheck,
          prior: shown,
          ask: (prompt) => askThinkingLab(prompt, 0),
          onStep: (checks) => publishTerritoryChecklist(row.code, checks),
        });
        if (!checked.passed) {
          const failedCheck = checked.checks.find((check) => check.state === "fail");
          const reason = failedCheck ? `${failedCheck.id}: ${failedCheck.reason ?? ""}`.trim() : "This check could not be decided.";
          const lesson = { code: row.code, statement, reason };
          learned.push(lesson);
          learnedDuringFix.push(lesson);
          refused.add(statement.trim().toLowerCase());
          shown = checked.checks;
          scope = nextFixScope(scope, checked.checks);
          continue;
        }
        publishTerritoryChecklist(row.code, beginSiblingCheck(checked.checks));
        const rows = admittedTerritories.map((item) => ({
          code: item.code,
          statement: item.code.toUpperCase() === row.code.toUpperCase() ? statement : item.statement,
        }));
        const fingerprint = territorySetFingerprint({
          bigThoughtFingerprint: focusedBigThoughtFingerprint,
          territoryFingerprints: rows.map((item) =>
            territoryFingerprint({ statement: item.statement, bigThoughtFingerprint: focusedBigThoughtFingerprint }),
          ),
        });
        const siblingScript = await askThinkingLab(
          buildTerritorySiblingPrompt({ parentStatement: focusedThought.statement, rows }),
          0,
        );
        const siblingSet = parseTerritorySet(siblingScript, fingerprint);
        if (!territoryReplacementPasses(siblingSet, row.code)) {
          const reason =
            territoryFailureLessons({
              rows: [{ code: row.code, statement }],
              items: [{ code: row.code, verdict: "AUDIT_FAIL" }],
              siblingSet,
            })[0]?.reason ?? "Sibling audit failed this Territory.";
          const lesson = { code: row.code, statement, reason: `siblingsDistinct: ${reason}` };
          learned.push(lesson);
          learnedDuringFix.push(lesson);
          refused.add(statement.trim().toLowerCase());
          const failedSibling = finishSiblingCheck(checked.checks, false, reason);
          shown = failedSibling;
          publishTerritoryChecklist(row.code, failedSibling);
          scope = nextFixScope(scope, failedSibling);
          continue;
        }
        const passedChecks = finishSiblingCheck(checked.checks, true, "");
        publishTerritoryChecklist(row.code, passedChecks);
        const sameArea =
          scope.preserve.includes("questionArises") && scope.repair.every((item) => item.id === "audienceLanguage");
        if (!freshQuestion || !livedSentence) {
          const written = await writeTerritoryAreaSentence({
            territory: statement,
            parentStatement: focusedThought.statement,
            masterStatement: selected?.statement,
            audience: selected?.audience,
            answeredQuestion: questionForCheck || answeredQuestion,
            siblings: admittedTerritories
              .filter((item) => item.code.toUpperCase() !== row.code.toUpperCase())
              .map((item) => item.statement),
            ask: (prompt) => askThinkingLab(prompt, 0.2),
          });
          if (!livedSentence) livedSentence = written.sentence;
          if (!freshQuestion) freshQuestion = written.question;
        }
        const areaQuestion = sameArea
          ? row.canonicalSemantic.areaQuestion || freshQuestion || checked.question
          : freshQuestion || checked.question || row.canonicalSemantic.areaQuestion;
        await labTerritories.replace.mutateAsync({
          bigThoughtId: focusedThought.id,
          id: row.id,
          statement,
          facts: {
            ...row.canonicalSemantic,
            ...shownTerritoryFacts(row.code, statement),
            areaQuestion,
            whatItSays: livedSentence.trim() || (sameArea ? row.canonicalSemantic.whatItSays : statement),
          },
          admission: "GENERATE_VALID",
        });
        applied.set(row.code.toUpperCase(), statement);
        offered = true;
      }
      if (!offered && checklistAtStart.length > 0) publishTerritoryChecklist(row.code, checklistAtStart);
    }
    const replaced = new Set(failed.map((row) => row.code.toUpperCase()));
    setTerritoryFixOffers((current) =>
      current.filter((offer) => offer.thoughtId !== focusedThought.id || !replaced.has(offer.failedCode.toUpperCase())),
    );
    const covered = applied.size;
    if (covered === 0) {
      if (learnedDuringFix.length > 0) {
        await territorySet.save.mutateAsync({
          schema: "thinking-lab/territory-set/v1",
          repairCount: territorySet.data?.repairCount ?? 0,
          siblingSet: storedTerritorySet,
          audit: territorySet.data?.audit ?? null,
          challenger: territorySet.data?.challenger ?? null,
          auditLessons: mergeTerritoryAuditLessons(territorySet.data?.auditLessons ?? [], learnedDuringFix),
        });
      }
    } else {
      const items = admittedTerritories.flatMap((row, index) => {
        const code = row.code.toUpperCase();
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
          },
        ];
      });
      await territorySet.save.mutateAsync({
        schema: "thinking-lab/territory-set/v1",
        repairCount: (territorySet.data?.repairCount ?? 0) + 1,
        siblingSet: null,
        audit: items.length > 0 ? { fingerprint: "", items } : null,
        challenger: null,
        auditLessons: mergeTerritoryAuditLessons(territorySet.data?.auditLessons ?? [], learnedDuringFix),
      });
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
        toast.error(error instanceof Error ? error.message : t("thinkingLab.error.generic", "Thinking Lab could not finish that step."));
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
        const eligible: typeof admittedTerritories = [];
        const checked = new Map<string, TerritoryPassCheck[]>();
        const individualFailures: Array<{ code: string; statement: string; reason: string }> = [];
        for (const row of admittedTerritories) {
          if (heldPass.has(row.code.toUpperCase())) {
            eligible.push(row);
            continue;
          }
          const run = await runTerritoryIndividualChecks({
            statement: row.statement,
            parentStatement: focusedThought.statement,
            audience: selected?.audience,
            question: questionForAudit || row.canonicalSemantic.areaQuestion,
            ensureQuestion: async () => {
              const written = await writeTerritoryAreaSentence({
                territory: row.statement,
                parentStatement: focusedThought.statement,
                masterStatement: selected?.statement,
                audience: selected?.audience,
              answeredQuestion: questionForAudit || answeredQuestion,
              siblings: admittedTerritories
                .filter((item) => item.id !== row.id)
                  .map((item) => item.statement),
                ask: (prompt) => askThinkingLab(prompt, 0.2),
              });
              if (written.sentence && written.question) {
                await labTerritories.saveGloss.mutateAsync({
                  bigThoughtId: row.bigThoughtId,
                  id: row.id,
                  facts: { ...row.canonicalSemantic, whatItSays: written.sentence, areaQuestion: written.question },
                });
              }
              return written.question;
            },
            ask: (prompt) => askThinkingLab(prompt, 0),
            onStep: (checks) => publishTerritoryChecklist(row.code, checks),
          });
          if (!run.passed) {
            const failedCheck = run.checks.find((check) => check.state === "fail");
            individualFailures.push({
              code: row.code,
              statement: row.statement,
              reason: failedCheck
                ? `${failedCheck.id}: ${failedCheck.reason ?? ""}`.trim()
                : "This check could not be decided.",
            });
            continue;
          }
          checked.set(row.code.toUpperCase(), run.checks);
          eligible.push(row);
          publishTerritoryChecklist(row.code, beginSiblingCheck(run.checks));
        }
        const siblingRows = eligible.map((row) => ({ code: row.code, statement: row.statement }));
        const siblingScript =
          siblingRows.length === 0
            ? null
            : await askThinkingLab(
                buildTerritorySiblingPrompt({ parentStatement: focusedThought.statement, rows: siblingRows }),
                0,
              );
        const siblingSet = siblingScript ? parseTerritorySet(siblingScript, territoryFingerprintNow) : storedTerritorySet;
        const siblingScores =
          siblingRows.length === 0 || !siblingSet
            ? []
            : scoreTerritoryAudit({
                codes: siblingRows.map((row) => row.code),
                siblingSet,
                siblingSetCurrent: true,
              });
        for (const row of eligible) {
          const prior = checked.get(row.code.toUpperCase());
          if (!prior) continue;
          const verdict = siblingScores.find((item) => item.code.toUpperCase() === row.code.toUpperCase())?.verdict;
          const reason =
            territoryFailureLessons({
              rows: [{ code: row.code, statement: row.statement }],
              items: [{ code: row.code, verdict: "AUDIT_FAIL" }],
              siblingSet,
            })[0]?.reason ?? "Sibling audit failed this Territory.";
          publishTerritoryChecklist(
            row.code,
            finishSiblingCheck(prior, verdict === "AUDIT_PASS", verdict === "AUDIT_PASS" ? "" : reason || "This check could not be decided."),
          );
        }
        const items = holdPassingTerritoryVerdicts(
          admittedTerritories.map((row) => {
            const statementFingerprint = territoryFingerprint({
              statement: row.statement,
              bigThoughtFingerprint: focusedBigThoughtFingerprint,
            });
            if (individualFailures.some((failure) => failure.code.toUpperCase() === row.code.toUpperCase())) {
              return { code: row.code, verdict: "AUDIT_FAIL" as const, statementFingerprint };
            }
            const scored = siblingScores.find((item) => item.code.toUpperCase() === row.code.toUpperCase());
            return {
              code: row.code,
              verdict: scored?.verdict === "AUDIT_PASS" ? ("AUDIT_PASS" as const) : ("AUDIT_FAIL" as const),
              statementFingerprint,
            };
          }),
          [...heldPass],
        );
        const siblingLessons = territoryFailureLessons({
          rows: siblingRows,
          items,
          siblingSet,
        }).filter((lesson) => !individualFailures.some((failure) => failure.code.toUpperCase() === lesson.code.toUpperCase()));
        await territorySet.save.mutateAsync({
          schema: "thinking-lab/territory-set/v1",
          repairCount: items.some((item) => item.verdict === "AUDIT_FAIL") ? (territorySet.data?.repairCount ?? 0) : 0,
          siblingSet,
          audit: { fingerprint: territoryFingerprintNow, items },
          challenger: null,
          auditLessons: mergeTerritoryAuditLessons(territorySet.data?.auditLessons ?? [], [
            ...individualFailures,
            ...siblingLessons,
          ]),
        });
        return;
      }
      if (territoryStage === "challenger") {
        if (!territoryChallengerCanRun(territoryVerdicts.flatMap((verdict) => (verdict ? [verdict] : [])))) return;
        const script = await askThinkingLab(
          buildTerritoryChallengerPrompt({
            parentStatement: focusedThought.statement,
            answeredQuestion,
            rows: admittedTerritories.map((row) => ({ code: row.code, statement: row.statement })),
          }),
          0,
        );
        const result = parseTerritoryChallenger(script);
        const siblingSet = storedTerritorySet
          ? applyChallengerCoverage(storedTerritorySet, coverageFromChallenger(result))
          : null;
        await territorySet.save.mutateAsync({
          schema: "thinking-lab/territory-set/v1",
          repairCount: territorySet.data?.repairCount ?? 0,
          siblingSet,
          audit: territorySet.data?.audit ?? null,
          challenger: { fingerprint: territoryFingerprintNow, result },
          auditLessons: territorySet.data?.auditLessons ?? [],
        });
        return;
      }
      if (territoryStage === "lock" && territoryLock.ok) {
        await territorySet.lock.mutateAsync({
          bigThoughtFingerprint: focusedBigThoughtFingerprint,
          ids: admittedTerritories.map((row) => row.id),
        });
      }
    }, territoryStage ?? "territory");
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

  const onAudit = () =>
    run(async () => {
      if (!selected || !parentFp) return;
      const local: LabBigThought[] = active.map((row) => ({ ...row }));
      const total = local.length;
      let done = 0;
      setAuditProgress({ done, total, current: null });
      try {
      for (const row of local) {
        const current = bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp });
        const fresh =
          fingerprintsMatch(row.semanticFingerprint, current) &&
          row.canonicalSemantic?.resolution === "RESOLVED" &&
          row.canonicalSemantic.unresolvedReasons.length === 0;
        if (!fresh) {
          setAuditProgress({ done, total, current: { code: row.code, statement: row.statement } });
          const facts = await judgeCandidateWithAsk({
            parentStatement: selected.statement,
            statement: row.statement,
            code: row.code,
            siblings: local
              .filter((item) => item.code !== row.code)
              .map((item) => ({ code: item.code, statement: item.statement })),
            ask: askThinkingLab,
          });
          await thoughts.updateFacts.mutateAsync({
            id: row.id,
            statement: row.statement,
            facts: { ...facts, code: row.code },
            masterFingerprint: parentFp,
          });
          row.canonicalSemantic = { ...facts, code: row.code };
          row.semanticFingerprint = current;
        }
        done += 1;
        setAuditProgress({ done, total, current: null });
      }
      const fingerprints = local.map((row) =>
        bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp }),
      );
      const nextSetFingerprint = incumbentSetFingerprint({
        masterThoughtFingerprint: parentFp,
        bigThoughtFingerprints: fingerprints,
      });
      let sibling = setRecord?.siblingSet ?? null;
      if (siblingSetNeedsFreshJudgment(sibling, nextSetFingerprint, local.map((row) => row.code))) {
        setAuditProgress({
          done,
          total,
          current: { code: "", statement: t("thinkingLab.bt.auditingSet", "Sibling set") },
        });
        sibling = await judgeSiblingSet(
          {
            parentStatement: selected.statement,
            rows: local.map((row) => ({ code: row.code, statement: row.statement })),
            fingerprint: nextSetFingerprint,
          },
          askThinkingLab,
        );
        setAuditProgress({ done, total, current: null });
      }
      const held = keptPassingAuditItems({
        items: setRecord?.audit?.items,
        rows: local.map((row) => ({
          code: row.code,
          statementFingerprint: bigThoughtFingerprint({
            statement: row.statement,
            masterThoughtFingerprint: parentFp,
          }),
        })),
      });
      const items = holdPassingAuditVerdicts(
        scoreAudit({
        rows: local.map((row) => ({
          code: row.code,
          admission: individualAdmission({
            facts: row.canonicalSemantic,
            factsCurrent: fingerprintsMatch(
              row.semanticFingerprint,
              bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp }),
            ),
          }),
        })),
        siblingSet: sibling,
        siblingSetCurrent: siblingSetIsCurrent(sibling, nextSetFingerprint),
        }),
        held.map((item) => item.code),
      ).map((item) => {
        const row = local.find((candidate) => candidate.code.toUpperCase() === item.code.toUpperCase());
        const kept = held.find((candidate) => candidate.code.toUpperCase() === item.code.toUpperCase());
        return {
          ...item,
          statementFingerprint:
            kept?.statementFingerprint ??
            (row
              ? bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp })
              : undefined),
        };
      });
      const next: LabSetRecord = nextAuthoritativeSetRecord({
        record: setRecord,
        parentFingerprint: parentFp,
        siblingSet: sibling,
        audit: { setFingerprint: nextSetFingerprint, items },
        challenger:
          setRecord?.challenger?.setFingerprint === nextSetFingerprint ? setRecord.challenger : null,
      });
      await masters.saveSet.mutateAsync({ id: selected.id, lastAudit: next });
      if (sibling?.unresolvedReasons.includes("JUDGE_UNPARSEABLE")) {
        setNotice(
          t(
            "thinkingLab.bt.judgeUnparseable",
            "Audit finished, but the sibling judgment could not be read. Every Big Thought stays UNRESOLVED until Audit can read it.",
          ),
        );
      } else if ((sibling?.unresolvedReasons.length ?? 0) > 0) {
        setNotice(sibling?.unresolvedReasons.join(", ") ?? null);
      }
      } finally {
        setAuditProgress(null);
      }
    });

  const repairFailedBigThoughts = async (onlyCode?: string) => {
      setAuditProgress(null);
      if (onlyCode) {
        const key = onlyCode.trim().toUpperCase();
        setFixResponses((current) => current.filter((item) => item.code?.toUpperCase() !== key));
        setFixOffers((current) => current.filter((offer) => offer.failedCode.toUpperCase() !== key));
      } else {
        setFixResponses([]);
        setFixOffers([]);
      }
      if (!selected || !parentFp) return;
      const siblingForParent = siblingSetBelongsToParent(setRecord?.siblingSet ?? null, parentFp)
        ? setRecord?.siblingSet ?? null
        : null;
      const contributionFor = (code: string) =>
        siblingForParent?.reasonContributions?.find((item) => item.code.toUpperCase() === code.toUpperCase())
          ?.reasonContribution ?? null;
      const failureRows = active.filter((row) => {
        if (rowViews.find((view) => view.id === row.id)?.audit !== "AUDIT_FAIL") return false;
        return !onlyCode || row.code.toUpperCase() === onlyCode.trim().toUpperCase();
      });
      if (failureRows.length === 0) return;
      const failureCodesInRun = new Set(failureRows.map((row) => row.code.toUpperCase()));
      const incumbents = active
        .filter((row) => !failureCodesInRun.has(row.code.toUpperCase()))
        .map((row) => ({
          code: row.code,
          statement: row.statement,
          reasonContribution: contributionFor(row.code),
        }));
      const exclusions = mergeExclusionEntries(
        exclusionsForParent(setRecord?.semanticExclusions, parentFp),
        exclusionsFromSiblingSet(siblingForParent),
      );
      const labelsByStatement = new Map<string, string>();
      let subjectCode = "";
      const { results, exclusions: discovered } = await runFixReplacements({
        failures: failureRows.map((row) => ({
          code: row.code,
          statement: row.statement,
          reasonContribution: contributionFor(row.code),
          audit: "AUDIT_FAIL" as const,
        })),
        incumbents,
        exclusions,
        propose: async () => null,
        listProposals: async ({ failure, incumbents: currentIncumbents, exclusions: currentExclusions }) => {
          subjectCode = failure.code;
          const script = await askThinkingLab(
            buildGeneratePrompt({
              parentStatement: selected.statement,
              incumbents: currentIncumbents,
              needed: 3,
              missingWhy: null,
              exclusions: currentExclusions,
              failed: failure,
            }),
            0.2,
          );
          setFixResponses((current) => [
            ...current,
            { ...presentFixModelResponse("proposal", script), code: failure.code },
          ]);
          const items = parseGeneratedBigThoughts(script ? parseModelJson(script) : null, selected.statement);
          for (const item of items) {
            if (item.label) labelsByStatement.set(item.statement, item.label);
          }
          return items
            .map((item) => item.statement)
            .filter((statement) => statement !== failure.statement)
            .slice(0, 3);
        },
        judge: (statement, judgedSiblings) => {
          let pass = 0;
          return judgeCandidateWithAsk({
            parentStatement: selected.statement,
            statement,
            code: "NEW",
            siblings: judgedSiblings,
            ask: async (prompt) => {
              const script = await askThinkingLab(prompt, 0);
              pass += 1;
              const kind = pass === 1 ? "individual" : "adversarial";
              setFixResponses((current) => [
                ...current,
                { ...presentFixModelResponse(kind, script), code: subjectCode },
              ]);
              return script;
            },
          });
        },
        precheck: ({ statement, incumbents: currentIncumbents }) =>
          precheckReplacementCandidate(
            {
              parentStatement: selected.statement,
              candidateStatement: statement,
              incumbents: currentIncumbents,
              fingerprint: incumbentSetFingerprint({
                masterThoughtFingerprint: parentFp,
                bigThoughtFingerprints: [...currentIncumbents, { code: "NEW", statement }].map((row) =>
                  bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp }),
                ),
              }),
            },
            async (prompt) => {
              const script = await askThinkingLab(prompt, 0);
              setFixResponses((current) => [
                ...current,
                {
                  ...presentFixModelResponse("sibling", script, [
                  ...currentIncumbents.map((row) => row.code),
                  "NEW",
                ]),
                  code: subjectCode,
                },
              ]);
              return script;
            },
          ),
      });
      const semanticExclusions = mergeExclusionHistory(null, discovered, parentFp);
      const persisted = persistedSetRecordAfterFix(parseLabSetRecord(selected.lastAudit), 0, semanticExclusions);
      if (persisted.write) {
        await masters.saveSet.mutateAsync({
          id: selected.id,
          lastAudit: persisted.lastAudit,
        });
      }
      const offers = results.flatMap((result) =>
        result.result === "OFFERS"
          ? result.offers.map((offer) => ({
              ...offer,
              failedCode: result.code,
              label: labelsByStatement.get(offer.statement) ?? "",
            }))
          : [],
      );
      if (onlyCode) {
        const key = onlyCode.trim().toUpperCase();
        setFixOffers((current) => [...current.filter((offer) => offer.failedCode.toUpperCase() !== key), ...offers]);
      } else {
        setFixOffers(offers);
      }
      const unsafe = results.filter((result) => result.result === "NO_SAFE_REPLACEMENT").map((result) => result.code);
      if (offers.length > 0) setNotice(null);
      else setNotice(t("thinkingLab.bt.noSafeReplacement", "NO_SAFE_REPLACEMENT {{codes}}", { codes: unsafe.join(", ") }));
  };

  const onFixBigThought = (code: string) => {
    const key = code.trim().toUpperCase();
    if (!key || fixingBigThoughtCodesRef.current.has(key)) return;
    fixingBigThoughtCodesRef.current.add(key);
    setFixingBigThoughtCodes(new Set(fixingBigThoughtCodesRef.current));
    void (async () => {
      try {
        await repairFailedBigThoughts(code);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("thinkingLab.error.generic", "Thinking Lab could not finish that step."));
      } finally {
        fixingBigThoughtCodesRef.current.delete(key);
        setFixingBigThoughtCodes(new Set(fixingBigThoughtCodesRef.current));
      }
    })();
  };

  const onPickFixOffer = (failedCode: string, statement: string) =>
    run(async () => {
      if (!selected || !parentFp) return;
      const offer = fixOffers.find(
        (row) => row.failedCode.toUpperCase() === failedCode.toUpperCase() && row.statement === statement,
      );
      const previous = active.find((row) => row.code.toUpperCase() === failedCode.toUpperCase());
      if (!offer || !previous) return;
        await thoughts.reject.mutateAsync(previous.id);
      const known = thoughts.data ?? [];
      const code = nextBigThoughtCode(known.map((row) => row.code));
      const sort = known.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
      const facts: BigThoughtFacts = { ...offer.facts, code };
        await thoughts.insert.mutateAsync({
          code,
        statement: offer.statement,
        label: offer.label,
          sortOrder: sort,
          facts,
          masterFingerprint: parentFp,
        });
      const held = heldAuditAfterFix({
        items: parseLabSetRecord(selected.lastAudit)?.audit?.items,
        rows: active
          .filter((row) => row.id !== previous.id)
          .map((row) => ({
            code: row.code,
            statementFingerprint: bigThoughtFingerprint({
              statement: row.statement,
              masterThoughtFingerprint: parentFp,
            }),
          })),
        replacedCodes: [previous.code],
      });
      held.push({
        code,
        verdict: "AUDIT_PASS",
        statementFingerprint: bigThoughtFingerprint({
          statement: offer.statement,
          masterThoughtFingerprint: parentFp,
        }),
      });
      const persisted = persistedSetRecordAfterFix(
        parseLabSetRecord(selected.lastAudit),
        1,
        parseLabSetRecord(selected.lastAudit)?.semanticExclusions,
        held,
      );
      if (persisted.write) {
        await masters.saveSet.mutateAsync({ id: selected.id, lastAudit: persisted.lastAudit });
      }
      setFixOffers((current) => current.filter((row) => row.failedCode.toUpperCase() !== failedCode.toUpperCase()));
        setNotice(null);
    });

  const onChallenger = () =>
    run(async () => {
      if (!selected || !parentFp || !challengerReady) return;
      const passing = rowViews.filter((row) => row.audit === "AUDIT_PASS");
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
    });

  const onLock = () =>
    run(async () => {
      if (!selected) return;
      if (lockDecision.ok === false) {
        setNotice(lockDecision.reason);
        return;
      }
      const ids = rowViews
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
            toast.error(saveError instanceof Error ? saveError.message : t("thinkingLab.execution.characterFailed", "The character image could not be made."));
            return;
          }
          toast.error(t("thinkingLab.execution.characterPortraitOnly", "The portrait is saved. The character sheet could not be made."));
          return;
        }
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

  const pathUp = (() => {
    if (!selected || !locked || !focus || focus.masterId !== selected.id || focus.kind === "master") return undefined;
    const masterTitle = (masterStatement || masterSubject || selected.originalInput).trim();
    const masterItem = { label: t("thinkingLab.tree.masterThought", "Master Thought"), title: masterTitle };
    const thought =
      rowViews.find((row) => row.id === focus.thoughtId) ??
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
    return [angleItem, territoryItem, thoughtItem, masterItem];
  })();

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className={cn("flex min-h-0 min-w-0 w-full flex-1", !showContent && "pointer-events-none invisible select-none")} aria-hidden={!showContent}>
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden bg-muted/40">
                <div className="mb-1 flex shrink-0 items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <h1 className="text-lg font-semibold text-foreground">{t("thinkingLab.page.title", "Thinking Lab")}</h1>
                    <p className="text-sm text-muted-foreground">
                      {t("thinkingLab.page.subtitle", "Confirm one Master Thought, then keep distinct material supports.")}
                    </p>
                  </div>
                  {hasMasters && !composerOpen ? (
                    <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => setComposerOpen(true)}>
                      {t("thinkingLab.action.newMaster", "New Master Thought")}
                    </Button>
                  ) : null}
                  {hasMasters && composerOpen ? (
                    <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={closeComposer}>
                      {t("thinkingLab.action.closeComposer", "Close")}
                    </Button>
                  ) : null}
                </div>
                <ModuleShellContentGate pagePath="/thinking-lab">
                  {scriptTableOpen && focusedExecution?.script ? (
                    <ExecutionScriptTable
                      pillarName={focusedExecution.pillarName}
                      script={focusedExecution.script}
                      onClose={() => setScriptTableOpen(false)}
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
                            <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)] items-center gap-x-5 border-b border-white/15 bg-brand-blue px-5 py-4 text-white">
                              <div className="min-w-0">
                                <p className="text-[11px] leading-4 text-white">
                                  {t("thinkingLab.master.shiftFrom", "Keyakinan lama yang mau digeser")}
                                </p>
                                <p className="mt-1 break-words text-sm leading-snug text-white">{selected.priorBelief}</p>
                              </div>
                              <span className="text-base text-white" aria-hidden="true">
                                →
                              </span>
                              <div className="min-w-0">
                                <p className="text-[11px] leading-4 text-white">
                                  {t("thinkingLab.tree.masterThought", "Master Thought")}:
                                </p>
                                <p className="mt-1 break-words text-sm font-medium leading-snug text-white">
                                  {selected.statement || selected.originalInput}
                                </p>
                              </div>
                            </div>
                          ) : null}
                          {showComposer ? (
                          <div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          <div className="shrink-0">
                            <h2 className="text-3xl font-bold leading-tight tracking-tight text-foreground">
                              {t("thinkingLab.composer.headline", "Dari keyakinan lama ke peta ide konten")}
                            </h2>
                            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                              {t(
                                "thinkingLab.composer.lead",
                                "Tulis keyakinan yang mau digeser dan keyakinan yang mau ditanamkan. Mulai dari Master Thought, lalu turunkan level demi level sampai Idea, mengikuti Framework MT sampai Execution v1.0.",
                              )}
                            </p>
                          </div>
                          <ProductBeliefSource
                            disabled={busy}
                            onApply={(draft) => {
                              setNewPrior(draft.priorBelief);
                              setNewPlanted(draft.plantedBelief);
                              setNewAudience(draft.audience);
                            }}
                          />
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
                            disabled={busy || !newPrior.trim() || !newPlanted.trim() || beliefsMatch(newPrior, newPlanted)}
                            aria-busy={busyAction === "formulate" || undefined}
                          >
                            {busyAction === "formulate" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                            {t("thinkingLab.action.formulate", "Formulate Master Thought")}
                          </Button>
                          </div>
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
                                  rowViews.map((row) => ({
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
                                focus.kind === "execution"
                                  ? focus.territoryId
                                  : null;
                              const ideasOpen =
                                focus.kind === "angle" || focus.kind === "idea" || focus.kind === "execution"
                                  ? focus.angleId
                                  : null;
                              const lockedAnglesFor = (territoryId: string) => {
                                if (anglesOpen !== territoryId) return [];
                                return (labAngles.data ?? [])
                                  .filter(
                                    (angle) => angle.territoryId === territoryId && angle.admission === "GENERATE_VALID",
                                  )
                                  .map((angle) => {
                                    const ideas = visibleIdeas(labIdeas.data ?? [], angle.id);
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
                                          ? ideas.map((idea) => ({
                                              id: idea.id,
                                              code: idea.code,
                                              statement: idea.statement,
                                              subject: idea.canonicalSemantic.subject,
                                              recommended: idea.canonicalSemantic.causeLock === "LOCKED",
                                              executions:
                                                focus?.kind !== "master" &&
                                                focus?.kind !== "bigThought" &&
                                                (focus?.kind === "idea" || focus?.kind === "execution") &&
                                                focus.ideaId === idea.id
                                                  ? (labExecutions.data ?? []).map((row) => ({
                                                      id: row.id,
                                                      label: row.pillarName,
                                                      passed: executionChecklistPassed(
                                                        row.canonicalSemantic,
                                                        row.admission,
                                                        row.script?.lineIssues.length ?? 0,
                                                      ),
                                                    }))
                                                  : [],
                                            }))
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
                          {showComposer && hasMasters ? (
                            <SavedMasterThoughtList
                              masters={masters.data ?? []}
                              onOpen={(id) => {
                                const row = masters.data?.find((item) => item.id === id);
                                closeComposer();
                                skipAutoSelect.current = false;
                                setSelectedId(id);
                                setFocus(row?.mtStatus === "locked" ? { kind: "master", masterId: id } : null);
                              }}
                              onDelete={(id) => setPendingDelete({ kind: "master", id })}
                            />
                          ) : selected && locked && focus?.masterId === selected.id && focus.kind === "execution" ? (
                            focusedExecution ? (
                              <ExecutionScriptPanel
                                pillarName={focusedExecution.pillarName}
                                statement={focusedExecution.statement}
                                script={focusedExecution.script}
                                admission={focusedExecution.admission}
                                facts={focusedExecution.canonicalSemantic}
                                progress={executionProgress}
                                pending={busy}
                                fixingLineId={fixingLineId}
                                onStop={onStopExecution}
                                onRepair={() => void onRepairExecution()}
                                onFixLine={onFixLine}
                                onRewrite={onRewriteExecution}
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
                                onUseOffer={onUseExecutionOffer}
                                onRetrySelling={onRetrySelling}
                                checks={executionChecklists[focusedExecution.id]}
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
                          ) : selected && locked ? (
                            focus?.masterId === selected.id ? (
                              <LabNodeInspector
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
                                  focus.kind === "angle" && openIdeas.length > 0
                                    ? openIdeas.map((row, index) => ({
                                        id: row.id,
                                        code: row.code,
                                        statement: row.statement,
                                        mechanismKeys: row.canonicalSemantic.mechanismKeys,
                                        editable: row.status === "candidate",
                                        verdict: shownIdeaVerdicts[index] ?? null,
                                        checklist: ideaChecklists[row.code.toUpperCase()]?.checks,
                                        checklistNote: ideaChecklists[row.code.toUpperCase()]?.note,
                                      }))
                                    : undefined
                                }
                                ideaStage={focus.kind === "angle" && !ideaSetLocked ? ideaStage : null}
                                onIdeaStage={() => void onIdeaStage()}
                                onLockIdeas={
                                  focus.kind === "angle" && !ideaSetLocked && ideaLock.ok
                                    ? () => void onLockIdeas()
                                    : undefined
                                }
                                onFixIdea={
                                  focus.kind === "angle" && !ideaSetLocked ? onFixIdea : undefined
                                }
                                fixingIdeaCodes={focus.kind === "angle" && !ideaSetLocked ? [...fixingIdeaCodes] : undefined}
                                ideaNotes={
                                  focus.kind === "angle" && !ideaSetLocked
                                    ? ideaNotes.filter((note) => {
                                        const openCodes = new Set(openIdeas.map((row) => row.code.toUpperCase()));
                                        const pair = note.match(/^([A-Za-z0-9]+)\s·\s([A-Za-z0-9]+):/);
                                        if (pair) {
                                          return openCodes.has(pair[1].toUpperCase()) || openCodes.has(pair[2].toUpperCase());
                                        }
                                        const single = note.match(/^([A-Za-z0-9]+):/);
                                        if (single) return openCodes.has(single[1].toUpperCase());
                                        return true;
                                      })
                                    : undefined
                                }
                                ideaFixOffers={
                                  focus.kind === "angle" && !ideaSetLocked
                                    ? ideaFixOffers
                                        .filter((offer) => offer.angleId === focusedAngle?.id)
                                        .map((offer) => ({ failedCode: offer.failedCode, statement: offer.statement }))
                                    : undefined
                                }
                                onPickIdeaFixOffer={
                                  focus.kind === "angle" && !ideaSetLocked
                                    ? (code, statement) => void onPickIdeaFixOffer(code, statement)
                                    : undefined
                                }
                                executionReady={focus.kind === "idea" && focusedIdea?.status === "locked"}
                                executions={
                                  focus.kind === "idea"
                                    ? (labExecutions.data ?? []).map((row) => ({
                                        id: row.id,
                                        pillar: row.pillar,
                                        label: row.pillarName,
                                        statement: row.statement,
                                        admission: row.admission,
                                      }))
                                    : undefined
                                }
                                onChoosePillar={
                                  focus.kind === "idea" && focusedIdea?.status === "locked" ? onOpenPillarPicker : undefined
                                }
                                executionProgress={focus.kind === "idea" ? executionProgress : null}
                                onStopExecution={focus.kind === "idea" ? onStopExecution : undefined}
                                angleReady={
                                  focus.kind === "territory" &&
                                  showGenerateAngle &&
                                  admittedAngles.length < ACTIVE_SET_CAP &&
                                  angleStage !== "fix" &&
                                  angleStage !== "generate"
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
                                        return {
                                          ...row,
                                          editable: row.status === "candidate",
                                          checklist: territoryChecklists[row.code.toUpperCase()]?.checks,
                                          checklistNote: territoryChecklists[row.code.toUpperCase()]?.note,
                                          verdict:
                                            territoryVerdicts[
                                              admittedTerritories.findIndex((item) => item.id === row.id)
                                            ] ?? null,
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
                                onAcceptGap={
                                  focus.kind === "bigThought" &&
                                  territoryMaterialGap &&
                                  !territoriesPanelClosed &&
                                  territoryStoredCount < ACTIVE_SET_CAP
                                    ? () => void onAcceptGap()
                                    : undefined
                                }
                                onSkipGap={
                                  focus.kind === "bigThought" && territoryMaterialGap && !territoriesPanelClosed
                                    ? () => void onSkipGap()
                                    : undefined
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
                                        "This locked Master Thought has no subject yet. Unlock it, then understand it again so the subject is saved.",
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
                                  <h2 className="text-base font-semibold text-foreground">
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
                                </header>
                              ) : null}
                              {showBeliefField ? (
                                <MasterThoughtSection
                                  locked={locked}
                                  busy={busy}
                                  understanding={busyAction === "understand" || busyAction === "formulate"}
                                  priorDraft={priorDraft}
                                  originalDraft={originalDraft}
                                  audienceDraft={audienceDraft}
                                  proposalDraft={proposalDraft}
                                  facts={selected.canonicalSemantic}
                                  admission={admission}
                                  confirmedStatement={ready ? selected.statement : null}
                                  onPriorChange={setPriorDraft}
                                  onOriginalChange={setOriginalDraft}
                                  onAudienceChange={setAudienceDraft}
                                  onProposalChange={setProposalDraft}
                                  onUnderstand={() => void onUnderstand()}
                                  judgmentCurrent={judgmentCurrent}
                                  onKeepOriginal={() => {
                                    const planted = originalDraft.trim();
                                    if (!planted || !selected) return;
                                    void run(async () => {
                                      await masters.saveJudge.mutateAsync({
                                        id: selected.id,
                                        facts: acceptChosenBelief(planted),
                                        fingerprint: understandFingerprint(planted, null),
                                      });
                                    }, "understand");
                                  }}
                                  onUseSubject={(answer) => {
                                    const planted = originalDraft.trim() || selected.originalInput.trim();
                                    const subject = answer.trim();
                                    if (!planted || !subject || !selected) return;
                                    void run(async () => {
                                      await masters.saveJudge.mutateAsync({
                                        id: selected.id,
                                        facts: acceptChosenBelief(subject),
                                        fingerprint: understandFingerprint(planted, null),
                                      });
                                    }, "understand");
                                  }}
                                  onPickBelief={(belief) => {
                                    const next = belief.trim();
                                    if (!next || !selected) return;
                                    void run(async () => {
                                      const prior = priorDraft.trim();
                                      const audience = audienceDraft.trim();
                                      if (beliefsMatch(beliefClaim(next), beliefClaim(prior))) throw new Error("SAME_BELIEF");
                                      setOriginalDraft(next);
                                      await masters.saveOriginal.mutateAsync({
                                        id: selected.id,
                                        planted: next,
                                        priorBelief: prior,
                                        audience,
                                      });
                                      const facts = acceptPlantedBelief(next);
                                      await masters.saveJudge.mutateAsync({
                                        id: selected.id,
                                        facts,
                                        fingerprint: understandFingerprint(next, null),
                                      });
                                    }, "understand");
                                  }}
                                  onUseBelief={(belief) => {
                                    const next = belief.trim();
                                    if (!next || !selected) return;
                                    void run(async () => {
                                      const prior = priorDraft.trim();
                                      const audience = audienceDraft.trim();
                                      if (beliefsMatch(next, prior)) throw new Error("SAME_BELIEF");
                                      setOriginalDraft(next);
                                      await masters.saveOriginal.mutateAsync({
                                        id: selected.id,
                                        planted: next,
                                        priorBelief: prior,
                                        audience,
                                      });
                                      const facts = await judgeMasterThought(next, askThinkingLab, undefined, {
                                        priorBelief: prior,
                                        audience,
                                      });
                                      await masters.saveJudge.mutateAsync({
                                        id: selected.id,
                                        facts,
                                        fingerprint: understandFingerprint(next, facts.proposedRootBelief),
                                      });
                                    }, "understand");
                                  }}
                                  onOpenChoices={async (question) => {
                                    let choices: MasterChoiceSet = { subjects: [], beliefs: [] };
                                    await run(async () => {
                                      const raw = await askThinkingLab(
                                        buildMasterChoicePrompt({
                                          originalInput: originalDraft,
                                          priorBelief: priorDraft,
                                          audience: audienceDraft,
                                          question,
                                        }),
                                        0.2,
                                      );
                                      choices = parseMasterChoiceSet(raw ? parseModelJson(raw) : null, {
                                        priorBelief: priorDraft,
                                        originalInput: originalDraft,
                                      });
                                    });
                                    return choices;
                                  }}
                                  onConfirmOriginal={onConfirmOriginal}
                                  onConfirmProposal={onConfirmProposal}
                                  onConfirmEdit={() => void onConfirmEdit()}
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
                                  {(ready || locked || rowViews.length > 0) && !editingBelief ? (
                                    <BigThoughtSection
                                  parentStatement={becauseParent}
                                      rows={rowViews}
                                      missingWhy={missingWhy}
                                      notice={notice}
                                      auditProgress={auditProgress}
                                      fixResponses={fixResponses}
                                  fixOffers={fixOffers}
                                  onPickFixOffer={(code, statement) => void onPickFixOffer(code, statement)}
                                      generateBusy={busy}
                                      generating={busyAction === "generate"}
                                      onGenerateTerritory={(bigThoughtId) => void onGenerateTerritory(bigThoughtId)}
                                  onEditBigThought={onEditBigThought}
                                      onDeleteBigThought={(bigThoughtId) =>
                                    setPendingDelete({ kind: "bigThought", id: bigThoughtId })
                                  }
                                      onFixBigThought={onFixBigThought}
                                      fixingCodes={[...fixingBigThoughtCodes]}
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
        onOpenChange={setPillarPickerOpen}
        onConfirm={(pillars, audio, look, speech, durationSeconds, brandName, cta) =>
          loadScriptConfirm({ pillars, audio, look, speech, durationSeconds, brandName, cta })
        }
      />
      <ExecutionConfirmDialog
        open={scriptConfirm !== null}
        loading={scriptConfirm?.loading ?? false}
        failed={scriptConfirm?.failed ?? false}
        questions={scriptConfirm?.questions ?? null}
        pending={busy}
        onOpenChange={(open) => {
          if (open) return;
          confirmToken.current += 1;
          setScriptConfirm(null);
        }}
        onRetry={() => {
          if (!scriptConfirm) return;
          loadScriptConfirm(scriptConfirm);
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
          );
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
