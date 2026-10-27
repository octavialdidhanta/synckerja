import { buildLocationImagePrompt, buildPropertyImagePrompt, type LocationImageBrief } from "@/6-1-dashboard/modal/locationImagePrompt";
import { GeminiSpendCapError, presentGeminiSpendCap, readEdgeFunctionError } from "@/shared/ai/geminiSpendCap";
import { supabase } from "@/shared/lib/supabaseClient";
import { storageUploadOptions } from "@/shared/lib/storageCacheControl";
import {
  buildCharacterPortraitPrompt,
  buildCharacterSheetPrompt,
  characterDisplayName,
  characterStorageKey,
  characterVisualPath,
} from "@/thinking-lab/execution/characterSheet";
import { withCharacterVisuals, type VoiceOverScript } from "@/thinking-lab/execution/script";

const BUCKET = "digital-asset-character-images";

export type CharacterGeneratePhase = "portrait" | "sheet";

export class CharacterSheetError extends Error {
  readonly script: VoiceOverScript;

  constructor(script: VoiceOverScript, message: string) {
    super(message);
    this.name = "CharacterSheetError";
    this.script = script;
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes.buffer], { type: mimeType || "image/png" });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

async function compressForReference(base64: string, mimeType: string): Promise<{ base64: string; mimeType: string }> {
  const blob = base64ToBlob(base64, mimeType);
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, 1));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return { base64, mimeType };
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return { base64: dataUrl.replace(/^data:image\/\w+;base64,/, ""), mimeType: "image/jpeg" };
}

export async function readStoredCharacterVisual(path: string): Promise<{ base64: string; mimeType: string } | null> {
  return loadStoredPortrait(path);
}

async function loadStoredPortrait(path: string): Promise<{ base64: string; mimeType: string } | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.length === 0) return null;
  return { base64: bytesToBase64(bytes), mimeType: data.type || "image/jpeg" };
}

type DesignAspect = "1:1" | "4:5" | "9:16" | "16:9";

async function generateDesignImage(
  prompt: string,
  aspectRatio: DesignAspect,
  reference?: { imageBase64: string; mimeType: string },
  audit?: { planId: string; action: string; target: string },
): Promise<{ base64: string; mimeType: string }> {
  const { data: refreshed } = await supabase.auth.refreshSession();
  const session = refreshed.session ?? (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) throw new Error("AUTH");
  const body: Record<string, unknown> = { prompt, aspectRatio };
  if (audit?.planId) {
    body.planId = audit.planId;
    body.usageAction = audit.action;
    body.usageTarget = audit.target;
  }
  if (reference) {
    body.identitySheet = true;
    body.referenceImageBase64 = reference.imageBase64;
    body.referenceImageMimeType = reference.mimeType;
    body.characterStructuredReferences = [
      {
        head: {
          imageBase64: reference.imageBase64,
          mimeType: reference.mimeType,
          description:
            "Copy this exact photographed person. Same face, hair, age, skin, and clothes. Do not cast a different model. Stay photographic.",
        },
      },
    ];
    body.characterTextParts = [
      {
        faceHair: "Match the Character 1 Head photograph exactly. Same face and hair. A real photo, not a drawing.",
        clothing: "Wear exactly the clothes visible in the Character 1 Head photograph. Do not change the shirt.",
      },
    ];
  }
  const { data, error } = await supabase.functions.invoke("generate-design-image", {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
    timeout: 180000,
  });
  if (data?.error || error) {
    const message = await readEdgeFunctionError(data, error);
    if (presentGeminiSpendCap(message)) throw new GeminiSpendCapError(message);
    throw new Error(message || "EMPTY");
  }
  const base64 = data?.imageBase64;
  if (!base64 || typeof base64 !== "string") throw new Error("EMPTY");
  return { base64, mimeType: typeof data?.mimeType === "string" ? data.mimeType : "image/png" };
}

export async function imageFileToStoredBlob(file: Blob): Promise<{ blob: Blob; mimeType: string }> {
  const type = file.type.toLowerCase();
  if (type === "image/png") return { blob: file, mimeType: "image/png" };
  if (type === "image/jpeg" || type === "image/jpg") return { blob: file, mimeType: "image/jpeg" };
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("IMAGE");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("IMAGE");
  return { blob, mimeType: "image/jpeg" };
}

export async function storeCharacterVisual(input: {
  organizationId: string;
  executionId: string;
  handle: string;
  kind: "portrait" | "body";
  file: Blob;
  previousPath?: string;
}): Promise<string> {
  const stored = await imageFileToStoredBlob(input.file);
  const ext = stored.mimeType === "image/png" ? "png" : "jpg";
  const path = characterVisualPath(input.organizationId, input.executionId, input.handle, input.kind, ext);
  const { error } = await supabase.storage.from(BUCKET).upload(path, stored.blob, {
    ...storageUploadOptions({
      upsert: true,
      contentType: stored.mimeType,
    }),
    cacheControl: "0",
  });
  if (error) throw error;
  if (input.previousPath && input.previousPath !== path) {
    await supabase.storage.from(BUCKET).remove([input.previousPath]);
  }
  return path;
}

export async function storeBriefCharacterVisual(input: {
  organizationId: string;
  planId: string;
  handle: string;
  kind: "portrait" | "body";
  file: Blob;
  previousPath?: string;
}): Promise<string> {
  const stored = await imageFileToStoredBlob(input.file);
  const ext = stored.mimeType === "image/png" ? "png" : "jpg";
  const path = `${input.organizationId}/brief/${input.planId}/${characterStorageKey(input.handle)}-${input.kind}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, stored.blob, {
    ...storageUploadOptions({
      upsert: true,
      contentType: stored.mimeType,
    }),
    cacheControl: "0",
  });
  if (error) throw error;
  if (input.previousPath && input.previousPath !== path && input.previousPath.includes("/brief/")) {
    await supabase.storage.from(BUCKET).remove([input.previousPath]);
  }
  return path;
}

export async function copyStoredCharacterVisual(input: {
  organizationId: string;
  executionId: string;
  handle: string;
  kind: "portrait" | "body";
  sourcePath: string;
  previousPath?: string;
}): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(input.sourcePath);
  if (error || !data) throw error ?? new Error("EMPTY");
  return storeCharacterVisual({ ...input, file: data });
}

async function uploadVisual(path: string, base64: string, mimeType: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, base64ToBlob(base64, mimeType), {
    ...storageUploadOptions({
      upsert: true,
      contentType: mimeType || "image/png",
    }),
    cacheControl: "0",
  });
  if (error) throw error;
}

export async function generateCharacterVisuals(input: {
  organizationId: string;
  executionId: string;
  script: VoiceOverScript;
  handle: string;
  onPhase?: (phase: CharacterGeneratePhase) => void;
}): Promise<VoiceOverScript> {
  const character = input.script.assets.characters.find((item) => item.handle === input.handle);
  if (!character) throw new Error("MISSING");
  const name = characterDisplayName(character.handle);
  let portrait = character.portraitPath ? await loadStoredPortrait(character.portraitPath) : null;
  let portraitPath = character.portraitPath;
  if (!portrait || !portraitPath) {
    input.onPhase?.("portrait");
    portrait = await generateDesignImage(
      buildCharacterPortraitPrompt(name, character.description, input.script.look),
      "4:5",
    );
    const portraitExt = portrait.mimeType.includes("jpeg") || portrait.mimeType.includes("jpg") ? "jpg" : "png";
    portraitPath = characterVisualPath(input.organizationId, input.executionId, character.handle, "portrait", portraitExt);
    await uploadVisual(portraitPath, portrait.base64, portrait.mimeType);
  }
  const withPortrait = withCharacterVisuals(input.script, character.handle, {
    portraitPath,
    sheetPath: character.sheetPath,
  });
  input.onPhase?.("sheet");
  try {
    const reference = await compressForReference(portrait.base64, portrait.mimeType);
    const sheet = await generateDesignImage(
      buildCharacterSheetPrompt(name, character.description, input.script.look),
      "16:9",
      reference,
    );
    const sheetExt = sheet.mimeType.includes("jpeg") || sheet.mimeType.includes("jpg") ? "jpg" : "png";
    const sheetPath = characterVisualPath(input.organizationId, input.executionId, character.handle, "sheet", sheetExt);
    await uploadVisual(sheetPath, sheet.base64, sheet.mimeType);
    return withCharacterVisuals(withPortrait, character.handle, { portraitPath, sheetPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SHEET";
    throw new CharacterSheetError(withPortrait, message);
  }
}

export async function loadLinkedIdeaStatement(organizationId: string, planTitle: string, handle: string): Promise<string> {
  const title = planTitle.trim();
  let ideaId = "";
  if (title) {
    const titled = await supabase
      .from("thinking_lab_executions")
      .select("idea_id")
      .eq("organization_id", organizationId)
      .filter("script->>title", "eq", title)
      .limit(1);
    ideaId = typeof titled.data?.[0]?.idea_id === "string" ? titled.data[0].idea_id : "";
  }
  if (!ideaId) {
    const recent = await supabase
      .from("thinking_lab_executions")
      .select("idea_id, script")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(40);
    const match = (recent.data ?? []).find((row) => {
      const assets = (row.script as { assets?: Record<string, Array<{ handle?: string }>> } | null)?.assets;
      if (!assets) return false;
      return ["locations", "characters", "properties"].some((key) => assets[key]?.some((item) => item.handle === handle));
    });
    ideaId = typeof match?.idea_id === "string" ? match.idea_id : "";
  }
  if (!ideaId) return "";
  const idea = await supabase
    .from("thinking_lab_ideas")
    .select("statement")
    .eq("id", ideaId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return typeof idea.data?.statement === "string" ? idea.data.statement.trim() : "";
}

async function storeBriefAssetVisual(input: {
  organizationId: string;
  planId: string;
  handle: string;
  kind: "location" | "property";
  file: Blob;
  previousPath?: string;
}): Promise<string> {
  const stored = await imageFileToStoredBlob(input.file);
  const ext = stored.mimeType === "image/png" ? "png" : "jpg";
  const path = `${input.organizationId}/brief/${input.planId}/${characterStorageKey(input.handle)}-${input.kind}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, stored.blob, {
    ...storageUploadOptions({
      upsert: true,
      contentType: stored.mimeType,
    }),
    cacheControl: "0",
  });
  if (error) throw error;
  if (input.previousPath && input.previousPath !== path && input.previousPath.includes("/brief/")) {
    await supabase.storage.from(BUCKET).remove([input.previousPath]);
  }
  return path;
}

export async function storeBriefLocationVisual(input: {
  organizationId: string;
  planId: string;
  handle: string;
  file: Blob;
  previousPath?: string;
}): Promise<string> {
  return storeBriefAssetVisual({ ...input, kind: "location" });
}

export async function storeBriefPropertyVisual(input: {
  organizationId: string;
  planId: string;
  handle: string;
  file: Blob;
  previousPath?: string;
}): Promise<string> {
  return storeBriefAssetVisual({ ...input, kind: "property" });
}

export async function generateBriefLocationVisual(input: {
  organizationId: string;
  planId: string;
  handle: string;
  description: string;
  aspect: DesignAspect;
  previousPath?: string;
  title?: string;
  caption?: string;
  storyboard?: string;
  concept?: LocationImageBrief["concept"];
  look?: string;
}): Promise<string> {
  let idea = "";
  try {
    idea = await loadLinkedIdeaStatement(input.organizationId, input.title ?? "", input.handle);
  } catch {
    idea = "";
  }
  const prompt = buildLocationImagePrompt({
    handle: input.handle,
    description: input.description,
    aspect: input.aspect,
    title: input.title ?? "",
    caption: input.caption ?? "",
    idea,
    storyboard: input.storyboard ?? "",
    concept: input.concept ?? { locations: [], characters: [], properties: [] },
    look: input.look,
  });
  const image = await generateDesignImage(prompt, input.aspect, undefined, {
    planId: input.planId,
    action: "generate_location",
    target: input.handle,
  });
  return storeBriefLocationVisual({ ...input, file: base64ToBlob(image.base64, image.mimeType) });
}

export async function generateBriefPropertyVisual(input: {
  organizationId: string;
  planId: string;
  handle: string;
  description: string;
  aspect: DesignAspect;
  previousPath?: string;
  title?: string;
  caption?: string;
  storyboard?: string;
  concept?: LocationImageBrief["concept"];
  look?: string;
}): Promise<string> {
  let idea = "";
  try {
    idea = await loadLinkedIdeaStatement(input.organizationId, input.title ?? "", input.handle);
  } catch {
    idea = "";
  }
  const prompt = buildPropertyImagePrompt({
    handle: input.handle,
    description: input.description,
    aspect: input.aspect,
    title: input.title ?? "",
    caption: input.caption ?? "",
    idea,
    storyboard: input.storyboard ?? "",
    concept: input.concept ?? { locations: [], characters: [], properties: [] },
    look: input.look,
  });
  const image = await generateDesignImage(prompt, input.aspect, undefined, {
    planId: input.planId,
    action: "generate_property",
    target: input.handle,
  });
  return storeBriefPropertyVisual({ ...input, file: base64ToBlob(image.base64, image.mimeType) });
}

export async function removeCharacterVisual(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function characterVisualUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}
