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
const SETTINGS_SCRIPT_AI =
  "Digital Marketing → Social Media → Settings → Script AI Configuration (Gemini API key).";

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
      .select("google_ai_api_key, daily_limit, model")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (configError || !config) {
      return jsonResponse(
        { error: `Script AI config not found. Configure Gemini at ${SETTINGS_SCRIPT_AI}` },
        400,
      );
    }

    // Receipt vision uses Gemini only; do not gate on `is_active` (legacy Groq flag left many Gemini orgs "disabled").

    const apiKey = safeTrim(config.google_ai_api_key);
    if (!apiKey) {
      return jsonResponse(
        { error: `Google AI API key not configured. Add it at ${SETTINGS_SCRIPT_AI}` },
        400,
      );
    }

    const dailyLimit = Math.max(1, config.daily_limit ?? 50);
    const rawModel = safeTrim(config.model) || "gemini-2.5-flash";
    const model = deprecatedModels[rawModel] ?? rawModel;
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

    const inlineParts = receiptFiles.map((file) => ({
      inline_data: {
        mime_type: file.mimeType,
        data: file.base64,
      },
    }));

    const ocrPrompt = [
      "Extract all readable text from this receipt image/PDF.",
      "Return plain text only.",
      "Keep line breaks for readability.",
      "Important: when a long transaction ID, payment code, or reference number wraps across lines, that line break is layout only—the next line often continues the same token with no space in the real value.",
      "Do not add extra explanation.",
    ].join("\n");
    const ocrResult = await callGeminiText({ apiKey, model, prompt: ocrPrompt, inlineParts });
    if (!ocrResult.ok) return jsonResponse({ error: ocrResult.error }, 500);
    const combinedOcrText = [ocrResult.text, ocrText].filter((v) => v.length > 0).join("\n\n");

    const extractionPrompt = [
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
      combinedOcrText ? `OCR text:\n${combinedOcrText}` : "OCR text: (empty)",
    ].join("\n");
    const extractionResult = await callGeminiText({ apiKey, model, prompt: extractionPrompt, inlineParts });
    if (!extractionResult.ok) return jsonResponse({ error: extractionResult.error }, 500);
    const parsed = extractJsonObject(extractionResult.text);
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
