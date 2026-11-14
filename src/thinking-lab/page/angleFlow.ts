import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { askThinkingLab } from "@/thinking-lab/shared/ai";
import type { AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import type { CheckLevel } from "@/thinking-lab/shared/checkSettings";
import { angleFingerprint, bigThoughtFingerprint, territoryFingerprint } from "@/thinking-lab/shared/fingerprint";
import type { useMasterThought } from "@/thinking-lab/master-thought/useMasterThought";
import {
  angleChecksFromStored,
  firstAngleFailure,
  runAngleChecks,
  type AnglePassCheck,
  type AnglePeer,
} from "@/thinking-lab/angle/passChecklist";
import { buildAngleRevisionPrompt, parseAngleRevision } from "@/thinking-lab/angle/revise";
import { proposeAngleStatements, runAngleGenerate, shownAngleFacts } from "@/thinking-lab/angle/generate";
import { loadAngleParentGate, loadAngleSet, saveAngleSet } from "@/thinking-lab/angle/repository";
import {
  angleVerdict,
  canReviseAngle,
  emptyAngleSetRecord,
  mergeAngleAuditLessons,
  withAngleResult,
  withAngleRevision,
  type AngleSetRecord,
} from "@/thinking-lab/angle/record";
import type { useLabAngles } from "@/thinking-lab/angle/useAngles";
import type { useAngleSet } from "@/thinking-lab/angle/useAngles";
import type { useLabTerritories } from "@/thinking-lab/territory/useTerritories";
import type { useTerritorySet } from "@/thinking-lab/territory/useTerritories";
import type { LabFocus } from "@/thinking-lab/page/labFocus";
import type { LabRunFns } from "@/thinking-lab/page/labRunContext";

export function useAngleFlowState() {
  const fixingAngleCodesRef = useRef(new Set<string>());
  const [fixingAngleCodes, setFixingAngleCodes] = useState<ReadonlySet<string>>(() => new Set());
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
  return {
    fixingAngleCodesRef,
    fixingAngleCodes,
    setFixingAngleCodes,
    angleChecklists,
    setAngleChecklists,
    angleGenerateRun,
    setAngleGenerateRun,
    publishAngleChecklist,
  };
}

export type AngleFlowState = ReturnType<typeof useAngleFlowState>;

type LabAngle = NonNullable<ReturnType<typeof useLabAngles>["data"]>[number];
type LabTerritory = NonNullable<ReturnType<typeof useLabTerritories>["data"]>[number];
type LabBigThought = { id: string; statement: string };

export type AngleFlowDeps = LabRunFns & {
  t: ReturnType<typeof useAppTranslation>["t"];
  skipFor: (level: CheckLevel) => string[];
  run: (work: () => Promise<void>, action?: string, target?: string) => Promise<void>;
  runManual: (action: string, work: () => Promise<string | null>, target?: string) => Promise<string | null>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  masters: ReturnType<typeof useMasterThought>;
  parentFp: string | null;
  focus: LabFocus | null;
  setFocus: Dispatch<SetStateAction<LabFocus | null>>;
  focusedTerritory: LabTerritory | null;
  focusedThought: LabBigThought | null;
  labTerritories: ReturnType<typeof useLabTerritories>;
  labAngles: ReturnType<typeof useLabAngles>;
  angleSet: ReturnType<typeof useAngleSet>;
  territorySet: ReturnType<typeof useTerritorySet>;
  admittedAngles: LabAngle[];
  angleVerdicts: ReturnType<typeof angleVerdict>[];
  anglePeers: (exceptCode?: string) => AnglePeer[];
  angleAncestors: AncestorStake[];
  angleStage: ReturnType<typeof import("@/thinking-lab/angle/lock").selectAngleStage>;
  angleLock: ReturnType<typeof import("@/thinking-lab/angle/lock").evaluateAngleLock>;
  parentTerritoryFingerprint: string;
  angleStatementFingerprint: (statement: string) => string;
  queryClient: QueryClient;
};

export function createAngleActions(ctx: AngleFlowState & AngleFlowDeps) {
  const {
    fixingAngleCodesRef,
    setFixingAngleCodes,
    publishAngleChecklist,
    setAngleGenerateRun,
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
    queryClient,
  } = ctx;

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
          const fp = angleFingerprint({
            statement: row.statement,
            territoryFingerprint: territoryFingerprint({
              statement: territory.statement,
              bigThoughtFingerprint: bigThoughtFingerprint({ statement: focusedThought.statement, masterThoughtFingerprint: parentFp }),
            }),
          });
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

  const onReviseAngle = onFixAngle;
  return { onFixAngle, onReviseAngle, onAngleStage, onLockAngles, onGenerateAngle, onEditAngle };
}