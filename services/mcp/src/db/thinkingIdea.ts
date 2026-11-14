import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmedFingerprint } from "../../../../src/thinking-lab/master-thought/semantic";
import { readIdeaValidation } from "../../../../src/thinking-lab/idea/check/record";
import { failureItemsFromIdeas, peersFromIdeas } from "../../../../src/thinking-lab/idea/check/memory";
import { runIdeaChecks } from "../../../../src/thinking-lab/idea/check/run";
import { IDEA_ACTIVE_CAP, nextIdeaCode } from "../../../../src/thinking-lab/idea/generate";
import { ideaFacts, type IdeaMechanismKey } from "../../../../src/thinking-lab/idea/facts";
import { readIdeaSetRecord, type IdeaAuditItem } from "../../../../src/thinking-lab/idea/ideaSet";
import { evaluateIdeaParent } from "../../../../src/thinking-lab/idea/eligibility";
import { sameIdeaConcept } from "../../../../src/thinking-lab/idea/conceptIdentity";
import { ideaFingerprint, ideaSetFingerprint } from "../../../../src/thinking-lab/shared/fingerprint";
import type { JudgeConfig } from "./thinkingLab";
import {
  loadCheckSettings,
  makeAsk,
  rpcError,
  sessionArgs,
  skippedChecks,
  type Deps,
  type LevelWrite,
  type Replace,
  type Session,
  type ThinkingWriteResult,
} from "./thinkingWrite";

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
 * One Idea written in chat, under a locked Angle. Runs the switched-on Idea checks, compared with every
 * Idea under this Master Thought, so an Idea that repeats another branch fails the distinct check.
 * Only a passing Idea is saved, with its validation and an AUDIT_PASS item in the Angle's idea set.
 */
export async function addThinkingIdea(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  input: { angleId: string; statement: string; subject: string; keys: IdeaMechanismKey[] },
  deps: Deps = {},
  replace?: { row: Replace; persist: (write: LevelWrite) => Promise<ThinkingWriteResult> },
): Promise<ThinkingWriteResult> {
  const statement = input.statement.replace(/\s+/g, " ").trim();
  if (!statement) throw new Error("invalid_input");
  const loaded = await loadIdeaContext(admin, ctx, input.angleId);
  const context = replace ? { ...loaded, ideas: loaded.ideas.filter((row) => row.id !== replace.row.id) } : loaded;
  const gate = ideaParentGate(context);
  if (gate.ok === false) {
    const reason =
      gate.reason === "PARENT_UNLOCKED"
        ? "Lock the Angles first (thinking.angle.lock)."
        : "The Angle or a level above it changed after it was locked. Check it again on the page first.";
    return { saved: false, failed: [{ check: "angle", reason }] };
  }
  const angleFp = gate.angleFingerprint;
  return addIdeaUnder(admin, config, ctx, context, angleFp, statement, input, deps, replace);
}

async function loadIdeaContext(admin: SupabaseClient, ctx: Session, angleId: string): Promise<IdeaContext> {
  const { data, error } = await admin.rpc("mcp_thinking_idea_context", { ...sessionArgs(ctx), p_angle_id: angleId });
  if (error) rpcError(error);
  if (!data || typeof data !== "object") throw new Error("not_found");
  return data as IdeaContext;
}

function ideaParentGate(context: IdeaContext) {
  const masterStatement = context.master.statement.trim();
  return evaluateIdeaParent({
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
}

async function addIdeaUnder(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  context: IdeaContext,
  angleFp: string,
  statement: string,
  input: { angleId: string; statement: string; subject: string; keys: IdeaMechanismKey[] },
  deps: Deps,
  replace?: { row: Replace; persist: (write: LevelWrite) => Promise<ThinkingWriteResult> },
): Promise<ThinkingWriteResult> {
  const masterStatement = context.master.statement.trim();

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

  const skip = skippedChecks(await loadCheckSettings(admin, ctx, deps), "idea");
  const validation = await runIdeaChecks({
    statement,
    mechanismKeys: input.keys,
    angle: context.angle.statement,
    territory: context.territory.statement,
    bigThought: context.big_thought.statement,
    masterThought: masterStatement,
    masterSubject: context.master.subject,
    audience: context.master.audience,
    priorBelief: context.master.prior_belief,
    rootBelief: context.master.root_belief,
    failures: failureItemsFromIdeas(ideas, context.angle.id),
    peers: peersFromIdeas(ideas),
    historyAvailable: true,
    skip,
    ask: makeAsk(config, ctx, deps),
  });
  if (validation.decision !== "LOLOS") {
    // The checks stop at the first one that does not pass; the ones after it were not asked.
    const first = validation.criteria.find((criterion) => criterion.status !== "PASS");
    const reason = first?.reason || validation.decisionReason || "Not verified yet.";
    return {
      saved: false,
      failed: [{ check: first?.id ?? "decision", reason: first?.status === "FAIL" ? reason : `Not verified: ${reason}` }],
    };
  }

  const code = replace?.row.code ?? nextIdeaCode(sameAngle.map((row) => row.code));
  const record = readIdeaSetRecord(context.angle.idea_set);
  const items = record.audit?.items ?? [];
  const facts = ideaFacts({ code, statement, subject: input.subject, mechanismKeys: input.keys });
  const statementFingerprint = ideaFingerprint({ statement, angleFingerprint: angleFp });
  const nextItems: IdeaAuditItem[] = [
    ...items.filter((item) => item.code.toUpperCase() !== code.toUpperCase()),
    { code, verdict: "AUDIT_PASS", statementFingerprint, ...(skip.length ? { skipped: skip } : {}) },
  ];
  const openStatements = [...sameAngle.filter((row) => row.status !== "locked").map((row) => row.statement), statement];
  const nextRecord = {
    ...record,
    audit: {
      fingerprint: ideaSetFingerprint({
        angleFingerprint: angleFp,
        ideaFingerprints: openStatements.map((text) => ideaFingerprint({ statement: text, angleFingerprint: angleFp })),
      }),
      items: nextItems,
    },
  };
  if (replace) {
    return replace.persist({ code, statement, facts, setRecord: nextRecord, fingerprint: statementFingerprint, validation });
  }
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

/** The stored decision, read the same way the database reads it (validation->>'decision'). */
function storedDecision(validation: unknown): string {
  if (!validation || typeof validation !== "object") return "";
  const decision = (validation as { decision?: unknown }).decision;
  return typeof decision === "string" ? decision : "";
}

/**
 * Lock the passing Ideas of one locked Angle, like Lock on the page: at least one, each
 * AUDIT_PASS for its current sentence and decided LOLOS. Pillars need a locked Idea.
 */
export async function lockThinkingIdeas(
  admin: SupabaseClient,
  ctx: Session,
  input: { angleId: string },
): Promise<ThinkingWriteResult> {
  const context = await loadIdeaContext(admin, ctx, input.angleId);
  const gate = ideaParentGate(context);
  if (gate.ok === false) {
    return { saved: false, failed: [{ check: "angle", reason: "The Angle is not locked or changed after it was locked." }] };
  }
  const angleFp = gate.angleFingerprint;
  const record = readIdeaSetRecord(context.angle.idea_set);
  const items = record.audit?.items ?? [];
  const open = context.ideas
    .filter((row) => row.angle_id === context.angle.id && row.status !== "locked" && row.admission !== "GENERATE_REJECT")
    .filter((row) => storedDecision(row.validation) !== "DITOLAK");
  if (open.length === 0) {
    const anyLocked = context.ideas.some((row) => row.angle_id === context.angle.id && row.status === "locked");
    if (anyLocked) return { saved: true, id: input.angleId };
    return { saved: false, failed: [{ check: "lock", reason: "Add at least one Idea that passes first." }] };
  }
  const notReady = open.filter((row) => {
    const item = items.find((entry) => entry.code.toUpperCase() === row.code.toUpperCase());
    const current = item?.statementFingerprint === ideaFingerprint({ statement: row.statement, angleFingerprint: angleFp });
    return !(item?.verdict === "AUDIT_PASS" && current && storedDecision(row.validation) === "LOLOS");
  });
  if (notReady.length > 0) {
    return {
      saved: false,
      failed: notReady.map((row) => ({ check: row.code, reason: "This Idea has not passed its checks for its current sentence. Fix or delete it first." })),
    };
  }
  const { error } = await admin.rpc("mcp_lock_thinking_ideas", {
    ...sessionArgs(ctx),
    p_angle_id: input.angleId,
    p_rows: open.map((row) => ({ id: row.id, fingerprint: ideaFingerprint({ statement: row.statement, angleFingerprint: angleFp }) })),
  });
  if (error) rpcError(error);
  return { saved: true, id: input.angleId };
}
