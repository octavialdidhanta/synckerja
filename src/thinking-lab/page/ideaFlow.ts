import { useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { askThinkingLab, parseModelJson } from "@/thinking-lab/shared/ai";
import type { AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import type { CheckLevel } from "@/thinking-lab/shared/checkSettings";
import { useMasterThought } from "@/thinking-lab/master-thought/useMasterThought";
import { useAngleSet, useLabAngles } from "@/thinking-lab/angle/useAngles";
import { useLabTerritories } from "@/thinking-lab/territory/useTerritories";
import {
  buildIdeaDiscoveryPrompt,
  ideaDiscoveryMatches,
  parseIdeaDiscoveryQuestions,
  type IdeaDiscoveryQuestion,
} from "@/thinking-lab/idea/discover";
import { sameIdeaConcept } from "@/thinking-lab/idea/conceptIdentity";
import {
  IDEA_ACTIVE_CAP,
  nextIdeaCode,
  parseGeneratedIdeaDrafts,
  proposeIdea,
  runIdeaGenerate,
  type IdeaDraft,
} from "@/thinking-lab/idea/generate";
import { ideaFacts } from "@/thinking-lab/idea/facts";
import { ideaFingerprint } from "@/thinking-lab/shared/fingerprint";
import {
  loadIdeaComparisonHistory,
  loadIdeaParentGate,
  loadIdeaSet,
  saveIdeaSet,
  type LabIdea,
} from "@/thinking-lab/idea/repository";
import { admissionForDecision, uncheckedIdeaValidation, type IdeaValidation } from "@/thinking-lab/idea/check/record";
import {
  failureItemsFromIdeas,
  failureMemoryFromValidation,
  peersFromIdeas,
  type FailureMemoryItem,
} from "@/thinking-lab/idea/check/memory";
import { runIdeaChecks } from "@/thinking-lab/idea/check/run";
import { buildIdeaRevisionPrompt, canReviseIdea, revisionCount } from "@/thinking-lab/idea/revise";
import { emptyIdeaSetRecord, type IdeaDiscovery } from "@/thinking-lab/idea/ideaSet";
import { useIdeaSet, useLabIdeas } from "@/thinking-lab/idea/useIdeas";
import type { LabFocus } from "@/thinking-lab/page/labFocus";

export function ideaLiveReport(
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

export function useIdeaFlowState() {
  const ideaDiscoverToken = useRef(0);
  const [ideaDiscover, setIdeaDiscover] = useState<{
    angleId: string;
    angleFingerprint: string;
    questions: IdeaDiscoveryQuestion[] | null;
    loading: boolean;
    failed: boolean;
  } | null>(null);
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
  return {
    ideaDiscoverToken,
    ideaDiscover,
    setIdeaDiscover,
    ideaGenerateRun,
    setIdeaGenerateRun,
    ideaRevisionTarget,
    setIdeaRevisionTarget,
    ideaPassPrevious,
    publishLiveIdea,
  };
}

export type IdeaFlowState = ReturnType<typeof useIdeaFlowState>;

/** What the Idea actions read from the rest of the page. */
export type IdeaFlowDeps = {
  focus: LabFocus | null;
  setFocus: Dispatch<SetStateAction<LabFocus | null>>;
  masters: ReturnType<typeof useMasterThought>;
  parentFp: string | null;
  labAngles: ReturnType<typeof useLabAngles>;
  labTerritories: ReturnType<typeof useLabTerritories>;
  labIdeas: ReturnType<typeof useLabIdeas>;
  ideaSet: ReturnType<typeof useIdeaSet>;
  angleSet: ReturnType<typeof useAngleSet>;
  active: ReadonlyArray<{ id: string; statement: string }>;
  focusedAngle: NonNullable<ReturnType<typeof useLabAngles>["data"]>[number] | null;
  focusedTerritory: NonNullable<ReturnType<typeof useLabTerritories>["data"]>[number] | null;
  focusedThought: { statement: string } | null;
  masterStatement: string;
  masterSubject: string;
  selected: NonNullable<ReturnType<typeof useMasterThought>["data"]>[number] | null;
  ideaAudience: { audience: string; priorBelief: string; rootBelief: string };
  ancestorsWithMaster: (ancestors: AncestorStake[]) => AncestorStake[];
  parentTerritoryFingerprint: string;
  parentAngleFingerprint: string;
  openIdeas: LabIdea[];
  ideaAuditSaved: boolean;
  ideaFingerprintNow: string;
  skippedMark: (level: CheckLevel) => { skipped?: string[] };
  skipFor: (level: CheckLevel) => string[];
  run: (work: () => Promise<void>, action?: string, target?: string) => Promise<void>;
  runManual: (action: string, work: () => Promise<string | null>, target?: string) => Promise<string | null>;
  t: ReturnType<typeof useAppTranslation>["t"];
  queryClient: QueryClient;
  setNotice: Dispatch<SetStateAction<string | null>>;
  labRunRef: MutableRefObject<boolean>;
};

export function createIdeaActions(ctx: IdeaFlowState & IdeaFlowDeps) {
  const {
    ideaDiscoverToken,
    ideaDiscover,
    setIdeaDiscover,
    setIdeaGenerateRun,
    setIdeaRevisionTarget,
    publishLiveIdea,
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
  } = ctx;

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

  const ideaParentFor = (angleId: string) => {
    const angle = (labAngles.data ?? []).find((row) => row.id === angleId) ?? null;
    const territory = (labTerritories.data ?? []).find((row) => row.id === angle?.territoryId) ?? null;
    const thought = (active ?? []).find((row) => row.id === territory?.bigThoughtId) ?? null;
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
      const activeRows = known.filter(
        (row) => (row.validation ?? uncheckedIdeaValidation(row.statement, focusedAngle.statement)).decision !== "DITOLAK",
      );
      if (activeRows.length >= IDEA_ACTIVE_CAP) return t("thinkingLab.manual.cap", "This set is full.");
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

  return {
    ideaDiscover,
    setIdeaDiscover,
    ideaDiscoverToken,
    ideaParentFor,
    onGenerateIdea,
    checkIdeaSentence,
    onManualIdea,
    onEditIdea,
    onReviseIdea,
    writeGeneratedIdeas,
    savePassedIdeaAudit,
    onLockIdeas,
  };
}