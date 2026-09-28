import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  assessMasterThought,
  beliefsMatch,
  confirmedFingerprint,
  confirmedParentReady,
  factsMatchStoredFingerprint,
  judgeMasterThought,
  resolveConfirmation,
  understandFingerprint,
} from "@/thinking-lab/master-thought/semantic";
import { masterBeliefDescription } from "@/thinking-lab/master-thought/description";
import { territoryDescriptions } from "@/thinking-lab/territory/description";
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
  buildAngleFixOptionsPrompt,
  parseAngleFixOptionsScript,
} from "@/thinking-lab/angle/fix";
import {
  buildAngleGapPrompt,
  judgeAndSealAngle,
  nextAngleCode,
  parseGeneratedAngleStatements,
  proposeAngleStatements,
  runAngleGenerate,
} from "@/thinking-lab/angle/generate";
import { evaluateAngleLock, selectAngleStage } from "@/thinking-lab/angle/lock";
import { admitAngle, visibleAngles } from "@/thinking-lab/angle/policy";
import { angleNodeSubject } from "@/thinking-lab/angle/subject";
import { loadAngleParentGate } from "@/thinking-lab/angle/repository";
import {
  angleConflictFailures,
  angleSetIsCurrent,
  applyAngleChallengerCoverage,
  buildAngleSiblingPrompt,
  emptyAngleSetRecord,
  parseAngleSet,
  scoreAngleAudit,
} from "@/thinking-lab/angle/setAudit";
import { useAngleSet, useLabAngles } from "@/thinking-lab/angle/useAngles";
import { canShowGenerateIdea } from "@/thinking-lab/idea/eligibility";
import { buildIdeaDownTopPrompt, parseIdeaDownTop } from "@/thinking-lab/idea/downTop";
import { buildIdeaFixOptionsPrompt, ideaReplacementPasses, parseIdeaFixOptionsScript } from "@/thinking-lab/idea/fix";
import { IDEA_ACTIVE_CAP, TARGET_IDEA_VALID, judgeAndSealIdea, nextIdeaCode, proposeIdeaStatements, runIdeaGenerate } from "@/thinking-lab/idea/generate";
import { evaluateIdeaLock, selectIdeaStage } from "@/thinking-lab/idea/lock";
import { loadIdeaParentGate } from "@/thinking-lab/idea/repository";
import { admitIdea, visibleIdeas } from "@/thinking-lab/idea/policy";
import {
  buildIdeaSiblingPrompt,
  emptyIdeaSetRecord,
  ideaSetIsCurrent,
  parseIdeaSet,
  scoreIdeaAudit,
} from "@/thinking-lab/idea/setAudit";
import type { IdeaSemanticFacts } from "@/thinking-lab/idea/types";
import { useIdeaSet, useLabIdeas } from "@/thinking-lab/idea/useIdeas";
import { buildExecutionGeneratePrompt, judgeAndSealExecution, parseExecutionStatement } from "@/thinking-lab/execution/generate";
import { EXECUTION_PILLARS, executionPillarLabel, isExecutionPillar } from "@/thinking-lab/execution/types";
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
} from "@/thinking-lab/territory/generate";
import { admitTerritory } from "@/thinking-lab/territory/policy";
import { loadTerritoryParentGate } from "@/thinking-lab/territory/repository";
import { buildTerritoryChallengerPrompt, coverageFromChallenger, parseTerritoryChallenger, territoryChallengerCanRun } from "@/thinking-lab/territory/challenger";
import { evaluateTerritoryLock, selectTerritoryStage } from "@/thinking-lab/territory/lock";
import {
  applyChallengerCoverage,
  buildTerritorySiblingPrompt,
  emptyTerritorySetRecord,
  parseTerritorySet,
  holdPassingTerritoryVerdicts,
  mergeTerritoryAuditLessons,
  scoreTerritoryAudit,
  territoryFailureLessons,
  territorySetIsCurrent,
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
import { LabNodeInspector } from "@/thinking-lab/section/LabNodeInspector";
import { MasterThoughtMapTree } from "@/thinking-lab/section/MasterThoughtMapTree";
import { MasterThoughtSection } from "@/thinking-lab/section/MasterThoughtSection";
import { StageActionBar } from "@/thinking-lab/section/StageActionBar";

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
    | null
  >(null);
  const [editingMasterId, setEditingMasterId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [zoomHost, setZoomHost] = useState<HTMLDivElement | null>(null);
  const [focus, setFocus] = useState<
    | { kind: "master"; masterId: string }
    | { kind: "bigThought"; masterId: string; thoughtId: string }
    | { kind: "territory"; masterId: string; thoughtId: string; territoryId: string }
    | { kind: "angle"; masterId: string; thoughtId: string; territoryId: string; angleId: string }
    | { kind: "idea"; masterId: string; thoughtId: string; territoryId: string; angleId: string; ideaId: string }
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
      (row) => row.status !== "rejected" && !row.label.trim() && !labeledAttempt.current.has(row.id),
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
          return label ? [{ id: row.id, label }] : [];
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
  const labTerritories = useLabTerritories(territoryParentIds);
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
                  relation: angle.canonicalSemantic.relationToParent,
                })),
            };
          }),
      };
    });
  }, [active, parentFp, setRecord, labTerritories.data, labAngles.data]);

  const focusedThought =
    locked &&
    (focus?.kind === "bigThought" || focus?.kind === "territory" || focus?.kind === "angle" || focus?.kind === "idea") &&
    focus.masterId === selected?.id
      ? (rowViews.find((row) => row.id === focus.thoughtId) ?? null)
      : null;
  const territorySet = useTerritorySet(focusedThought?.id ?? null);
  const focusedTerritory =
    focus?.kind === "territory" || focus?.kind === "angle" || focus?.kind === "idea"
      ? ((labTerritories.data ?? []).find((row) => row.id === focus.territoryId) ?? null)
      : null;
  const territoryCopy = focusedTerritory
    ? territoryDescriptions(focusedTerritory.statement, focusedThought?.statement ?? "")
    : null;
  const angleSet = useAngleSet(focusedTerritory?.id ?? null);
  const masterStatement = (selected?.statement || selected?.originalInput || "").trim();
  const becauseParent = (masterSubject || masterStatement).trim();
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
    if (stored?.verdict === "AUDIT_PASS" && stored.statementFingerprint === statementFingerprint) return "AUDIT_PASS";
    if (
      !rescoredTerritoryAudit &&
      stored?.verdict === "AUDIT_FAIL" &&
      stored.statementFingerprint === statementFingerprint
    ) {
      return "AUDIT_FAIL";
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
    const statementFingerprint = parentTerritoryFingerprint
      ? angleFingerprint({ statement: row.statement, territoryFingerprint: parentTerritoryFingerprint })
      : "";
    const stored = angleSet.data?.audit?.items.find((item) => item.code.toUpperCase() === row.code.toUpperCase());
    if (stored?.verdict === "AUDIT_PASS" && stored.statementFingerprint === statementFingerprint) return "AUDIT_PASS";
    if (
      !rescoredAngleAudit &&
      stored?.verdict === "AUDIT_FAIL" &&
      stored.statementFingerprint === statementFingerprint
    ) {
      return "AUDIT_FAIL";
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
  const angleStage = selectAngleStage({
    admittedCount: admittedAngles.length,
    verdicts: angleVerdicts,
    challengerComplete: Boolean(
      angleChallenger && angleChallenger.status === "COMPLETE" && angleChallenger.unresolvedReasons.length === 0,
    ),
    materialGap: angleMaterialGap,
    canAdd: admittedAngles.length < ACTIVE_SET_CAP,
    repairsUsed: (angleSet.data?.repairCount ?? 0) > 0,
    lockOk: angleLock.ok,
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
  const angleSetLocked = admittedAngles.length >= 3 && admittedAngles.every((row) => row.status === "locked");
  const territoryAlreadySealed = canShowGenerateAngle(focusedTerritory, focusedBigThoughtFingerprint || null);
  const showGenerateAngle = Boolean(
    focusedTerritory?.admission === "GENERATE_VALID" &&
      focusedThought?.canGenerateTerritory &&
      (focusedTerritory.status !== "locked" || territoryAlreadySealed),
  );
  const focusedAngle =
    focus?.kind === "angle" ? ((labAngles.data ?? []).find((row) => row.id === focus.angleId) ?? null) : null;
  const ideaSet = useIdeaSet(focus?.kind === "angle" || focus?.kind === "idea" ? focus.angleId : null);
  const focusedTerritoryFingerprint =
    focusedTerritory && focusedBigThoughtFingerprint
      ? territoryFingerprint({ statement: focusedTerritory.statement, bigThoughtFingerprint: focusedBigThoughtFingerprint })
      : "";
  const showGenerateIdea = canShowGenerateIdea(focusedAngle, focusedTerritoryFingerprint || null);
  const admittedIdeas = visibleIdeas(labIdeas.data ?? [], focusedAngle?.id ?? "");
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
          codes: admittedIdeas.map((row) => row.code),
          siblingSet: storedIdeaSet,
          siblingSetCurrent: true,
        })
      : null;
  const ideaVerdicts = admittedIdeas.map((row) => {
    const statementFingerprint = parentAngleFingerprint
      ? ideaFingerprint({ statement: row.statement, angleFingerprint: parentAngleFingerprint })
      : "";
    const stored = ideaSet.data?.audit?.items.find((item) => item.code.toUpperCase() === row.code.toUpperCase());
    if (stored?.verdict === "AUDIT_PASS" && stored.statementFingerprint === statementFingerprint) return "AUDIT_PASS" as const;
    if (!rescoredIdeaAudit && stored?.verdict === "AUDIT_FAIL" && stored.statementFingerprint === statementFingerprint) {
      return "AUDIT_FAIL" as const;
    }
    return rescoredIdeaAudit?.find((item) => item.code.toUpperCase() === row.code.toUpperCase())?.verdict ?? null;
  });
  const ideaDownTopCurrent = fingerprintsMatch(ideaSet.data?.downTop?.fingerprint, ideaFingerprintNow);
  const ideaDownTop = admittedIdeas.map((row) => {
    if (!ideaDownTopCurrent) return null;
    return ideaSet.data?.downTop?.items.find((item) => item.code.toUpperCase() === row.code.toUpperCase())?.verdict ?? null;
  });
  const ideaLock = evaluateIdeaLock({
    admittedCount: admittedIdeas.length,
    verdicts: ideaVerdicts,
    downTop: ideaDownTop,
    downTopCurrent: ideaDownTopCurrent,
  });
  const ideaStage = selectIdeaStage({
    admittedCount: admittedIdeas.length,
    verdicts: ideaVerdicts,
    downTop: ideaDownTop,
    downTopCurrent: ideaDownTopCurrent,
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
    ...(ideaDownTopCurrent
      ? (ideaSet.data?.downTop?.items ?? [])
          .filter((item) => item.proofCanAppear === false && item.bigThoughtNote)
          .map((item) => `${item.code}: ${item.bigThoughtNote}`)
      : []),
    ...((ideaVerdicts.some((verdict) => verdict === "AUDIT_FAIL") || ideaDownTop.some((verdict) => verdict === "FAIL")) &&
    (ideaSet.data?.repairCount ?? 0) > 0
      ? [t("thinkingLab.idea.repairStopped", "Fix already ran once. This set stays open until the ideas pass.")]
      : []),
  ];
  const ideaSetLocked =
    admittedIdeas.length >= TARGET_IDEA_VALID && admittedIdeas.every((row) => row.status === "locked");
  const bigThoughtQuestionNotes = (labAngles.data ?? [])
    .filter((angle) =>
      (labTerritories.data ?? []).some(
        (territory) => territory.id === angle.territoryId && territory.bigThoughtId === focusedThought?.id,
      ),
    )
    .flatMap((angle) =>
      (angle.ideaSet.downTop?.items ?? [])
        .filter((item) => item.proofCanAppear === false && item.bigThoughtNote.trim())
        .map((item) => `${angle.code} · ${item.code}: ${item.bigThoughtNote}`),
    );
  const focusedIdea =
    focus?.kind === "idea" ? ((labIdeas.data ?? []).find((row) => row.id === focus.ideaId) ?? null) : null;
  const labExecutions = useLabExecutions(focusedIdea?.status === "locked" ? focusedIdea.id : null);

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
    challengerComplete,
    lockOk: lockDecision.ok,
  });
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
      const facts = await judgeMasterThought(planted, askThinkingLab, undefined, { priorBelief, audience });
      await masters.saveJudge.mutateAsync({
        id: created.id,
        facts,
        fingerprint: understandFingerprint(planted, facts.proposedRootBelief),
      });
      setNewPrior("");
      setNewPlanted("");
      setNewAudience("");
      setComposerOpen(false);
      skipAutoSelect.current = false;
      setSelectedId(created.id);
    });

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
      const text = originalDraft.trim();
      const prior = priorDraft.trim();
      const audience = audienceDraft.trim();
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
      const facts = await judgeMasterThought(text, askThinkingLab, clarification, {
        priorBelief: prior,
        audience,
      });
      await masters.saveJudge.mutateAsync({
        id: selected.id,
        facts,
        fingerprint: understandFingerprint(text, facts.proposedRootBelief),
      });
    });

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
        incumbents: rowViews.map((row) => ({ code: row.code, statement: row.statement, admission: row.admission })),
        activeCount: rowViews.length,
        missingWhy,
        propose: async (plan, incumbents) => {
          const script = await askThinkingLab(
            buildGeneratePrompt({
              parentStatement: becauseParent,
              incumbents: incumbents
                .filter((row) => row.admission === "GENERATE_VALID")
                .map((row) => ({ code: row.code, statement: row.statement })),
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
            label: candidate.label,
            sortOrder: sort,
            facts: { ...facts, code },
            masterFingerprint: parentFp,
          });
          record = clearSetConclusions(record);
          await masters.saveSet.mutateAsync({ id: selected.id, lastAudit: record });
          return {
            code: saved.code,
            statement: saved.statement,
            admission: individualAdmission({ facts: { ...facts, code }, factsCurrent: true }),
          };
        },
      });
    }, "generate");

  const generateTerritory = async (bigThoughtId: string) => {
      if (!masters.organizationId || !parentFp) return;
      const known = (labTerritories.data ?? []).filter((row) => row.bigThoughtId === bigThoughtId);
      let sort = known.reduce((max, row) => Math.max(max, row.sortOrder), 0);
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
        })),
        propose: (plan, parent, incumbents) =>
          proposeTerritoryStatements({
            parentStatement: parent.statement,
            ancestors: parent.ancestors,
            audience: parent.audience || selected?.audience,
            incumbents: incumbents.map((row) => ({ code: row.code, statement: row.statement })),
            lessons: territorySet.data?.auditLessons ?? [],
            needed: plan.needed,
            ask: async (prompt) => {
              const script = await askThinkingLab(prompt, 0.2);
              if (!script) throw new Error(t("thinkingLab.error.generic", "Thinking Lab could not finish that step."));
              return script;
            },
          }),
        judge: (parent, code, statement) =>
          judgeAndSealTerritory({
            parentStatement: parent.statement,
            ancestors: parent.ancestors,
            audience: parent.audience || selected?.audience,
            code,
            statement,
            ask: (prompt) => askThinkingLab(prompt, 0),
          }),
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
          };
        },
      });
      if (result.outcome === "DENIED" && result.reason) {
        toast.error(result.reason);
        return;
      }
      if (result.outcome === "INSUFFICIENT_VALID_TERRITORIES") {
        const message = t("thinkingLab.territory.insufficient", "Only {{count}} of {{target}} Territories are valid. Generate can try again. Territories that already passed stay passed.", {
          count: result.generateValid,
          target: result.target,
        });
        setNotice(message);
        toast.error(message);
      }
      if (
        bigThoughtId === focusedThought?.id &&
        admittedTerritorySetChanged(
          known.map((row) => ({ code: row.code, admission: row.admission })),
          result.incumbents,
        )
      ) {
        await territorySet.save.mutateAsync({
          ...emptyTerritorySetRecord(),
          auditLessons: territorySet.data?.auditLessons ?? [],
        });
      }
  };

  const onGenerateTerritory = (bigThoughtId: string) => run(() => generateTerritory(bigThoughtId), "generate-territory");

  const onGenerateAngle = (territoryId: string) =>
    run(async () => {
      if (!masters.organizationId || !parentFp) return;
      const territory = (labTerritories.data ?? []).find((row) => row.id === territoryId);
      if (!territory || !focusedThought || focusedThought.id !== territory.bigThoughtId) return;
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
        propose: (plan, parent, incumbents) =>
          proposeAngleStatements({
            parentStatement: parent.statement,
            ancestors: parent.ancestors,
            incumbents: incumbents.map((row) => ({ code: row.code, statement: row.statement })),
            needed: plan.needed,
            ask: (prompt) => askThinkingLab(prompt, 0.2),
          }),
        judge: (parent, code, statement) =>
          judgeAndSealAngle({
            parentStatement: parent.statement,
            ancestors: parent.ancestors,
            code,
            statement,
            ask: (prompt) => askThinkingLab(prompt, 0),
          }),
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
      if (territoryId === focusedTerritory?.id) {
        await angleSet.save.mutateAsync(emptyAngleSetRecord());
      }
    }, "generate-angle");

  const onGenerateIdea = (angleId: string) =>
    run(async () => {
      if (!masters.organizationId || !parentFp || !focusedAngle || focusedAngle.id !== angleId) return;
      const known = (labIdeas.data ?? []).filter((row) => row.angleId === angleId);
      let sort = known.reduce((max, row) => Math.max(max, row.sortOrder), 0);
      const result = await runIdeaGenerate({
        loadParent: () =>
          loadIdeaParentGate({
            organizationId: masters.organizationId as string,
            angleId,
            expectedTerritoryId: focusedAngle.territoryId,
            masterThoughtFingerprint: parentFp,
          }),
        incumbents: known.map((row) => ({
          code: row.code,
          statement: row.statement,
          admission: row.admission,
          angleId: row.angleId,
        })),
        propose: (plan, parent, incumbents) =>
          proposeIdeaStatements({
            parentStatement: parent.statement,
            ancestors: parent.ancestors,
            incumbents: incumbents.map((row) => ({ code: row.code, statement: row.statement })),
            needed: plan.needed,
            ask: (prompt) => askThinkingLab(prompt, 0.2),
          }),
        judge: (parent, code, statement) =>
          judgeAndSealIdea({
            parentStatement: parent.statement,
            masterSubject,
            ancestors: parent.ancestors,
            code,
            statement,
            ask: (prompt) => askThinkingLab(prompt, 0),
          }),
        persist: async ({ parent, code, statement, facts, admission }) => {
          sort += 1;
          const saved = await labIdeas.insert.mutateAsync({
            angleId: parent.id,
            expectedTerritoryId: focusedAngle.territoryId,
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
        await ideaSet.save.mutateAsync(emptyIdeaSetRecord());
      }
    }, "generate-idea");

  const onIdeaStage = () =>
    run(async () => {
      if (!focusedAngle || !focusedThought || !masters.organizationId || !parentFp || admittedIdeas.length === 0) return;
      const ancestors: AncestorStake[] = [
        ...(focusedTerritory?.statement.trim() ? [{ label: "Territory", statement: focusedTerritory.statement.trim() }] : []),
        ...angleAncestors,
      ];
      if (ideaStage === "fix") {
        const failed = admittedIdeas.filter(
          (_, index) => ideaVerdicts[index] === "AUDIT_FAIL" || ideaDownTop[index] === "FAIL" || ideaDownTop[index] === "UNRESOLVED",
        );
        const keepers = admittedIdeas.filter(
          (_, index) => ideaVerdicts[index] === "AUDIT_PASS" && ideaDownTop[index] !== "FAIL",
        );
        const offers: Array<{ angleId: string; failedCode: string; statement: string; facts: IdeaSemanticFacts }> = [];
        for (const row of failed) {
          const script = await askThinkingLab(
            buildIdeaFixOptionsPrompt({
              parentStatement: focusedAngle.statement,
              masterSubject,
              ancestors,
              failed: { code: row.code, statement: row.statement },
              keepers: keepers.map((keeper) => ({ code: keeper.code, statement: keeper.statement })),
              conflicts: ideaNotes,
            }),
            0.2,
          );
          const statements = parseIdeaFixOptionsScript(script).filter((statement) => statement !== row.statement.trim());
          for (const statement of statements) {
            if (offers.some((offer) => offer.failedCode === row.code && offer.statement === statement)) continue;
            const facts = await judgeAndSealIdea({
              parentStatement: focusedAngle.statement,
              masterSubject,
              ancestors,
              code: row.code,
              statement,
              ask: (prompt) => askThinkingLab(prompt, 0),
            });
            if (admitIdea(facts) !== "GENERATE_VALID") continue;
            const rows = admittedIdeas.map((item) => ({
              code: item.code,
              statement: item.code.toUpperCase() === row.code.toUpperCase() ? statement : item.statement,
            }));
            const fingerprint = ideaSetFingerprint({
              angleFingerprint: parentAngleFingerprint,
              ideaFingerprints: rows.map((item) =>
                ideaFingerprint({ statement: item.statement, angleFingerprint: parentAngleFingerprint }),
              ),
            });
            const siblingScript = await askThinkingLab(
              buildIdeaSiblingPrompt({ parentStatement: focusedAngle.statement, rows }),
              0,
            );
            const siblingSet = parseIdeaSet(siblingScript, fingerprint);
            if (!ideaReplacementPasses(siblingSet, row.code)) continue;
            offers.push({ angleId: focusedAngle.id, failedCode: row.code, statement, facts });
          }
        }
        setIdeaFixOffers(offers);
        const held = admittedIdeas.flatMap((row, index) => {
          const verdict = ideaVerdicts[index];
          if (verdict !== "AUDIT_PASS" && verdict !== "AUDIT_FAIL") return [];
          return [
            {
              code: row.code,
              verdict,
              statementFingerprint: ideaFingerprint({
                statement: row.statement,
                angleFingerprint: parentAngleFingerprint,
              }),
            },
          ];
        });
        await ideaSet.save.mutateAsync({
          schema: "thinking-lab/idea-set/v1",
          repairCount: (ideaSet.data?.repairCount ?? 0) + 1,
          siblingSet: null,
          audit: held.length > 0 ? { fingerprint: "", items: held } : null,
          downTop: null,
        });
        const covered = new Set(offers.map((offer) => offer.failedCode.toUpperCase()));
        if (covered.size < failed.length) {
          setNotice(
            t("thinkingLab.idea.noSafeReplacement", "NO_SAFE_REPLACEMENT {{count}}/{{failed}}", {
              count: covered.size,
              failed: failed.length,
            }),
          );
        } else {
          setNotice(null);
        }
        return;
      }
      if (ideaStage === "audit") {
        const script = await askThinkingLab(
          buildIdeaSiblingPrompt({
            parentStatement: focusedAngle.statement,
            rows: admittedIdeas.map((row) => ({ code: row.code, statement: row.statement })),
          }),
          0,
        );
        const siblingSet = parseIdeaSet(script, ideaFingerprintNow);
        const items = scoreIdeaAudit({
          codes: admittedIdeas.map((row) => row.code),
          siblingSet,
          siblingSetCurrent: true,
        }).map((item) => ({
          ...item,
          statementFingerprint: ideaFingerprint({
            statement: admittedIdeas.find((row) => row.code.toUpperCase() === item.code.toUpperCase())?.statement ?? "",
            angleFingerprint: parentAngleFingerprint,
          }),
        }));
        await ideaSet.save.mutateAsync({
          schema: "thinking-lab/idea-set/v1",
          repairCount: items.some((item) => item.verdict === "AUDIT_FAIL") ? (ideaSet.data?.repairCount ?? 0) : 0,
          siblingSet,
          audit: { fingerprint: ideaFingerprintNow, items },
          downTop: null,
        });
        return;
      }
      if (ideaStage === "downtop") {
        const script = await askThinkingLab(
          buildIdeaDownTopPrompt({
            masterStatement,
            masterSubject,
            bigThoughtStatement: focusedThought.statement,
            angleStatement: focusedAngle.statement,
            rows: admittedIdeas.map((row) => ({ code: row.code, statement: row.statement })),
          }),
          0,
        );
        const items = parseIdeaDownTop(
          script,
          admittedIdeas.map((row) => row.code),
          Boolean(masterSubject),
        );
        await ideaSet.save.mutateAsync({
          schema: "thinking-lab/idea-set/v1",
          repairCount: ideaSet.data?.repairCount ?? 0,
          siblingSet: ideaSet.data?.siblingSet ?? null,
          audit: ideaSet.data?.audit ?? null,
          downTop: { fingerprint: ideaFingerprintNow, items },
        });
        return;
      }
      if (ideaStage === "lock" && ideaLock.ok) {
        await ideaSet.lock.mutateAsync({
          angleFingerprint: parentAngleFingerprint,
          ids: admittedIdeas.map((row) => row.id),
        });
      }
    }, ideaStage ?? "audit");

  const onPickIdeaFixOffer = (failedCode: string, statement: string) =>
    run(async () => {
      if (!focusedAngle || !masters.organizationId) return;
      const offer = ideaFixOffers.find(
        (row) =>
          row.angleId === focusedAngle.id &&
          row.failedCode.toUpperCase() === failedCode.toUpperCase() &&
          row.statement === statement,
      );
      const previous = admittedIdeas.find((row) => row.code.toUpperCase() === failedCode.toUpperCase());
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
        downTop: null,
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
      if (!read.ok) {
        return read.reason === "TOO_LONG" ? t("thinkingLab.manual.labelTooLong", "A label is at most 3 words.") : null;
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
      await angleSet.save.mutateAsync(emptyAngleSetRecord());
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
      await ideaSet.save.mutateAsync(emptyIdeaSetRecord());
      return null;
    });

  const onEditIdea = (id: string, statement: string) =>
    runManual("manual-idea", async () => {
      if (!parentFp) return null;
      const idea = (labIdeas.data ?? []).find((row) => row.id === id);
      if (!idea || idea.status !== "candidate") return null;
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
        await ideaSet.save.mutateAsync(emptyIdeaSetRecord());
      }
      return null;
    });

  const onGenerateExecution = (pillar: string) =>
    run(async () => {
      if (!focusedIdea || focusedIdea.status !== "locked" || !isExecutionPillar(pillar) || !masters.organizationId) return;
      const { ancestors } = ideaParentFor(focusedIdea.angleId);
      const script = await askThinkingLab(
        buildExecutionGeneratePrompt({
          masterStatement,
          masterSubject,
          ideaStatement: focusedIdea.statement,
          pillar,
          ancestors,
        }),
        0.2,
      );
      const statement = parseExecutionStatement(parseModelJson(script));
      if (!statement) return;
      const facts = await judgeAndSealExecution({
        masterStatement,
        masterSubject,
        ideaStatement: focusedIdea.statement,
        pillar,
        ancestors,
        statement,
        ask: (prompt) => askThinkingLab(prompt, 0),
      });
      await labExecutions.save.mutateAsync({
        ideaId: focusedIdea.id,
        pillar,
        statement,
        facts,
      });
    }, `execution-${pillar}`);

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
        const statement = parseGeneratedAngleStatements(parseModelJson(script))[0];
        if (!statement) return;
        const code = nextAngleCode(known.map((row) => row.code));
        const facts = await judgeAndSealAngle({
          parentStatement: focusedTerritory.statement,
          ancestors: angleAncestors,
          code,
          statement,
          ask: (prompt) => askThinkingLab(prompt, 0),
        });
        let admission = admitAngle(facts);
        if (admission === "GENERATE_VALID" && admittedAngles.length > 0) {
          const precheckScript = await askThinkingLab(
            buildAngleSiblingPrompt({
              parentStatement: focusedTerritory.statement,
              rows: [...admittedAngles.map((row) => ({ code: row.code, statement: row.statement })), { code, statement }],
            }),
            0,
          );
          const precheck = parseAngleSet(precheckScript, "gap-precheck");
          if (precheck.resolution !== "RESOLVED" || angleConflictFailures(precheck).has(code.toUpperCase())) {
            admission = "GENERATE_REJECT";
          }
        }
        const sort = known.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
        await labAngles.insert.mutateAsync({
          territoryId: focusedTerritory.id,
          expectedBigThoughtId: focusedTerritory.bigThoughtId,
          masterThoughtFingerprint: parentFp,
          code,
          statement,
          sortOrder: sort,
          facts,
          admission,
        });
        if (admission === "GENERATE_VALID") {
          await angleSet.save.mutateAsync(emptyAngleSetRecord());
        } else {
          setNotice(
            t(
              "thinkingLab.angle.gapRejected",
              "The gap candidate collided with a passing Angle and was not admitted. Generate Angle can try again.",
            ),
          );
        }
        return;
      }
      if (angleStage === "fix") {
        const failed = admittedAngles.filter((_, index) => angleVerdicts[index] === "AUDIT_FAIL");
        const keepers = admittedAngles.filter((_, index) => angleVerdicts[index] === "AUDIT_PASS");
        const offers: Array<{ territoryId: string; failedCode: string; statement: string; facts: AngleSemanticFacts }> = [];
        for (const row of failed) {
          const script = await askThinkingLab(
            buildAngleFixOptionsPrompt({
              parentStatement: focusedTerritory.statement,
              ancestors: angleAncestors,
              failed: { code: row.code, statement: row.statement },
              keepers: keepers.map((keeper) => ({ code: keeper.code, statement: keeper.statement })),
              conflicts: angleNotes,
            }),
            0.2,
          );
          const statements = parseAngleFixOptionsScript(script).filter((statement) => statement !== row.statement.trim());
          for (const statement of statements) {
            if (offers.some((offer) => offer.failedCode === row.code && offer.statement === statement)) continue;
            const facts = await judgeAndSealAngle({
              parentStatement: focusedTerritory.statement,
              ancestors: angleAncestors,
              code: row.code,
              statement,
              ask: (prompt) => askThinkingLab(prompt, 0),
            });
            if (admitAngle(facts) !== "GENERATE_VALID") continue;
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
            if (!angleReplacementPasses(siblingSet, row.code)) continue;
            offers.push({ territoryId: focusedTerritory.id, failedCode: row.code, statement, facts });
          }
        }
        setAngleFixOffers(offers);
        const held = admittedAngles.flatMap((row, index) => {
          const verdict = angleVerdicts[index];
          if (verdict !== "AUDIT_PASS" && verdict !== "AUDIT_FAIL") return [];
          return [
            {
              code: row.code,
              verdict,
              statementFingerprint: angleFingerprint({
                statement: row.statement,
                territoryFingerprint: parentTerritoryFingerprint,
              }),
            },
          ];
        });
        await angleSet.save.mutateAsync({
          schema: "thinking-lab/angle-set/v1",
          repairCount: (angleSet.data?.repairCount ?? 0) + 1,
          siblingSet: null,
          audit: held.length > 0 ? { fingerprint: "", items: held } : null,
          challenger: null,
        });
        const covered = new Set(offers.map((offer) => offer.failedCode.toUpperCase()));
        if (covered.size < failed.length) {
          setNotice(
            t("thinkingLab.angle.noSafeReplacement", "NO_SAFE_REPLACEMENT {{count}}/{{failed}}", {
              count: covered.size,
              failed: failed.length,
            }),
          );
        } else {
          setNotice(null);
        }
        return;
      }
      if (angleStage === "audit") {
        const script = await askThinkingLab(
          buildAngleSiblingPrompt({
            parentStatement: focusedTerritory.statement,
            rows: admittedAngles.map((row) => ({ code: row.code, statement: row.statement })),
          }),
          0,
        );
        const siblingSet = parseAngleSet(script, angleFingerprintNow);
        const items = scoreAngleAudit({
          codes: admittedAngles.map((row) => row.code),
          siblingSet,
          siblingSetCurrent: true,
        });
        await angleSet.save.mutateAsync({
          schema: "thinking-lab/angle-set/v1",
          repairCount: items.some((item) => item.verdict === "AUDIT_FAIL") ? (angleSet.data?.repairCount ?? 0) : 0,
          siblingSet,
          audit: { fingerprint: angleFingerprintNow, items },
          challenger: null,
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
      if (!focusedTerritory || admittedAngles.length < 3 || !parentTerritoryFingerprint) return;
      if (!angleVerdicts.every((verdict) => verdict === "AUDIT_PASS")) return;
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

  const onTerritoryStage = () => {
    if (territoryStage === "generate" && focusedThought) {
      return run(() => generateTerritory(focusedThought.id), "generate");
    }
    return run(async () => {
      if (!focusedThought || !masters.organizationId || !parentFp || admittedTerritories.length === 0) return;
      if (territoryStage === "fix") {
        const failed = admittedTerritories.filter((_, index) => territoryVerdicts[index] === "AUDIT_FAIL");
        const keepers = admittedTerritories.filter((_, index) => territoryVerdicts[index] === "AUDIT_PASS");
        const conflicts = territoryNotes.map((note) =>
          note.kind === "overlap"
            ? `${note.a} · ${note.b}: ${note.explanation}`
            : note.kind === "containment"
              ? `${note.container} · ${note.contained}: ${note.explanation}`
              : note.text,
        );
        const offers: Array<{ thoughtId: string; failedCode: string; statement: string; facts: TerritorySemanticFacts }> = [];
        for (const row of failed) {
          const script = await askThinkingLab(
            buildTerritoryFixOptionsPrompt({
              parentStatement: focusedThought.statement,
              ancestors: territoryAncestors,
              audience: selected?.audience,
              failed: { code: row.code, statement: row.statement },
              keepers: keepers.map((keeper) => ({ code: keeper.code, statement: keeper.statement })),
              conflicts,
            }),
            0.2,
          );
          const statements = parseTerritoryFixOptionsScript(script).filter((statement) => statement !== row.statement.trim());
          for (const statement of statements) {
            if (offers.some((offer) => offer.failedCode === row.code && offer.statement === statement)) continue;
            const facts = await judgeAndSealTerritory({
              parentStatement: focusedThought.statement,
              ancestors: territoryAncestors,
              audience: selected?.audience,
              code: row.code,
              statement,
              ask: (prompt) => askThinkingLab(prompt, 0),
            });
            if (admitTerritory(facts) !== "GENERATE_VALID") continue;
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
            if (!territoryReplacementPasses(siblingSet, row.code)) continue;
            offers.push({ thoughtId: focusedThought.id, failedCode: row.code, statement, facts });
          }
        }
        setTerritoryFixOffers(offers);
        const held = admittedTerritories.flatMap((row, index) => {
          const verdict = territoryVerdicts[index];
          if (verdict !== "AUDIT_PASS" && verdict !== "AUDIT_FAIL") return [];
          return [
            {
              code: row.code,
              verdict,
              statementFingerprint: territoryFingerprint({
                statement: row.statement,
                bigThoughtFingerprint: focusedBigThoughtFingerprint,
              }),
            },
          ];
        });
        await territorySet.save.mutateAsync({
          schema: "thinking-lab/territory-set/v1",
          repairCount: (territorySet.data?.repairCount ?? 0) + 1,
          siblingSet: null,
          audit: held.length > 0 ? { fingerprint: "", items: held } : null,
          challenger: null,
          auditLessons: mergeTerritoryAuditLessons(
            territorySet.data?.auditLessons ?? [],
            territoryFailureLessons({
              rows: failed.map((row) => ({ code: row.code, statement: row.statement })),
              items: failed.map((row) => ({ code: row.code, verdict: "AUDIT_FAIL" })),
              siblingSet: storedTerritorySet,
            }),
          ),
        });
        const covered = new Set(offers.map((offer) => offer.failedCode.toUpperCase()));
        if (covered.size < failed.length) {
          setNotice(
            t("thinkingLab.territory.noSafeReplacement", "NO_SAFE_REPLACEMENT {{count}}/{{failed}}", {
              count: covered.size,
              failed: failed.length,
            }),
          );
        } else {
          setNotice(null);
        }
        return;
      }
      if (territoryStage === "audit") {
        const script = await askThinkingLab(
          buildTerritorySiblingPrompt({
            parentStatement: focusedThought.statement,
            rows: admittedTerritories.map((row) => ({ code: row.code, statement: row.statement })),
          }),
          0,
        );
        const siblingSet = parseTerritorySet(script, territoryFingerprintNow);
        const passingCodes = admittedTerritories.flatMap((row, index) =>
          territoryVerdicts[index] === "AUDIT_PASS" ? [row.code] : [],
        );
        const items = holdPassingTerritoryVerdicts(
          scoreTerritoryAudit({
            codes: admittedTerritories.map((row) => row.code),
            siblingSet,
            siblingSetCurrent: true,
          }),
          passingCodes,
        ).map((item) => {
          const row = admittedTerritories.find((candidate) => candidate.code.toUpperCase() === item.code.toUpperCase());
          return {
            ...item,
            statementFingerprint: row
              ? territoryFingerprint({ statement: row.statement, bigThoughtFingerprint: focusedBigThoughtFingerprint })
              : item.statementFingerprint,
          };
        });
        await territorySet.save.mutateAsync({
          schema: "thinking-lab/territory-set/v1",
          repairCount: items.some((item) => item.verdict === "AUDIT_FAIL") ? (territorySet.data?.repairCount ?? 0) : 0,
          siblingSet,
          audit: { fingerprint: territoryFingerprintNow, items },
          challenger: null,
          auditLessons: mergeTerritoryAuditLessons(
            territorySet.data?.auditLessons ?? [],
            territoryFailureLessons({
              rows: admittedTerritories.map((row) => ({ code: row.code, statement: row.statement })),
              items,
              siblingSet,
            }),
          ),
        });
        return;
      }
      if (territoryStage === "challenger") {
        if (!territoryChallengerCanRun(territoryVerdicts.flatMap((verdict) => (verdict ? [verdict] : [])))) return;
        const script = await askThinkingLab(
          buildTerritoryChallengerPrompt({
            parentStatement: focusedThought.statement,
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

  const onFix = () =>
    run(async () => {
      setAuditProgress(null);
      setFixResponses([]);
      if (!selected || !parentFp) return;
      const siblingForParent = siblingSetBelongsToParent(setRecord?.siblingSet ?? null, parentFp)
        ? setRecord?.siblingSet ?? null
        : null;
      const contributionFor = (code: string) =>
        siblingForParent?.reasonContributions?.find((item) => item.code.toUpperCase() === code.toUpperCase())
          ?.reasonContribution ?? null;
      const failureRows = active.filter(
        (row) => rowViews.find((view) => view.id === row.id)?.audit === "AUDIT_FAIL",
      );
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
      setFixOffers([]);
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
      setFixOffers(offers);
      const unsafe = results.filter((result) => result.result === "NO_SAFE_REPLACEMENT").map((result) => result.code);
      if (offers.length > 0) setNotice(null);
      else setNotice(t("thinkingLab.bt.noSafeReplacement", "NO_SAFE_REPLACEMENT {{codes}}", { codes: unsafe.join(", ") }));
    });

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

  const pathUp = (() => {
    if (!selected || !locked || !focus || focus.masterId !== selected.id || focus.kind === "master") return undefined;
    const masterTitle = (masterSubject || selected.statement || selected.originalInput).trim();
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
      title: angle ? angleNodeSubject(angle.statement, territory?.statement ?? "") : "",
    };
    if (focus.kind === "angle") return [territoryItem, thoughtItem, masterItem];
    return [angleItem, territoryItem, thoughtItem, masterItem];
  })();

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className={cn("flex min-h-0 min-w-0 w-full flex-1", !showContent && "pointer-events-none invisible select-none")} aria-hidden={!showContent}>
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden bg-muted/40">
                <div className="mb-1 shrink-0 py-2">
                  <h1 className="text-lg font-semibold text-foreground">{t("thinkingLab.page.title", "Thinking Lab")}</h1>
                  <p className="text-sm text-muted-foreground">
                    {t("thinkingLab.page.subtitle", "Confirm one Master Thought, then keep distinct material supports.")}
                  </p>
                </div>
                <ModuleShellContentGate pagePath="/thinking-lab">
                  <div className={LAB_MAIN_GRID}>
                    <div className={LAB_LEFT_COL}>
                      <div className={LAB_LEFT_SECTION}>
                        <div className={`${LAB_MT_CARD} gap-3 p-4`}>
                          <div className="flex shrink-0 items-center gap-2">
                            <h2 className="shrink-0 text-sm font-medium">{t("thinkingLab.list.title", "Master Thoughts")}</h2>
                            {selected?.priorBelief ? (
                              <div
                                className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm"
                                title={`${selected.priorBelief} → ${selected.statement || selected.originalInput}${selected.audience ? ` · ${selected.audience}` : ""}`}
                              >
                                <span className="min-w-0 flex-1 truncate text-rose-700 line-through">{selected.priorBelief}</span>
                                <span className="shrink-0" aria-hidden="true">→</span>
                                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{selected.statement || selected.originalInput}</span>
                                {selected.audience ? (
                                  <span className="min-w-0 max-w-[24%] truncate text-muted-foreground">{selected.audience}</span>
                                ) : null}
                              </div>
                            ) : (
                              <div className="min-w-0 flex-1" />
                            )}
                            <div ref={setZoomHost} className="shrink-0" />
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
                          {showComposer ? (
                          <>
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
                          >
                            {t("thinkingLab.action.formulate", "Formulate Master Thought")}
                          </Button>
                          </>
                          ) : null}
                          <MasterThoughtMapTree
                            masters={masters.data ?? []}
                            selectedId={selected?.id ?? null}
                            inspectedMasterId={focus?.masterId ?? (selected && !locked ? selected.id : null)}
                            inspectedThoughtId={focus?.kind === "bigThought" ? focus.thoughtId : null}
                            inspectedTerritoryId={focus?.kind === "territory" ? focus.territoryId : null}
                            inspectedAngleId={focus?.kind === "angle" ? focus.angleId : null}
                            inspectedIdeaId={focus?.kind === "idea" ? focus.ideaId : null}
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
                                  (angle) =>
                                    angle.territoryId === territoryId &&
                                    angle.admission === "GENERATE_VALID" &&
                                    angle.status === "locked",
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
                                focus.kind === "territory" || focus.kind === "angle" || focus.kind === "idea"
                                  ? focus.territoryId
                                  : null;
                              const ideasOpen =
                                focus.kind === "angle" || focus.kind === "idea" ? focus.angleId : null;
                              const lockedAnglesFor = (territoryId: string, territoryStatement: string) => {
                                if (anglesOpen !== territoryId) return [];
                                const territoryFp = focusedBigThoughtFingerprint
                                  ? territoryFingerprint({
                                      statement: territoryStatement,
                                      bigThoughtFingerprint: focusedBigThoughtFingerprint,
                                    })
                                  : "";
                                return (labAngles.data ?? [])
                                  .filter(
                                    (angle) =>
                                      angle.territoryId === territoryId &&
                                      angle.admission === "GENERATE_VALID" &&
                                      angle.status === "locked",
                                  )
                                  .map((angle) => {
                                    const ideas = visibleIdeas(labIdeas.data ?? [], angle.id);
                                    const angleFp = territoryFp
                                      ? angleFingerprint({ statement: angle.statement, territoryFingerprint: territoryFp })
                                      : "";
                                    const currentSet = ideaSetFingerprint({
                                      angleFingerprint: angleFp,
                                      ideaFingerprints: ideas.map((idea) =>
                                        ideaFingerprint({ statement: idea.statement, angleFingerprint: angleFp }),
                                      ),
                                    });
                                    const downTop =
                                      ideasOpen === angle.id && ideaSet.data ? ideaSet.data.downTop : angle.ideaSet.downTop;
                                    const downTopCurrent = fingerprintsMatch(downTop?.fingerprint, currentSet);
                                    return {
                                      id: angle.id,
                                      code: angle.code,
                                      statement: angle.statement,
                                      childCount: ideas.length,
                                      ideas:
                                        ideasOpen === angle.id
                                          ? ideas.map((idea) => ({
                                              id: idea.id,
                                              code: idea.code,
                                              statement: idea.statement,
                                              recommended:
                                                downTopCurrent &&
                                                idea.canonicalSemantic.causeLock === "LOCKED" &&
                                                downTop?.items.some(
                                                  (item) =>
                                                    item.code.toUpperCase() === idea.code.toUpperCase() && item.verdict === "PASS",
                                                ) === true,
                                            }))
                                          : [],
                                    };
                                  });
                              };
                              const passing = admittedTerritories
                                .filter((row) => row.status === "locked")
                                .map((row) => ({
                                  id: row.id,
                                  code: row.code,
                                  statement: row.statement,
                                  childCount: angleCountFor(row.id),
                                  angles: lockedAnglesFor(row.id, row.statement),
                                }));
                              const next = new Map(withWorkingSet());
                              const children = next.get(selected.id) ?? [];
                              next.set(
                                selected.id,
                                children.map((child) =>
                                  child.id === focusedThought.id ? { ...child, territories: passing } : child,
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
                            onRequestEdit={(id) => {
                              skipAutoSelect.current = false;
                              setSelectedId(id);
                              setFocus(null);
                              setEditingMasterId(id);
                            }}
                            onRequestDelete={(id) => setPendingDelete({ kind: "master", id })}
                            territoryGenerateThoughtId={territoryGenerateThoughtId}
                            territoryGeneratePending={busyAction === "generate-territory"}
                            onGenerateTerritory={(thoughtId) => void onGenerateTerritory(thoughtId)}
                            zoomHost={zoomHost}
                          />
                        </div>
                      </div>
                    </div>
                    <div className={LAB_RIGHT_COL}>
                      <div className={LAB_SECTION}>
                        <div className={LAB_RIGHT_CARD}>
                          {selected && locked ? (
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
                                      ? angleNodeSubject(focusedAngle?.statement ?? "", focusedTerritory?.statement ?? "")
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
                                territoryId={focus.kind === "territory" ? focusedTerritory?.id : undefined}
                                territoryArea={
                                  focus.kind === "territory" && territoryCopy?.area
                                    ? { lead: territoryCopy.areaLead, body: territoryCopy.area }
                                    : null
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
                                      : undefined
                                }
                                unlockDisabled={busy}
                                pendingAction={busyAction}
                                notice={focus.kind === "bigThought" ? notice : null}
                                manualAdd={
                                  focus?.kind === "angle" &&
                                          showGenerateIdea &&
                                          !ideaSetLocked &&
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
                                  focus.kind === "territory"
                                    ? (territoryId) => void onGenerateAngle(territoryId)
                                    : undefined
                                }
                                angleId={focus.kind === "angle" ? focusedAngle?.id : undefined}
                                ideaReady={focus.kind === "angle" && showGenerateIdea && !ideaSetLocked}
                                onGenerateIdea={focus.kind === "angle" ? (id) => void onGenerateIdea(id) : undefined}
                                ideas={
                                  focus.kind === "angle"
                                    ? admittedIdeas.map((row, index) => ({
                                        id: row.id,
                                        code: row.code,
                                        statement: row.statement,
                                        editable: row.status === "candidate",
                                        verdict: ideaVerdicts[index] ?? ideaDownTop[index] ?? null,
                                      }))
                                    : undefined
                                }
                                ideaStage={focus.kind === "angle" && !ideaSetLocked ? ideaStage : null}
                                onIdeaStage={() => void onIdeaStage()}
                                ideaNotes={focus.kind === "angle" ? ideaNotes : undefined}
                                ideaFixOffers={
                                  focus.kind === "angle"
                                    ? ideaFixOffers
                                        .filter((offer) => offer.angleId === focusedAngle?.id)
                                        .map((offer) => ({ failedCode: offer.failedCode, statement: offer.statement }))
                                    : undefined
                                }
                                onPickIdeaFixOffer={
                                  focus.kind === "angle"
                                    ? (code, statement) => void onPickIdeaFixOffer(code, statement)
                                    : undefined
                                }
                                executionReady={focus.kind === "idea" && focusedIdea?.status === "locked"}
                                pillars={focus.kind === "idea" ? EXECUTION_PILLARS.map((pillar) => ({ ...pillar })) : undefined}
                                executions={
                                  focus.kind === "idea"
                                    ? (labExecutions.data ?? []).map((row) => ({
                                        id: row.id,
                                        pillar: row.pillar,
                                        label: executionPillarLabel(row.pillar),
                                        statement: row.statement,
                                        admission: row.admission,
                                      }))
                                    : undefined
                                }
                                onGenerateExecution={
                                  focus.kind === "idea" && focusedIdea?.status === "locked"
                                    ? (pillar) => void onGenerateExecution(pillar)
                                    : undefined
                                }
                                angleReady={
                                  focus.kind === "territory" &&
                                  showGenerateAngle &&
                                  !angleSetLocked &&
                                  angleStage !== "fix" &&
                                  angleStage !== "generate" &&
                                  (admittedAngles.length === 0 || busyAction === "generate-angle")
                                }
                                angles={
                                  focus.kind === "territory"
                                    ? admittedAngles.map((row, index) => ({
                                        id: row.id,
                                        code: row.code,
                                        statement: row.statement,
                                        verdict: angleVerdicts[index] ?? null,
                                        editable: row.status === "candidate",
                                      }))
                                    : undefined
                                }
                                angleStage={focus.kind === "territory" && !angleSetLocked ? angleStage : null}
                                onAngleStage={() => void onAngleStage()}
                                onLockAngles={
                                  focus.kind === "territory" &&
                                  !angleSetLocked &&
                                  admittedAngles.length >= 3 &&
                                  angleVerdicts.every((verdict) => verdict === "AUDIT_PASS")
                                    ? () => void onLockAngles()
                                    : undefined
                                }
                                angleNotes={focus.kind === "territory" ? angleNotes : undefined}
                                angleFixOffers={
                                  focus.kind === "territory"
                                    ? angleFixOffers
                                        .filter((offer) => offer.territoryId === focusedTerritory?.id)
                                        .map((offer) => ({ failedCode: offer.failedCode, statement: offer.statement }))
                                    : undefined
                                }
                                onPickAngleFixOffer={
                                  focus.kind === "territory"
                                    ? (code, statement) => void onPickAngleFixOffer(code, statement)
                                    : undefined
                                }
                                territories={
                                  focus.kind === "bigThought"
                                    ? (focusedThought?.territories ?? []).map((row) => ({
                                        ...row,
                                        editable: row.status === "candidate",
                                        verdict:
                                          territoryVerdicts[
                                            admittedTerritories.findIndex((item) => item.id === row.id)
                                          ] ?? null,
                                      }))
                                    : undefined
                                }
                                territoryStage={focus.kind === "bigThought" && !admittedSetLocked ? territoryStage : null}
                                onTerritoryStage={() => void onTerritoryStage()}
                                onAcceptGap={
                                  focus.kind === "bigThought" &&
                                  territoryMaterialGap &&
                                  !admittedSetLocked &&
                                  territoryStoredCount < ACTIVE_SET_CAP
                                    ? () => void onAcceptGap()
                                    : undefined
                                }
                                onSkipGap={
                                  focus.kind === "bigThought" && territoryMaterialGap && !admittedSetLocked
                                    ? () => void onSkipGap()
                                    : undefined
                                }
                                onRemoveCoveringTerritory={
                                  focus.kind === "bigThought" &&
                                  !admittedSetLocked &&
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
                                questionNotes={focus.kind === "bigThought" ? bigThoughtQuestionNotes : undefined}
                                territoryNotes={focus.kind === "bigThought" ? territoryNotes : undefined}
                                territoryFixOffers={
                                  focus.kind === "bigThought"
                                    ? territoryFixOffers
                                        .filter((offer) => offer.thoughtId === focusedThought?.id)
                                        .map((offer) => ({ failedCode: offer.failedCode, statement: offer.statement }))
                                    : undefined
                                }
                                onPickTerritoryFixOffer={
                                  focus.kind === "bigThought"
                                    ? (code, statement) => void onPickTerritoryFixOffer(code, statement)
                                    : undefined
                                }
                              />
                            ) : null
                          ) : selected ? (
                            <>
                              {(ready || locked) && !showBeliefField ? (
                                <header className="space-y-2 border-b border-border pb-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      {t("thinkingLab.tree.masterThought", "Master Thought")}
                                    </p>
                                  </div>
                                  <h2 className="text-base font-semibold text-foreground">
                                    {masterSubject || selected.statement || selected.originalInput}
                                  </h2>
                                  {masterSubject && masterDescription.trim() !== masterSubject ? (
                                    <p className="text-sm text-foreground">{masterDescription}</p>
                                  ) : null}
                                  {selected.priorBelief ? (
                                    <p className="text-sm text-rose-700 line-through">{selected.priorBelief}</p>
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
                                  onClarify={(answer) => {
                                    const question = selected.canonicalSemantic?.clarificationQuestion;
                                    if (!question) return;
                                    void onUnderstand({ question, answer });
                                  }}
                                  onConfirmOriginal={onConfirmOriginal}
                                  onConfirmProposal={onConfirmProposal}
                                  onConfirmEdit={() => void onConfirmEdit()}
                                />
                              ) : null}
                              {(ready || locked) && !editingBelief && selected.statement && busyAction !== "generate" ? (
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
                                  onSubmit={onManualBigThought}
                                />
                              ) : null}
                              {(ready || locked) && !editingBelief && busyAction !== "manual-big-thought" ? (
                                <StageActionBar
                                  action={stageAction}
                                  busy={busy}
                                  showSpinner={!auditProgress?.current}
                                  onGenerate={() => void onGenerate()}
                                  onAudit={() => void onAudit()}
                                  onFix={() => void onFix()}
                                  onChallenger={() => void onChallenger()}
                                  onLock={() => void onLock()}
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
                                  onGenerateTerritory={(bigThoughtId) => void onGenerateTerritory(bigThoughtId)}
                                  onEditBigThought={onEditBigThought}
                                  onDeleteBigThought={(bigThoughtId) =>
                                    setPendingDelete({ kind: "bigThought", id: bigThoughtId })
                                  }
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
                </ModuleShellContentGate>
          </div>
        </div>
      </div>
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
                : pendingDelete?.kind === "bigThought"
                  ? t("thinkingLab.confirm.deleteBigThoughtTitle", "Delete this Big Thought?")
                  : t("thinkingLab.confirm.deleteTitle", "Delete this Master Thought?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === "territory"
                ? t(
                    "thinkingLab.confirm.deleteTerritoryBody",
                    "This deletes the Territory and the Angles under it. This cannot be undone.",
                  )
                : pendingDelete?.kind === "bigThought"
                  ? t(
                      "thinkingLab.confirm.deleteBigThoughtBody",
                      "This deletes the Big Thought and the Territories and Angles under it. This cannot be undone.",
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
