import { useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { askThinkingLab } from "@/thinking-lab/shared/ai";
import type { AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import type { CheckLevel } from "@/thinking-lab/shared/checkSettings";
import { ANSWERED_QUESTION_VERSION, resolveAnsweredQuestion } from "@/thinking-lab/big-thought/answeredQuestion";
import { bigThoughtFingerprint, territoryFingerprint } from "@/thinking-lab/shared/fingerprint";
import type { useMasterThought } from "@/thinking-lab/master-thought/useMasterThought";
import type { useBigThoughts } from "@/thinking-lab/big-thought/useBigThoughts";
import {
  firstTerritoryFailure,
  runTerritoryChecks,
  territoryChecksFromStored,
  type TerritoryPassCheck,
  type TerritoryPeer,
} from "@/thinking-lab/territory/passChecklist";
import { buildTerritoryRevisionPrompt, parseTerritoryRevision } from "@/thinking-lab/territory/revise";
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
  type TerritorySetRecord,
} from "@/thinking-lab/territory/record";
import type { TerritorySemanticFacts } from "@/thinking-lab/territory/types";
import type { useLabTerritories } from "@/thinking-lab/territory/useTerritories";
import type { useTerritorySet } from "@/thinking-lab/territory/useTerritories";
import type { LabFocus } from "@/thinking-lab/page/labFocus";
import type { LabRunFns } from "@/thinking-lab/page/labRunContext";

export function useTerritoryFlowState() {
  const generatingTerritoryIdsRef = useRef(new Set<string>());
  const [generatingTerritoryIds, setGeneratingTerritoryIds] = useState<ReadonlySet<string>>(() => new Set());
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
  return {
    generatingTerritoryIdsRef,
    generatingTerritoryIds,
    setGeneratingTerritoryIds,
    fixingTerritoryCodesRef,
    fixingTerritoryCodes,
    setFixingTerritoryCodes,
    territoryChecklists,
    setTerritoryChecklists,
    territoryGenerateRun,
    setTerritoryGenerateRun,
    publishTerritoryChecklist,
  };
}

export type TerritoryFlowState = ReturnType<typeof useTerritoryFlowState>;

type LabTerritory = NonNullable<ReturnType<typeof useLabTerritories>["data"]>[number];
type LabBigThought = NonNullable<ReturnType<typeof useBigThoughts>["data"]>[number];

export type TerritoryFlowDeps = LabRunFns & {
  t: ReturnType<typeof useAppTranslation>["t"];
  skipFor: (level: CheckLevel) => string[];
  run: (work: () => Promise<void>, action?: string, target?: string) => Promise<void>;
  runManual: (action: string, work: () => Promise<string | null>, target?: string) => Promise<string | null>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  askScoped: (action: string, target: string, prompt: string, temperature?: 0 | 0.2) => Promise<string | null>;
  masters: ReturnType<typeof useMasterThought>;
  selected: NonNullable<ReturnType<typeof useMasterThought>["data"]>[number] | null;
  parentFp: string | null;
  focusedThought: LabBigThought | null;
  labTerritories: ReturnType<typeof useLabTerritories>;
  thoughts: ReturnType<typeof useBigThoughts>;
  territorySet: ReturnType<typeof useTerritorySet>;
  admittedTerritories: LabTerritory[];
  territoryVerdicts: ReturnType<typeof territoryVerdict>[];
  territoryPeers: (exceptCode?: string) => TerritoryPeer[];
  territoryAncestors: AncestorStake[];
  territoryStage: ReturnType<typeof selectTerritoryStage>;
  territoryLock: ReturnType<typeof evaluateTerritoryLock>;
  focusedBigThoughtFingerprint: string;
  territoryStatementFingerprint: (statement: string) => string;
  answeredQuestion: string;
  descriptionFlight: MutableRefObject<Set<string>>;
  queryClient: QueryClient;
};

export function createTerritoryActions(ctx: TerritoryFlowState & TerritoryFlowDeps) {
  const {
    generatingTerritoryIdsRef,
    setGeneratingTerritoryIds,
    fixingTerritoryCodesRef,
    setFixingTerritoryCodes,
    publishTerritoryChecklist,
    setTerritoryGenerateRun,
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
    queryClient,
    reportStepError,
  } = ctx;

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
          ctx.territoryChecklists[row.code.toUpperCase()]?.checks ??
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

  const onReviseTerritory = onFixTerritory;
  return { onFixTerritory, onReviseTerritory, onTerritoryStage, onLockTerritories, onGenerateTerritory, onEditTerritory };
}