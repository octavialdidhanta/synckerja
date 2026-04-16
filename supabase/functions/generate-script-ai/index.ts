/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const BAHASA_INSTRUCTION = "\n\nPENTING: Seluruh output script, caption, dan hashtag HARUS dalam Bahasa Indonesia. Jangan gunakan bahasa lain.";
const FORMAT_INSTRUCTION =
  "\n\nFORMAT OUTPUT: Gunakan Markdown dengan benar. Untuk tabel: gunakan format standar (| Kolom1 | Kolom2 | Kolom3 |) dengan baris pemisah (|---|---|---|), satu baris per row. Jangan wrap teks ke baris baru di dalam satu cell—gunakan satu baris per row tabel agar terbaca rapi. Untuk tabel breakdown script: header HARUS persis lima kolom | Timing | VO (Voice Over) | Visual | Element Lainnya | Tagging | — dilarang mengganti Element Lainnya jadi Text On Screen/Teks di Layar, dilarang menghilangkan Tagging, dilarang hanya empat kolom. Setiap baris data wajib isi kolom Tagging. WAJIB: Akhiri script dengan blok ## CAPTION ## (baris sendiri) lalu baris baru lalu teks caption agar bisa disimpan di Save to Plan. Jika ada konsep, awali dengan ## Konsep Konten ## atau ## Concept of Content ## (baris sendiri) lalu baris baru lalu paragraf konsep.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const jsonResponse = (body: object, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseWithUser.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();

    const orgId = profile?.active_organization_id ?? null;
    if (!orgId) {
      return jsonResponse({ error: "No active organization" }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const prompt = body.prompt != null ? String(body.prompt).trim() : "";
    const originalText = body.originalText != null ? String(body.originalText).trim() : "";
    const fullScript = body.fullScript != null ? String(body.fullScript).trim() : "";
    const instruction = body.instruction != null ? String(body.instruction).trim() : "";
    const sectionType = body.sectionType != null ? String(body.sectionType).trim() : "";
    const previousRowText = body.previousRowText != null ? String(body.previousRowText).trim() : "";
    const nextRowText = body.nextRowText != null ? String(body.nextRowText).trim() : "";

    const isReframe = body.mode === "reframe";
    const isRevise =
      body.mode === "revise" || (originalText.length > 0 && instruction.length > 0 && !isReframe);
    const mode = isReframe ? "reframe" : isRevise ? "revise" : "generate";

    if (mode === "reframe") {
      if (!fullScript || !instruction) {
        return jsonResponse({ error: "Missing fullScript or instruction for reframe mode" }, 400);
      }
    } else if (mode === "revise") {
      if (!originalText || !instruction) {
        return jsonResponse({ error: "Missing originalText or instruction for revise mode" }, 400);
      }
    } else if (!prompt) {
      return jsonResponse({ error: "Missing prompt" }, 400);
    }

    const { data: config, error: configError } = await supabaseAdmin
      .from("organization_script_ai_config")
      .select("google_ai_api_key, daily_limit, model, is_active")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (configError || !config) {
      return jsonResponse({ error: "Script AI config not found. Configure at Settings > Script AI Generator." }, 400);
    }

    const dailyLimit = Math.max(1, config.daily_limit ?? 50);
    const useGroqForText = !!config.is_active;

    const today = new Date().toISOString().slice(0, 10);
    const { data: usageRow, error: usageError } = await supabaseAdmin
      .from("script_ai_daily_usage")
      .select("id, count")
      .eq("organization_id", orgId)
      .eq("usage_date", today)
      .maybeSingle();

    if (usageError) {
      console.error("Error fetching usage:", usageError);
      return jsonResponse({ error: "Failed to check usage limit" }, 500);
    }

    const currentCount = usageRow?.count ?? 0;
    if (currentCount >= dailyLimit) {
      return jsonResponse({
        error: `Daily limit reached (${dailyLimit} per day). Try again tomorrow.`,
      }, 429);
    }

    let fullPrompt: string;
    if (mode === "reframe") {
      fullPrompt = `User ingin memandang script konten digital marketing ini dari sudut pandang masalah yang berbeda.

Instruksi: ${instruction}

Script asli:
---
${fullScript}
---

Buat ulang SELURUH script dengan format yang sama persis (## Konsep Konten ##, **Judul Script:**, **Format & Style**, tabel breakdown, ## CAPTION ##, hashtag). Ganti framing masalah sesuai instruksi. Return HANYA script lengkap, tanpa penjelasan.${BAHASA_INSTRUCTION}${FORMAT_INSTRUCTION}`;
    } else if (mode === "revise") {
      const sectionHint = sectionType ? ` (Tipe section: ${sectionType})` : "";
      const tableRowHint =
        sectionType === "tableRow"
          ? "\n\nPENTING: Ini satu baris dari tabel breakdown script. Revisi sesuai instruksi. Return HANYA satu baris tabel dalam format markdown (| col1 | col2 | col3 | ...). Pastikan kolom Visual, Element Lainnya, dan Tagging menyesuaikan dengan perubahan VO/kolom lain agar konsisten dalam satu baris. REVISI HARUS NYAMBUNG dengan baris sebelumnya dan baris sesudahnya—jaga alur narasi dan tema agar tidak terasa dipaksakan."
          : "";
      const contextBlock =
        fullScript.length > 0
          ? `

KONTEKS SCRIPT LENGKAP (untuk menjaga tone, struktur, dan konsistensi dengan bagian lain—jangan ubah bagian yang tidak direvisi):
---
${fullScript}
---
`
          : "";
      const hasNeighborRows = sectionType === "tableRow" && (previousRowText.length > 0 || nextRowText.length > 0);
      const neighborBlock = hasNeighborRows
        ? `

KONTEKS LANGSUNG (revisi harus nyambung dengan baris ini—jangan ubah baris sebelum/sesudah, hanya revisi baris tengah):
${previousRowText.length > 0 ? `Baris SEBELUMNYA:\n${previousRowText}\n` : ""}
Baris yang DIREVISI (teks asli):
${originalText}
${nextRowText.length > 0 ? `\nBaris SESUDAHNYA:\n${nextRowText}` : ""}

Revisi HANYA baris tengah di atas agar alur narasi dan tema nyambung dengan baris sebelum dan sesudah.
`
        : "";
      const partToReviseBlock = hasNeighborRows
        ? ""
        : `

Bagian yang perlu direvisi (teks asli):
---
${originalText}
---
`;
      fullPrompt = `User ingin merevisi bagian script berikut. Instruksi: ${instruction}${sectionHint}
${contextBlock}${neighborBlock}${partToReviseBlock}

Return HANYA teks yang sudah direvisi, tanpa penjelasan tambahan. Format output harus sama (markdown, tabel, dll) sesuai teks asli. Jangan ubah struktur, hanya revisi konten sesuai instruksi.${tableRowHint}${BAHASA_INSTRUCTION}`;
    } else {
      fullPrompt = prompt + BAHASA_INSTRUCTION + FORMAT_INSTRUCTION;
    }

    let script = "";
    if (useGroqForText) {
      const groqApiKey = (Deno.env.get("GROQ_API_KEY") ?? "").trim();
      if (!groqApiKey) {
        return jsonResponse({ error: 'Server missing GROQ_API_KEY secret. Configure it in Supabase Secrets.' }, 500);
      }

      // Guard against very large prompts: Groq on-demand/free tiers can have low TPM.
      // Rough heuristic: ~4 chars/token (varies by language). Keep buffer for completion.
      const approxInputTokens = Math.ceil(fullPrompt.length / 4);
      const MAX_APPROX_INPUT_TOKENS = 5000;
      if (approxInputTokens > MAX_APPROX_INPUT_TOKENS) {
        return jsonResponse(
          {
            error:
              `Prompt terlalu besar untuk Groq (perkiraan input ~${approxInputTokens} tokens). ` +
              "Kurangi ukuran prompt/data, atau switch Text AI Provider ke Gemini untuk prompt yang panjang.",
          },
          413,
        );
      }

      // Groq deprecates models over time; default to a current production model.
      // Ref: https://console.groq.com/docs/models
      const primaryGroqModel = (config.model ?? "llama-3.3-70b-versatile").trim() || "llama-3.3-70b-versatile";
      const replacementGroqModel = "llama-3.3-70b-versatile";
      const fallbackGroqModel = "llama-3.1-8b-instant";

      const callGroq = async (model: string) => {
        return await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${groqApiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: fullPrompt }],
            temperature: 0.2,
          }),
        });
      };

      let groqRes = await callGroq(primaryGroqModel);

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        console.error("Groq API error:", groqRes.status, errText);
        let errMsg = "Failed to generate script";
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message ?? errMsg;
        } catch {
          // use default
        }
        // Normalize token/rate errors into a friendly 413 for the client.
        if (
          groqRes.status === 413 ||
          errText.includes("rate_limit_exceeded") ||
          errText.includes("\"type\":\"tokens\"") ||
          errText.toLowerCase().includes("tokens per minute")
        ) {
          return jsonResponse(
            {
              error:
                "Request terlalu besar/terkena limit Groq (TPM). Kurangi ukuran prompt/data, atau switch Text AI Provider ke Gemini. " +
                `Detail: ${errMsg}`,
            },
            413,
          );
        }
        // If the selected model has been decommissioned, retry once with a known-good fallback model.
        if (
          groqRes.status === 400 &&
          (errText.includes("model_decommissioned") || errText.toLowerCase().includes("decommissioned"))
        ) {
          const retryModel = primaryGroqModel === replacementGroqModel ? fallbackGroqModel : replacementGroqModel;
          const retryRes = await callGroq(retryModel);
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            const retryContent = retryData?.choices?.[0]?.message?.content;
            script = typeof retryContent === "string" ? retryContent.trim() : "";
          } else {
            const retryErrText = await retryRes.text();
            console.error("Groq API retry error:", retryRes.status, retryErrText);
            let retryMsg = errMsg;
            try {
              const retryJson = JSON.parse(retryErrText);
              retryMsg = retryJson.error?.message ?? retryMsg;
            } catch {
              // keep retryMsg
            }
            if (
              retryRes.status === 413 ||
              retryErrText.includes("rate_limit_exceeded") ||
              retryErrText.includes("\"type\":\"tokens\"") ||
              retryErrText.toLowerCase().includes("tokens per minute")
            ) {
              return jsonResponse(
                {
                  error:
                    "Request terlalu besar/terkena limit Groq (TPM). Kurangi ukuran prompt/data, atau switch Text AI Provider ke Gemini. " +
                    `Detail: ${retryMsg}`,
                },
                413,
              );
            }
            const status = retryRes.status === 429 ? 429 : 500;
            return jsonResponse({ error: retryMsg }, status);
          }
        } else {
          const status = groqRes.status === 429 ? 429 : 500;
          return jsonResponse({ error: errMsg }, status);
        }
      }

      if (!script) {
        const groqData = await groqRes.json();
        const content = groqData?.choices?.[0]?.message?.content;
        script = typeof content === "string" ? content.trim() : "";
      }
    } else {
      const apiKey = (config.google_ai_api_key ?? "").trim();
      if (!apiKey) {
        return jsonResponse({ error: "Google AI API key not configured. Add it in Settings > Script AI Generator." }, 400);
      }

      const rawModel = (config.model ?? "gemini-2.5-flash").trim() || "gemini-2.5-flash";
      // Map deprecated models to current equivalents
      const deprecatedModels: Record<string, string> = {
        "gemini-1.5-flash": "gemini-2.5-flash",
        "gemini-1.5-flash-latest": "gemini-2.5-flash",
        "gemini-1.5-pro": "gemini-2.5-flash",
        "gemini-2.0-flash": "gemini-2.5-flash",
        "gemini-2.0-flash-exp": "gemini-2.5-flash",
      };
      const model = deprecatedModels[rawModel] ?? rawModel;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
        }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error("Gemini API error:", geminiRes.status, errText);
        let errMsg = "Failed to generate script";
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message ?? errMsg;
        } catch {
          // use default
        }
        return jsonResponse({ error: errMsg }, 500);
      }

      const geminiData = await geminiRes.json();
      const textPart = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
      script = typeof textPart === "string" ? textPart.trim() : "";
    }

    if (!script) {
      return jsonResponse({ error: "No content generated from AI" }, 500);
    }

    if (usageRow?.id) {
      await supabaseAdmin
        .from("script_ai_daily_usage")
        .update({ count: currentCount + 1, updated_at: new Date().toISOString() })
        .eq("id", usageRow.id);
    } else {
      await supabaseAdmin.from("script_ai_daily_usage").insert({
        organization_id: orgId,
        usage_date: today,
        count: 1,
      });
    }

    return jsonResponse({ success: true, script }, 200);
  } catch (err) {
    console.error("generate-script-ai error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
});
