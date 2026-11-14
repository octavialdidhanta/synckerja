import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmedFingerprint } from "../../../../src/thinking-lab/master-thought/semantic";
import { ANSWERED_QUESTION_VERSION, resolveAnsweredQuestion } from "../../../../src/thinking-lab/big-thought/answeredQuestion";
import { nextTerritoryCode, shownTerritoryFacts } from "../../../../src/thinking-lab/territory/generate";
import { firstTerritoryFailure, runTerritoryChecks } from "../../../../src/thinking-lab/territory/passChecklist";
import { writeTerritoryAreaSentence } from "../../../../src/thinking-lab/territory/description";
import { readTerritorySetRecord, withTerritoryResult, type TerritoryAuditItem } from "../../../../src/thinking-lab/territory/record";
import { evaluateTerritoryParent } from "../../../../src/thinking-lab/territory/eligibility";
import {
  bigThoughtFingerprint,
  territoryFingerprint,
  territorySetFingerprint,
} from "../../../../src/thinking-lab/shared/fingerprint";
import { ACTIVE_SET_CAP, TARGET_GENERATE_VALID } from "../../../../src/thinking-lab/shared/limits";
import type { TerritorySemanticFacts } from "../../../../src/thinking-lab/territory/types";
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

type TerritoryRow = {
  id: string;
  code: string;
  statement: string;
  status: string;
  admission: string;
  sort_order: number;
};

type TerritoryContext = {
  master: { statement: string; root_belief: string; audience: string; confirmed: boolean };
  big_thought: {
    id: string;
    code: string;
    statement: string;
    status: string;
    semantic_fingerprint: string | null;
    canonical_semantic: { answeredQuestion?: string | null; answeredQuestionVersion?: unknown } | null;
    territory_set: unknown;
  };
  territories: TerritoryRow[];
  master_codes: string[];
};

async function loadContext(admin: SupabaseClient, ctx: Session, bigThoughtId: string): Promise<TerritoryContext> {
  const { data, error } = await admin.rpc("mcp_thinking_territory_context", {
    ...sessionArgs(ctx),
    p_big_thought_id: bigThoughtId,
  });
  if (error) rpcError(error);
  if (!data || typeof data !== "object") throw new Error("not_found");
  return data as TerritoryContext;
}

function fingerprints(context: TerritoryContext): { parentFp: string; bigThoughtFp: string } {
  const masterStatement = context.master.statement.trim();
  const parentFp = confirmedFingerprint(masterStatement, context.master.root_belief || masterStatement);
  return {
    parentFp,
    bigThoughtFp: bigThoughtFingerprint({ statement: context.big_thought.statement, masterThoughtFingerprint: parentFp }),
  };
}

/** Admitted Territories whose stored verdict is AUDIT_PASS for their current name. */
function passedRows(context: TerritoryContext, bigThoughtFp: string, items: TerritoryAuditItem[]): TerritoryRow[] {
  const admitted = context.territories.filter((row) => row.admission === "GENERATE_VALID");
  return admitted.filter((row) => {
    const item = items.find((entry) => entry.code.toUpperCase() === row.code.toUpperCase());
    const fingerprint = territoryFingerprint({ statement: row.statement, bigThoughtFingerprint: bigThoughtFp });
    return row.status === "locked" || (item?.verdict === "AUDIT_PASS" && item.statementFingerprint === fingerprint);
  });
}

/**
 * One Territory written in chat, under a locked Big Thought. Runs the page's five Territory checks (the
 * "beda dari Territory lain" check compares it with the Territories that passed) and writes the area
 * sentence; a pass is saved as admitted with an AUDIT_PASS item, like the page.
 */
export async function addThinkingTerritory(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  input: { bigThoughtId: string; statement: string },
  deps: Deps = {},
  replace?: { row: Replace; persist: (write: LevelWrite) => Promise<ThinkingWriteResult> },
): Promise<ThinkingWriteResult> {
  const statement = input.statement.replace(/\s+/g, " ").trim();
  if (!statement) throw new Error("invalid_input");
  const loaded = await loadContext(admin, ctx, input.bigThoughtId);
  const context = replace ? { ...loaded, territories: loaded.territories.filter((row) => row.id !== replace.row.id) } : loaded;
  const { parentFp, bigThoughtFp } = fingerprints(context);
  const parent = evaluateTerritoryParent(
    {
      status: context.big_thought.status,
      statement: context.big_thought.statement,
      semanticFingerprint: context.big_thought.semantic_fingerprint,
    },
    parentFp,
  );
  if (parent.ok === false) {
    const reason =
      parent.reason === "PARENT_UNLOCKED"
        ? "Lock the Big Thought set first (thinking.bigthought.lock)."
        : "The Big Thought changed after it was checked. Check it again on the page first.";
    return { saved: false, failed: [{ check: "bigThought", reason }] };
  }
  const admitted = context.territories.filter((row) => row.admission === "GENERATE_VALID");
  if (admitted.length >= ACTIVE_SET_CAP) {
    return { saved: false, failed: [{ check: "cap", reason: `A Big Thought holds at most ${ACTIVE_SET_CAP} Territories.` }] };
  }
  if (admitted.some((row) => row.statement.trim().toLowerCase() === statement.toLowerCase())) {
    return { saved: false, failed: [{ check: "duplicate", reason: "This Territory is already in this Big Thought." }] };
  }

  const ask = makeAsk(config, ctx, deps);
  const skip = skippedChecks(await loadCheckSettings(admin, ctx, deps), "territory");
  const audience = context.master.audience.trim();
  const semantic = context.big_thought.canonical_semantic;
  let question =
    semantic?.answeredQuestionVersion === ANSWERED_QUESTION_VERSION ? semantic.answeredQuestion?.trim() ?? "" : "";
  let newQuestion = "";
  if (!question) {
    question = await resolveAnsweredQuestion({
      master: context.master.statement,
      reason: context.big_thought.statement,
      audience,
      ask,
    });
    newQuestion = question;
  }

  const record = readTerritorySetRecord(context.big_thought.territory_set);
  const passed = passedRows(context, bigThoughtFp, record.audit?.items ?? []);
  let gloss: { sentence: string; question: string } | null = null;
  const writeGloss = async () =>
    writeTerritoryAreaSentence({
      territory: statement,
      parentStatement: context.big_thought.statement,
      masterStatement: context.master.statement,
      audience,
      answeredQuestion: question,
      siblings: passed.map((row) => row.statement),
      ask,
    });

  const run = await runTerritoryChecks({
    statement,
    parentStatement: context.big_thought.statement,
    audience,
    question,
    ensureQuestion: async () => {
      gloss = await writeGloss();
      return gloss.question;
    },
    peers: passed.map((row) => ({ code: row.code, statement: row.statement })),
    skip,
    ask,
  });
  const failure = firstTerritoryFailure(run.checks);
  if (failure) return { saved: false, failed: [{ check: failure.gate, reason: failure.reason }] };

  const code = replace?.row.code ?? nextTerritoryCode(context.master_codes);
  const area = gloss ?? (await writeGloss());
  const facts: TerritorySemanticFacts = {
    ...shownTerritoryFacts(code, statement),
    ...(area.sentence && area.question ? { whatItSays: area.sentence, areaQuestion: area.question } : {}),
  };
  const statementFingerprint = territoryFingerprint({ statement, bigThoughtFingerprint: bigThoughtFp });
  const marked = withTerritoryResult(record, { code, statement, statementFingerprint, failure: null, skipped: skip });
  const nextRecord = {
    ...marked,
    audit: {
      fingerprint: territorySetFingerprint({
        bigThoughtFingerprint: bigThoughtFp,
        territoryFingerprints: [...admitted.map((row) => row.statement), statement].map((name) =>
          territoryFingerprint({ statement: name, bigThoughtFingerprint: bigThoughtFp }),
        ),
      }),
      items: marked.audit?.items ?? [],
    },
  };
  if (replace) {
    return replace.persist({ code, statement, facts, setRecord: nextRecord, fingerprint: statementFingerprint });
  }
  const sortOrder = context.territories.reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0) + 1;
  const saved = await admin.rpc("mcp_add_thinking_territory", {
    ...sessionArgs(ctx),
    p_big_thought_id: input.bigThoughtId,
    p_code: code,
    p_statement: statement,
    p_sort_order: sortOrder,
    p_facts: JSON.parse(JSON.stringify(facts)) as unknown,
    p_territory_set: JSON.parse(JSON.stringify(nextRecord)) as unknown,
    p_answered_question: newQuestion,
    p_answered_question_version: ANSWERED_QUESTION_VERSION,
  });
  if (saved.error) rpcError(saved.error);
  if (typeof saved.data !== "string") throw new Error("request_failed");
  return { saved: true, id: saved.data, code };
}

/** Lock the Territory set of one Big Thought, like the page: at least 3 admitted, all AUDIT_PASS. */
export async function lockThinkingTerritories(
  admin: SupabaseClient,
  ctx: Session,
  input: { bigThoughtId: string },
): Promise<ThinkingWriteResult> {
  const context = await loadContext(admin, ctx, input.bigThoughtId);
  const { bigThoughtFp } = fingerprints(context);
  const record = readTerritorySetRecord(context.big_thought.territory_set);
  const admitted = context.territories.filter((row) => row.admission === "GENERATE_VALID");
  if (admitted.length < TARGET_GENERATE_VALID) {
    return {
      saved: false,
      failed: [{ check: "lock", reason: `Add at least ${TARGET_GENERATE_VALID} Territories that pass first (now ${admitted.length}).` }],
    };
  }
  const passed = new Set(passedRows(context, bigThoughtFp, record.audit?.items ?? []).map((row) => row.id));
  const open = admitted.filter((row) => !passed.has(row.id));
  if (open.length > 0) {
    return {
      saved: false,
      failed: open.map((row) => ({
        check: row.code,
        reason: "This Territory has not passed its checks for its current name. Revise or delete it first.",
      })),
    };
  }
  const { error } = await admin.rpc("mcp_lock_thinking_territories", {
    ...sessionArgs(ctx),
    p_big_thought_id: input.bigThoughtId,
    p_rows: admitted.map((row) => ({
      id: row.id,
      fingerprint: territoryFingerprint({ statement: row.statement, bigThoughtFingerprint: bigThoughtFp }),
    })),
  });
  if (error) rpcError(error);
  return { saved: true, id: input.bigThoughtId };
}
