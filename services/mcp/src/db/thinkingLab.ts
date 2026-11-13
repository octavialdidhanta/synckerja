import type { SupabaseClient } from "@supabase/supabase-js";
import { developmentForPillar, readDevelopmentPaths } from "../../../../src/thinking-lab/creative-idea/paths";
import { admitExecution } from "../../../../src/thinking-lab/execution/policy";
import { IMAGE_PASS_CHECK_IDS, runImageOpenChecks } from "../../../../src/thinking-lab/execution/imageChecklist";
import {
  EXECUTION_PASS_CHECK_IDS,
  executionChecklistPassed,
  runExecutionOpenChecks,
} from "../../../../src/thinking-lab/execution/passChecklist";
import {
  buildPlanScript,
  flattenVoiceOver,
  parseVoiceOverScript,
  type VoiceOverScript,
} from "../../../../src/thinking-lab/execution/script";
import type { ExecutionSemanticFacts } from "../../../../src/thinking-lab/execution/types";
import { parseAIScriptOutput } from "../../../../src/6-1-script-generator/utils/parseAIScriptOutput";
import type { ThinkingPlanFields, ThinkingScriptDraft } from "../tools/thinking/scriptInput";

type Session = { userId: string; organizationId: string };

export type ThinkingIdeaRow = {
  id: string;
  statement: string;
  master_statement: string;
  angle_statement: string;
};

export type ThinkingMasterRow = {
  id: string;
  statement: string;
  prior_belief: string;
  audience: string;
  status: string;
  big_thoughts: number;
  ideas: number;
  updated_at: string;
};

/** Master Thought down to Idea, with status, admission, audit verdict, and the first failure reason per item. */
export type ThinkingTree = {
  master: { id: string; statement: string; prior_belief: string; audience: string; subject: string; status: string };
  big_thoughts: unknown[];
};

export type ThinkingChain = {
  idea_id: string;
  idea_statement: string;
  master_statement: string;
  master_subject: string | null;
  big_thought_statement: string;
  territory_statement: string;
  angle_statement: string;
  pillars: Array<{ id: string; name: string }>;
  executions: Array<{ id: string; pillar_name: string; title: string; passed: boolean }>;
};

export type ThinkingCheckResult =
  | { passed: false; check_id: string; reason: string }
  | { passed: true; execution_id: string };

export type ThinkingPlanResult = { id: string; title: string };

export type JudgeConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  scheduledPostsInternalSecret: string;
};

type ChainStored = {
  idea_id: string;
  idea_statement: string;
  master_statement: string;
  master_subject: string | null;
  big_thought_statement: string;
  territory_statement: string;
  angle_statement: string;
  development_paths: unknown;
  pillars: PillarDetail[];
  executions: StoredExecution[];
};

type PillarDetail = { id: string; name: string; category: string; description: string };

type StoredExecution = {
  id: string;
  pillar_name: string;
  title: string;
  admission: string;
  canonical_semantic: unknown;
  line_issue_count: number;
};

type ExecutionStored = {
  id: string;
  idea_id: string;
  content_pillar_id: string | null;
  pillar_name: string | null;
  script: unknown;
  canonical_semantic: unknown;
  admission: string;
};

const PATH_MARKERS = ["portraitPath", "bodyPath", "sheetPath", "locationPath", "propertyPath"];

function asRows<T>(data: unknown): T[] {
  if (data == null) return [];
  return Array.isArray(data) ? (data as T[]) : [data as T];
}

function sessionArgs(ctx: Session): Record<string, unknown> {
  return { p_user_id: ctx.userId, p_organization_id: ctx.organizationId };
}

function throwRpc(error: { message?: string }): never {
  const message = error.message ?? "";
  if (message.includes("not_found")) throw new Error("not_found");
  if (message.includes("not_a_member") || message.includes("forbidden")) throw new Error("forbidden");
  if (message.includes("invalid_date") || message.includes("invalid_input")) throw new Error("invalid_input");
  throw new Error("request_failed");
}

async function callRpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throwRpc(error);
  return asRows<T>(data);
}

async function callRpcOne<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const rows = await callRpc<T>(admin, fn, args);
  const row = rows[0];
  if (!row) throw new Error("not_found");
  return row;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readPillars(value: unknown): PillarDetail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    const id = textOf(row?.id).trim();
    const name = textOf(row?.name).trim();
    if (!id || !name) return [];
    return [{
      id,
      name,
      category: textOf(row?.category).trim(),
      description: textOf(row?.description).trim(),
    }];
  });
}

function passedFromStored(semantic: unknown, admission: string, lineIssueCount: number): boolean {
  const facts = asRecord(semantic);
  if (!facts) return false;
  try {
    return executionChecklistPassed(facts as ExecutionSemanticFacts, admission, lineIssueCount);
  } catch {
    return false;
  }
}

function readExecutions(value: unknown): StoredExecution[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    const id = textOf(row?.id).trim();
    if (!id) return [];
    const count = Number(row?.line_issue_count);
    return [{
      id,
      pillar_name: textOf(row?.pillar_name).trim(),
      title: textOf(row?.title).trim(),
      admission: textOf(row?.admission).trim(),
      canonical_semantic: row?.canonical_semantic ?? null,
      line_issue_count: Number.isInteger(count) && count > 0 ? count : 0,
    }];
  });
}

function toPublicChain(row: ChainStored): ThinkingChain {
  return {
    idea_id: row.idea_id,
    idea_statement: row.idea_statement,
    master_statement: row.master_statement,
    master_subject: row.master_subject,
    big_thought_statement: row.big_thought_statement,
    territory_statement: row.territory_statement,
    angle_statement: row.angle_statement,
    pillars: row.pillars.map((pillar) => ({ id: pillar.id, name: pillar.name })),
    executions: row.executions.map((execution) => ({
      id: execution.id,
      pillar_name: execution.pillar_name,
      title: execution.title,
      passed: passedFromStored(execution.canonical_semantic, execution.admission, execution.line_issue_count),
    })),
  };
}

function readChainRow(raw: Record<string, unknown>): ChainStored {
  return {
    idea_id: textOf(raw.idea_id),
    idea_statement: textOf(raw.idea_statement),
    master_statement: textOf(raw.master_statement),
    master_subject: textOf(raw.master_subject).trim() || null,
    big_thought_statement: textOf(raw.big_thought_statement),
    territory_statement: textOf(raw.territory_statement),
    angle_statement: textOf(raw.angle_statement),
    development_paths: raw.development_paths ?? [],
    pillars: readPillars(raw.pillars),
    executions: readExecutions(raw.executions),
  };
}

async function loadChain(admin: SupabaseClient, ctx: Session, ideaId: string): Promise<ChainStored> {
  const row = await callRpcOne<Record<string, unknown>>(admin, "mcp_get_thinking_chain", {
    ...sessionArgs(ctx),
    p_idea_id: ideaId,
  });
  return readChainRow(row);
}

function draftToScript(draft: ThinkingScriptDraft): VoiceOverScript {
  if (draft.medium === "image" && !draft.image?.format) throw new Error("invalid_input");
  const parsed = parseVoiceOverScript({
    title: draft.title,
    caption: draft.caption ?? "",
    medium: draft.medium,
    speech: draft.speech,
    look: draft.look,
    audio: draft.audio,
    image: draft.medium === "image" && draft.image
      ? {
          format: draft.image.format,
          slideCountMode: draft.image.slide_count ? "manual" : "idea",
          slideCount: draft.image.slide_count ?? null,
          withImage: true,
        }
      : undefined,
    assets: {
      characters: (draft.characters ?? []).map((item) => ({ handle: item.name, description: item.description ?? "" })),
      locations: (draft.locations ?? []).map((item) => ({ handle: item.name, description: item.description ?? "" })),
      properties: (draft.properties ?? []).map((item) => ({ handle: item.name, description: item.description ?? "" })),
    },
    scenes: draft.scenes.map((scene) => ({
      title: scene.title ?? "",
      ...(scene.purpose === "cta" ? { purpose: "cta" } : {}),
      lines: scene.lines.map((line) => ({
        narration: line.narration,
        ...(line.delivery ? { delivery: line.delivery } : {}),
        shots: (line.shots ?? []).map((shot) => ({
          role: shot.role ?? "",
          angle: shot.angle ?? "",
          visualFunction: shot.visual_function ?? "",
          prompt: shot.prompt ?? "",
        })),
      })),
    })),
  });
  if (!parsed) throw new Error("invalid_input");
  return stripVisualPaths(parsed);
}

function stripVisualPaths(script: VoiceOverScript): VoiceOverScript {
  const clean = (asset: { handle: string; description: string }) => ({
    handle: asset.handle,
    description: asset.description,
  });
  return {
    ...script,
    assets: {
      locations: script.assets.locations.map(clean),
      characters: script.assets.characters.map(clean),
      properties: script.assets.properties.map(clean),
    },
  };
}

function containsPathMarker(value: string): boolean {
  return PATH_MARKERS.some((marker) => value.includes(marker));
}

export function planParts(script: VoiceOverScript): { brief: string; caption: string | null; concept: string | null } {
  const parsed = parseAIScriptOutput(buildPlanScript(stripVisualPaths(script)));
  const brief = parsed.brief.trim();
  const concept = parsed.concept.trim();
  if (
    !brief.includes("| Timing | Visual | VO (Voice Over) |")
    || !brief.includes("| Shot |")
    || !brief.includes("Angle")
    || !brief.includes("Visual function")
    || !brief.includes("Veo 3 prompt")
    || !brief.includes("Master prompt")
    || containsPathMarker(brief)
  ) {
    throw new Error("invalid_input");
  }
  if (concept && (!concept.startsWith('{"v":1') || containsPathMarker(concept))) {
    throw new Error("invalid_input");
  }
  const caption = parsed.caption.trim();
  if (caption.length > 2200) throw new Error("invalid_input");
  return { brief, caption: caption || null, concept: concept || null };
}

function ancestorsOf(chain: ChainStored) {
  return [
    chain.territory_statement.trim() ? { label: "Territory", statement: chain.territory_statement.trim() } : null,
    chain.big_thought_statement.trim() ? { label: "Big Thought", statement: chain.big_thought_statement.trim() } : null,
    chain.master_statement.trim() ? { label: "Master Thought", statement: chain.master_statement.trim() } : null,
  ].flatMap((row) => (row ? [row] : []));
}

function failedResult(checks: ReadonlyArray<{ id: string; state: string; enabled?: boolean; reason?: string }>): ThinkingCheckResult {
  const failed = checks.find((check) => check.enabled !== false && check.state === "fail");
  return {
    passed: false,
    check_id: failed?.id ?? "unresolved",
    reason: (failed?.reason ?? "undecided").slice(0, 500),
  };
}

export async function askJudge(
  config: JudgeConfig,
  ctx: Session,
  prompt: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  let response: Response;
  try {
    response = await fetchImpl(`${config.supabaseUrl}/functions/v1/generate-script-ai`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        apikey: config.supabaseServiceRoleKey,
        "Content-Type": "application/json",
        "x-synckerja-internal-secret": config.scheduledPostsInternalSecret,
      },
      body: JSON.stringify({
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        purpose: "thinking_json",
        prompt,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error("judge_failed");
  }
  const text = await response.text();
  const lowered = text.toLowerCase();
  if (lowered.includes("monthly spending cap") || lowered.includes("prepayment credits are depleted")) {
    throw new Error("spend_cap");
  }
  if (response.status === 429) throw new Error("rate_limited");
  if (!response.ok) throw new Error("judge_failed");
  try {
    const body = JSON.parse(text) as { script?: unknown };
    return typeof body.script === "string" && body.script.trim() ? body.script.trim() : null;
  } catch {
    throw new Error("judge_failed");
  }
}

async function createPlan(
  admin: SupabaseClient,
  ctx: Session,
  title: string,
  contentPillarId: string,
  script: VoiceOverScript,
  fields: ThinkingPlanFields,
): Promise<ThinkingPlanResult> {
  const parts = planParts(script);
  return callRpcOne<ThinkingPlanResult>(admin, "mcp_create_thinking_plan", {
    ...sessionArgs(ctx),
    p_title: title,
    p_post_date: fields.postDate,
    p_content_type_id: fields.contentTypeId,
    p_service_id: fields.serviceId,
    p_sub_service_id: fields.subServiceId,
    p_feature_id: fields.featureId,
    p_content_pillar_id: contentPillarId,
    p_brief: parts.brief,
    p_concept: parts.concept,
    p_caption: parts.caption,
  });
}

export function listThinkingMasters(admin: SupabaseClient, ctx: Session): Promise<ThinkingMasterRow[]> {
  return callRpc<ThinkingMasterRow>(admin, "mcp_list_thinking_masters", sessionArgs(ctx));
}

export async function readThinkingTree(
  admin: SupabaseClient,
  ctx: Session,
  masterThoughtId: string,
): Promise<ThinkingTree> {
  const { data, error } = await admin.rpc("mcp_get_thinking_tree", {
    ...sessionArgs(ctx),
    p_master_thought_id: masterThoughtId,
  });
  if (error) throwRpc(error);
  if (!data || typeof data !== "object") throw new Error("not_found");
  return data as ThinkingTree;
}

export function listThinkingIdeas(admin: SupabaseClient, ctx: Session): Promise<ThinkingIdeaRow[]> {
  return callRpc<ThinkingIdeaRow>(admin, "mcp_list_thinking_ideas", sessionArgs(ctx));
}

export async function readThinkingChain(
  admin: SupabaseClient,
  ctx: Session,
  ideaId: string,
): Promise<ThinkingChain> {
  return toPublicChain(await loadChain(admin, ctx, ideaId));
}

export async function checkThinkingExecution(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  input: { ideaId: string; contentPillarId: string; script: ThinkingScriptDraft },
  deps: { ask?: (prompt: string) => Promise<string | null>; fetchImpl?: typeof fetch } = {},
): Promise<ThinkingCheckResult> {
  const chain = await loadChain(admin, ctx, input.ideaId);
  const pillar = chain.pillars.find((item) => item.id === input.contentPillarId);
  if (!pillar) throw new Error("invalid_input");
  const script = draftToScript(input.script);
  const started = Date.now();
  const ask = async (prompt: string) => {
    if (Date.now() - started > 90_000) throw new Error("judge_failed");
    if (deps.ask) return deps.ask(prompt);
    return askJudge(config, ctx, prompt, deps.fetchImpl ?? fetch);
  };
  const shared = {
    pillar: pillar.name,
    pillarCategory: pillar.category || null,
    pillarDescription: pillar.description || null,
    masterStatement: chain.master_statement,
    masterSubject: chain.master_subject ?? "",
    ideaStatement: chain.idea_statement,
    ancestors: ancestorsOf(chain),
    pillarDevelopment: developmentForPillar(
      readDevelopmentPaths(chain.development_paths),
      pillar.id,
    ) || null,
    script,
    masterSells: "unresolved" as const,
    ask,
    onStep: () => undefined,
  };
  const result = script.medium === "image" && script.image
    ? await runImageOpenChecks({
        ...shared,
        image: script.image,
        prior: IMAGE_PASS_CHECK_IDS.map((id) => ({ id, state: "pending" as const, enabled: true })),
      })
    : await runExecutionOpenChecks({
        ...shared,
        prior: EXECUTION_PASS_CHECK_IDS.map((id) => ({ id, state: "pending" as const, enabled: true })),
      });
  const facts = result.facts;
  const passed = result.passed
    && executionChecklistPassed(facts, admitExecution(facts), script.lineIssues.length)
    && admitExecution(facts) === "GENERATE_VALID";
  if (!passed) return failedResult(result.checks);
  const statement = flattenVoiceOver(script);
  if (!statement) throw new Error("invalid_input");
  const saved = await callRpcOne<{ id: string }>(admin, "mcp_save_thinking_execution", {
    ...sessionArgs(ctx),
    p_idea_id: input.ideaId,
    p_content_pillar_id: input.contentPillarId,
    p_statement: statement,
    p_script: JSON.parse(JSON.stringify(script)) as unknown,
    p_facts: JSON.parse(JSON.stringify(facts)) as unknown,
    p_admission: "GENERATE_VALID",
  });
  return { passed: true, execution_id: saved.id };
}

export async function saveThinkingPlan(
  admin: SupabaseClient,
  ctx: Session,
  input: { executionId: string } & ThinkingPlanFields,
): Promise<ThinkingPlanResult> {
  const row = await callRpcOne<ExecutionStored>(admin, "mcp_get_thinking_execution", {
    ...sessionArgs(ctx),
    p_execution_id: input.executionId,
  });
  const storedScript = asRecord(row.script);
  const lineIssues = Array.isArray(storedScript?.lineIssues) ? storedScript.lineIssues.length : 0;
  if (!row.content_pillar_id) throw new Error("invalid_input");
  if (!passedFromStored(row.canonical_semantic, row.admission, lineIssues)) throw new Error("not_passed");
  const script = parseVoiceOverScript(row.script);
  if (!script) throw new Error("invalid_input");
  return createPlan(admin, ctx, script.title.trim() || "Untitled", row.content_pillar_id, script, input);
}

export async function saveThinkingPlanDirect(
  admin: SupabaseClient,
  ctx: Session,
  input: { ideaId: string; contentPillarId: string; script: ThinkingScriptDraft } & ThinkingPlanFields,
): Promise<ThinkingPlanResult> {
  const chain = await loadChain(admin, ctx, input.ideaId);
  if (!chain.pillars.some((pillar) => pillar.id === input.contentPillarId)) throw new Error("invalid_input");
  const script = draftToScript(input.script);
  return createPlan(admin, ctx, script.title.trim() || input.script.title, input.contentPillarId, script, input);
}
