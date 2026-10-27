import { parseMarkdownTable } from "@/6-1-dashboard/utils/markdownTableUtils";
import type { BriefConceptDocument } from "@/6-1-dashboard/modal/briefConceptAssets";
import { lookStylePromptBlock, readLook } from "@/6-1-dashboard/lib/seedanceVideo";

export type LocationImageBrief = {
  handle: string;
  description: string;
  aspect: string;
  title: string;
  caption: string;
  idea: string;
  storyboard: string;
  concept: BriefConceptDocument;
  /** Video Settings / Master Prompt Look. When empty, read from the storyboard Master prompt column. */
  look?: string;
};

/** Look written on any Master prompt cell in the storyboard table. */
export function lookFromBriefStoryboard(storyboard: string): string {
  const parsed = parseMarkdownTable(storyboard);
  if (!parsed || parsed.table.length < 2) return readLook(storyboard);
  const headers = parsed.table[0] ?? [];
  const masterIdx = headers.findIndex((header) => header.trim().toLowerCase() === "master prompt");
  if (masterIdx < 0) return readLook(storyboard);
  for (const row of parsed.table.slice(1)) {
    const look = readLook(String(row[masterIdx] ?? ""));
    if (look) return look;
  }
  return "";
}

function resolvedLook(input: Pick<LocationImageBrief, "look" | "storyboard">): string {
  const explicit = input.look?.trim() ?? "";
  if (explicit) return explicit;
  return lookFromBriefStoryboard(input.storyboard);
}

function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function columnIndex(headers: string[], test: (header: string) => boolean): number {
  return headers.findIndex((header) => test(header.toLowerCase()));
}

function storyboardNotes(storyboard: string, handle: string): { shots: string[]; narration: string } {
  const parsed = parseMarkdownTable(storyboard);
  if (!parsed || parsed.table.length < 2) {
    const mentioned = storyboard
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes(handle))
      .slice(0, 6)
      .map((line) => clip(line, 240));
    return { shots: mentioned, narration: clip(storyboard, 700) };
  }
  const headers = parsed.table[0] ?? [];
  const voice = columnIndex(headers, (header) => header.includes("voice"));
  const job = columnIndex(headers, (header) => header.includes("visual function"));
  const prompt = columnIndex(headers, (header) => header.includes("prompt"));
  const shot = columnIndex(headers, (header) => header === "shot" || header.startsWith("shot"));
  const shots: string[] = [];
  const spoken: string[] = [];
  for (const row of parsed.table.slice(1)) {
    const narration = voice >= 0 ? row[voice]?.trim() ?? "" : "";
    if (narration) spoken.push(narration);
    if (!row.some((cell) => cell.includes(handle))) continue;
    const parts = [
      shot >= 0 ? row[shot] : "",
      job >= 0 ? row[job] : "",
      prompt >= 0 ? row[prompt] : "",
      narration ? `heard with: ${narration}` : "",
    ].filter(Boolean);
    if (parts.length > 0) shots.push(clip(parts.join(" — "), 320));
    if (shots.length >= 6) break;
  }
  return { shots, narration: clip(spoken.join(" "), 700) };
}

function assetLines(items: Array<{ handle: string; description: string }>, skipHandle: string): string {
  const lines = items
    .filter((item) => item.handle !== skipHandle)
    .slice(0, 12)
    .map((item) => `${item.handle}: ${clip(item.description, 160)}`);
  return lines.length > 0 ? lines.join("\n") : "(none)";
}

export function buildLocationImagePrompt(input: LocationImageBrief): string {
  const name = input.handle.replace(/^@location_/, "").replace(/^@/, "").replace(/_/g, " ").trim() || "the place";
  const { shots, narration } = storyboardNotes(input.storyboard, input.handle);
  const shotBlock = shots.length > 0
    ? shots.map((shot) => `- ${shot}`).join("\n")
    : "- No shot names this location yet. Build a place that can host the story below.";
  const lookBlock = lookStylePromptBlock(resolvedLook(input));
  return [
    "Create ONE photorealistic location still for a video. This is the empty film set, not a generic stock photo of the place name.",
    "ONE FRAME ONLY: a single continuous photograph. No split screen, no stacked photos, no diptych, no collage, no before-and-after, no two pictures in one image.",
    "Read the Idea and the shots only to decide the architecture, time of day, weather, wealth, and how lived-in the place is.",
    `The picture is only ${input.handle} (${name}). Do not turn it into a portrait, a character, or a different location.`,
    "EMPTY SET (MANDATORY): no people, no faces, no hands, no silhouettes, no mannequins. No graphic overlays, icons, charts, arrows, clocks, captions, or composited illustrations.",
    "Do not place characters or property objects into the frame. Furniture that is part of the place itself may stay.",
    `Location label: ${input.description.trim() || "No separate label. Infer the place from the story."}`,
    `Frame: ${input.aspect}. Fill the entire frame. Real camera photograph, sharp detail.`,
    ...(lookBlock
      ? [
          lookBlock,
          "Camera, grade, and lighting must follow LOOK above. Do not default to cinematic soft window light or a movie still when LOOK asks for UGC or commercial.",
        ]
      : ["Natural light unless the story asks otherwise."]),
    "",
    "IDEA THIS VIDEO EXISTS TO SHOW:",
    input.idea.trim() || "(No linked Idea. The storyboard is the idea.)",
    "",
    `CONTENT TITLE: ${clip(input.title, 180) || "(none)"}`,
    `CAPTION: ${clip(input.caption, 400) || "(none)"}`,
    "",
    "DO NOT DRAW THESE. They exist in the film, but this frame is the place only:",
    "Characters:",
    assetLines(input.concept.characters, input.handle),
    "Properties:",
    assetLines(input.concept.properties, input.handle),
    "Other locations:",
    assetLines(input.concept.locations, input.handle),
    "",
    "SHOTS THAT MUST BE POSSIBLE IN THIS PLACE:",
    shotBlock,
    "",
    "STORY THE VIEWER HEARS:",
    narration || "(none)",
    "",
    "The location label is only the name of the place. The Idea and the shots decide the room and the mood; LOOK decides camera and grade.",
    "If a shot names a person or a graphic, leave that person and that graphic out. Show only the place where the shot could happen.",
    "Keep objects that belong to another location out of this frame.",
    "No people, no faces, no hands, no graphic overlay, no icon, no chart, no readable text, no logo, no watermark, no border.",
  ].join("\n");
}

export function buildPropertyImagePrompt(input: LocationImageBrief): string {
  const name = input.handle.replace(/^@property_/, "").replace(/^@/, "").replace(/_/g, " ").trim() || "the object";
  const { shots, narration } = storyboardNotes(input.storyboard, input.handle);
  const shotBlock = shots.length > 0
    ? shots.map((shot) => `- ${shot}`).join("\n")
    : "- No shot names this property yet. Design the object so it can appear in the story below.";
  const graphic = /graphic|overlay/i.test(`${input.handle} ${input.description}`);
  const lookBlock = lookStylePromptBlock(resolvedLook(input));
  return [
    graphic
      ? "Create ONE clean on-screen graphic plate for a video. This is a property used as an overlay, not a random poster and not a physical object in a room."
      : "Create ONE photorealistic photograph of a single property for a video. This is the object as it will be filmed, not a generic catalog photo.",
    "Read the Idea, the spoken story, the characters, the locations, and the shots before you decide the object's condition, age, screen, wear, and meaning.",
    `The picture is only ${input.handle} (${name}). Do not replace it with a person, a location, or a different object.`,
    "BACKGROUND (MANDATORY): seamless pure white. No table, no room, no floor, no shadow scene, no colored backdrop. The object or graphic sits alone on white.",
    `Property label: ${input.description.trim() || "No separate label. Infer the object from the story."}`,
    `Frame: ${input.aspect}. Fill the frame with the object on white, not with a location.`,
    ...(lookBlock
      ? [
          lookBlock,
          "Surface grade and lighting on the object must follow LOOK. Keep the background pure white.",
        ]
      : []),
    graphic
      ? "The graphic's meaning comes from the Idea and the shots. Keep any words short and taken from the Idea. Do not invent a slogan. Place the graphic on pure white."
      : "Photograph only this object on a pure white background. Show the condition the shots require. Do not add a brand name or extra writing the story does not need. Ignore any table, desk, or room named in the shots.",
    "",
    "IDEA THIS VIDEO EXISTS TO SHOW:",
    input.idea.trim() || "(No linked Idea. The storyboard is the idea.)",
    "",
    `CONTENT TITLE: ${clip(input.title, 180) || "(none)"}`,
    `CAPTION: ${clip(input.caption, 400) || "(none)"}`,
    "",
    "OTHER CONCEPT PIECES IN THIS SAME FILM:",
    "Characters:",
    assetLines(input.concept.characters, input.handle),
    "Locations:",
    assetLines(input.concept.locations, input.handle),
    "Other properties:",
    assetLines(input.concept.properties, input.handle),
    "",
    "SHOTS THAT USE THIS PROPERTY:",
    shotBlock,
    "",
    "STORY THE VIEWER HEARS:",
    narration || "(none)",
    "",
    "The property label is only the name. The Idea and the shots decide how this object actually looks. They do not decide the background.",
    "The background is always pure white, even when a shot places the object on a table or inside a room.",
    "Keep objects that belong to another property out of this frame.",
    "No people, no faces, no logo, no watermark, no border.",
  ].join("\n");
}
