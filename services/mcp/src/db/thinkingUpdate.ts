import type { SupabaseClient } from "@supabase/supabase-js";
import { checkWrittenBelief, confirmedBeliefFacts, confirmedFingerprint } from "../../../../src/thinking-lab/master-thought/semantic";
import {
  angleFingerprint,
  bigThoughtFingerprint,
  ideaFingerprint,
  territoryFingerprint,
} from "../../../../src/thinking-lab/shared/fingerprint";
import type { IdeaMechanismKey } from "../../../../src/thinking-lab/idea/facts";
import { loadMasterCatalog, type JudgeConfig } from "./thinkingLab";
import { addThinkingAngle } from "./thinkingAngle";
import { addThinkingIdea } from "./thinkingIdea";
import { addThinkingTerritory } from "./thinkingTerritory";
import {
  addThinkingBigThought,
  loadCheckSettings,
  makeAsk,
  masterCheckReason,
  rpcError,
  sessionArgs,
  skippedChecks,
  type Deps,
  type LevelWrite,
  type Session,
  type ThinkingWriteResult,
} from "./thinkingWrite";

type Row = {
  id: string;
  code: string;
  statement: string;
  status: string;
  semantic_fingerprint: string | null;
  canonical_semantic?: unknown;
};

export type Subtree = {
  master: {
    id: string;
    statement: string;
    root_belief: string | null;
    prior_belief: string | null;
    audience: string | null;
    semantic_fingerprint: string | null;
    last_audit: unknown;
  };
  big_thoughts: Array<Row & { title: string | null; territory_set: unknown }>;
  territories: Array<Row & { big_thought_id: string; angle_set: unknown }>;
  angles: Array<Row & { territory_id: string; parent_territory_fingerprint: string | null; idea_set: unknown }>;
  ideas: Array<Row & { angle_id: string; parent_angle_fingerprint: string | null }>;
};

type Change = Record<string, unknown> & { id?: string };
type Changes = {
  master?: Change;
  big_thoughts: Change[];
  territories: Change[];
  angles: Change[];
  ideas: Change[];
};

async function loadSubtree(admin: SupabaseClient, ctx: Session, masterThoughtId: string): Promise<Subtree> {
  const { data, error } = await admin.rpc("mcp_thinking_subtree", { ...sessionArgs(ctx), p_master_thought_id: masterThoughtId });
  if (error) rpcError(error);
  if (!data || typeof data !== "object") throw new Error("not_found");
  return data as Subtree;
}

/** Every fingerprint of the subtree, computed from the statements given (the stored ones, or the edited ones). */
function fingerprintsOf(tree: Subtree) {
  const master = tree.master.statement.trim();
  const mt = confirmedFingerprint(master, (tree.master.root_belief || master).trim());
  const bt = new Map(tree.big_thoughts.map((row) => [row.id, bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: mt })]));
  const tr = new Map(
    tree.territories.map((row) => [row.id, territoryFingerprint({ statement: row.statement, bigThoughtFingerprint: bt.get(row.big_thought_id) ?? "" })]),
  );
  const an = new Map(
    tree.angles.map((row) => [row.id, angleFingerprint({ statement: row.statement, territoryFingerprint: tr.get(row.territory_id) ?? "" })]),
  );
  const id = new Map(
    tree.ideas.map((row) => [row.id, ideaFingerprint({ statement: row.statement, angleFingerprint: an.get(row.angle_id) ?? "" })]),
  );
  return { mt, bt, tr, an, id };
}

function changeFor(list: Change[], id: string): Change {
  let found = list.find((item) => item.id === id);
  if (!found) {
    found = { id };
    list.push(found);
  }
  return found;
}

/**
 * Rewrites the audit items of one set record (the edited row's own item is written by its update): an item whose fingerprint matched the old sentence chain
 * gets the new one, and is marked parentChanged when an ancestor changed. Unknown fields are kept.
 */
function resealItems(
  record: unknown,
  rows: Array<{ code: string; before: string; after: string }>,
  markParent: boolean,
): { record: unknown; changed: boolean } {
  if (!record || typeof record !== "object") return { record, changed: false };
  const raw = record as { audit?: { items?: unknown } | null };
  const items = raw.audit && Array.isArray(raw.audit.items) ? (raw.audit.items as Array<Record<string, unknown>>) : null;
  if (!items) return { record, changed: false };
  let changed = false;
  const next = items.map((item) => {
    const code = typeof item.code === "string" ? item.code.toUpperCase() : "";
    const row = rows.find((entry) => entry.code.toUpperCase() === code);
    if (!row || row.before === row.after || item.statementFingerprint !== row.before) return item;
    changed = true;
    return { ...item, statementFingerprint: row.after, ...(markParent ? { parentChanged: true } : {}) };
  });
  return changed ? { record: { ...raw, audit: { ...raw.audit, items: next } }, changed } : { record, changed };
}

/**
 * Follows a change down the tree: every row that was current under the old sentences is moved onto the
 * new ones (semantic fingerprint, parent fingerprint, and its audit item), so locked children stay locked.
 * Rows whose fingerprint changed because an ancestor changed are marked parentChanged ("Induk berubah").
 */
export function resealSubtree(before: Subtree, after: Subtree, changes: Changes, editedId: string): void {
  const old = fingerprintsOf(before);
  const now = fingerprintsOf(after);
  const moved = (map: "bt" | "tr" | "an" | "id", id: string) => (old[map].get(id) ?? "") !== (now[map].get(id) ?? "");
  const stored = (fp: string | null, oldFp: string | undefined) => Boolean(fp) && fp === oldFp;

  // Set records hold the children's audit items: Master Thought -> BT items, BT -> Territory items, and so on.
  const masterRecord = resealItems(
    (changes.master?.last_audit as unknown) ?? after.master.last_audit,
    after.big_thoughts.filter((row) => row.id !== editedId).map((row) => ({ code: row.code, before: old.bt.get(row.id) ?? "", after: now.bt.get(row.id) ?? "" })),
    true,
  );
  if (masterRecord.changed) {
    changes.master = { ...(changes.master ?? {}), last_audit: masterRecord.record };
  }
  for (const row of after.big_thoughts) {
    if (row.id !== editedId && moved("bt", row.id) && stored(row.semantic_fingerprint, old.bt.get(row.id))) {
      changeFor(changes.big_thoughts, row.id).semantic_fingerprint = now.bt.get(row.id);
    }
    const kids = after.territories.filter((child) => child.big_thought_id === row.id);
    const current = changes.big_thoughts.find((item) => item.id === row.id)?.territory_set ?? row.territory_set;
    const record = resealItems(
      current,
      kids.filter((child) => child.id !== editedId).map((child) => ({ code: child.code, before: old.tr.get(child.id) ?? "", after: now.tr.get(child.id) ?? "" })),
      true,
    );
    if (record.changed) changeFor(changes.big_thoughts, row.id).territory_set = record.record;
  }
  for (const row of after.territories) {
    if (row.id !== editedId && moved("tr", row.id) && stored(row.semantic_fingerprint, old.tr.get(row.id))) {
      changeFor(changes.territories, row.id).semantic_fingerprint = now.tr.get(row.id);
    }
    const kids = after.angles.filter((child) => child.territory_id === row.id);
    const current = changes.territories.find((item) => item.id === row.id)?.angle_set ?? row.angle_set;
    const record = resealItems(
      current,
      kids.filter((child) => child.id !== editedId).map((child) => ({ code: child.code, before: old.an.get(child.id) ?? "", after: now.an.get(child.id) ?? "" })),
      true,
    );
    if (record.changed) changeFor(changes.territories, row.id).angle_set = record.record;
  }
  for (const row of after.angles) {
    if (row.id !== editedId && moved("an", row.id) && stored(row.semantic_fingerprint, old.an.get(row.id))) {
      changeFor(changes.angles, row.id).semantic_fingerprint = now.an.get(row.id);
    }
    if (row.parent_territory_fingerprint && row.parent_territory_fingerprint === old.tr.get(row.territory_id) && moved("tr", row.territory_id)) {
      changeFor(changes.angles, row.id).parent_territory_fingerprint = now.tr.get(row.territory_id);
    }
    const kids = after.ideas.filter((child) => child.angle_id === row.id);
    const current = changes.angles.find((item) => item.id === row.id)?.idea_set ?? row.idea_set;
    const record = resealItems(
      current,
      kids.filter((child) => child.id !== editedId).map((child) => ({ code: child.code, before: old.id.get(child.id) ?? "", after: now.id.get(child.id) ?? "" })),
      true,
    );
    if (record.changed) changeFor(changes.angles, row.id).idea_set = record.record;
  }
  for (const row of after.ideas) {
    if (row.id !== editedId && moved("id", row.id) && stored(row.semantic_fingerprint, old.id.get(row.id))) {
      changeFor(changes.ideas, row.id).semantic_fingerprint = now.id.get(row.id);
    }
    if (row.parent_angle_fingerprint && row.parent_angle_fingerprint === old.an.get(row.angle_id) && moved("an", row.angle_id)) {
      changeFor(changes.ideas, row.id).parent_angle_fingerprint = now.an.get(row.angle_id);
    }
  }
}

function emptyChanges(): Changes {
  return { big_thoughts: [], territories: [], angles: [], ideas: [] };
}

async function apply(admin: SupabaseClient, ctx: Session, masterThoughtId: string, changes: Changes): Promise<void> {
  const { error } = await admin.rpc("mcp_thinking_apply", {
    ...sessionArgs(ctx),
    p_master_thought_id: masterThoughtId,
    p_changes: JSON.parse(JSON.stringify(changes)) as unknown,
  });
  if (error) rpcError(error);
}

function withStatement<T extends { id: string; statement: string }>(rows: T[], id: string, statement: string): T[] {
  return rows.map((row) => (row.id === id ? { ...row, statement } : row));
}

/** A rewrite of one row: its checks ran and passed; write it, keep its lock, and carry the subtree along. */
function persistRow(
  admin: SupabaseClient,
  ctx: Session,
  tree: Subtree,
  level: "big_thoughts" | "territories" | "angles" | "ideas",
  row: Row,
  parentSet: { level: "master" | "big_thoughts" | "territories" | "angles"; id: string; field: string },
) {
  return async (write: LevelWrite): Promise<ThinkingWriteResult> => {
    const after: Subtree = { ...tree, [level]: withStatement(tree[level] as Row[], row.id, write.statement) } as Subtree;
    const changes = emptyChanges();
    const own: Change = {
      id: row.id,
      statement: write.statement,
      canonical_semantic: write.facts,
      ...(row.status === "locked" || row.semantic_fingerprint ? { semantic_fingerprint: write.fingerprint } : {}),
      ...(write.label ? { title: write.label } : {}),
      ...(write.validation !== undefined ? { validation: write.validation } : {}),
    };
    changes[level].push(own);
    if (parentSet.level === "master") changes.master = { last_audit: write.setRecord };
    else changeFor(changes[parentSet.level], parentSet.id)[parentSet.field] = write.setRecord;
    resealSubtree(tree, after, changes, row.id);
    await apply(admin, ctx, tree.master.id, changes);
    return { saved: true, id: row.id, code: write.code };
  };
}

function findRow<T extends Row>(rows: T[], id: string): T {
  const row = rows.find((item) => item.id === id);
  if (!row) throw new Error("not_found");
  return row;
}

/** Rewrite the Master Thought belief (and optionally the old belief and audience). Locked stays locked. */
export async function updateThinkingMaster(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  input: { masterThoughtId: string; belief?: string; priorBelief?: string; audience?: string },
  deps: Deps = {},
): Promise<ThinkingWriteResult> {
  const tree = await loadSubtree(admin, ctx, input.masterThoughtId);
  const belief = (input.belief ?? tree.master.statement).replace(/\s+/g, " ").trim();
  const priorBelief = (input.priorBelief ?? tree.master.prior_belief ?? "").replace(/\s+/g, " ").trim();
  if (!belief) throw new Error("invalid_input");
  const beliefChanged = belief !== tree.master.statement.trim() || priorBelief !== (tree.master.prior_belief ?? "").trim();
  const changes = emptyChanges();
  changes.master = {
    ...(input.audience !== undefined ? { audience: input.audience.trim() } : {}),
    ...(input.priorBelief !== undefined ? { prior_belief: priorBelief } : {}),
  };
  if (beliefChanged) {
    const skip = skippedChecks(await loadCheckSettings(admin, ctx, deps), "master");
    const catalog = await loadMasterCatalog(admin, ctx, tree.master.id);
    const check = await checkWrittenBelief({ belief, priorBelief, catalog, skip }, makeAsk(config, ctx, deps));
    if (!check.pass) {
      return { saved: false, failed: check.reasons.map((reason) => ({ check: "masterThought", reason: masterCheckReason(reason) })) };
    }
    if (belief !== tree.master.statement.trim()) {
      const after: Subtree = { ...tree, master: { ...tree.master, statement: belief, root_belief: belief } };
      changes.master = {
        ...changes.master,
        statement: belief,
        root_belief: belief,
        canonical_semantic: confirmedBeliefFacts(belief),
        semantic_fingerprint: confirmedFingerprint(belief, belief),
      };
      resealSubtree(tree, after, changes, tree.master.id);
    }
  }
  await apply(admin, ctx, tree.master.id, changes);
  return { saved: true, id: tree.master.id };
}

export async function updateThinkingBigThought(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  input: { masterThoughtId: string; bigThoughtId: string; statement: string; label?: string },
  deps: Deps = {},
): Promise<ThinkingWriteResult> {
  const tree = await loadSubtree(admin, ctx, input.masterThoughtId);
  const row = findRow(tree.big_thoughts, input.bigThoughtId);
  return addThinkingBigThought(
    admin,
    config,
    ctx,
    { masterThoughtId: tree.master.id, statement: input.statement, label: input.label ?? row.title ?? "" },
    deps,
    { row, persist: persistRow(admin, ctx, tree, "big_thoughts", row, { level: "master", id: tree.master.id, field: "last_audit" }) },
  );
}

export async function updateThinkingTerritory(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  input: { masterThoughtId: string; territoryId: string; statement: string },
  deps: Deps = {},
): Promise<ThinkingWriteResult> {
  const tree = await loadSubtree(admin, ctx, input.masterThoughtId);
  const row = findRow(tree.territories, input.territoryId);
  return addThinkingTerritory(
    admin,
    config,
    ctx,
    { bigThoughtId: row.big_thought_id, statement: input.statement },
    deps,
    { row, persist: persistRow(admin, ctx, tree, "territories", row, { level: "big_thoughts", id: row.big_thought_id, field: "territory_set" }) },
  );
}

export async function updateThinkingAngle(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  input: { masterThoughtId: string; angleId: string; statement: string; subject: string; example: string },
  deps: Deps = {},
): Promise<ThinkingWriteResult> {
  const tree = await loadSubtree(admin, ctx, input.masterThoughtId);
  const row = findRow(tree.angles, input.angleId);
  return addThinkingAngle(
    admin,
    config,
    ctx,
    { territoryId: row.territory_id, statement: input.statement, subject: input.subject, example: input.example },
    deps,
    { row, persist: persistRow(admin, ctx, tree, "angles", row, { level: "territories", id: row.territory_id, field: "angle_set" }) },
  );
}

export async function updateThinkingIdea(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  input: { masterThoughtId: string; ideaId: string; statement: string; subject: string; keys: IdeaMechanismKey[] },
  deps: Deps = {},
): Promise<ThinkingWriteResult> {
  const tree = await loadSubtree(admin, ctx, input.masterThoughtId);
  const row = findRow(tree.ideas, input.ideaId);
  return addThinkingIdea(
    admin,
    config,
    ctx,
    { angleId: row.angle_id, statement: input.statement, subject: input.subject, keys: input.keys },
    deps,
    { row, persist: persistRow(admin, ctx, tree, "ideas", row, { level: "angles", id: row.angle_id, field: "idea_set" }) },
  );
}
