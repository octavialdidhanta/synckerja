import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmedFingerprint } from "../../../../src/thinking-lab/master-thought/semantic";
import {
  applyCrossStatus,
  crossPeersFromIdeas,
  failureItemsFromIdeas,
  judgeCrossIdeas,
  readIdeaValidation,
  relevantFromPeer,
  runIdeaPassChecks,
  type IdeaValidation,
} from "../../../../src/thinking-lab/idea/validation";
import { IDEA_ACTIVE_CAP, ideaFactsForValidation, nextIdeaCode } from "../../../../src/thinking-lab/idea/generate";
import { IDEA_GENERATE_PASS_IDS } from "../../../../src/thinking-lab/idea/generatePasses";
import { runIdeaIndividualChecks } from "../../../../src/thinking-lab/idea/passChecklist";
import {
  buildIdeaSiblingPrompt,
  ideaFailureLessons,
  parseIdeaSet,
  readIdeaSetRecord,
  type IdeaAuditItem,
} from "../../../../src/thinking-lab/idea/setAudit";
import { ideaReplacementPasses } from "../../../../src/thinking-lab/idea/fix";
import { evaluateIdeaParent } from "../../../../src/thinking-lab/idea/eligibility";
import { sameIdeaConcept } from "../../../../src/thinking-lab/idea/conceptIdentity";
import { ideaFingerprint, ideaSetFingerprint } from "../../../../src/thinking-lab/shared/fingerprint";
import type { IdeaMechanismKey } from "../../../../src/thinking-lab/idea/types";
import type { JudgeConfig } from "./thinkingLab";
import { makeAsk, rpcError, sessionArgs, type Deps, type Session, type ThinkingWriteResult } from "./thinkingWrite";

type IdeaRow = {
  id: string;
  code: string;
  statement: string;
  angle_id: string;
  admission: string;
  status: string;
  sort_order: number;
  validation: unknown;
};

type IdeaContext = {
  master: { statement: string; root_belief: string; audience: string; prior_belief: string; subject: string };
  big_thought: { id: string; statement: string; status: string; semantic_fingerprint: string | null };
  territory: { id: string; statement: string; status: string; semantic_fingerprint: string | null; big_thought_id: string };
  angle: {
    id: string;
    code: string;
    statement: string;
    status: string;
    semantic_fingerprint: string | null;
    territory_id: string;
    idea_set: unknown;
  };
  ideas: IdeaRow[];
};

/**
 * One Idea written in chat, under a locked Angle. Runs K1-K7 (with the comparison against every Idea
 * under this Master Thought, so an Idea that repeats another branch fails K5), then the page's Idea
 * checks (batched) and the sibling check. Only a passing Idea is saved, with its validation and an
 * AUDIT_PASS item in the Angle's idea set.
 */
export async function addThinkingIdea(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  input: { angleId: string; statement: string; subject: string; keys: IdeaMechanismKey[] },
  deps: Deps = {},
): Promise<ThinkingWriteResult> {
  const statement = input.statement.replace(/\s+/g, " ").trim();
  if (!statement) throw new Error("invalid_input");
  const { data, error } = await admin.rpc("mcp_thinking_idea_context", { ...sessionArgs(ctx), p_angle_id: input.angleId });
  if (error) rpcError(error);
  if (!data || typeof data !== "object") throw new Error("not_found");
  const context = data as IdeaContext;

  const masterStatement = context.master.statement.trim();
  const gate = evaluateIdeaParent({
    angle: {
      id: context.angle.id,
      status: context.angle.status,
      statement: context.angle.statement,
      semanticFingerprint: context.angle.semantic_fingerprint,
      territoryId: context.angle.territory_id,
    },
    territory: {
      id: context.territory.id,
      status: context.territory.status,
      statement: context.territory.statement,
      semanticFingerprint: context.territory.semantic_fingerprint,
      bigThoughtId: context.territory.big_thought_id,
    },
    bigThought: {
      id: context.big_thought.id,
      status: context.big_thought.status,
      statement: context.big_thought.statement,
      semanticFingerprint: context.big_thought.semantic_fingerprint,
    },
    masterThoughtFingerprint: confirmedFingerprint(masterStatement, context.master.root_belief || masterStatement),
    expectedAngleId: context.angle.id,
  });
  if (gate.ok === false) {
    const reason =
      gate.reason === "PARENT_UNLOCKED"
        ? "Lock the Angles first (thinking.angle.lock)."
        : "The Angle or a level above it changed after it was locked. Check it again on the page first.";
    return { saved: false, failed: [{ check: "angle", reason }] };
  }
  const angleFp = gate.angleFingerprint;

  const ideas = context.ideas.map((row) => ({
    id: row.id,
    code: row.code,
    statement: row.statement,
    angleId: row.angle_id,
    admission: row.admission,
    status: row.status,
    sortOrder: row.sort_order,
    validation: readIdeaValidation(row.validation),
  }));
  const sameAngle = ideas.filter((row) => row.angleId === context.angle.id);
  const active = sameAngle.filter((row) => row.validation?.decision !== "DITOLAK" && row.admission !== "GENERATE_REJECT");
  if (active.length >= IDEA_ACTIVE_CAP) {
    return { saved: false, failed: [{ check: "cap", reason: `An Angle holds at most ${IDEA_ACTIVE_CAP} Ideas.` }] };
  }
  if (ideas.some((row) => sameIdeaConcept(row.statement, statement))) {
    return { saved: false, failed: [{ check: "duplicate", reason: "This repeats an Idea already saved under this Master Thought." }] };
  }

  const ask = makeAsk(config, ctx, deps);
  const peers = crossPeersFromIdeas(ideas);
  const checked = await runIdeaPassChecks({
    statement,
    angle: context.angle.statement,
    territory: context.territory.statement,
    bigThought: context.big_thought.statement,
    masterThought: masterStatement,
    audience: context.master.audience,
    priorBelief: context.master.prior_belief,
    rootBelief: context.master.root_belief,
    failures: failureItemsFromIdeas(ideas, context.angle.id),
    peers: peers.map((peer) => relevantFromPeer(peer, context.angle.id)),
    historyAvailable: true,
    ask,
  });
  const code = nextIdeaCode(sameAngle.map((row) => row.code));
  let validation: IdeaValidation;
  try {
    const [settled] = await judgeCrossIdeas({
      candidates: [{ code, statement, concept: checked.concept, mechanism: checked.mechanism, value: checked.value, validation: checked }],
      peers,
      historyAvailable: true,
      ask,
    });
    validation = settled?.validation ?? applyCrossStatus(checked, "BELUM_TERVERIFIKASI");
  } catch {
    validation = applyCrossStatus(checked, "BELUM_TERVERIFIKASI");
  }
  if (validation.decision !== "LOLOS") {
    // The checks stop at the first one that does not pass; the ones after it were not asked.
    const first =
      validation.criteria.find((criterion) => criterion.status === "FAIL") ??
      validation.criteria.find((criterion) => criterion.status !== "PASS");
    const reason = (first?.explanation || first?.reason || validation.decisionReason || "Not verified yet.").trim();
    return {
      saved: false,
      failed: [{
        check: first?.id ?? "decision",
        reason: first?.status === "FAIL" ? reason : `Not verified: ${reason}`,
      }],
    };
  }

  const ancestors = [
    { label: "Territory", statement: context.territory.statement.trim() },
    { label: "Big Thought", statement: context.big_thought.statement.trim() },
    { label: "Master Thought", statement: masterStatement },
  ];
  const run = await runIdeaIndividualChecks({
    batch: true,
    statement,
    parentStatement: context.angle.statement,
    ancestors,
    masterSubject: context.master.subject,
    mechanismKeys: input.keys,
    ask,
    onStep: () => undefined,
  });
  if (!run.passed) {
    const failed = run.checks.find((check) => check.state === "fail");
    return {
      saved: false,
      failed: [{ check: failed?.id ?? "undecided", reason: failed?.reason?.trim() || "This check could not be decided." }],
    };
  }

  const record = readIdeaSetRecord(context.angle.idea_set);
  const items = record.audit?.items ?? [];
  const passed = sameAngle.filter((row) => {
    if (row.status === "locked") return false;
    const item = items.find((entry) => entry.code.toUpperCase() === row.code.toUpperCase());
    return item?.verdict === "AUDIT_PASS" && item.statementFingerprint === ideaFingerprint({ statement: row.statement, angleFingerprint: angleFp });
  });
  const sealed = sameAngle.filter((row) => row.status === "locked").map((row) => ({ code: row.code, statement: row.statement }));
  const siblingRows = [...passed.map((row) => ({ code: row.code, statement: row.statement })), { code, statement }];
  let siblingSet = record.siblingSet;
  if (siblingRows.length + sealed.length >= 2) {
    const fingerprint = ideaSetFingerprint({
      angleFingerprint: angleFp,
      ideaFingerprints: [...siblingRows, ...sealed].map((row) => ideaFingerprint({ statement: row.statement, angleFingerprint: angleFp })),
    });
    const judged = parseIdeaSet(
      await ask(buildIdeaSiblingPrompt({ parentStatement: context.angle.statement, rows: siblingRows, sealed })),
      fingerprint,
    );
    if (!judged || !ideaReplacementPasses(judged, code)) {
      const reason =
        ideaFailureLessons({ rows: [{ code, statement }], items: [{ code, verdict: "AUDIT_FAIL" }], siblingSet: judged })[0]?.reason ??
        "This Idea overlaps another.";
      return { saved: false, failed: [{ check: "siblingsDistinct", reason }] };
    }
    siblingSet = judged;
  }

  const facts = {
    ...ideaFactsForValidation(code, statement, "LOLOS", input.keys, input.subject.trim()),
    generatePasses: [...IDEA_GENERATE_PASS_IDS],
  };
  const statementFingerprint = ideaFingerprint({ statement, angleFingerprint: angleFp });
  const nextItems: IdeaAuditItem[] = [
    ...items.filter((item) => item.code.toUpperCase() !== code.toUpperCase()),
    { code, verdict: "AUDIT_PASS", statementFingerprint },
  ];
  const openStatements = [...sameAngle.filter((row) => row.status !== "locked").map((row) => row.statement), statement];
  const nextRecord = {
    ...record,
    siblingSet,
    audit: {
      fingerprint: ideaSetFingerprint({
        angleFingerprint: angleFp,
        ideaFingerprints: openStatements.map((text) => ideaFingerprint({ statement: text, angleFingerprint: angleFp })),
      }),
      items: nextItems,
    },
  };
  const sortOrder = sameAngle.reduce((max, row) => Math.max(max, row.sortOrder ?? 0), 0) + 1;
  const saved = await admin.rpc("mcp_add_thinking_idea", {
    ...sessionArgs(ctx),
    p_angle_id: input.angleId,
    p_code: code,
    p_statement: statement,
    p_sort_order: sortOrder,
    p_parent_fingerprint: angleFp,
    p_facts: JSON.parse(JSON.stringify(facts)) as unknown,
    p_validation: JSON.parse(JSON.stringify(validation)) as unknown,
    p_idea_set: JSON.parse(JSON.stringify(nextRecord)) as unknown,
  });
  if (saved.error) rpcError(saved.error);
  if (typeof saved.data !== "string") throw new Error("request_failed");
  return { saved: true, id: saved.data, code };
}
