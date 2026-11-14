import type { SupabaseClient } from "@supabase/supabase-js";
import {
  acceptChosenBelief,
  beliefsMatch,
  checkWrittenBelief,
  confirmedFingerprint,
} from "../../../../src/thinking-lab/master-thought/semantic";
import { runBigThoughtIndividualChecks } from "../../../../src/thinking-lab/big-thought/passChecks";
import { judgeSiblingSet } from "../../../../src/thinking-lab/big-thought/semantic";
import {
  auditSiblingGate,
  emptySetRecord,
  nextAuthoritativeSetRecord,
  parseLabSetRecord,
} from "../../../../src/thinking-lab/big-thought/audit";
import { nextBigThoughtCode, shownBigThoughtFacts } from "../../../../src/thinking-lab/big-thought/generate";
import { bigThoughtFingerprint, fingerprintsMatch, incumbentSetFingerprint } from "../../../../src/thinking-lab/shared/fingerprint";
import { individualAdmission } from "../../../../src/thinking-lab/big-thought/policy";
import { bigThoughtListed } from "../../../../src/thinking-lab/big-thought/checklist";
import { ACTIVE_SET_CAP } from "../../../../src/thinking-lab/shared/limits";
import type { AuditItem, BigThoughtFacts } from "../../../../src/thinking-lab/big-thought/types";
import { parseCheckSettings, skippedChecks, type CheckSettings } from "../../../../src/thinking-lab/shared/checkSettings";
import type { MasterCatalogContext } from "../../../../src/thinking-lab/master-thought/types";
import type { CatalogPick } from "../tools/thinking/treeWrite";
import { askJudge, type JudgeConfig } from "./thinkingLab";

export type Session = { userId: string; organizationId: string };
type Ask = (prompt: string) => Promise<string | null>;
export { skippedChecks };

/** checks overrides the organization's pass-check switches (tests). */
export type Deps = { ask?: Ask; fetchImpl?: typeof fetch; checks?: CheckSettings };

/** The organization's pass-check switches. A missing switch is OFF. */
export async function loadCheckSettings(admin: SupabaseClient, ctx: Session, deps: Deps): Promise<CheckSettings> {
  if (deps.checks) return deps.checks;
  const { data, error } = await admin.rpc("mcp_thinking_check_settings", sessionArgs(ctx));
  if (error) rpcError(error);
  return parseCheckSettings(data);
}

/** Rewrite an existing row instead of adding one: its code is kept and it is left out of its own siblings. */
export type Replace = { id: string; code: string };

/** What an add or a rewrite stores; a rewrite hands it to the update module instead of the add RPC. */
export type LevelWrite = {
  code: string;
  statement: string;
  facts: unknown;
  /** The parent's set record with this item's AUDIT_PASS. */
  setRecord: unknown;
  /** The new fingerprint of this item under its current parent. */
  fingerprint: string;
  label?: string;
  validation?: unknown;
};

export type ThinkingWriteResult =
  | { saved: true; id: string; code?: string; catalog?: string | null }
  | { saved: false; failed: Array<{ check: string; reason: string }>; catalogs?: string[]; options?: string[] };

type CatalogMatch = { ok: true; id: string; name: string } | { ok: false; result: ThinkingWriteResult };

/** One active catalog by id or name. None or several matches return the choices instead. */
async function resolveCatalog(admin: SupabaseClient, ctx: Session, query: string): Promise<CatalogMatch> {
  const { data, error } = await admin.rpc("mcp_thinking_catalogs", { ...sessionArgs(ctx), p_query: query });
  if (error) rpcError(error);
  const rows = (Array.isArray(data) ? data : []) as Array<{ id: string; name: string }>;
  if (rows.length === 1) return { ok: true, id: rows[0].id, name: rows[0].name };
  const all = rows.length > 1 ? rows : await (async () => {
    const listed = await admin.rpc("mcp_thinking_catalogs", { ...sessionArgs(ctx), p_query: null });
    if (listed.error) rpcError(listed.error);
    return (Array.isArray(listed.data) ? listed.data : []) as Array<{ id: string; name: string }>;
  })();
  return {
    ok: false,
    result: {
      saved: false,
      failed: [{
        check: "catalog",
        reason: rows.length > 1 ? `"${query}" matches several catalogs. Name one.` : `No active catalog matches "${query}".`,
      }],
      catalogs: all.map((row) => row.name),
    },
  };
}

type CatalogOption = { kind: "sub_category" | "feature"; id: string; name: string };

type CatalogPickMatch =
  | { ok: true; serviceId: string; subServiceIds: string[]; featureIds: string[]; context: MasterCatalogContext }
  | { ok: false; result: ThinkingWriteResult };

/** Each wanted name or id must match exactly one option of its kind. */
function pickOptions(
  options: CatalogOption[],
  kind: CatalogOption["kind"],
  wanted: string[],
): { ok: true; picked: CatalogOption[] } | { ok: false; result: ThinkingWriteResult } {
  const pool = options.filter((option) => option.kind === kind);
  const picked: CatalogOption[] = [];
  for (const query of wanted) {
    const key = query.trim().toLowerCase();
    const hits = pool.filter((option) => option.id === key || option.name.trim().toLowerCase() === key);
    if (hits.length !== 1) {
      const label = kind === "sub_category" ? "sub-category" : "feature";
      return {
        ok: false,
        result: {
          saved: false,
          failed: [{
            check: "catalog",
            reason: hits.length > 1 ? `"${query}" matches several ${label} rows. Name one.` : `No ${label} of this catalog matches "${query}".`,
          }],
          options: pool.map((option) => option.name),
        },
      };
    }
    if (!picked.some((option) => option.id === hits[0].id)) picked.push(hits[0]);
  }
  return { ok: true, picked };
}

/** The required category plus the optional sub-categories and features of that category. */
async function resolveCatalogPick(admin: SupabaseClient, ctx: Session, pick: CatalogPick): Promise<CatalogPickMatch> {
  const match = await resolveCatalog(admin, ctx, pick.catalog.trim());
  if (!match.ok) return match;
  let options: CatalogOption[] = [];
  if (pick.subCategories.length || pick.features.length) {
    const { data, error } = await admin.rpc("mcp_thinking_catalog_options", { ...sessionArgs(ctx), p_service_id: match.id });
    if (error) rpcError(error);
    options = (Array.isArray(data) ? data : []) as CatalogOption[];
  }
  const subs = pickOptions(options, "sub_category", pick.subCategories);
  if (!subs.ok) return subs;
  const features = pickOptions(options, "feature", pick.features);
  if (!features.ok) return features;
  return {
    ok: true,
    serviceId: match.id,
    subServiceIds: subs.picked.map((option) => option.id),
    featureIds: features.picked.map((option) => option.id),
    context: {
      category: match.name,
      subCategories: subs.picked.map((option) => option.name),
      features: features.picked.map((option) => option.name),
    },
  };
}

async function linkCatalog(admin: SupabaseClient, ctx: Session, masterThoughtId: string, pick: Extract<CatalogPickMatch, { ok: true }>) {
  const { error } = await admin.rpc("mcp_set_thinking_master_catalog", {
    ...sessionArgs(ctx),
    p_master_thought_id: masterThoughtId,
    p_service_id: pick.serviceId,
    p_sub_service_ids: pick.subServiceIds,
    p_feature_ids: pick.featureIds,
  });
  if (error) rpcError(error);
}

/** Link a Master Thought to its category, with optional sub-categories and features of that category. */
export async function setThinkingMasterCatalog(
  admin: SupabaseClient,
  ctx: Session,
  input: { masterThoughtId: string } & CatalogPick,
): Promise<ThinkingWriteResult> {
  const pick = await resolveCatalogPick(admin, ctx, input);
  if (!pick.ok) return pick.result;
  await linkCatalog(admin, ctx, input.masterThoughtId, pick);
  return { saved: true, id: input.masterThoughtId, catalog: pick.context.category };
}

/** The reason shown for a failed Master Thought check. */
export function masterCheckReason(reason: string): string {
  if (reason === "UNDECIDED") return "The check could not be decided. Try again.";
  if (reason === "CATALOG_REQUIRED") return "Link a catalog category first.";
  return reason;
}

/** All checks of one call share one time budget, like thinking.execution.check. */
export function makeAsk(config: JudgeConfig, ctx: Session, deps: Deps): Ask {
  const started = Date.now();
  return async (prompt) => {
    if (Date.now() - started > 90_000) throw new Error("judge_failed");
    if (deps.ask) return deps.ask(prompt);
    return askJudge(config, ctx, prompt, deps.fetchImpl ?? fetch);
  };
}

export function rpcError(error: { message?: string }): never {
  const message = error.message ?? "";
  if (message.includes("not_found")) throw new Error("not_found");
  if (message.includes("not_a_member") || message.includes("forbidden")) throw new Error("forbidden");
  if (message.includes("invalid_input")) throw new Error("invalid_input");
  if (message.includes("duplicate key")) throw new Error("conflict");
  throw new Error("request_failed");
}

export function sessionArgs(ctx: Session): Record<string, unknown> {
  return { p_user_id: ctx.userId, p_organization_id: ctx.organizationId };
}

/** Same bar as Keep as written on the page. A catalog category is required. */
export async function createThinkingMaster(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  input: { belief: string; priorBelief: string; audience: string } & CatalogPick,
  deps: Deps = {},
): Promise<ThinkingWriteResult> {
  const belief = input.belief.replace(/\s+/g, " ").trim();
  const priorBelief = input.priorBelief.replace(/\s+/g, " ").trim();
  const audience = input.audience.trim();
  if (!belief || !priorBelief) throw new Error("invalid_input");
  const pick = await resolveCatalogPick(admin, ctx, input);
  if (!pick.ok) return pick.result;
  const skip = skippedChecks(await loadCheckSettings(admin, ctx, deps), "master");
  if (!skip.includes("shift") && beliefsMatch(belief, priorBelief)) {
    return { saved: false, failed: [{ check: "shift", reason: "The new belief repeats the old belief." }] };
  }
  const check = await checkWrittenBelief({ belief, priorBelief, audience, catalog: pick.context, skip }, makeAsk(config, ctx, deps));
  if (!check.pass) {
    return { saved: false, failed: check.reasons.map((reason) => ({ check: "masterThought", reason: masterCheckReason(reason) })) };
  }
  const facts = acceptChosenBelief(belief);
  const { data, error } = await admin.rpc("mcp_create_thinking_master", {
    ...sessionArgs(ctx),
    p_statement: belief,
    p_prior_belief: priorBelief,
    p_audience: audience,
    p_facts: facts,
    p_fingerprint: confirmedFingerprint(belief, belief),
  });
  if (error) rpcError(error);
  if (typeof data !== "string") throw new Error("request_failed");
  await linkCatalog(admin, ctx, data, pick);
  return { saved: true, id: data, catalog: pick.context.category };
}

type BigThoughtContext = {
  statement: string;
  root_belief: string;
  subject: string;
  confirmed: boolean;
  locked: boolean;
  last_audit: unknown;
  big_thoughts: Array<{
    id: string;
    code: string;
    label: string;
    statement: string;
    status: string;
    sort_order: number;
    canonical_semantic?: unknown;
    semantic_fingerprint?: string | null;
  }>;
};

async function loadBigThoughtContext(admin: SupabaseClient, ctx: Session, masterThoughtId: string): Promise<BigThoughtContext> {
  const { data, error } = await admin.rpc("mcp_thinking_big_thought_context", {
    ...sessionArgs(ctx),
    p_master_thought_id: masterThoughtId,
  });
  if (error) rpcError(error);
  if (!data || typeof data !== "object") throw new Error("not_found");
  return data as BigThoughtContext;
}

/**
 * Lock the Big Thought set, like Lock on the page: every listed Big Thought must show AUDIT_PASS
 * for its current sentence. Locks those Big Thoughts and the Master Thought, so Territories can start.
 */
export async function lockThinkingBigThoughts(
  admin: SupabaseClient,
  ctx: Session,
  input: { masterThoughtId: string },
): Promise<ThinkingWriteResult> {
  const context = await loadBigThoughtContext(admin, ctx, input.masterThoughtId);
  if (!context.confirmed) {
    return { saved: false, failed: [{ check: "masterThought", reason: "Confirm the Master Thought first." }] };
  }
  if (context.locked) return { saved: true, id: input.masterThoughtId };
  const masterStatement = context.statement.trim();
  const parentFp = confirmedFingerprint(masterStatement, context.root_belief || masterStatement);
  const record = parseLabSetRecord(context.last_audit) ?? emptySetRecord();
  const auditByCode = new Map((record.audit?.items ?? []).map((item) => [item.code.toUpperCase(), item]));
  const rows = context.big_thoughts
    .filter((row) => row.status !== "rejected")
    .map((row) => {
      const fingerprint = bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp });
      const facts = (row.canonical_semantic ?? null) as BigThoughtFacts | null;
      const admission = individualAdmission({
        facts,
        factsCurrent: fingerprintsMatch(row.semantic_fingerprint ?? null, fingerprint),
      });
      const item = auditByCode.get(row.code.toUpperCase());
      const passed =
        row.status === "locked" ||
        (item?.verdict === "AUDIT_PASS" &&
          Boolean(item.statementFingerprint) &&
          fingerprintsMatch(item.statementFingerprint ?? null, fingerprint));
      const audit = passed ? "AUDIT_PASS" : item?.verdict === "AUDIT_FAIL" ? "AUDIT_FAIL" : null;
      const listed = bigThoughtListed({
        admission,
        audit,
        gateFailure: facts?.gateFailure ?? null,
        auditGateFailure: item?.gateFailure ?? null,
      });
      return { row, passed, listed, reason: item?.gateFailure?.reason ?? "" };
    })
    .filter((entry) => entry.listed);
  if (rows.length === 0) {
    return { saved: false, failed: [{ check: "lock", reason: "Add at least one Big Thought that passes first." }] };
  }
  const open = rows.filter((entry) => !entry.passed);
  if (open.length > 0) {
    return {
      saved: false,
      failed: open.map((entry) => ({
        check: entry.row.code,
        reason: entry.reason || "This Big Thought has not passed its checks for the current sentence. Fix or delete it first.",
      })),
    };
  }
  const { error } = await admin.rpc("mcp_lock_thinking_big_thoughts", {
    ...sessionArgs(ctx),
    p_master_thought_id: input.masterThoughtId,
    p_big_thought_ids: rows.filter((entry) => entry.row.status !== "locked").map((entry) => entry.row.id),
  });
  if (error) rpcError(error);
  return { saved: true, id: input.masterThoughtId };
}

/**
 * One Big Thought written in chat. The individual checks (batched) and the sibling check run
 * exactly as on the page; a pass is saved with the same facts, fingerprint, and audit item the
 * page writes after a successful Fix, so the page shows it as checked.
 */
export async function addThinkingBigThought(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  input: { masterThoughtId: string; statement: string; label: string },
  deps: Deps = {},
  replace?: { row: Replace; persist: (write: LevelWrite) => Promise<ThinkingWriteResult> },
): Promise<ThinkingWriteResult> {
  const statement = input.statement.replace(/\s+/g, " ").trim();
  if (!statement) throw new Error("invalid_input");
  const loaded = await loadBigThoughtContext(admin, ctx, input.masterThoughtId);
  const context = replace ? { ...loaded, big_thoughts: loaded.big_thoughts.filter((row) => row.id !== replace.row.id) } : loaded;
  if (!context.confirmed) {
    return { saved: false, failed: [{ check: "masterThought", reason: "Confirm the Master Thought first." }] };
  }
  if (context.locked && !replace) {
    return { saved: false, failed: [{ check: "masterThought", reason: "This Master Thought is locked." }] };
  }
  const active = context.big_thoughts.filter((row) => row.status !== "rejected");
  if (active.length >= ACTIVE_SET_CAP) {
    return { saved: false, failed: [{ check: "cap", reason: `A Master Thought holds at most ${ACTIVE_SET_CAP} Big Thoughts.` }] };
  }
  const record = parseLabSetRecord(context.last_audit) ?? emptySetRecord();
  const passedCodes = new Set(
    (record.audit?.items ?? []).filter((item) => item.verdict === "AUDIT_PASS").map((item) => item.code.toUpperCase()),
  );
  const keepers = active
    .filter((row) => row.status === "locked" || passedCodes.has(row.code.toUpperCase()))
    .map((row) => ({ code: row.code, statement: row.statement, label: row.label }));
  const masterStatement = context.statement.trim();
  const becauseParent = (context.subject || masterStatement).trim();
  const parentFp = confirmedFingerprint(masterStatement, context.root_belief || masterStatement);
  const code = replace?.row.code ?? nextBigThoughtCode(context.big_thoughts.map((row) => row.code));
  const ask = makeAsk(config, ctx, deps);
  const skip = skippedChecks(await loadCheckSettings(admin, ctx, deps), "bigThought");

  const checked = await runBigThoughtIndividualChecks({
    batch: true,
    statement,
    parentStatement: becauseParent,
    others: keepers,
    skip,
    ask,
  });
  if (!checked.passed) {
    const failure = checked.failure;
    return {
      saved: false,
      failed: [{ check: failure?.gate ?? "undecided", reason: failure?.reason || "This check could not be decided." }],
    };
  }

  const siblingRows = [...keepers.map((row) => ({ code: row.code, statement: row.statement })), { code, statement }];
  const siblingFingerprint = incumbentSetFingerprint({
    masterThoughtFingerprint: parentFp,
    bigThoughtFingerprints: siblingRows.map((row) =>
      bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parentFp }),
    ),
  });
  // One row needs no model call; the page stores this set too, so Lock sees a current sibling check.
  // With the sibling check OFF, the stored set stays as it was.
  const siblingOff = skip.includes("sibling") && siblingRows.length >= 2;
  const sibling = siblingOff
    ? record.siblingSet
    : await judgeSiblingSet({ parentStatement: masterStatement, rows: siblingRows, fingerprint: siblingFingerprint }, ask);
  if (!siblingOff && siblingRows.length >= 2) {
    const gate = auditSiblingGate({
      code,
      siblingSet: sibling,
      siblingSetCurrent: true,
      activeCodes: siblingRows.map((row) => row.code),
    });
    if (!gate.passed) return { saved: false, failed: [{ check: "sibling", reason: gate.reason }] };
  }

  const facts: BigThoughtFacts = { ...shownBigThoughtFacts(code, statement), generatePasses: ["resolved", "relation"] };
  const statementFingerprint = bigThoughtFingerprint({ statement, masterThoughtFingerprint: parentFp });
  const items: AuditItem[] = [
    ...(record.audit?.items ?? []).filter((item) => item.code.toUpperCase() !== code.toUpperCase()),
    { code, verdict: "AUDIT_PASS", statementFingerprint, gatesChecked: true, ...(skip.length ? { skipped: skip } : {}) },
  ];
  const nextRecord = nextAuthoritativeSetRecord({
    record,
    parentFingerprint: parentFp,
    siblingSet: sibling,
    audit: { setFingerprint: record.audit?.setFingerprint ?? "", items },
    challenger: record.challenger,
  });
  if (replace) {
    return replace.persist({
      code,
      statement,
      facts,
      setRecord: nextRecord,
      fingerprint: statementFingerprint,
      label: input.label.trim(),
    });
  }
  const sortOrder = context.big_thoughts.reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0) + 1;
  const saved = await admin.rpc("mcp_add_thinking_big_thought", {
    ...sessionArgs(ctx),
    p_master_thought_id: input.masterThoughtId,
    p_code: code,
    p_label: input.label.trim(),
    p_statement: statement,
    p_sort_order: sortOrder,
    p_facts: JSON.parse(JSON.stringify(facts)) as unknown,
    p_fingerprint: statementFingerprint,
    p_last_audit: JSON.parse(JSON.stringify(nextRecord)) as unknown,
  });
  if (saved.error) rpcError(saved.error);
  if (typeof saved.data !== "string") throw new Error("request_failed");
  return { saved: true, id: saved.data, code };
}
