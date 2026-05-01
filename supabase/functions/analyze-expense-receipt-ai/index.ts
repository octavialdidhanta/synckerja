/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/** User-facing hint — aligns with `/digital-marketing/social-media/settings` Script AI Configuration. */
const SETTINGS_SCRIPT_AI = "Digital Marketing → Social Media → Settings → Script AI Configuration.";

const PDF_MIME_RE = /pdf/i;

function isPdfMime(mime: string): boolean {
  return PDF_MIME_RE.test(mime);
}

type OpenAIChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

function dataUrlForReceiptFile(file: { mimeType: string; base64: string }): string {
  const mime = file.mimeType || "image/jpeg";
  return `data:${mime};base64,${file.base64}`;
}

/** Groq: base64 image payloads must stay under ~4MB per image (413 if exceeded). */
const GROQ_MAX_BASE64_CHARS_PER_IMAGE = 3_500_000;

function assertGroqReceiptImagesWithinLimit(files: Array<{ base64: string }>): string | null {
  for (let i = 0; i < files.length; i++) {
    const len = files[i]?.base64.length ?? 0;
    if (len > GROQ_MAX_BASE64_CHARS_PER_IMAGE) {
      return `Receipt image ${i + 1} is too large for Groq (base64 length ${len}; max ~${GROQ_MAX_BASE64_CHARS_PER_IMAGE}). Compress or retake the photo.`;
    }
  }
  return null;
}

function parseOpenAICompatibleError(errText: string, fallback: string): string {
  try {
    const errJson = JSON.parse(errText) as { error?: unknown };
    const e = errJson.error;
    if (typeof e === "string" && e.trim()) return e.trim();
    if (e && typeof e === "object" && "message" in e && typeof (e as { message?: unknown }).message === "string") {
      return ((e as { message: string }).message).trim() || fallback;
    }
  } catch {
    // ignore
  }
  return errText.trim() || fallback;
}

/** Fireworks Chat Completions: serverless IDs use `accounts/fireworks/models/...` (see Fireworks docs). */
function toFireworksAccountsModelsPath(model: string): string {
  const m = model.trim().replace(/\/+$/, "");
  if (!m) return m;
  if (m.startsWith("accounts/fireworks/models/")) return m;
  if (m.startsWith("fireworks/")) {
    const slug = m.slice("fireworks/".length).replace(/\/+$/, "");
    return slug ? `accounts/fireworks/models/${slug}` : m;
  }
  if (!m.includes("/")) return `accounts/fireworks/models/${m}`;
  return m;
}

/** Fireworks: retry alternate model id naming (catalog vs path). */
function alternateFireworksModelId(model: string): string | null {
  const prefix = "accounts/fireworks/models/";
  if (model.startsWith(prefix)) {
    const slug = model.slice(prefix.length).replace(/\/+$/, "");
    return slug ? `fireworks/${slug}` : null;
  }
  if (model.startsWith("fireworks/")) {
    const slug = model.slice("fireworks/".length).replace(/\/+$/, "");
    return slug ? `${prefix}${slug}` : null;
  }
  return null;
}

function resolveGroqVisionModelId(stored: string | null | undefined): string {
  const fromEnv = (Deno.env.get("GROQ_VISION_MODEL") ?? "").trim();
  const defaultVision = "meta-llama/llama-4-scout-17b-16e-instruct";
  const fallback = fromEnv || defaultVision;
  const m = (stored ?? "").trim();
  if (!m) return fallback;
  const lower = m.toLowerCase();
  if (lower.includes("vision") || lower.startsWith("meta-llama/") || lower.includes("llava")) return m;
  if (lower.includes("llama-3.3") || lower.includes("llama-3.1") || lower.includes("versatile") || lower.includes("instant")) {
    return fallback;
  }
  return m;
}

const FIREWORKS_VISION_HINT = /vision|vl-|llava|rolm-ocr|internvl|scout|maverick/i;

function resolveFireworksVisionModelId(stored: string | null | undefined): string {
  const fromEnv = (Deno.env.get("FIREWORKS_VISION_MODEL") ?? "").trim();
  const defaultVision = "accounts/fireworks/models/llama-v3p2-11b-vision-instruct";
  const fallback = toFireworksAccountsModelsPath(fromEnv || defaultVision);
  const m = (stored ?? "").trim();
  if (!m) return fallback;
  const lower = m.toLowerCase();
  if (lower.includes("gemini")) return fallback;
  if (lower.startsWith("gpt-") || lower.includes("openai/")) return fallback;
  if (
    (/llama-v3p3-70b-instruct|llama-v3p1-8b-instruct/i.test(lower) || lower.includes("text")) &&
    !FIREWORKS_VISION_HINT.test(lower)
  ) {
    return fallback;
  }
  if (!m.startsWith("accounts/") && !m.startsWith("fireworks/")) return fallback;
  return toFireworksAccountsModelsPath(m);
}

type OpenAIChatOk = { ok: true; text: string };
type OpenAIChatFail = { ok: false; error: string; status?: number };

async function callOpenAICompatibleChat(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  content: OpenAIChatContentPart[];
  temperature?: number;
  maxCompletionTokens?: number;
  jsonObject?: boolean;
}): Promise<OpenAIChatOk | OpenAIChatFail> {
  const url = `${params.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model: params.model,
    messages: [{ role: "user", content: params.content }],
    temperature: params.temperature ?? 0.2,
  };
  if (typeof params.maxCompletionTokens === "number") {
    body.max_completion_tokens = params.maxCompletionTokens;
  }
  if (params.jsonObject === true) {
    body.response_format = { type: "json_object" };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    const errMsg = parseOpenAICompatibleError(errText, "Failed to analyze receipt");
    return { ok: false, error: errMsg, status: res.status };
  }

  const data = await res.json();
  const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) return { ok: false, error: "No content generated from AI" };
  return { ok: true, text };
}

async function callGroqVisionWithFallback(params: {
  apiKey: string;
  primaryModel: string;
  content: OpenAIChatContentPart[];
  maxCompletionTokens?: number;
  jsonObject?: boolean;
}): Promise<OpenAIChatOk | OpenAIChatFail> {
  const envAlt = (Deno.env.get("GROQ_VISION_MODEL_FALLBACK") ?? "").trim();
  const fallbacks = Array.from(
    new Set(
      [
        params.primaryModel,
        "meta-llama/llama-4-scout-17b-16e-instruct",
        envAlt || null,
      ].filter((v): v is string => Boolean(v)),
    ),
  );

  let last: OpenAIChatFail = { ok: false, error: "Groq vision request failed" };
  for (const model of fallbacks) {
    const r = await callOpenAICompatibleChat({
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: params.apiKey,
      model,
      content: params.content,
      maxCompletionTokens: params.maxCompletionTokens,
      jsonObject: params.jsonObject,
    });
    if (r.ok === true) return r;
    last = r;
    const errLower = r.error.toLowerCase();
    const tryNextModel =
      r.status === 404 ||
      r.status === 413 ||
      errLower.includes("decommissioned") ||
      errLower.includes("model_decommissioned") ||
      errLower.includes("not found") ||
      errLower.includes("does not support") ||
      errLower.includes("too large") ||
      errLower.includes("payload") ||
      errLower.includes("file too large") ||
      (errLower.includes("image") && errLower.includes("not")) ||
      (errLower.includes("vision") && errLower.includes("not"));
    if (!tryNextModel) break;
  }
  return last;
}

/** Vision models to try if primary is unavailable on serverless (order: smaller / docs examples first). */
const FIREWORKS_VISION_SERVERLESS_FALLBACKS: string[] = [
  "accounts/fireworks/models/llama-v3p2-11b-vision-instruct",
  "accounts/fireworks/models/llama-v3p2-90b-vision-instruct",
  "accounts/fireworks/models/kimi-k2p5",
];

function buildFireworksVisionModelCandidates(primaryModel: string, envFallback: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const id = toFireworksAccountsModelsPath(raw);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
    const alt = alternateFireworksModelId(id);
    if (alt && !seen.has(alt)) {
      seen.add(alt);
      out.push(alt);
    }
  };
  push(primaryModel);
  if (envFallback) push(envFallback);
  for (const d of FIREWORKS_VISION_SERVERLESS_FALLBACKS) push(d);
  return out;
}

async function callFireworksVisionWithRetry(params: {
  apiKey: string;
  baseUrl: string;
  primaryModel: string;
  content: OpenAIChatContentPart[];
  maxCompletionTokens?: number;
  jsonObject?: boolean;
}): Promise<OpenAIChatOk | OpenAIChatFail> {
  const run = (model: string) =>
    callOpenAICompatibleChat({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      model,
      content: params.content,
      maxCompletionTokens: params.maxCompletionTokens,
      jsonObject: params.jsonObject,
    });

  const envAlt = (Deno.env.get("FIREWORKS_VISION_MODEL_FALLBACK") ?? "").trim();
  const candidates = buildFireworksVisionModelCandidates(params.primaryModel, envAlt);

  let last: OpenAIChatFail = { ok: false, error: "Fireworks vision request failed" };
  for (const modelId of candidates) {
    const r = await run(modelId);
    if (r.ok === true) return r;
    last = r;
    const errLower = last.error.toLowerCase();
    const tryNext =
      last.status === 404 ||
      last.status === 413 ||
      errLower.includes("not found") ||
      errLower.includes("inaccessible") ||
      errLower.includes("not deployed") ||
      errLower.includes("does not support") ||
      errLower.includes("invalid model") ||
      errLower.includes("too large") ||
      errLower.includes("payload");
    if (!tryNext) break;
  }
  return last;
}

const deprecatedModels: Record<string, string> = {
  "gemini-1.5-flash": "gemini-2.5-flash",
  "gemini-1.5-flash-latest": "gemini-2.5-flash",
  "gemini-1.5-pro": "gemini-2.5-flash",
  "gemini-2.0-flash": "gemini-2.5-flash",
  "gemini-2.0-flash-exp": "gemini-2.5-flash",
};

type IncomingReceiptFile = {
  name?: string;
  mimeType?: string;
  base64?: string;
};

type ParsedResult = {
  expenseName?: string;
  amount?: number;
  createDate?: string;
  description?: string;
  /** Bank transfer ref, invoice no., BI-FAST ref, etc. — verbatim from model, no trim. */
  transactionId?: string;
  transactionIdNeedsReview?: boolean;
  referenceNumber?: string;
  referenceNumberNeedsReview?: boolean;
  paymentCode?: string;
  paymentCodeNeedsReview?: boolean;
};

async function callGeminiText(params: {
  apiKey: string;
  model: string;
  prompt: string;
  inlineParts: Array<{ inline_data: { mime_type: string; data: string } }>;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent`;
  const geminiRes = await fetch(geminiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": params.apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: params.prompt }, ...params.inlineParts],
        },
      ],
    }),
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    let errMsg = "Failed to analyze receipt";
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson?.error?.message ?? errMsg;
    } catch {
      // ignore parse failure
    }
    return { ok: false, error: errMsg };
  }

  const geminiData = await geminiRes.json();
  const textPart = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  const text = typeof textPart === "string" ? textPart.trim() : "";
  if (!text) return { ok: false, error: "No content generated from AI" };
  return { ok: true, text };
}

const jsonResponse = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function safeTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Identifier / machine codes: preserve exactly as returned in JSON (no trim). */
function passThroughIdentifier(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseBoolFlag(value: unknown): boolean {
  return value === true || value === "true";
}

function extractJsonObject(text: string): ParsedResult | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as ParsedResult;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as ParsedResult;
    } catch {
      return null;
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await supabaseWithUser.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) return jsonResponse({ error: "Invalid token" }, 401);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();
    const organizationId = profile?.active_organization_id ?? null;
    if (!organizationId) return jsonResponse({ error: "No active organization" }, 400);

    const body = await req.json().catch(() => ({}));
    const incomingFiles = Array.isArray(body?.receiptFiles) ? (body.receiptFiles as IncomingReceiptFile[]) : [];
    const receiptFiles = incomingFiles
      .map((f) => ({
        name: safeTrim(f.name),
        mimeType: safeTrim(f.mimeType) || "application/octet-stream",
        base64: safeTrim(f.base64),
      }))
      .filter((f) => f.base64.length > 0)
      .slice(0, 3);

    if (receiptFiles.length === 0) {
      return jsonResponse({ error: "Missing receiptFiles payload" }, 400);
    }

    const ocrText = safeTrim(body?.ocrText);

    const { data: config, error: configError } = await supabaseAdmin
      .from("organization_script_ai_config")
      .select("google_ai_api_key, daily_limit, model, is_active, text_ai_provider")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (configError || !config) {
      return jsonResponse(
        { error: `Script AI config not found. Configure at ${SETTINGS_SCRIPT_AI}` },
        400,
      );
    }

    const rawProvider = (config as { text_ai_provider?: unknown }).text_ai_provider;
    const normalizedProvider =
      typeof rawProvider === "string" && ["gemini", "groq", "fireworks"].includes(rawProvider.trim())
        ? rawProvider.trim() as "gemini" | "groq" | "fireworks"
        : (config.is_active ? "groq" : "gemini");

    // Do not gate Gemini-only flows on `is_active` (legacy Groq flag left many Gemini orgs "disabled").

    const dailyLimit = Math.max(1, config.daily_limit ?? 50);
    const storedModel = safeTrim(config.model);
    const today = new Date().toISOString().slice(0, 10);

    const { data: usageRow, error: usageError } = await supabaseAdmin
      .from("script_ai_daily_usage")
      .select("id, count")
      .eq("organization_id", organizationId)
      .eq("usage_date", today)
      .maybeSingle();
    if (usageError) return jsonResponse({ error: "Failed to check usage limit" }, 500);
    const currentCount = usageRow?.count ?? 0;
    if (currentCount >= dailyLimit) {
      return jsonResponse({ error: `Daily limit reached (${dailyLimit} per day). Try again tomorrow.` }, 429);
    }

    const visionReceiptFiles = receiptFiles.filter((f) => !isPdfMime(f.mimeType));
    const hasPdfReceipt = receiptFiles.some((f) => isPdfMime(f.mimeType));

    const ocrPrompt = [
      "Extract all readable text from this receipt image/PDF.",
      "Return plain text only.",
      "Keep line breaks for readability.",
      "Important: when a long transaction ID, payment code, or reference number wraps across lines, that line break is layout only—the next line often continues the same token with no space in the real value.",
      "Do not add extra explanation.",
    ].join("\n");

    const extractionPromptBase = [
      "You are extracting expense data from receipts.",
      "Use both receipt images/PDF and OCR text context when available.",
      "Return ONLY valid JSON with this exact shape (all keys present; use empty string \"\" or false as needed):",
      '{"expenseName":"string","amount":12345,"createDate":"YYYY-MM-DD","description":"string","transactionId":"string","transactionIdNeedsReview":false,"referenceNumber":"string","referenceNumberNeedsReview":false,"paymentCode":"string","paymentCodeNeedsReview":false}',
      "Rules:",
      "- amount must be final transaction total amount (not subtotal/fee).",
      "- createDate must be transaction date. If unknown, return empty string.",
      "- expenseName should be merchant or best transaction title.",
      "- description should summarize transaction details briefly (human-readable prose).",
      "- transactionId: primary transaction / payment reference (e.g. ID transaksi, BI-FAST ref, trace no.). If none, \"\".",
      "- referenceNumber: other long reference numbers on the receipt (e.g. nomor referensi) if distinct from transactionId; else \"\".",
      "- paymentCode: payment / VA / billing codes if shown separately; else \"\".",
      "- CRITICAL for transactionId, referenceNumber, paymentCode:",
      "  * Prefer the receipt IMAGE to see whether a space truly exists between characters that appear on separate lines.",
      "  * Do NOT insert spaces or line breaks only because OCR text or layout wrapped mid-string; merge continuation lines into one single-line string with no fake spaces.",
      "  * Do NOT remove spaces that are clearly visible in the receipt between characters.",
      "  * Each of these three fields must be a single line inside JSON (no newline characters inside the string).",
      "- transactionIdNeedsReview, referenceNumberNeedsReview, paymentCodeNeedsReview: set true if that value is truncated, unreadable, ambiguous, or you are unsure; else false.",
      "- If field not found, return empty string for text/date and 0 for amount.",
    ];

    let combinedOcrText: string;
    let extractionText: string;

    const mapOpenAICompatErrorStatus = (status?: number) => {
      if (status === 429) return 429;
      if (status === 413) return 400;
      return 500;
    };

    if (normalizedProvider === "groq" || normalizedProvider === "fireworks") {
      if (hasPdfReceipt && visionReceiptFiles.length === 0 && !ocrText) {
        return jsonResponse(
          {
            error:
              "Bukti PDF dengan provider Groq/Fireworks membutuhkan teks OCR dari perangkat atau unggah gambar. " +
              "Alternatif: pilih provider Gemini (dukungan PDF langsung) di Script AI Configuration.",
          },
          400,
        );
      }

      const buildVisionUserContent = (textPrompt: string): OpenAIChatContentPart[] => {
        const parts: OpenAIChatContentPart[] = [];
        for (const file of visionReceiptFiles) {
          parts.push({ type: "image_url", image_url: { url: dataUrlForReceiptFile(file) } });
        }
        parts.push({ type: "text", text: textPrompt });
        return parts;
      };

      const clientOcrSection = ocrText
        ? `\n${
          hasPdfReceipt
            ? "Client/device OCR for PDF or unreadable scan (use together with receipt images when present)."
            : "Optional client/device OCR hint (may be imperfect; prefer receipt images)."
        }:\n${ocrText}`
        : "";

      const visionExtractionPrompt = [
        ...extractionPromptBase,
        "When receipt images are attached, read totals, dates, and reference numbers directly from them.",
        clientOcrSection,
      ].join("\n");

      if (normalizedProvider === "groq") {
        const groqApiKey = (Deno.env.get("GROQ_API_KEY") ?? "").trim();
        if (!groqApiKey) {
          return jsonResponse({ error: "Server missing GROQ_API_KEY secret. Configure it in Supabase Secrets." }, 500);
        }
        const groqVisionModel = resolveGroqVisionModelId(storedModel || null);

        if (visionReceiptFiles.length === 0) {
          const textOnlyOcr = ocrText;
          if (!textOnlyOcr) {
            return jsonResponse({ error: "Missing OCR text for text-only receipt analysis." }, 400);
          }
          combinedOcrText = textOnlyOcr;
          const extractionPrompt = [
            ...extractionPromptBase,
            `OCR text:\n${combinedOcrText}`,
          ].join("\n");
          const ex = await callGroqVisionWithFallback({
            apiKey: groqApiKey,
            primaryModel: groqVisionModel,
            content: [{ type: "text", text: extractionPrompt }],
            maxCompletionTokens: 4096,
            jsonObject: true,
          });
          if (ex.ok === false) {
            return jsonResponse({ error: ex.error }, mapOpenAICompatErrorStatus(ex.status));
          }
          extractionText = ex.text;
        } else {
          const groqLimitErr = assertGroqReceiptImagesWithinLimit(visionReceiptFiles);
          if (groqLimitErr) return jsonResponse({ error: groqLimitErr }, 400);

          const ex = await callGroqVisionWithFallback({
            apiKey: groqApiKey,
            primaryModel: groqVisionModel,
            content: buildVisionUserContent(visionExtractionPrompt),
            maxCompletionTokens: 4096,
            jsonObject: true,
          });
          if (ex.ok === false) {
            return jsonResponse({ error: ex.error }, mapOpenAICompatErrorStatus(ex.status));
          }
          extractionText = ex.text;
          combinedOcrText = ocrText;
        }
      } else {
        const fireworksApiKey = (Deno.env.get("FIREWORKS_API_KEY") ?? "").trim();
        if (!fireworksApiKey) {
          return jsonResponse(
            { error: "Server missing FIREWORKS_API_KEY secret. Configure it in Supabase Secrets." },
            500,
          );
        }
        const fireworksBase =
          (Deno.env.get("FIREWORKS_BASE_URL") ?? "https://api.fireworks.ai/inference/v1").trim() ||
          "https://api.fireworks.ai/inference/v1";
        const fwVisionModel = resolveFireworksVisionModelId(storedModel || null);

        if (visionReceiptFiles.length === 0) {
          const textOnlyOcr = ocrText;
          if (!textOnlyOcr) {
            return jsonResponse({ error: "Missing OCR text for text-only receipt analysis." }, 400);
          }
          combinedOcrText = textOnlyOcr;
          const extractionPrompt = [
            ...extractionPromptBase,
            `OCR text:\n${combinedOcrText}`,
          ].join("\n");
          const ex = await callFireworksVisionWithRetry({
            apiKey: fireworksApiKey,
            baseUrl: fireworksBase,
            primaryModel: fwVisionModel,
            content: [{ type: "text", text: extractionPrompt }],
            maxCompletionTokens: 4096,
            jsonObject: false,
          });
          if (ex.ok === false) {
            return jsonResponse({ error: ex.error }, mapOpenAICompatErrorStatus(ex.status));
          }
          extractionText = ex.text;
        } else {
          const ex = await callFireworksVisionWithRetry({
            apiKey: fireworksApiKey,
            baseUrl: fireworksBase,
            primaryModel: fwVisionModel,
            content: buildVisionUserContent(visionExtractionPrompt),
            maxCompletionTokens: 4096,
            jsonObject: false,
          });
          if (ex.ok === false) {
            return jsonResponse({ error: ex.error }, mapOpenAICompatErrorStatus(ex.status));
          }
          extractionText = ex.text;
          combinedOcrText = ocrText;
        }
      }
    } else {
      const apiKey = safeTrim(config.google_ai_api_key);
      if (!apiKey) {
        return jsonResponse(
          { error: `Google AI API key not configured. Add it at ${SETTINGS_SCRIPT_AI}` },
          400,
        );
      }
      const rawModel = storedModel || "gemini-2.5-flash";
      const model = deprecatedModels[rawModel] ?? rawModel;
      const inlineParts = receiptFiles.map((file) => ({
        inline_data: {
          mime_type: file.mimeType,
          data: file.base64,
        },
      }));

      const ocrResult = await callGeminiText({ apiKey, model, prompt: ocrPrompt, inlineParts });
      if (ocrResult.ok === false) return jsonResponse({ error: ocrResult.error }, 500);
      combinedOcrText = [ocrResult.text, ocrText].filter((v) => v.length > 0).join("\n\n");

      const extractionPrompt = [
        ...extractionPromptBase,
        combinedOcrText ? `OCR text:\n${combinedOcrText}` : "OCR text: (empty)",
      ].join("\n");
      const extractionResult = await callGeminiText({ apiKey, model, prompt: extractionPrompt, inlineParts });
      if (extractionResult.ok === false) return jsonResponse({ error: extractionResult.error }, 500);
      extractionText = extractionResult.text;
    }

    const parsed = extractJsonObject(extractionText);
    if (!parsed) {
      return jsonResponse({ error: "AI output is not valid JSON" }, 500);
    }

    const amount = typeof parsed.amount === "number"
      ? parsed.amount
      : Number(safeTrim(parsed.amount));
    const p = parsed as ParsedResult;
    const normalized: ParsedResult = {
      expenseName: safeTrim(parsed.expenseName),
      amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : undefined,
      createDate: safeTrim(parsed.createDate),
      description: safeTrim(parsed.description),
      transactionId: passThroughIdentifier(p.transactionId),
      transactionIdNeedsReview: parseBoolFlag(p.transactionIdNeedsReview),
      referenceNumber: passThroughIdentifier(p.referenceNumber),
      referenceNumberNeedsReview: parseBoolFlag(p.referenceNumberNeedsReview),
      paymentCode: passThroughIdentifier(p.paymentCode),
      paymentCodeNeedsReview: parseBoolFlag(p.paymentCodeNeedsReview),
    };

    if (usageRow?.id) {
      await supabaseAdmin
        .from("script_ai_daily_usage")
        .update({ count: currentCount + 1, updated_at: new Date().toISOString() })
        .eq("id", usageRow.id);
    } else {
      await supabaseAdmin.from("script_ai_daily_usage").insert({
        organization_id: organizationId,
        usage_date: today,
        count: 1,
      });
    }

    return jsonResponse({ success: true, data: normalized }, 200);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
