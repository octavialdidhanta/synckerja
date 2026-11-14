import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { askThinkingLab, parseModelJson } from "@/thinking-lab/shared/ai";
import { ACTIVE_SET_CAP } from "@/thinking-lab/shared/limits";
import type { CheckLevel } from "@/thinking-lab/shared/checkSettings";
import { bigThoughtFingerprint } from "@/thinking-lab/shared/fingerprint";
import type { useMasterThought } from "@/thinking-lab/master-thought/useMasterThought";
import type { ProductReasonPool } from "@/thinking-lab/master-thought/productReasonPool";
import {
  GENERATE_LESSON_CODE,
  canReviseBigThought,
  generateLessons,
  mergeBigThoughtLessons,
  readBigThoughtSetRecord,
  withBigThoughtResult,
  withBigThoughtRevision,
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
  readBigThoughtCheckId,
  waitForChecklistReport,
  type GateLesson,
  type PassChecklist,
} from "@/thinking-lab/big-thought/checklist";
import { factsForBigThoughtChecks, runBigThoughtChecks } from "@/thinking-lab/big-thought/passChecks";
import { asBecauseClause } from "@/thinking-lab/big-thought/because";
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
import { evaluateLock } from "@/thinking-lab/big-thought/lock";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import type { BigThoughtFacts } from "@/thinking-lab/big-thought/types";
import type { useBigThoughts } from "@/thinking-lab/big-thought/useBigThoughts";
import type { AuditProgress } from "@/thinking-lab/section/BigThoughtSection";
import type { LabFocus } from "@/thinking-lab/page/labFocus";
import type { LabRunFns } from "@/thinking-lab/page/labRunContext";

export function useBigThoughtFlowState() {
  const [auditProgress, setAuditProgress] = useState<AuditProgress | null>(null);
  const [bigThoughtChecklists, setBigThoughtChecklists] = useState<Record<string, PassChecklist>>({});
  const fixingBigThoughtRef = useRef(new Set<string>());
  const [fixingBigThoughtCodes, setFixingBigThoughtCodes] = useState<string[]>([]);
  const [generateChecklist, setGenerateChecklist] = useState<PassChecklist | null>(null);
  const publishBigThoughtChecklist = async (code: string, statement: string, checklist: PassChecklist, done: number, total: number) => {
    setBigThoughtChecklists((current) => ({ ...current, [code.toUpperCase()]: checklist }));
    setAuditProgress({ done, total, current: { code, statement }, checklist });
    await waitForChecklistReport(checklist);
  };
  return {
    auditProgress,
    setAuditProgress,
    bigThoughtChecklists,
    setBigThoughtChecklists,
    fixingBigThoughtRef,
    fixingBigThoughtCodes,
    setFixingBigThoughtCodes,
    generateChecklist,
    setGenerateChecklist,
    publishBigThoughtChecklist,
  };
}

export type BigThoughtFlowState = ReturnType<typeof useBigThoughtFlowState>;

type ShownRowView = {
  id: string;
  code: string;
  statement: string;
  label: string;
  audit: ReturnType<typeof import("@/thinking-lab/big-thought/record").bigThoughtVerdict> | null;
  status: string;
  admission: string;
};

type LabBigThought = NonNullable<ReturnType<typeof useBigThoughts>["data"]>[number];

export type BigThoughtFlowDeps = LabRunFns & {
  t: ReturnType<typeof useAppTranslation>["t"];
  skipFor: (level: CheckLevel) => string[];
  run: (work: () => Promise<void>, action?: string, target?: string) => Promise<void>;
  runManual: (action: string, work: () => Promise<string | null>, target?: string) => Promise<string | null>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  askScoped: (action: string, target: string, prompt: string, temperature?: 0 | 0.2) => Promise<string | null>;
  masters: ReturnType<typeof useMasterThought>;
  selected: NonNullable<ReturnType<typeof useMasterThought>["data"]>[number] | null;
  thoughts: ReturnType<typeof useBigThoughts>;
  active: LabBigThought[];
  parentFp: string | null;
  ready: boolean;
  masterSubject: string;
  becauseParent: string;
  shownRowViews: ShownRowView[];
  bigThoughtPeers: (exceptCode?: string) => Array<{ code: string; statement: string; label?: string }>;
  bigThoughtStatementFingerprint: (statement: string) => string;
  lockDecision: ReturnType<typeof evaluateLock>;
  setFocus: Dispatch<SetStateAction<LabFocus | null>>;
  labRunRef: LabRunFns["labRunRef"];
  queryClient: QueryClient;
};

export function createBigThoughtActions(ctx: BigThoughtFlowState & BigThoughtFlowDeps) {
  const {
    setAuditProgress,
    bigThoughtChecklists,
    fixingBigThoughtRef,
    setFixingBigThoughtCodes,
    setGenerateChecklist,
    publishBigThoughtChecklist,
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
    reportStepError,
  } = ctx;

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
      const pool: ProductReasonPool | null | undefined = selected.productReasonPool;
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

  const onReviseBigThought = onFixBigThought;
  const onCheckBigThoughtSet = onAudit;
  return {
    onGenerate,
    onManualBigThought,
    onEditBigThought,
    onFixBigThought,
    onReviseBigThought,
    onAudit,
    onCheckBigThoughtSet,
    onLock,
    onUnlock,
  };
}