/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const CHARACTER_PROMPT = `Analyze this image of a person/character. Extract and return a JSON object with exactly these keys (use empty string if not visible):
- name: MUST be a suggested name for the character. If a name is visible (e.g. on a badge, caption, or sign), use it. If not visible, suggest a plausible name based on appearance, context, or role (e.g. "Ahmad", "Siti", "Man in blue shirt")—never use "Unknown".
- age: approximate age (e.g. "25 years")
- nationality: (e.g. "Indonesia")
- gender: (e.g. "Male" or "Female")
- hair_description: detailed hair description
- face_description: detailed face description
- clothing_description: what the person is wearing only (clothes, outfit, garments). Do not include setting or background here.
- additional_details: other details such as setting, background, pose context, special features, props. Do not repeat clothing here.
- accessories: glasses, jewelry, etc.
- body_shape: build/body type
- height: approximate height if visible (e.g. "175cm")

Return ONLY valid JSON, no markdown or extra text.`;

const OBJECT_PROMPT = `Analyze this image of an object/product. Extract and return a JSON object with exactly these keys:
- name: object name or short title
- description: detailed description of the object (appearance, use, features)

Return ONLY valid JSON, no markdown or extra text.`;

const SCENE_PROMPT = `Analyze this image and provide one long artistic description. The image may contain a scene, a product, or a character. Describe everything relevant: setting, mood, colors, composition, subjects, and any notable details. Write in a continuous paragraph suitable for creative or reference use. Return ONLY a JSON object with a single key "description" whose value is this full description text. No markdown, no extra keys. Example: {"description": "Your paragraph here..."}`;

const DESIGN_PROMPT = `Analyze this image as a design or layout (e.g. banner, poster, ad, social card). Extract and return a JSON object with exactly these keys (use empty string if not applicable):
- headline: main headline text visible in the design
- sub_headline: sub headline or secondary title text
- main_color: primary color used in the design. MUST use a variable placeholder like {primary_color} or {main_color} so it can be swapped later (e.g. "{primary_color}" or "Background: {bg_color}")
- other_colors: other notable colors, each with {variable} style, comma- or semicolon-separated (e.g. "{accent_color}; {text_color}")
- text: other body copy or text content
- elements: description of graphic elements, icons, shapes, or UI elements
- font: font or typography description (e.g. bold sans-serif, script font)
- layout_style_description: description of the layout style (composition, alignment, hierarchy)
- layout_change_recommendation: brief recommendation for layout changes or "ingin perubahan?" suggestions (e.g. "Consider moving CTA higher", "Add more whitespace")
- character_in_design: brief description of any character(s) or people in the design (for context; user may replace with a Digital Asset character)
- product_in_design: brief description of any product(s) or objects in the design (for context; user may replace with a Digital Asset product)

Return ONLY valid JSON, no markdown or extra text.`;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceRoleKey) {
      console.error("detect-digital-asset-image: SUPABASE_SERVICE_ROLE_KEY missing");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) {
      console.error("detect-digital-asset-image: getUser failed", userError?.message ?? userError);
      return jsonResponse({ error: "Invalid or expired session. Please sign in again." }, 401);
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
    const imageBase64 = body.imageBase64 != null ? String(body.imageBase64).trim() : "";
    const type = body.type === "scene" || body.type === "character" || body.type === "object" || body.type === "design"
      ? body.type
      : "character";

    if (!imageBase64) {
      return jsonResponse({ error: "Missing imageBase64" }, 400);
    }

    const { data: config, error: configError } = await supabaseAdmin
      .from("organization_script_ai_config")
      .select("google_ai_api_key, daily_limit, model, is_active")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (configError || !config) {
      return jsonResponse({ error: "Script AI config not found. Configure at Settings > Script AI Generator." }, 400);
    }

    const apiKey = (config.google_ai_api_key ?? "").trim();
    if (!apiKey) {
      return jsonResponse({ error: "Google AI API key not configured. Add it in Settings > Script AI Generator." }, 400);
    }

    const dailyLimit = Math.max(1, config.daily_limit ?? 50);
    const rawModel = (config.model ?? "gemini-2.5-flash").trim() || "gemini-2.5-flash";
    const deprecatedModels: Record<string, string> = {
      "gemini-1.5-flash": "gemini-2.5-flash",
      "gemini-1.5-flash-latest": "gemini-2.5-flash",
      "gemini-1.5-pro": "gemini-2.5-flash",
      "gemini-2.0-flash": "gemini-2.5-flash",
      "gemini-2.0-flash-exp": "gemini-2.5-flash",
    };
    const model = deprecatedModels[rawModel] ?? rawModel;

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

    const prompt = type === "character" ? CHARACTER_PROMPT : type === "object" ? OBJECT_PROMPT : type === "design" ? DESIGN_PROMPT : SCENE_PROMPT;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const parts: unknown[] = [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64,
        },
      },
      { text: prompt },
    ];

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      const isTemporary = geminiRes.status === 503 || geminiRes.status === 429;
      if (!isTemporary) {
        console.error("Gemini API error:", geminiRes.status, errText);
      }
      let errMsg = "Failed to detect image";
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message ?? errMsg;
      } catch {
        // use default
      }
      // Pass through 503 (overloaded) and 429 (quota) so client can show "try again later"
      const status = isTemporary ? geminiRes.status : 500;
      return jsonResponse({ error: errMsg }, status);
    }

    const geminiData = await geminiRes.json();
    const textPart = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    const rawText = typeof textPart === "string" ? textPart.trim() : "";

    if (!rawText) {
      return jsonResponse({ error: "No content generated from AI" }, 500);
    }

    if (type === "scene") {
      let description: string;
      try {
        const cleaned = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(cleaned) as { description?: string };
        description = typeof parsed?.description === "string" ? parsed.description.trim() : rawText;
      } catch {
        description = rawText;
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
      return jsonResponse({ description }, 200);
    }

    if (type === "design") {
      let designParsed: Record<string, string>;
      try {
        const cleaned = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
        designParsed = JSON.parse(cleaned) as Record<string, string>;
      } catch {
        return jsonResponse({ error: "AI did not return valid JSON for design" }, 500);
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
      return jsonResponse(designParsed, 200);
    }

    let parsed: Record<string, string>;
    try {
      const cleaned = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      parsed = JSON.parse(cleaned) as Record<string, string>;
    } catch {
      return jsonResponse({ error: "AI did not return valid JSON" }, 500);
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

    return jsonResponse(parsed, 200);
  } catch (err) {
    console.error("detect-digital-asset-image error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
});
