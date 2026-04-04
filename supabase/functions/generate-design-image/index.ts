/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Prefer Nano Banana Pro (Gemini 3 Pro Image); fallback to 2.5 Flash Image if unavailable
const IMAGE_MODEL_PRIMARY = "gemini-3-pro-image-preview";
const IMAGE_MODEL_FALLBACK = "gemini-2.5-flash-image";
const VALID_ASPECT_RATIOS = ["1:1", "4:5", "9:16", "16:9", "custom"] as const;
type AspectRatio = (typeof VALID_ASPECT_RATIOS)[number];

function parseAspectRatio(value: unknown): AspectRatio {
  if (typeof value === "string" && VALID_ASPECT_RATIOS.includes(value as AspectRatio)) {
    return value as AspectRatio;
  }
  return "1:1";
}

function parseCustomSize(body: Record<string, unknown>): { width: number; height: number; unit: string } | null {
  const w = body.customWidth != null ? Number(body.customWidth) : NaN;
  const h = body.customHeight != null ? Number(body.customHeight) : NaN;
  const unit = body.customUnit != null && typeof body.customUnit === "string" && ["px", "in", "mm", "cm"].includes(String(body.customUnit).toLowerCase())
    ? String(body.customUnit).toLowerCase()
    : "px";
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || w > 99999 || h < 1 || h > 99999) return null;
  return { width: Math.round(w), height: Math.round(h), unit };
}

// Supported by Gemini image models (e.g. 2.5 Flash Image). Map custom size to nearest for generationConfig.aspectRatio.
const SUPPORTED_ASPECT_RATIOS: { value: string; ratio: number }[] = [
  { value: "1:1", ratio: 1 },
  { value: "2:3", ratio: 2 / 3 },
  { value: "3:2", ratio: 3 / 2 },
  { value: "3:4", ratio: 3 / 4 },
  { value: "4:3", ratio: 4 / 3 },
  { value: "4:5", ratio: 4 / 5 },
  { value: "5:4", ratio: 5 / 4 },
  { value: "9:16", ratio: 9 / 16 },
  { value: "16:9", ratio: 16 / 9 },
  { value: "21:9", ratio: 21 / 9 },
];
function customSizeToAspectRatio(width: number, height: number): string {
  const r = width / height;
  let best = SUPPORTED_ASPECT_RATIOS[0];
  let bestDiff = Math.abs(r - best.ratio);
  for (const { value, ratio } of SUPPORTED_ASPECT_RATIOS) {
    const diff = Math.abs(r - ratio);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = { value, ratio };
    }
  }
  return best.value;
}

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

  console.log("generate-design-image: request received");
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
      console.error("generate-design-image: SUPABASE_SERVICE_ROLE_KEY missing");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    // Validate user access token (ES256 / HS256) via Auth API — reliable on Edge vs anon client + getUser(jwt).
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) {
      console.error("generate-design-image: getUser failed", userError?.message ?? userError);
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

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch (parseErr) {
      console.error("generate-design-image: body parse failed", parseErr);
      return jsonResponse(
        { error: "Invalid request body (possibly too large). Use fewer or smaller reference images and try again." },
        400
      );
    }
    const prompt = body.prompt != null ? String(body.prompt).trim() : "";
    const headlineExact = body.headline != null ? String(body.headline).trim() : "";
    const subHeadlineExact = body.sub_headline != null ? String(body.sub_headline).trim() : "";
    const textExact = body.text != null ? String(body.text).trim() : "";
    const verbatimTextBlock =
      headlineExact !== "" || subHeadlineExact !== "" || textExact !== ""
        ? "MANDATORY — HEADLINES & TEXT SECTION (strict, no typos):\n" +
          "ONLY the text strings listed below may appear as visible text. Copy them EXACTLY — character-for-character, in the same order. " +
          "Do NOT drop, add, or replace any character. Do NOT add spaces inside a word or remove spaces between words. Do NOT duplicate letters or change spelling. " +
          "Every character in the generated image must match the strings below exactly. No typos, no truncation, no paraphrase. Render sharp and crisp (no blur).\n\n" +
          (headlineExact !== "" ? `HEADLINE — copy exactly: «${headlineExact}»\n` : "") +
          (subHeadlineExact !== "" ? `SUB HEADLINE — copy exactly: «${subHeadlineExact}»\n` : "") +
          (textExact !== "" ? `TEXT — copy exactly: «${textExact}»\n` : "") +
          "\nFORBIDDEN — do NOT add any text that is not in the three fields above. Only the headline, sub headline, and text strings above may be shown.\n\n"
        : "";
    const aspectRatio = parseAspectRatio(body.aspectRatio);
    const referenceImageBase64 = body.referenceImageBase64 != null ? String(body.referenceImageBase64).trim() : "";
    const referenceImageMimeType =
      body.referenceImageMimeType != null && String(body.referenceImageMimeType).trim() !== ""
        ? String(body.referenceImageMimeType).trim()
        : "image/jpeg";
    const characterReferencesRaw = body.characterReferences;
    const characterReferences: { imageBase64: string; mimeType: string }[] = [];
    if (Array.isArray(characterReferencesRaw) && characterReferencesRaw.length > 0) {
      for (const item of characterReferencesRaw) {
        const b64 = item?.imageBase64 != null ? String(item.imageBase64).trim() : "";
        if (b64 === "") continue;
        const mt = item?.mimeType != null && String(item.mimeType).trim() !== "" ? String(item.mimeType).trim() : "image/jpeg";
        characterReferences.push({ imageBase64: b64, mimeType: mt });
      }
    } else if (body.characterReferenceImageBase64 != null && String(body.characterReferenceImageBase64).trim() !== "") {
      const b64 = String(body.characterReferenceImageBase64).trim();
      const mt = body.characterReferenceMimeType != null && String(body.characterReferenceMimeType).trim() !== ""
        ? String(body.characterReferenceMimeType).trim()
        : "image/jpeg";
      characterReferences.push({ imageBase64: b64, mimeType: mt });
    }
    const companyLogoBase64 =
      body.companyLogoBase64 != null ? String(body.companyLogoBase64).trim() : "";
    const companyLogoMimeType =
      body.companyLogoMimeType != null && String(body.companyLogoMimeType).trim() !== ""
        ? String(body.companyLogoMimeType).trim()
        : "image/png";

    const compositionReferencesRaw = body.compositionReferences;
    const compositionReferences: { imageBase64: string; mimeType: string }[] = [];
    if (Array.isArray(compositionReferencesRaw) && compositionReferencesRaw.length > 0) {
      for (const item of compositionReferencesRaw) {
        const b64 = item?.imageBase64 != null ? String(item.imageBase64).trim() : "";
        if (b64 === "") continue;
        const mt = item?.mimeType != null && String(item.mimeType).trim() !== "" ? String(item.mimeType).trim() : "image/jpeg";
        compositionReferences.push({ imageBase64: b64, mimeType: mt });
      }
    }

    type CharRefSlot = { imageBase64: string; mimeType: string; description?: string };
    type CharacterStructuredRefItem = {
      head?: CharRefSlot;
      clothes?: CharRefSlot[];
      logo?: CharRefSlot;
      foot?: CharRefSlot;
      accessories?: CharRefSlot[];
    };
    type CharacterTextPartItem = { faceHair?: string; clothing?: string; foot?: string; accessories?: string };
    const characterStructuredReferences: CharacterStructuredRefItem[] = [];
    const characterStructuredReferencesRaw = body.characterStructuredReferences;
    if (Array.isArray(characterStructuredReferencesRaw) && characterStructuredReferencesRaw.length > 0) {
      for (const item of characterStructuredReferencesRaw) {
        const entry: CharacterStructuredRefItem = {};
        if (item?.head?.imageBase64 != null && String(item.head.imageBase64).trim() !== "") {
          const desc = item.head.description != null && String(item.head.description).trim() !== "" ? String(item.head.description).trim() : undefined;
          entry.head = { imageBase64: String(item.head.imageBase64).trim(), mimeType: item.head.mimeType != null && String(item.head.mimeType).trim() !== "" ? String(item.head.mimeType).trim() : "image/jpeg", ...(desc ? { description: desc } : {}) };
        }
        if (Array.isArray(item?.clothes) && item.clothes.length > 0) {
          entry.clothes = [];
          for (const c of item.clothes) {
            if (c?.imageBase64 != null && String(c.imageBase64).trim() !== "") {
              const desc = c.description != null && String(c.description).trim() !== "" ? String(c.description).trim() : undefined;
              entry.clothes!.push({ imageBase64: String(c.imageBase64).trim(), mimeType: c.mimeType != null && String(c.mimeType).trim() !== "" ? String(c.mimeType).trim() : "image/jpeg", ...(desc ? { description: desc } : {}) });
            }
          }
        }
        if (item?.logo?.imageBase64 != null && String(item.logo.imageBase64).trim() !== "") {
          const desc = item.logo.description != null && String(item.logo.description).trim() !== "" ? String(item.logo.description).trim() : undefined;
          entry.logo = { imageBase64: String(item.logo.imageBase64).trim(), mimeType: item.logo.mimeType != null && String(item.logo.mimeType).trim() !== "" ? String(item.logo.mimeType).trim() : "image/jpeg", ...(desc ? { description: desc } : {}) };
        }
        if (item?.foot?.imageBase64 != null && String(item.foot.imageBase64).trim() !== "") {
          const desc = item.foot.description != null && String(item.foot.description).trim() !== "" ? String(item.foot.description).trim() : undefined;
          entry.foot = { imageBase64: String(item.foot.imageBase64).trim(), mimeType: item.foot.mimeType != null && String(item.foot.mimeType).trim() !== "" ? String(item.foot.mimeType).trim() : "image/jpeg", ...(desc ? { description: desc } : {}) };
        }
        if (Array.isArray(item?.accessories) && item.accessories.length > 0) {
          entry.accessories = [];
          for (const a of item.accessories) {
            if (a?.imageBase64 != null && String(a.imageBase64).trim() !== "") {
              const desc = a.description != null && String(a.description).trim() !== "" ? String(a.description).trim() : undefined;
              entry.accessories!.push({ imageBase64: String(a.imageBase64).trim(), mimeType: a.mimeType != null && String(a.mimeType).trim() !== "" ? String(a.mimeType).trim() : "image/jpeg", ...(desc ? { description: desc } : {}) });
            }
          }
        }
        characterStructuredReferences.push(entry);
      }
    }
    const characterTextParts: CharacterTextPartItem[] = [];
    const characterTextPartsRaw = body.characterTextParts;
    if (Array.isArray(characterTextPartsRaw) && characterTextPartsRaw.length > 0) {
      for (const item of characterTextPartsRaw) {
        characterTextParts.push({
          faceHair: item?.faceHair != null && String(item.faceHair).trim() !== "" ? String(item.faceHair).trim() : undefined,
          clothing: item?.clothing != null && String(item.clothing).trim() !== "" ? String(item.clothing).trim() : undefined,
          foot: item?.foot != null && String(item.foot).trim() !== "" ? String(item.foot).trim() : undefined,
          accessories: item?.accessories != null && String(item.accessories).trim() !== "" ? String(item.accessories).trim() : undefined,
        });
      }
    }

    if (!prompt) {
      return jsonResponse({ error: "Missing or empty prompt" }, 400);
    }

    const elementsText = body.elementsText != null ? String(body.elementsText).trim() : "";
    const layoutStyleText = body.layoutStyleText != null ? String(body.layoutStyleText).trim() : "";

    const { data: config, error: configError } = await supabaseAdmin
      .from("organization_script_ai_config")
      .select("google_ai_api_key, daily_limit, is_active")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (configError || !config) {
      return jsonResponse({ error: "Script AI config not found. Configure at Settings > Script AI Generator." }, 400);
    }

    if (!config.is_active) {
      return jsonResponse({ error: "Script AI is disabled. Enable it in Settings > Script AI Generator." }, 400);
    }

    const apiKey = (config.google_ai_api_key ?? "").trim();
    if (!apiKey) {
      return jsonResponse({ error: "Google AI API key not configured. Add it in Settings > Script AI Generator." }, 400);
    }

    const dailyLimit = Math.max(1, config.daily_limit ?? 50);
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

    const geminiUrl = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const generationConfigPrimary: Record<string, unknown> = {
      responseModalities: ["TEXT", "IMAGE"],
    };
    // aspectRatio will be set below after we compute effectiveAspectRatio and customSize

    const parts: unknown[] = [];
    if (referenceImageBase64 !== "") {
      parts.push({
        inlineData: {
          mimeType: referenceImageMimeType,
          data: referenceImageBase64,
        },
      });
    }
    for (const ref of characterReferences) {
      parts.push({
        inlineData: {
          mimeType: ref.mimeType,
          data: ref.imageBase64,
        },
      });
    }
    for (let i = 0; i < characterStructuredReferences.length; i++) {
      const n = i + 1;
      const struct = characterStructuredReferences[i];
      if (struct.head) {
        const headInstr = struct.head.description ? ` User instruction for this reference: ${struct.head.description}. Follow this instruction when drawing.\n\n` : "";
        parts.push({
          text:
            `MANDATORY — Character ${n} – Head. This image is the EXACT reference for this character's head. You MUST copy the hair from this image exactly: hair TEXTURE (curly, wavy, straight, kinky—if the reference shows curly hair, draw CURLY hair; if wavy, draw wavy; do NOT flatten to straight or swept-back), hair color, hair volume, hair shape, and hairstyle MUST match. Draw Character ${n} with this exact hair (and face if visible in the reference). If the reference shows only hair (e.g. isolated on white background), apply that exact hair texture and style to the character—do NOT replace with different hair from the design description. Do NOT add hats/caps that would hide this hair unless the reference itself shows headwear. Face/hair text in the design description must NOT override the reference: use it only when the reference shows obscured face (mask, helmet) or to refine skin; never use it to change hair texture or style.${headInstr}`,
        });
        parts.push({
          inlineData: { mimeType: struct.head.mimeType, data: struct.head.imageBase64 },
        });
      }
      if (struct.clothes && struct.clothes.length > 0) {
        for (let c = 0; c < struct.clothes.length; c++) {
          const slot = struct.clothes[c];
          const clothesInstr = slot.description ? ` User instruction for this reference: ${slot.description}. Follow this instruction when drawing.\n\n` : "";
          parts.push({
            text:
              `MANDATORY — Character ${n} – Clothes (${c === 0 ? "top/torso" : "bottom/legs"}). This image shows the EXACT garment the character MUST wear. You MUST draw Character ${n} wearing this exact item: same design, color, material, and style (e.g. armor, shirt, dress). Do NOT replace with other clothing from the design description. Copy this garment onto the character.${clothesInstr}`,
          });
          parts.push({
            inlineData: { mimeType: slot.mimeType, data: slot.imageBase64 },
          });
        }
      }
      if (struct.logo) {
        const logoInstr = struct.logo.description ? ` User instruction for this reference: ${struct.logo.description}. Follow this instruction when drawing.\n\n` : "";
        parts.push({
          text:
            `MANDATORY — Character ${n} – Logo on chest (ON THE CHARACTER'S CLOTHING ONLY). The following image is the EXACT logo that MUST appear ON Character ${n}'s BAU/shirt/jacket—on the CHEST area of the garment (left chest or right chest). This logo is PART OF THE CHARACTER'S OUTFIT. You MUST draw it ON the character's clothing. Do NOT put this logo in the design header, top of the image, center of the layout, or as a watermark. It must appear ONLY on the character's shirt/jacket/armor—nowhere else. Left chest or right chest only. You MUST use this exact logo image on the character's clothes; do not replace or omit it, and do not move it to the design/layout.${logoInstr}`,
        });
        parts.push({
          inlineData: { mimeType: struct.logo.mimeType, data: struct.logo.imageBase64 },
        });
      }
      if (struct.foot) {
        const footInstr = struct.foot.description ? ` User instruction for this reference: ${struct.foot.description}. Follow this instruction when drawing.\n\n` : "";
        parts.push({
          text:
            `MANDATORY — Character ${n} – Foot/shoes. This image shows the EXACT footwear the character MUST wear. You MUST draw Character ${n} wearing these exact shoes/boots. Do NOT replace with other footwear. Copy this footwear onto the character.${footInstr}`,
        });
        parts.push({
          inlineData: { mimeType: struct.foot.mimeType, data: struct.foot.imageBase64 },
        });
      }
      if (struct.accessories && struct.accessories.length > 0) {
        for (let a = 0; a < struct.accessories.length; a++) {
          const slot = struct.accessories[a];
          const accInstr = slot.description ? ` User instruction for this reference: ${slot.description}. Follow this instruction when drawing (e.g. how to wear, how to hold, or how to show the item).\n\n` : "";
          parts.push({
            text:
              `MANDATORY — Character ${n} – Accessories ${a + 1}. This image shows an EXACT accessory the character MUST wear or use (can be worn on body or held in hand). You MUST draw Character ${n} with this exact accessory (e.g. jewelry, glasses, hat, bag, prop). Do NOT replace with other accessories. Copy this accessory onto the character.${accInstr}`,
          });
          parts.push({
            inlineData: { mimeType: slot.mimeType, data: slot.imageBase64 },
          });
        }
      }
    }
    if (companyLogoBase64 !== "") {
      parts.push({
        inlineData: {
          mimeType: companyLogoMimeType,
          data: companyLogoBase64,
        },
      });
      parts.push({
        text:
          "The image above is the company logo that MUST appear in the generated design. " +
          "MANDATORY: (1) WHITE BACKGROUND (alas putih) — The company logo MUST sit on a WHITE background. Alas putih must be exactly 64×64 pixels — fixed size, same in every image. Keep internal padding minimal: little or no unnecessary space above or below the logo text inside the white base; the logo should fill the alas putih snugly so the white rectangle does not look too tall. " +
          "(2) CORNERS — The bottom-left and bottom-right corners of the alas putih must be slightly rounded (rounded corners); the top corners can stay sharp. " +
          "(3) LOGO SIZE — The logo sits inside the 64×64 px alas putih, with minimal top/bottom padding inside. Total block = 64 pixels, consistent in every image for carousel. " +
          "(4) POSITION — Place the logo at the TOP CENTER, flush with the top edge (nempel ke atas): horizontally centered, top of the alas putih touching the top edge of the frame with minimal or no gap. " +
          "Do NOT use any other logo or brand name from reference images; replace any existing logo with this one. " +
          "NOTE: If you were also given 'Character N – Logo on chest' images earlier, those are for the CHARACTER'S CLOTHING ONLY. Do not use those in the design header—keep them on the character's chest. This company logo is separate and goes in the design layout.\n\n",
      });
    }
    for (let i = 0; i < compositionReferences.length; i++) {
      const n = i + 1;
      parts.push({
        text:
          `Reference image ${n} (Gambar ke-${n}). Use this image when the user refers to 'gambar ke ${n}' or 'image ${n}':\n\n`,
      });
      const comp = compositionReferences[i];
      parts.push({
        inlineData: {
          mimeType: comp.mimeType,
          data: comp.imageBase64,
        },
      });
    }
    if (compositionReferences.length > 0) {
      const hasCharacterSelection = characterReferences.length > 0 || characterStructuredReferences.length > 0;
      const replaceCharRule =
        hasCharacterSelection
          ? "CRITICAL — REPLACE CHARACTER IN REFERENCE: The user has selected character(s) from the dropdown. You MUST REPLACE the person(s) shown in the composition reference images (Gambar ke-1, Gambar ke-2, Gambar ke-3, etc.) with the selected character(s). Do NOT keep or redraw the original person from those images. Draw the SELECTED character(s) — using the character reference images (face, hair, body, clothes) provided earlier — in the same position, pose, and setting as the person in the composition reference. The output must show the character chosen from the dropdown, not the original person in Gambar ke-N. Use the composition reference only for layout, pose, and scene; the face and body must be the selected character.\n\n"
          : "";
      // CRITICAL: When user asks to use a composition reference as the MAIN image (e.g. "ganti gambar utama dengan referensi gambar 1"), the main subject MUST come from that Gambar ke-N, not from the first/reference design image.
      const layoutLower = layoutStyleText.toLowerCase();
      const useRefAsMainMatch = layoutLower.match(/(?:ganti|replace|pakai|use)\s+(?:gambar\s+utama|main\s+image|gambar\s+utama)\s+(?:dengan|with)\s+(?:referensi\s+)?(?:gambar|image)\s*(\d+)/i)
        || layoutLower.match(/(?:referensi|reference)\s+(?:gambar|image)\s*(\d+)\s+sebagai\s+(?:gambar\s+utama|main)/i);
      const mainRefNum = useRefAsMainMatch ? Math.min(parseInt(useRefAsMainMatch[1], 10) || 1, compositionReferences.length) : 0;
      const compositionPriorityRule =
        mainRefNum >= 1
          ? `CRITICAL — COMPOSITION SECTION REQUEST: The user has requested that the MAIN image/subject be taken from Reference image ${mainRefNum} (Gambar ke-${mainRefNum}). You MUST use the CONTENT of Gambar ke-${mainRefNum} (the main product, drink, subject, or scene in that image) as the PRIMARY subject of the generated image. Do NOT use the first/reference design image as the main subject when the user has explicitly asked to use Gambar ke-${mainRefNum} instead. The main visual (e.g. the drink, product, or central element) in your output MUST match Gambar ke-${mainRefNum}. Follow this Composition section instruction exactly.\n\n`
          : layoutStyleText !== ""
            ? "CRITICAL — COMPOSITION SECTION: The user has provided instructions in the Composition section (text below). You MUST follow them. If the user asks to use a reference image (Gambar ke-N) as the main image or main subject, the MAIN subject of the generated image MUST be based on that referenced image, not on the first/reference design image. Do not ignore or override the Composition section.\n\n"
            : "";
      parts.push({
        text:
          replaceCharRule +
          compositionPriorityRule +
          "The images above are numbered composition/style references (Gambar ke-1, Gambar ke-2, etc.). Use them for composition (layout, arrangement, positioning) and visual style (mood, colors, look). " +
          (hasCharacterSelection
            ? "Remember: any person visible in those images must be REPLACED by the selected character(s) from the dropdown; do not copy the original person.\n\n"
            : "When the user specifies in the Composition section to use one of these as the main image (e.g. Gambar ke-1), that image's main subject MUST be the primary content of the output. Combine with the design description below.\n\n"),
      });
    }
    const customSize = parseCustomSize(body);
    // Aspect ratio is sent via generationConfig.imageConfig.aspectRatio (see below); prompt also enforces orientation and safe area.
    const numCharRefs = characterReferences.length;
    if (numCharRefs > 0) {
      const charLabels = Array.from({ length: numCharRefs }, (_, i) => `Character ${i + 1}`).join(", ");
      let charRulesText =
        `You have been given ${numCharRefs} character reference photo(s) in order (${charLabels}). ` +
        "Use each person's face and body for the corresponding character in the design description below.\n\n" +
        "MANDATORY CHARACTER RULES — follow exactly:\n" +
        "1) EXPRESSION: Use the exact facial expression specified (e.g. Sad = sorrowful, downcast, no smile; Happy = smiling, joyful; Angry = tense, frown; Neutral = calm, no strong emotion). Do NOT default to a happy or smiling expression unless the description says Happy or similar.\n" +
        "2) BODY POSE: If specified, the character's body must match (e.g. Sitting = seated; Standing = upright; Walking = mid-step; Running = in motion). If not specified, choose a natural pose.\n" +
        "3) HAND GESTURE: If specified, the character's hands/arms must match (e.g. Pointing up = arm raised; Arms crossed = arms folded; Waving = hand waving). If not specified, choose a natural gesture.\n" +
        "For characters where Expression, Body pose, or Hand gesture is not specified, you may choose a natural option. For any that IS specified, you MUST depict it clearly. Do not ignore or override the user's choices.\n\n";
      if (characterStructuredReferences.length > 0) {
        charRulesText +=
          "CRITICAL — STRUCTURED HEAD, CLOTHING, LOGO, FOOT, ACCESSORIES:\n" +
          "When 'Character N – Head' image is provided, the character's head and hair MUST match that reference exactly: hair TEXTURE (curly must stay curly, wavy stay wavy, straight stay straight—do not change to a different texture), hair style, color, volume, and shape. Do NOT replace or hide it with different hair or headwear from the design description. " +
          "The images labeled 'Character N – Clothes', 'Character N – Logo on chest', 'Character N – Foot', and 'Character N – Accessories' are REFERENCE PHOTOS of the exact garments, logo on chest, shoes, and accessories that character MUST wear or use in the generated image. " +
          "IMPORTANT: 'Character N – Logo on chest' means the logo goes ON THAT CHARACTER'S BAU (shirt/jacket)—on the chest of the garment. Do NOT put the Character N – Logo in the design header, top of image, or anywhere in the layout; it must appear ONLY on that character's clothing. " +
          "You MUST draw each character wearing the EXACT clothing (and if Logo is provided, draw that EXACT logo ON the character's CHEST area of the clothing—left chest or right chest, on the baju only), the EXACT footwear, and EXACT accessories shown in those reference images—same design, color, material, and style (e.g. if the reference shows armor, the character must wear that armor; if a logo is provided, that logo must appear on the chest of the outfit only, not in the design; if boots, those boots; if a hat or jewelry, that exact accessory). " +
          "Do NOT ignore these reference images. Do NOT substitute with generic items or with text descriptions. " +
          "The character's outfit (including logo on chest when provided), shoes, and accessories in the final image MUST match what is in the uploaded Clothes, Logo, Foot, and Accessories reference images. " +
          "HEAD: When Character N – Head image is provided, it is MANDATORY. Copy the hair from that image: same texture (curly/wavy/straight), style, color, volume, shape. If the reference has curly hair, the output MUST have curly hair—do not draw straight or swept-back hair instead. Use face/hair text only for obscured face (mask, helmet) or skin—never to override the reference hair.\n\n";
      }
      parts.push({ text: charRulesText });
    }
    const customSizePrefix =
      aspectRatio === "custom" && customSize
        ? (() => {
            const { width: w, height: h, unit } = customSize;
            const orientation =
              w > h
                ? "OUTPUT ORIENTATION: LANDSCAPE (horizontal). The image MUST be WIDER than it is TALL. Width is the longer side; the canvas is horizontal. Do NOT output a portrait or square image."
                : h > w
                  ? "OUTPUT ORIENTATION: PORTRAIT (vertical). The image MUST be TALLER than it is WIDE. Height is the longer side; the canvas is vertical. Do NOT output a landscape or square image."
                  : "OUTPUT ORIENTATION: SQUARE. Width equals height. The canvas must be square.";
            const isWideBanner = w > h && w / h >= 2;
            const safeAreaCustom =
              "COMPOSITION FOR CUSTOM SIZE: Keep ALL content (text, logos, people, objects, props, speech bubbles) INSIDE safe margins — at least 12–15% from the TOP, BOTTOM, LEFT, and RIGHT edges. Do NOT crop or cut off any part of a person (full head and body must be visible), any text, or any object. Leave breathing room on all four sides.\n\n";
            const wideBannerNote = isWideBanner
              ? "WIDE BANNER RULES: (1) ONE COHESIVE SCENE — do NOT create two separate panels (e.g. solid block left + different scene right with a hard cut). Use a single unified background or a smooth gradient/transition so the whole image feels like one design. (2) BALANCE — distribute content across the width: e.g. left area for text and products (with margin), center for connection or transition, right area for character and scene (with margin). Do NOT pack one side and crop the other. (3) FULL FIGURES — characters must be fully visible (full head, body, arms, held items) with margin from the frame; do NOT cut off heads or legs. (4) Logo and key elements should be placed deliberately (e.g. top center or clearly in one zone), not overlapping a seam between two disjointed areas.\n\n"
              : "";
            const cohesiveNote =
              !isWideBanner && w !== h
                ? "Create ONE unified composition — background and elements should flow together naturally, not look like separate blocks joined together.\n\n"
                : "";
            return `MANDATORY — CUSTOM SIZE: ${orientation}\n\nThe generated image MUST be exactly ${w} × ${h} ${unit} (width × height). Aspect ratio MUST be ${w}:${h}. Do NOT use any other dimensions or aspect ratio. ${safeAreaCustom}${wideBannerNote}${cohesiveNote}Compose the entire layout to fit this exact size; the output dimensions and orientation are non-negotiable. The output image MUST have exactly these dimensions. Do not approximate or use different dimensions.\n\n`;
          })()
        : "";
    const effectiveAspectRatio = aspectRatio === "custom" && !customSize ? "1:1" : aspectRatio;
    const orientationLabel =
      aspectRatio === "custom" && customSize
        ? customSize.width > customSize.height
          ? "LANDSCAPE"
          : customSize.height > customSize.width
            ? "PORTRAIT"
            : "SQUARE"
        : effectiveAspectRatio === "1:1"
          ? "SQUARE"
          : effectiveAspectRatio === "4:5" || effectiveAspectRatio === "9:16"
            ? "PORTRAIT"
            : effectiveAspectRatio === "16:9"
              ? "LANDSCAPE"
              : "SQUARE";
    const displayRatioForFirstPart =
      aspectRatio === "custom" && customSize
        ? `${customSize.width}:${customSize.height}`
        : effectiveAspectRatio;
    const aspectRatioWarning =
      "CRITICAL: You MUST output an image with EXACTLY the aspect ratio requested below. If you output a different aspect ratio (e.g. landscape when square or portrait was requested), the image will be cropped and text, logos, and people will be cut off. Always generate at the exact requested aspect ratio.\n\n";
    const fillCanvasRule =
      "FILL THE FRAME: The design MUST extend to ALL FOUR EDGES of the image. Do NOT leave white, empty, or blank borders or margins around the design. The background or content must reach every edge of the canvas. No letterboxing, no centering the design in a larger empty canvas.\n\n";
    const safeAreaRule =
      "SAFE AREA (CRITICAL): Imagine the output at the EXACT aspect ratio requested. Keep ALL important content INSIDE safe margins — at least 8–10% from the top, bottom, left, and right edges. Do NOT place any text, logos, faces, or key body parts (hands, arms, shoulders) on or past the frame boundary. Background and non-essential fill can go to the edges; headlines, taglines, logos, and people must stay fully visible within the frame. This prevents cropping when the image is displayed at the requested aspect ratio.\n\n";
    const portraitNoLandscapeRule =
      orientationLabel === "PORTRAIT" && (effectiveAspectRatio === "9:16" || effectiveAspectRatio === "4:5")
        ? "CRITICAL — PORTRAIT FRAME FILL: The output is a TALL portrait (height much greater than width). You MUST use the FULL HEIGHT of the canvas. Do NOT create a landscape or horizontal band and place it inside the portrait frame. Do NOT draw a wide horizontal layout that leaves empty space above and below. The ENTIRE image must be composed vertically: content must extend from the top third through the middle third to the bottom third. No empty bands at top or bottom. The result must BE a portrait design that fills the frame, not a landscape design on a portrait canvas.\n\n"
        : "";
    const squareNoLandscapeRule =
      orientationLabel === "SQUARE"
        ? "CRITICAL — SQUARE FRAME: The output MUST be SQUARE (1:1). Do NOT create a landscape or portrait layout and place it inside a square frame. Compose the design to FILL THE SQUARE — use the full width and full height. No wide horizontal band with empty space above/below; no tall vertical band with empty space on the sides. Content must be arranged for a square canvas.\n\n"
        : "";
    const outputFormatFirstPart =
      orientationLabel === "PORTRAIT"
        ? `${aspectRatioWarning}OUTPUT FORMAT (MANDATORY): Aspect ratio ${displayRatioForFirstPart}. Orientation: PORTRAIT. ${fillCanvasRule}${safeAreaRule}${portraitNoLandscapeRule}Compose the SCENE vertically (top-to-bottom layout). Do NOT use a horizontal banner layout. Do NOT put a landscape composition inside a portrait frame. The generated image MUST have this exact aspect ratio and MUST fill the full height.\n\n`
        : orientationLabel === "LANDSCAPE"
          ? `${aspectRatioWarning}OUTPUT FORMAT (MANDATORY): Aspect ratio ${displayRatioForFirstPart}. Orientation: LANDSCAPE. ${fillCanvasRule}${safeAreaRule}Compose the SCENE horizontally (left-to-right layout). The generated image MUST have this exact aspect ratio.\n\n`
          : `${aspectRatioWarning}OUTPUT FORMAT (MANDATORY): Aspect ratio ${displayRatioForFirstPart}. Orientation: SQUARE. ${fillCanvasRule}${safeAreaRule}${squareNoLandscapeRule}The generated image MUST be exactly square (same width and height). Do NOT output landscape or portrait. Compose to fill the square frame.\n\n`;
    const isCustomSize = aspectRatio === "custom" && customSize !== null;
    const customCompositionRule =
      isCustomSize
        ? "CUSTOM SIZE COMPOSITION (CRITICAL): (1) ONE SCENE — The whole image must be ONE cohesive design, not two or more disjointed panels. Background, text, and characters must belong to the same continuous scene with a unified or smoothly transitioning background. (2) SAFE MARGINS — Every element (text, logo, people, objects, props, speech bubbles) must sit at least 12–15% inside the top, bottom, left, and right edges. No cropping of heads, bodies, or text. (3) BALANCED LAYOUT — Distribute content across the canvas so neither side is overcrowded or cropped. Leave space on all sides. (4) FULL FIGURES — People must be fully visible (full head and body in frame) with room to spare; do not cut off at the chin, waist, or edges.\n\n"
        : "";
    const compositionRuleForOrientation =
      orientationLabel === "PORTRAIT"
        ? "COMPOSITION RULE (CRITICAL — PORTRAIT): You MUST compose the scene for a TALL, VERTICAL layout at the requested aspect ratio. FILL THE ENTIRE FRAME from top to bottom — use the UPPER third, MIDDLE third, and LOWER third with real content; no empty vertical bands. Keep ALL text, logos, and people INSIDE safe margins (at least 8–10% from each edge) so nothing is cut off. Structure: (1) Logo and headline in the UPPER third, well inside the top and side edges, (2) Main visual (characters, product, phone) in the MIDDLE third — full bodies and arms visible, (3) Call-to-action or supporting content in the LOWER third, inset from the bottom. FORBIDDEN: Do NOT draw a landscape or horizontal band and place it in the center of a tall frame. Do NOT leave large empty space at top or bottom. The output must be a single portrait image that uses the full height, not a wide design sitting in the middle of a portrait canvas.\n\n"
        : orientationLabel === "LANDSCAPE"
          ? "COMPOSITION RULE (CRITICAL): The CONTENT and LAYOUT must be designed for a HORIZONTAL (landscape) format at the requested aspect ratio. FILL THE FRAME with background edge to edge; keep ALL text, logos, people, objects, and props INSIDE safe margins (at least 10% from top, bottom, left, right) so nothing is cut off. Arrange elements from LEFT TO RIGHT; do not crop arms, shoulders, objects, or text at the edges. Speech bubbles, held items, and background elements must be fully visible within the frame. Do NOT create a vertical composition that leaves empty bands on the sides.\n\n"
          : orientationLabel === "SQUARE"
            ? "COMPOSITION RULE (CRITICAL — SQUARE): The CONTENT and LAYOUT must be designed for a SQUARE (1:1) format. FILL THE ENTIRE SQUARE — use both width and height; do NOT draw a landscape or portrait composition inside a square frame. Keep ALL text, logos, and people INSIDE safe margins (at least 10% from top, bottom, left, right) so nothing is cut off. Do NOT place headlines, taglines, or character limbs at the very edge; no cropped text or body parts. The output must BE a square design that fills the frame, not a wide or tall design placed on a square canvas.\n\n"
            : "";
    const aspectRatioMandatoryPrefix =
      aspectRatio === "custom" && customSize
        ? ""
        : effectiveAspectRatio === "1:1"
          ? "MANDATORY — OUTPUT ASPECT RATIO: 1:1. OUTPUT ORIENTATION: SQUARE. The canvas is SQUARE (width = height). You MUST output a SQUARE image that FILLS THE FRAME. Do NOT output a landscape or portrait image. Do NOT draw a wide horizontal or tall vertical layout and place it in a square — compose for the square so content uses the full area with safe margins (10% from each edge). This aspect ratio is non-negotiable.\n\n"
          : effectiveAspectRatio === "4:5" || effectiveAspectRatio === "9:16"
            ? `MANDATORY — OUTPUT ASPECT RATIO: ${effectiveAspectRatio}. OUTPUT ORIENTATION: PORTRAIT. The canvas is TALL (height > width). You MUST output a PORTRAIT image that FILLS THE FULL HEIGHT. Do NOT output a landscape or square image. Do NOT create a wide horizontal design and place it inside a portrait frame — the design must USE the full vertical space (top, middle, and bottom). No empty bands at top or bottom. This aspect ratio is non-negotiable.\n\n`
            : effectiveAspectRatio === "16:9"
              ? "MANDATORY — OUTPUT ASPECT RATIO: 16:9. OUTPUT ORIENTATION: LANDSCAPE. The canvas MUST be WIDER than it is TALL. You MUST output a LANDSCAPE image only — not portrait, not square. The final image MUST have width greater than height. Do NOT output a portrait or square image. This aspect ratio is non-negotiable.\n\n"
              : "";
    const characterInstruction =
      numCharRefs > 0
        ? referenceImageBase64 !== ""
          ? `The first attached image is the design reference. The next ${numCharRefs} image(s) are character references.${characterStructuredReferences.length > 0 ? " REMINDER: Character N – Head, Clothes, Logo on chest, Foot, and Accessories images above are MANDATORY. Character N – Logo must be placed ON THE CHARACTER'S BAU (shirt/jacket chest only)—NOT in the design header or layout. For Head: copy the hair from the reference exactly—same texture (if reference has curly hair, draw curly hair; do not draw straight or swept-back). Draw the exact outfit with logo on the character's clothes, and exact shoes and accessories; do not replace with other items from the design description." : ""}\n\nIMPORTANT: In the design description below, each character has optional fields: Expression, Body pose, Hand gesture. Whatever is specified MUST be drawn exactly—e.g. Expression: Sad means that character must look sad (sorrowful face, no smile); Body pose: Sitting means that character must be seated; Hand gesture: Pointing up means that character's hand/arm must be pointing upward. Do not substitute a generic happy pose when the user chose a different expression or gesture.\n\n${companyLogoBase64 !== "" ? "Use the provided company logo in the design; do not use any logo from the reference image.\n\n" : ""}Design description:\n\n`
          : `The attached image(s) are character references in order.${characterStructuredReferences.length > 0 ? " REMINDER: Character N – Head, Clothes, Logo on chest, Foot, and Accessories images above are MANDATORY. Character N – Logo must be placed ON THE CHARACTER'S BAU (shirt/jacket chest only)—NOT in the design header or layout. For Head: copy the hair from the reference exactly—same texture (if reference has curly hair, draw curly hair; do not draw straight or swept-back). Draw the exact outfit with logo on the character's clothes, and exact shoes and accessories; do not replace with other items from the design description." : ""}\n\nIMPORTANT: In the design description below, each character has optional fields: Expression, Body pose, Hand gesture. Whatever is specified MUST be drawn exactly—e.g. Expression: Sad means that character must look sad (sorrowful face, no smile); Body pose: Sitting means that character must be seated; Hand gesture: Pointing up means that character's hand/arm must be pointing upward. Do not substitute a generic happy pose when the user chose a different expression or gesture.\n\n${companyLogoBase64 !== "" ? "Use the provided company logo in the design.\n\n" : ""}Design description:\n\n`
        : `${companyLogoBase64 !== "" ? "Use the provided company logo visibly in the design, always on a white background (alas warna putih)." : ""}\n\n`;

    const userEditableSectionsRule =
      prompt.length > 0 || elementsText !== "" || layoutStyleText !== ""
        ? "USER-EDITABLE SECTIONS (use these, not the original): The design description below (Font, Elements, Composition, Headlines & text) comes from the user-editable text areas. You MUST follow Font, Elements, and Composition exactly as written. All headline, sub headline, and body text must be rendered SHARP and CRISP — no blur effect, no soft focus, no glow — clearly readable and matching the Font description.\n\n"
        : "";
    if (elementsText !== "") {
      parts.push({
        text:
          "MANDATORY ELEMENTS (from user-editable text area — apply exactly): The following elements MUST appear in the generated image exactly as specified. Do not omit, replace, or generalize. Include every element listed:\n\n" +
          elementsText +
          "\n\n",
      });
    }
    if (layoutStyleText !== "") {
      const layoutPrefix =
        orientationLabel === "PORTRAIT"
          ? "IMPORTANT: This image is PORTRAIT (vertical). Use the FULL HEIGHT of the frame — no empty bands at top or bottom. Interpret the composition below as a VERTICAL layout: if it describes elements side-by-side or horizontal, arrange them TOP TO BOTTOM instead. Do NOT draw a single horizontal band in the center; distribute content from top to bottom so the portrait frame is filled.\n\n"
          : isCustomSize
            ? "IMPORTANT: Custom dimensions — create ONE unified frame/image. The composition below must be realized as a single cohesive scene (unified or smoothly transitioning background), not as two separate panels side by side. Balance left and right; keep all elements inside safe margins.\n\n"
            : "";
      parts.push({
        text:
          "MANDATORY COMPOSITION — DO NOT IGNORE (from Composition Section): The user's instructions below define what must appear in the generated image. You MUST follow them exactly. " +
          "If the user asks to use a reference image (e.g. 'ganti gambar utama dengan referensi gambar 1' or 'replace main image with reference image 1'), the MAIN subject of the output MUST be taken from that Gambar ke-N — not from the first/reference design image. " +
          "Everything described below defines the composition to be created in a single frame/image. " +
          layoutPrefix +
          "The composition, arrangement, and layout of the generated image MUST follow this description precisely:\n\n" +
          layoutStyleText +
          "\n\n",
      });
    }
    const characterTextBlock =
      characterTextParts.length > 0
        ? characterTextParts
            .map((p, i) => {
              const n = i + 1;
              const lines: string[] = [];
              if (p.faceHair) lines.push(`Character ${n} – Face/hair: ${p.faceHair}`);
              if (p.clothing) lines.push(`Character ${n} – Clothing: ${p.clothing}`);
              if (p.foot) lines.push(`Character ${n} – Foot/shoes: ${p.foot}`);
              if (p.accessories) lines.push(`Character ${n} – Accessories: ${p.accessories}`);
              return lines.join("\n");
            })
            .filter((s) => s.length > 0)
            .join("\n\n")
        : "";
    const portraitPromptWrap =
      orientationLabel === "PORTRAIT" && prompt.length > 0
        ? "LAYOUT CONSTRAINT: Compose the following design in a VERTICAL (portrait) arrangement that FILLS THE FULL HEIGHT. Stack elements from top to bottom; do not place main elements in one horizontal row. Use upper, middle, and lower parts of the frame — no large empty areas at top or bottom.\n\n"
        : "";
    const promptFinal = characterTextBlock ? characterTextBlock + "\n\n" + portraitPromptWrap + prompt : (portraitPromptWrap + prompt);
    const aspectRatioReminder =
      orientationLabel === "PORTRAIT"
        ? `\n\nREMINDER: Output aspect ratio must be exactly ${displayRatioForFirstPart}. PORTRAIT — fill the FULL HEIGHT from top to bottom. Do NOT put a landscape or horizontal band inside the portrait frame. Do NOT leave empty space at top or bottom. Keep all text, logos, and people inside safe margins (8–10% from edges) so nothing is cut off.`
        : isCustomSize
          ? `\n\nREMINDER: Output must be exactly ${displayRatioForFirstPart} (custom size). ONE cohesive scene — no disjointed panels. Keep ALL elements inside safe margins (12–15% from all edges). Full figures and full text visible; no cropping. Balanced layout left and right.`
          : `\n\nREMINDER: Output aspect ratio must be exactly ${displayRatioForFirstPart}. Output orientation: ${orientationLabel}. Keep all text, logos, and people inside safe margins (8–10% from edges) so nothing is cut off.`;
    parts.push({
      text:
        (customSizePrefix || aspectRatioMandatoryPrefix) +
        verbatimTextBlock +
        customCompositionRule +
        compositionRuleForOrientation +
        characterInstruction +
        userEditableSectionsRule +
        promptFinal +
        aspectRatioReminder,
    });
    parts.unshift({ text: outputFormatFirstPart });

    // Enforce aspect ratio via API when supported (gemini-2.5-flash-image, gemini-3.x image models use generationConfig.imageConfig.aspectRatio).
    const geminiAspectRatioValue =
      aspectRatio === "custom" && customSize
        ? customSizeToAspectRatio(customSize.width, customSize.height)
        : effectiveAspectRatio;
    (generationConfigPrimary as Record<string, unknown>).imageConfig = {
      aspectRatio: geminiAspectRatioValue,
    };

    // Try fallback first to avoid 503 from primary when under high demand.
    const modelsToTry = [IMAGE_MODEL_FALLBACK, IMAGE_MODEL_PRIMARY];
    let lastErrorMsg = "Image generation failed";
    let geminiRes: Response | null = null;

    for (const model of modelsToTry) {
      let configToUse: Record<string, unknown> = generationConfigPrimary;
      geminiRes = await fetch(geminiUrl(model), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: configToUse,
        }),
      });
      if (geminiRes.ok) break;
      const errText = await geminiRes.text();
      console.error(`Gemini API error (${model}):`, geminiRes.status, errText);
      let errMsg = "Image generation failed";
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message ?? errMsg;
      } catch {
        // use default
      }
      lastErrorMsg = errMsg;
      // If 400 and error mentions imageConfig/aspectRatio, retry same model without imageConfig
      if (
        geminiRes.status === 400 &&
        (errText.includes("aspectRatio") || errText.includes("imageConfig") || errText.includes("Unknown name"))
      ) {
        const { imageConfig: _removed, ...configWithoutImage } = generationConfigPrimary as Record<string, unknown>;
        configToUse = configWithoutImage as Record<string, unknown>;
        geminiRes = await fetch(geminiUrl(model), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: configToUse,
          }),
        });
        if (geminiRes.ok) break;
        const retryErrText = await geminiRes.text();
        console.error(`Gemini API retry without imageConfig (${model}):`, geminiRes.status, retryErrText);
        try {
          const retryJson = JSON.parse(retryErrText);
          lastErrorMsg = retryJson.error?.message ?? lastErrorMsg;
        } catch {
          // keep lastErrorMsg
        }
      }
      // 404 = model not found; 503 = high demand/unavailable; 429 = rate limit — try fallback model
      if (geminiRes.status === 404 || geminiRes.status === 503 || geminiRes.status === 429) continue;
      return jsonResponse({ error: lastErrorMsg }, 500);
    }

    if (!geminiRes || !geminiRes.ok) {
      return jsonResponse({ error: lastErrorMsg }, 500);
    }

    let geminiData: unknown;
    try {
      geminiData = await geminiRes.json();
    } catch (parseErr) {
      console.error("Gemini response parse error:", parseErr);
      return jsonResponse({ error: "Invalid response from image API" }, 500);
    }

    const responseParts = (geminiData as { candidates?: Array<{ content?: { parts?: unknown[] } }> })?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(responseParts)) {
      return jsonResponse({ error: "No content generated from AI" }, 500);
    }

    let imageBase64: string | null = null;
    let mimeType = "image/png";
    for (const part of responseParts) {
      const p = part as { inlineData?: { data?: unknown; mimeType?: string }; inline_data?: { data?: unknown; mime_type?: string } };
      const inline = p?.inlineData ?? p?.inline_data;
      if (inline?.data) {
        imageBase64 = typeof inline.data === "string" ? inline.data : null;
        const m = inline as { mimeType?: string; mime_type?: string };
        if (m.mimeType) mimeType = String(m.mimeType);
        else if (m.mime_type) mimeType = String(m.mime_type);
        break;
      }
    }

    if (!imageBase64) {
      return jsonResponse({ error: "AI did not return an image" }, 500);
    }

    // Aspect ratio is enforced on the client (fitDataUrlToAspectRatio) — Sharp is not available in Supabase Deno edge.

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

    return jsonResponse({ imageBase64, mimeType }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("generate-design-image error:", message, stack || err);
    return jsonResponse(
      { error: message || "Image generation failed. Try fewer or smaller reference images." },
      500
    );
  }
});
