export type UsageService = "voice" | "video" | "image" | "script";
export type UsageStatus = "queued" | "running" | "succeeded" | "failed";
export type UsageUnit = "character" | "token";

export type UsageDraft = {
  organizationId: string;
  planId?: string | null;
  masterThoughtId?: string | null;
  actorUserId?: string | null;
  service: UsageService;
  action: string;
  targetLabel?: string | null;
  model?: string | null;
  usageAmount?: number | null;
  usageUnit?: UsageUnit | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  status: UsageStatus;
  providerRef?: string | null;
  sourceId?: string | null;
  promptExcerpt?: string | null;
};

type UsageWriter = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: { id?: string } | null }>;
        };
        maybeSingle: () => Promise<{ data: { id?: string } | null }>;
      };
    };
    insert: (row: Record<string, unknown>) => {
      select: (columns: string) => {
        maybeSingle: () => Promise<{ data: { id?: string } | null; error: { message?: string } | null }>;
      };
    };
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
        is: (column: string, value: null) => {
          eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
        };
      };
    };
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUsageUuid(value: string): boolean {
  return UUID.test(value);
}

/** Official provider total. Gemini `usageMetadata.totalTokenCount` or OpenAI-style `usage.total_tokens`. */
export function officialTokenCount(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const meta = record.usageMetadata;
  const usage = record.usage;
  const raw = meta && typeof meta === "object"
    ? (meta as Record<string, unknown>).totalTokenCount
    : usage && typeof usage === "object"
      ? (usage as Record<string, unknown>).total_tokens
      : undefined;
  if (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const value = Number(raw.trim());
    return Number.isSafeInteger(value) ? value : null;
  }
  return null;
}

function readTokenCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

export type TokenSplit = {
  total: number | null;
  input: number | null;
  output: number | null;
};

/** Prompt tokens, and answer tokens plus thinking tokens, from one provider payload. */
export function officialTokenSplit(payload: unknown): TokenSplit {
  const total = officialTokenCount(payload);
  if (!payload || typeof payload !== "object") return { total, input: null, output: null };
  const record = payload as Record<string, unknown>;
  const meta = record.usageMetadata;
  if (meta && typeof meta === "object") {
    const usage = meta as Record<string, unknown>;
    const input = readTokenCount(usage.promptTokenCount);
    const candidates = readTokenCount(usage.candidatesTokenCount);
    const thoughts = readTokenCount(usage.thoughtsTokenCount);
    const output = candidates == null && thoughts == null ? null : (candidates ?? 0) + (thoughts ?? 0);
    return { total, input, output };
  }
  const usage = record.usage;
  if (usage && typeof usage === "object") {
    const row = usage as Record<string, unknown>;
    return {
      total,
      input: readTokenCount(row.prompt_tokens),
      output: readTokenCount(row.completion_tokens),
    };
  }
  return { total, input: null, output: null };
}

function storedTokenCount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export type HistoryCharge = {
  id: string;
  at: number;
  text: string;
  amount: number;
  model: string | null;
};

function compactSpoken(text: string): string {
  return text.toLowerCase().replace(/\[[^\]]*\]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

function spokenMatches(clipText: string, historyText: string): boolean {
  const clip = compactSpoken(clipText);
  const history = compactSpoken(historyText);
  if (!clip || !history) return false;
  if (clip === history) return true;
  const shorter = clip.length <= history.length ? clip : history;
  const longer = clip.length <= history.length ? history : clip;
  return shorter.length >= 20 && longer.includes(shorter);
}

function historyItemText(record: Record<string, unknown>): string {
  const direct = String(record.text ?? "").trim();
  if (direct) return direct;
  if (!Array.isArray(record.dialogue)) return "";
  return record.dialogue
    .map((line) => (line && typeof line === "object" ? String((line as { text?: unknown }).text ?? "").trim() : ""))
    .filter(Boolean)
    .join("\n");
}

function wholeCount(value: unknown): number | null {
  const amount = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : Number.NaN;
  return Number.isSafeInteger(amount) ? amount : null;
}

export function historyChargeFromItem(item: unknown): HistoryCharge | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const id = String(record.history_item_id ?? "").trim();
  const at = Number(record.date_unix) * 1000;
  const from = wholeCount(record.character_count_change_from);
  const to = wholeCount(record.character_count_change_to);
  if (!id || !Number.isFinite(at) || from == null || to == null || to < from) return null;
  const model = String(record.model_id ?? "").trim();
  return {
    id,
    at,
    text: historyItemText(record),
    amount: to - from,
    model: model || null,
  };
}

/** Pair each clip with the closest unused ElevenLabs history item. No match means no amount. */
export function matchHistoryCharges(
  clips: Array<{ id: string; at: number; text: string }>,
  history: HistoryCharge[],
  windowMs = 30 * 60 * 1000,
): Array<{ clipId: string; historyId: string; amount: number; model: string | null }> {
  const pairs: Array<{ clipId: string; item: HistoryCharge; delta: number }> = [];
  for (const clip of clips) {
    if (!clip.text.trim()) continue;
    for (const item of history) {
      if (!spokenMatches(clip.text, item.text)) continue;
      const delta = Math.abs(item.at - clip.at);
      if (delta > windowMs) continue;
      pairs.push({ clipId: clip.id, item, delta });
    }
  }
  pairs.sort((a, b) => a.delta - b.delta);
  const usedClips = new Set<string>();
  const usedHistory = new Set<string>();
  const matches: Array<{ clipId: string; historyId: string; amount: number; model: string | null }> = [];
  for (const pair of pairs) {
    if (usedClips.has(pair.clipId) || usedHistory.has(pair.item.id)) continue;
    usedClips.add(pair.clipId);
    usedHistory.add(pair.item.id);
    matches.push({ clipId: pair.clipId, historyId: pair.item.id, amount: pair.item.amount, model: pair.item.model });
  }
  return matches;
}

export function promptExcerpt(text: string | null | undefined, limit = 160): string | null {
  const trimmed = text?.replace(/\s+/g, " ").trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, Math.max(0, limit - 3))}...`;
}

function amountPair(amount: number | null | undefined, unit: UsageUnit | null | undefined): { usage_amount: number | null; usage_unit: UsageUnit | null } {
  if (typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0 && (unit === "character" || unit === "token")) {
    return { usage_amount: amount, usage_unit: unit };
  }
  return { usage_amount: null, usage_unit: null };
}

export async function recordContentUsage(admin: UsageWriter, draft: UsageDraft): Promise<string | null> {
  try {
    const amounts = amountPair(draft.usageAmount, draft.usageUnit);
    const sourceId = draft.sourceId && isUsageUuid(draft.sourceId) ? draft.sourceId : null;
    if (sourceId) {
      const existing = await admin.from("content_ai_usage").select("id").eq("service", draft.service).eq("source_id", sourceId).maybeSingle();
      if (existing.data?.id) return String(existing.data.id);
    }
    const inserted = await admin.from("content_ai_usage").insert({
      organization_id: draft.organizationId,
      social_media_plan_id: draft.planId && isUsageUuid(draft.planId) ? draft.planId : null,
      thinking_master_thought_id: draft.masterThoughtId && isUsageUuid(draft.masterThoughtId) ? draft.masterThoughtId : null,
      actor_user_id: draft.actorUserId && isUsageUuid(draft.actorUserId) ? draft.actorUserId : null,
      service: draft.service,
      action: draft.action.slice(0, 40),
      target_label: promptExcerpt(draft.targetLabel, 120),
      model: draft.model?.trim() ? draft.model.trim().slice(0, 120) : null,
      ...amounts,
      input_tokens: storedTokenCount(draft.inputTokens),
      output_tokens: storedTokenCount(draft.outputTokens),
      status: draft.status,
      provider_ref: draft.providerRef?.trim() ? draft.providerRef.trim().slice(0, 120) : null,
      source_id: sourceId,
      prompt_excerpt: promptExcerpt(draft.promptExcerpt),
    }).select("id").maybeSingle();
    if (inserted.error) {
      console.error("content_ai_usage insert", inserted.error.message);
      return null;
    }
    return inserted.data?.id ? String(inserted.data.id) : null;
  } catch (error) {
    console.error("content_ai_usage insert", error);
    return null;
  }
}

export async function settleContentUsage(
  admin: UsageWriter,
  service: UsageService,
  sourceId: string,
  patch: { status: UsageStatus; usageAmount?: number | null; usageUnit?: UsageUnit | null },
): Promise<void> {
  try {
    if (!isUsageUuid(sourceId)) return;
    const existing = await admin.from("content_ai_usage").select("id").eq("service", service).eq("source_id", sourceId).maybeSingle();
    if (!existing.data?.id) return;
    const next: Record<string, unknown> = { status: patch.status };
    if (typeof patch.usageAmount === "number" && patch.usageUnit) {
      const amounts = amountPair(patch.usageAmount, patch.usageUnit);
      if (amounts.usage_amount != null) {
        next.usage_amount = amounts.usage_amount;
        next.usage_unit = amounts.usage_unit;
      }
    }
    const updated = await admin.from("content_ai_usage").update(next).eq("id", String(existing.data.id)).eq("service", service);
    if (updated.error) console.error("content_ai_usage update", updated.error.message);
  } catch (error) {
    console.error("content_ai_usage update", error);
  }
}
