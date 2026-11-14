import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmedFingerprint } from "../../../../src/thinking-lab/master-thought/semantic";
import { nextAngleCode, shownAngleFacts } from "../../../../src/thinking-lab/angle/generate";
import { firstAngleFailure, runAngleChecks } from "../../../../src/thinking-lab/angle/passChecklist";
import { readAngleSetRecord, withAngleResult, type AngleAuditItem } from "../../../../src/thinking-lab/angle/record";
import { evaluateAngleParent } from "../../../../src/thinking-lab/angle/eligibility";
import { angleFingerprint, angleSetFingerprint } from "../../../../src/thinking-lab/shared/fingerprint";
import { ACTIVE_SET_CAP } from "../../../../src/thinking-lab/shared/limits";
import type { AngleSemanticFacts } from "../../../../src/thinking-lab/angle/types";
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

type AngleRow = {
  id: string;
  code: string;
  statement: string;
  status: string;
  admission: string;
  sort_order: number;
  subject: string;
};

type AngleContext = {
  master: { statement: string; root_belief: string };
  big_thought: { id: string; statement: string; status: string; semantic_fingerprint: string | null };
  territory: {
    id: string;
    code: string;
    statement: string;
    status: string;
    semantic_fingerprint: string | null;
    big_thought_id: string;
    angle_set: unknown;
  };
  angles: AngleRow[];
  master_codes: string[];
};

async function loadContext(admin: SupabaseClient, ctx: Session, territoryId: string): Promise<AngleContext> {
  const { data, error } = await admin.rpc("mcp_thinking_angle_context", { ...sessionArgs(ctx), p_territory_id: territoryId });
  if (error) rpcError(error);
  if (!data || typeof data !== "object") throw new Error("not_found");
  return data as AngleContext;
}

function parentGate(context: AngleContext) {
  const masterStatement = context.master.statement.trim();
  return evaluateAngleParent({
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
    expectedTerritoryId: context.territory.id,
  });
}

function sameText(left: string, right: string): boolean {
  return left.trim().toLowerCase().replace(/\s+/g, " ") === right.trim().toLowerCase().replace(/\s+/g, " ");
}

function passedRows(context: AngleContext, territoryFp: string, items: AngleAuditItem[]): AngleRow[] {
  return context.angles
    .filter((row) => row.admission === "GENERATE_VALID")
    .filter((row) => {
      if (row.status === "locked") return true;
      const item = items.find((entry) => entry.code.toUpperCase() === row.code.toUpperCase());
      return (
        item?.verdict === "AUDIT_PASS" &&
        item.statementFingerprint === angleFingerprint({ statement: row.statement, territoryFingerprint: territoryFp })
      );
    });
}

/**
 * One Angle written in chat, under a locked Territory, with its short subject and one lived example.
 * Runs the page's six Angle checks (the last one compares it with the Angles that already passed), then
 * saves it as admitted with an AUDIT_PASS item in the Territory's angle set, like Generate on the page.
 */
export async function addThinkingAngle(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  input: { territoryId: string; statement: string; subject: string; example: string },
  deps: Deps = {},
  replace?: { row: Replace; persist: (write: LevelWrite) => Promise<ThinkingWriteResult> },
): Promise<ThinkingWriteResult> {
  const statement = input.statement.replace(/\s+/g, " ").trim();
  const subject = input.subject.replace(/\s+/g, " ").trim();
  const example = input.example.replace(/\s+/g, " ").trim();
  if (!statement) throw new Error("invalid_input");
  const loaded = await loadContext(admin, ctx, input.territoryId);
  const context = replace ? { ...loaded, angles: loaded.angles.filter((row) => row.id !== replace.row.id) } : loaded;
  const gate = parentGate(context);
  if (gate.ok === false) {
    const reason =
      gate.reason === "PARENT_UNLOCKED"
        ? "Lock the Territories first (thinking.territory.lock)."
        : "The Territory or its Big Thought changed after it was locked. Check it again on the page first.";
    return { saved: false, failed: [{ check: "territory", reason }] };
  }
  const territoryFp = gate.territoryFingerprint;
  const admitted = context.angles.filter((row) => row.admission === "GENERATE_VALID");
  if (admitted.length >= ACTIVE_SET_CAP) {
    return { saved: false, failed: [{ check: "cap", reason: `A Territory holds at most ${ACTIVE_SET_CAP} Angles.` }] };
  }
  if (admitted.some((row) => sameText(row.statement, statement) || (subject && sameText(row.subject, subject)))) {
    return { saved: false, failed: [{ check: "duplicate", reason: "This Angle or its subject is already in this Territory." }] };
  }

  const ask = makeAsk(config, ctx, deps);
  const skip = skippedChecks(await loadCheckSettings(admin, ctx, deps), "angle");
  const ancestors = [
    { label: "Big Thought", statement: context.big_thought.statement.trim() },
    { label: "Master Thought", statement: context.master.statement.trim() },
  ];
  const record = readAngleSetRecord(context.territory.angle_set);
  const passed = passedRows(context, territoryFp, record.audit?.items ?? []);
  const run = await runAngleChecks({
    statement,
    parentStatement: context.territory.statement,
    ancestors,
    subject,
    example,
    peers: passed.map((row) => ({ code: row.code, statement: row.statement, subject: row.subject })),
    skip,
    ask,
  });
  const failure = firstAngleFailure(run.checks);
  if (failure) return { saved: false, failed: [{ check: failure.gate, reason: failure.reason }] };

  const code = replace?.row.code ?? nextAngleCode(context.master_codes);
  const facts: AngleSemanticFacts = shownAngleFacts(code, statement, subject, example);
  const statementFingerprint = angleFingerprint({ statement, territoryFingerprint: territoryFp });
  const marked = withAngleResult(record, { code, statement, statementFingerprint, failure: null, skipped: skip });
  const nextRecord = {
    ...marked,
    audit: {
      fingerprint: angleSetFingerprint({
        territoryFingerprint: territoryFp,
        angleFingerprints: [...admitted.map((row) => row.statement), statement].map((text) =>
          angleFingerprint({ statement: text, territoryFingerprint: territoryFp }),
        ),
      }),
      items: marked.audit?.items ?? [],
    },
  };
  if (replace) {
    return replace.persist({ code, statement, facts, setRecord: nextRecord, fingerprint: statementFingerprint });
  }
  const sortOrder = context.angles.reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0) + 1;
  const saved = await admin.rpc("mcp_add_thinking_angle", {
    ...sessionArgs(ctx),
    p_territory_id: input.territoryId,
    p_code: code,
    p_statement: statement,
    p_sort_order: sortOrder,
    p_parent_fingerprint: territoryFp,
    p_facts: JSON.parse(JSON.stringify(facts)) as unknown,
    p_angle_set: JSON.parse(JSON.stringify(nextRecord)) as unknown,
  });
  if (saved.error) rpcError(saved.error);
  if (typeof saved.data !== "string") throw new Error("request_failed");
  return { saved: true, id: saved.data, code };
}

/** Lock the Angles of one Territory, like the page: at least one admitted, all AUDIT_PASS. */
export async function lockThinkingAngles(
  admin: SupabaseClient,
  ctx: Session,
  input: { territoryId: string },
): Promise<ThinkingWriteResult> {
  const context = await loadContext(admin, ctx, input.territoryId);
  const gate = parentGate(context);
  if (gate.ok === false) {
    return { saved: false, failed: [{ check: "territory", reason: "The Territory is not locked or changed after it was locked." }] };
  }
  const territoryFp = gate.territoryFingerprint;
  const record = readAngleSetRecord(context.territory.angle_set);
  const admitted = context.angles.filter((row) => row.admission === "GENERATE_VALID");
  if (admitted.length === 0) return { saved: false, failed: [{ check: "lock", reason: "Add at least one Angle that passes first." }] };
  const passed = new Set(passedRows(context, territoryFp, record.audit?.items ?? []).map((row) => row.id));
  const open = admitted.filter((row) => !passed.has(row.id));
  if (open.length > 0) {
    return {
      saved: false,
      failed: open.map((row) => ({ check: row.code, reason: "This Angle has not passed its checks for its current sentence. Fix or delete it first." })),
    };
  }
  const { error } = await admin.rpc("mcp_lock_thinking_angles", {
    ...sessionArgs(ctx),
    p_territory_id: input.territoryId,
    p_rows: admitted.map((row) => ({
      id: row.id,
      fingerprint: angleFingerprint({ statement: row.statement, territoryFingerprint: territoryFp }),
    })),
  });
  if (error) rpcError(error);
  return { saved: true, id: input.territoryId };
}
