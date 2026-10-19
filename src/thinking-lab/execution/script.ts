import { stringifyMarkdownTable } from "@/6-1-dashboard/utils/markdownTableUtils";
import { createBriefSequence, upsertBriefSequencesInMarkdown } from "@/6-1-dashboard/modal/briefSequences";
import { serializeBriefConcept } from "@/6-1-dashboard/modal/briefConceptAssets";
import type { ExecutionSemanticFacts } from "@/thinking-lab/execution/types";
import { isFlashSalePillar } from "@/thinking-lab/execution/types";
import { confirmedDecisionRules, readPointOfView, readScriptDecisions, type ScriptDecision } from "@/thinking-lab/execution/confirm";
import { ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";

const PLAN_TABLE_HEADERS = [
  "Timing",
  "Visual",
  "VO (Voice Over)",
  "Shot",
  "Angle",
  "Visual function",
  "Veo 3 prompt",
  "Master prompt",
] as const;

function planCell(value: string): string {
  return value.replace(/\|/g, "｜");
}

export type ScriptAsset = {
  handle: string;
  description: string;
  portraitPath?: string;
  sheetPath?: string;
  bodyPath?: string;
  visualRevision?: number;
};

const CHARACTER_VISUAL_PATH =
  /^[0-9a-f-]{36}\/thinking-lab\/[0-9a-f-]{36}\/[a-z0-9_]{1,60}-(portrait|sheet|body)\.(jpg|png)$/i;

function readCharacterVisualPath(value: unknown, kind: "portrait" | "sheet" | "body"): string | undefined {
  const text = asText(value);
  const match = CHARACTER_VISUAL_PATH.exec(text);
  if (!match || match[1].toLowerCase() !== kind) return undefined;
  return text;
}

export type ScriptShot = {
  id: string;
  role: string;
  angle: string;
  visualFunction: string;
  prompt: string;
};

export type ScriptDelivery = "vo" | "dialogue" | "silent";

export type ScriptLine = {
  id: string;
  narration: string;
  shots: ScriptShot[];
  delivery?: ScriptDelivery;
};

export type ScriptScene = {
  id: string;
  title: string;
  lines: ScriptLine[];
  purpose?: "cta";
};

export type ScriptAudio = {
  sound: boolean;
  music: boolean;
};

export type ScriptLook = "ugc" | "commercial" | "cinematic";

export type ScriptSpeech = "vo" | "mix" | "dialog" | "silent";

export type VoiceOverScript = {
  title: string;
  caption: string;
  assets: {
    locations: ScriptAsset[];
    characters: ScriptAsset[];
    properties: ScriptAsset[];
  };
  scenes: ScriptScene[];
  lineIssues: Array<{ lineId: string; reason: string }>;
  productionIssues?: Array<{ lineId: string; reason: string; kind: "viewpoint" | "continuity" }>;
  audio: ScriptAudio;
  look?: ScriptLook;
  speech?: ScriptSpeech;
  durationSeconds?: number;
  brandName?: string;
  cta?: string;
  pointOfView?: string;
  decisions?: ScriptDecision[];
  followedRecommendation?: boolean;
};

export type ScriptLineReplacement = {
  lineId: string;
  narration: string;
  shots: Array<Omit<ScriptShot, "id">>;
};

const WORDS_PER_SECOND = 2.2;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function scriptRoot(raw: unknown): Record<string, unknown> | null {
  const row = asRecord(raw);
  if (!row) return null;
  if (Array.isArray(row.scenes)) return row;
  return scriptRoot(row.script);
}

function asHandle(value: string, fallback: string): string {
  const body = (value.trim() || fallback)
    .replace(/^@+/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `@${body || fallback}`;
}

function readAssets(value: unknown, prefix: string, visuals = false): ScriptAsset[] {
  return asList(value).flatMap((item, index) => {
    if (typeof item === "string" && item.trim()) {
      return [{ handle: asHandle(item, `${prefix}_${index + 1}`), description: "" }];
    }
    const row = asRecord(item);
    if (!row) return [];
    const description = asText(row.description ?? row.text);
    const handle = asHandle(asText(row.handle ?? row.token ?? row.name), `${prefix}_${index + 1}`);
    if (!description && handle === `@${prefix}_${index + 1}`) return [];
    const asset: ScriptAsset = { handle, description };
    if (visuals) {
      const portraitPath = readCharacterVisualPath(row.portraitPath, "portrait");
      const sheetPath = readCharacterVisualPath(row.sheetPath, "sheet");
      const bodyPath = readCharacterVisualPath(row.bodyPath, "body");
      if (portraitPath) asset.portraitPath = portraitPath;
      if (sheetPath) asset.sheetPath = sheetPath;
      if (bodyPath) asset.bodyPath = bodyPath;
      const revision = Number(row.visualRevision);
      if (Number.isFinite(revision) && revision > 0) asset.visualRevision = Math.floor(revision);
    }
    return [asset];
  });
}

export function keepCharacterVisuals(next: VoiceOverScript, previous: VoiceOverScript | null): VoiceOverScript {
  if (!previous) return next;
  const saved = new Map(previous.assets.characters.map((item) => [item.handle, item]));
  return {
    ...next,
    assets: {
      ...next.assets,
      characters: next.assets.characters.map((item) => {
        const prior = saved.get(item.handle);
        if (!prior) return item;
        return {
          ...item,
          ...(prior.portraitPath ? { portraitPath: prior.portraitPath } : {}),
          ...(prior.sheetPath ? { sheetPath: prior.sheetPath } : {}),
          ...(prior.bodyPath ? { bodyPath: prior.bodyPath } : {}),
          ...(prior.visualRevision ? { visualRevision: prior.visualRevision } : {}),
        };
      }),
    },
  };
}

export function withCharacterVisuals(
  script: VoiceOverScript,
  handle: string,
  visuals: { portraitPath?: string; sheetPath?: string; bodyPath?: string },
): VoiceOverScript {
  return {
    ...script,
    assets: {
      ...script.assets,
      characters: script.assets.characters.map((item) =>
        item.handle === handle ? { ...item, ...visuals, visualRevision: Date.now() } : item,
      ),
    },
  };
}

export type CharacterVisualKind = "portrait" | "sheet" | "body";

export function withoutCharacterVisual(
  script: VoiceOverScript,
  handle: string,
  kind: CharacterVisualKind,
): VoiceOverScript {
  return {
    ...script,
    assets: {
      ...script.assets,
      characters: script.assets.characters.map((item) => {
        if (item.handle !== handle) return item;
        const next: ScriptAsset = { handle: item.handle, description: item.description };
        if (kind !== "portrait" && item.portraitPath) next.portraitPath = item.portraitPath;
        if (kind !== "sheet" && item.sheetPath) next.sheetPath = item.sheetPath;
        if (kind !== "body" && item.bodyPath) next.bodyPath = item.bodyPath;
        if (next.portraitPath || next.sheetPath || next.bodyPath) {
          if (item.visualRevision) next.visualRevision = item.visualRevision;
        }
        return next;
      }),
    },
  };
}

function readShot(value: unknown, lineId: string, index: number): ScriptShot | null {
  const row = asRecord(value);
  if (!row) return null;
  const role = asText(row.role ?? row.shot ?? row.label);
  const angle = asText(row.angle ?? row.camera);
  const visualFunction = asText(row.visualFunction ?? row.visual ?? row.function);
  const prompt = asText(row.prompt ?? row.veo);
  if (!role && !angle && !visualFunction && !prompt) return null;
  return {
    id: `${lineId}-h${index + 1}`,
    role: role || `Shot ${index + 1}`,
    angle,
    visualFunction,
    prompt,
  };
}

function readStoredDelivery(raw: unknown): ScriptDelivery | undefined {
  return raw === "vo" || raw === "dialogue" || raw === "silent" ? raw : undefined;
}

export function deliveryForSpeech(speech: ScriptSpeech, raw?: unknown): ScriptDelivery {
  if (speech === "dialog") return "dialogue";
  if (speech === "silent") return "silent";
  if (speech === "vo") return "vo";
  return readStoredDelivery(raw) === "dialogue" ? "dialogue" : "vo";
}

function readLine(value: unknown, sceneId: string, index: number, speech?: ScriptSpeech): ScriptLine | null {
  const id = `${sceneId}-l${index + 1}`;
  if (typeof value === "string") {
    const narration = value.trim();
    if (!narration) return null;
    const delivery = speech ? deliveryForSpeech(speech) : undefined;
    return { id, narration, shots: [], ...(delivery ? { delivery } : {}) };
  }
  const row = asRecord(value);
  if (!row) return null;
  const narration = asText(row.narration ?? row.vo ?? row.text ?? row.line);
  const shots = asList(row.shots ?? row.shot).flatMap((shot, shotIndex) => {
    const parsed = readShot(shot, id, shotIndex);
    return parsed ? [parsed] : [];
  });
  if (!narration && shots.length === 0) return null;
  const stored = readStoredDelivery(row.delivery);
  const delivery = speech ? deliveryForSpeech(speech, stored) : stored;
  return { id, narration, shots, ...(delivery ? { delivery } : {}) };
}

export function withSpeech(script: VoiceOverScript, speech: ScriptSpeech): VoiceOverScript {
  return {
    ...script,
    speech,
    scenes: script.scenes.map((scene) => ({
      ...scene,
        lines: scene.lines.map((line) => {
          const delivery = deliveryForSpeech(speech, line.delivery);
          const next = { ...line, delivery };
          if (delivery !== "dialogue") return next;
          return {
            ...next,
            shots: next.shots.map((shot, index) => (index === 0 ? shot : { ...shot, prompt: stripSaid(shot.prompt) })),
          };
        }),
    })),
  };
}

export function parseVoiceOverScript(raw: unknown): VoiceOverScript | null {
  const row = scriptRoot(raw);
  if (!row) return null;
  const speech = readScriptSpeech(row.speech);
  const scenes = asList(row.scenes).flatMap((scene, sceneIndex) => {
    const sceneRow = asRecord(scene);
    if (!sceneRow && typeof scene !== "string") return [];
    const id = `s${sceneIndex + 1}`;
    const title = sceneRow ? asText(sceneRow.title ?? sceneRow.name) : "";
    const source = sceneRow ? asList(sceneRow.lines ?? sceneRow.rows ?? sceneRow.narrations) : [scene];
    const lines = source.flatMap((line, lineIndex) => {
      const parsed = readLine(line, id, lineIndex, speech);
      return parsed ? [parsed] : [];
    });
    const isCta = sceneRow?.purpose === "cta" || sceneRow?.kind === "cta";
    if (lines.length === 0 || lines.every((line) => !line.narration.trim())) return [];
    const parsedScene: ScriptScene = {
      id,
      title: title || `Scene ${sceneIndex + 1}`,
      lines,
      ...(isCta ? { purpose: "cta" as const } : {}),
    };
    return [parsedScene];
  });
  if (scenes.length === 0) return null;
  const known = new Set(scenes.flatMap((scene) => scene.lines.map((line) => line.id)));
  const assets = asRecord(row.assets) ?? row;
  const lineIssues = asList(row.lineIssues ?? asRecord(row.issues)?.lines).flatMap((issue) => {
    const issueRow = asRecord(issue);
    if (!issueRow) return [];
    const lineId = asText(issueRow.lineId ?? issueRow.id);
    const reason = asText(issueRow.reason);
    if (!known.has(lineId) || !reason) return [];
    return [{ lineId, reason }];
  });
  const productionIssues = asList(row.productionIssues).flatMap((issue) => {
    const issueRow = asRecord(issue);
    if (!issueRow) return [];
    const lineId = asText(issueRow.lineId ?? issueRow.id);
    const reason = asText(issueRow.reason);
    if (!known.has(lineId) || !reason) return [];
    const kind = issueRow.kind === "viewpoint" ? "viewpoint" : "continuity";
    return [{ lineId, reason, kind }] as const;
  });
  const look = readScriptLook(row.look);
  return {
    title: asText(row.title ?? row.postTitle ?? row.headline ?? row.judul),
    caption: asText(row.caption ?? row.postCaption),
    assets: {
      locations: readAssets(assets.locations, "location"),
      characters: readAssets(assets.characters, "character", true),
      properties: readAssets(assets.properties, "property"),
    },
    scenes,
    lineIssues,
    ...(productionIssues.length > 0 ? { productionIssues: [...productionIssues] } : {}),
    audio: readScriptAudio(row.audio),
    ...(look ? { look } : {}),
    ...(speech ? { speech } : {}),
    ...(readDurationSeconds(row.durationSeconds) ? { durationSeconds: readDurationSeconds(row.durationSeconds) } : {}),
    ...(readBrandName(row.brandName) ? { brandName: readBrandName(row.brandName) ?? undefined } : {}),
    ...(readCallToAction(row.cta) ? { cta: readCallToAction(row.cta) ?? undefined } : {}),
    ...(readScriptDecisions(row.decisions).length > 0 ? { decisions: readScriptDecisions(row.decisions) } : {}),
    ...(readPointOfView(row.pointOfView, row.confirmations, row.decisions)
      ? { pointOfView: readPointOfView(row.pointOfView, row.confirmations, row.decisions) ?? undefined }
      : {}),
    ...(row.followedRecommendation === true ? { followedRecommendation: true } : {}),
  };
}

function readDurationSeconds(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount);
}

export function readBrandName(value: unknown): string | null {
  const text = asText(value).replace(/\s+/g, " ");
  return text || null;
}

export function readCallToAction(value: unknown): string | null {
  const text = asText(value).replace(/\s+/g, " ");
  if (!text || text.length > 80) return null;
  return text;
}

export function scriptMentionsBrand(script: VoiceOverScript, brand: string): boolean {
  const name = brand.trim();
  if (!name) return true;
  const inNarration = script.scenes.some((scene) => scene.lines.some((line) => line.narration.includes(name)));
  if (!inNarration) return false;
  if (script.speech !== "silent") return true;
  return script.scenes.some((scene) => scene.lines.some((line) => line.shots.some((shot) => shot.prompt.includes(name))));
}

function weaveBrand(text: string, brand: string): string {
  if (text.includes(brand)) return text;
  const trimmed = text.trim();
  if (!trimmed) return brand;
  const matched = trimmed.match(/^(.*?)([.!?…]+)\s*$/);
  if (matched?.[1]?.trim()) return `${matched[1].trimEnd()} ${brand}${matched[2]}`;
  return `${trimmed} ${brand}`;
}

export function ensureBrandMention(script: VoiceOverScript, brand: string): VoiceOverScript {
  const name = brand.trim();
  if (!name) return script;
  const named = script.brandName === name ? script : { ...script, brandName: name };
  if (scriptMentionsBrand(named, name)) return named;
  let placedNarration = false;
  let placedShot = named.speech !== "silent";
  return {
    ...named,
    scenes: named.scenes.map((scene) => ({
      ...scene,
      lines: scene.lines.map((line) => {
        let narration = line.narration;
        if (!placedNarration && narration.trim()) {
          narration = weaveBrand(narration, name);
          placedNarration = narration.includes(name);
        }
        let shots = line.shots;
        if (narration.includes(name) && line.delivery === "dialogue" && shots[0] && shotHasSaid(shots[0].prompt)) {
          const prompt = shots[0].prompt.replace(SAID_CLAUSE, (clause) => {
            const token = clause.match(/@[A-Za-z0-9_.]+/);
            return token ? `${token[0]} said: "${narration}"` : clause;
          });
          if (prompt !== shots[0].prompt) shots = shots.map((shot, index) => (index === 0 ? { ...shot, prompt } : shot));
        }
        if (!placedShot && narration.includes(name)) {
          const already = shots.some((shot) => shot.prompt.includes(name));
          if (!already && shots[0]) {
            shots = shots.map((shot, index) =>
              index === 0
                ? { ...shot, prompt: `${shot.prompt.trim()} Readable on-screen text shows "${name}".`.trim() }
                : shot,
            );
          }
          placedShot = shots.some((shot) => shot.prompt.includes(name));
        }
        return { ...line, narration, shots };
      }),
    })),
  };
}

export function chainNarrationLines(script: VoiceOverScript): Array<{ id: string; narration: string }> {
  return script.scenes
    .filter((scene) => scene.purpose !== "cta")
    .flatMap((scene) => scene.lines.map((line) => ({ id: line.id, narration: line.narration })));
}

/** Lines a one-line recheck needs. Viewpoint is local; continuity also needs the line before it. */
export function linesForProductionRecheck(
  lines: Array<{ id: string; narration: string }>,
  lineId: string,
  kind: "viewpoint" | "continuity",
): Array<{ id: string; narration: string }> {
  const index = lines.findIndex((line) => line.id === lineId);
  if (index < 0) return lines;
  if (kind === "viewpoint") return [lines[index]];
  return lines.slice(Math.max(0, index - 1), index + 1);
}

export function conclusionNarrationLines(script: VoiceOverScript): Array<{ id: string; narration: string }> {
  const story = script.scenes.filter((scene) => scene.purpose !== "cta");
  const last = story[story.length - 1];
  if (!last) return [];
  return last.lines.map((line) => ({ id: line.id, narration: line.narration }));
}

export function storyVoiceOver(script: VoiceOverScript): string {
  return flattenVoiceOver({ ...script, scenes: script.scenes.filter((scene) => scene.purpose !== "cta") });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bareCallToAction(text: string, action: string): boolean {
  const normalized = text.trim().replace(/[.!?…]+$/g, "").trim().toLowerCase();
  return normalized === action.trim().toLowerCase();
}

function withoutTrailingAction(narration: string, action: string): string {
  if (bareCallToAction(narration, action)) return "";
  const pattern = new RegExp(`\\s+${escapeRegExp(action.trim())}\\s*[.!?…]*\\s*$`, "i");
  return narration.replace(pattern, "").trim();
}

export function detachCallToAction(script: VoiceOverScript, cta: string): VoiceOverScript {
  const action = readCallToAction(cta);
  if (!action) return script;
  const tagged = script.cta === action ? script : { ...script, cta: action };
  const scenes = tagged.scenes.flatMap((scene) => {
    if (scene.purpose === "cta") return [scene];
    const lines = scene.lines.flatMap((line) => {
      const narration = withoutTrailingAction(line.narration, action);
      if (!narration) return [];
      let shots = line.shots;
      if (narration !== line.narration && line.delivery === "dialogue" && shots[0] && shotHasSaid(shots[0].prompt)) {
        const prompt = shots[0].prompt.replace(SAID_CLAUSE, (clause) => {
          const token = clause.match(/@[A-Za-z0-9_.]+/);
          return token ? `${token[0]} said: "${narration}"` : clause;
        });
        if (prompt !== shots[0].prompt) shots = shots.map((shot, index) => (index === 0 ? { ...shot, prompt } : shot));
      }
      return [{ ...line, narration, shots }];
    });
    if (lines.length === 0) return [];
    return [{ ...scene, lines }];
  });
  const story = scenes.filter((scene) => scene.purpose !== "cta");
  const invitation = scenes.filter((scene) => scene.purpose === "cta");
  return { ...tagged, scenes: [...story, ...invitation] };
}

export function callToActionSceneReady(script: VoiceOverScript, cta: string): boolean {
  const action = cta.trim();
  const scene = [...script.scenes].reverse().find((item) => item.purpose === "cta");
  if (!scene || !action) return false;
  const text = scene.lines.map((line) => line.narration.trim()).filter(Boolean).join(" ");
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 8 || words.length > 60) return false;
  return !bareCallToAction(text, action);
}

export function attachCtaScene(script: VoiceOverScript, scene: ScriptScene): VoiceOverScript {
  const story = script.scenes.filter((item) => item.purpose !== "cta");
  const index = story.length + 1;
  const id = `s${index}`;
  const lines = scene.lines.map((line, lineIndex) => ({
    ...line,
    id: `${id}-l${lineIndex + 1}`,
    shots: line.shots.map((shot, shotIndex) => ({ ...shot, id: `${id}-l${lineIndex + 1}-h${shotIndex + 1}` })),
  }));
  return {
    ...script,
    scenes: [...story, { ...scene, id, title: scene.title.trim() || `Scene ${index}`, purpose: "cta", lines }],
  };
}

export function parseCtaScene(raw: unknown, speech?: ScriptSpeech): ScriptScene | null {
  const row = asRecord(raw);
  const scene = row?.scene ?? row?.scenes ?? raw;
  const parsed = parseVoiceOverScript({ speech, scenes: Array.isArray(scene) ? scene : [scene] });
  const first = parsed?.scenes[0];
  if (!first) return null;
  return { ...first, purpose: "cta" };
}

export function buildCtaScenePrompt(input: {
  ideaStatement: string;
  masterStatement: string;
  pointOfView?: string | null;
  decisions?: ScriptDecision[] | null;
  action: string;
  speech?: ScriptSpeech | null;
  brandName?: string | null;
}): string {
  const action = input.action.trim();
  const locked = confirmedDecisionRules(input.decisions, input.pointOfView);
  return [
    "Write one new scene for the end of a video script.",
    "This scene is only the call to action. It comes after the conclusion.",
    `The chosen action is "${action}". That label is not the narration.`,
    "Write one or two sentences in the Idea's language.",
    ...(locked.length > 0 ? locked : ["Speak from the same point of view as the rest of the script."]),
    "Show the viewer taking that action, or invite them in that point of view's voice.",
    "Do not make the scene only the settings label.",
    "Do not repeat the Master Thought and do not add a new cause.",
    "Do not title the scene Conclusion, Kesimpulan, CTA, or Call to Action.",
    input.speech === "silent"
      ? "There is no spoken voice. One shot shows the invitation as readable text inside the picture."
      : input.speech === "dialog"
        ? "A character speaks the invitation. The main shot carries said: and two supporting shots do not."
        : "The invitation is voice-over unless the speech mode is dialogue.",
    input.brandName?.trim() ? `The brand name already in the script is "${input.brandName.trim()}". Keep that spelling if you name it.` : "",
    'Return JSON only: {"title":"...","purpose":"cta","lines":[{"narration":"...","delivery":"vo","shots":[{"role":"Shot 1 — Main Shot","angle":"...","visualFunction":"...","prompt":"..."}]}]}',
    "",
    "Master Thought, already said in the conclusion. Do not say it again:",
    input.masterStatement.trim(),
    "",
    "Idea:",
    input.ideaStatement.trim(),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function readScriptAudio(raw: unknown): ScriptAudio {
  const row = asRecord(raw);
  return { sound: row?.sound === true, music: row?.music === true };
}

export function lineAudio(script: Pick<VoiceOverScript, "audio" | "speech">, line: ScriptLine): ScriptAudio {
  const music = script.audio?.music === true;
  const dialogue = line.delivery === "dialogue" || shotHasSaid(line.shots[0]?.prompt ?? "");
  if (script.speech === "mix" || script.speech === "dialog") return { sound: dialogue, music };
  return { sound: script.audio?.sound === true, music };
}

export function audioMasterLine(audio?: ScriptAudio | null): string {
  const sound = audio?.sound === true;
  const music = audio?.music === true;
  if (sound && music) return "Audio : sound and music";
  if (sound) return "Audio : sound, no music";
  if (music) return "Audio : music, no sound";
  return "Audio : no sound, no music";
}

export function readScriptLook(raw: unknown): ScriptLook | undefined {
  return raw === "ugc" || raw === "commercial" || raw === "cinematic" ? raw : undefined;
}

export function lookMasterLine(look?: ScriptLook | null): string {
  if (look === "ugc") return "Look : UGC, handheld iPhone, natural light, no bokeh, no cinematic grade";
  if (look === "commercial") return "Look : commercial ad, stable camera, clean even lighting, sharp product focus, polished but not a movie";
  if (look === "cinematic") return "Look : cinematic film, motivated lighting, shallow depth of field, camera on tripod or dolly, filmic color";
  return "";
}

export function readScriptSpeech(raw: unknown): ScriptSpeech | undefined {
  return raw === "vo" || raw === "mix" || raw === "dialog" || raw === "silent" ? raw : undefined;
}

const SAID_CLAUSE = /\s*@[A-Za-z0-9_.]+\s+said\s*:\s*"(?:[^"\\]|\\.)*"\s*/gi;

export function shotHasSaid(prompt: string): boolean {
  return /\bsaid\s*:/i.test(prompt);
}

export function stripSaid(prompt: string): string {
  return prompt.replace(SAID_CLAUSE, " ").replace(/\s{2,}/g, " ").trim();
}

/** The spoken line stays on the main shot. Later shots of the same sentence keep only the picture. */
export function visibleShotPrompt(line: ScriptLine, index: number): string {
  const prompt = line.shots[index]?.prompt ?? "";
  if (line.delivery !== "dialogue" || index === 0) return prompt;
  return stripSaid(prompt);
}

export function flattenVoiceOver(script: VoiceOverScript): string {
  return script.scenes
    .map((scene) => [scene.title.trim(), ...scene.lines.map((line) => line.narration.trim())].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function durationWordBudget(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds * WORDS_PER_SECOND));
}

export function narrationDurationSeconds(narration: string): number {
  const words = narration.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(5, Math.round(words / WORDS_PER_SECOND / 5) * 5);
}

export function scriptDurationSeconds(script: VoiceOverScript): number {
  return narrationDurationSeconds(script.scenes.flatMap((scene) => scene.lines.map((line) => line.narration)).join(" "));
}

export function voiceOverCopy(script: VoiceOverScript): string {
  return flattenVoiceOver(script);
}

export function allPromptsCopy(script: VoiceOverScript): string {
  return script.scenes
    .flatMap((scene) =>
      scene.lines.flatMap((line) => line.shots.map((_, index) => visibleShotPrompt(line, index).trim()).filter(Boolean)),
    )
    .join("\n\n");
}

function shotPromptBlock(shot: ScriptShot): string {
  const head = [`Shot : ${shot.role}`, `Angle : ${shot.angle}`, `Visual function : ${shot.visualFunction}`].join("\n");
  const prompt = shot.prompt.trim();
  return prompt ? `${head}\n\n${prompt}` : head;
}

/** One narration line: audio, then look when one was chosen, then only that sentence's shots. */
export function lineMasterPrompt(line: ScriptLine, audio?: ScriptAudio | null, look?: ScriptLook | null): string {
  const shots = line.shots.map((shot, index) => shotPromptBlock({ ...shot, prompt: visibleShotPrompt(line, index) })).join("\n\n");
  const head = [audioMasterLine(audio), lookMasterLine(look)].filter(Boolean).join("\n");
  return shots ? `${head}\n\n${shots}` : head;
}

export function buildPlanBriefMarkdown(script: VoiceOverScript): string {
  const rows: string[][] = [[...PLAN_TABLE_HEADERS]];
  const sequences = script.scenes.flatMap((scene) => {
    let rowCount = 0;
    for (const line of scene.lines) {
      const shots = line.shots.length > 0 ? line.shots : [null];
      const master = lineMasterPrompt(line, lineAudio(script, line), script.look);
      shots.forEach((shot, index) => {
        rowCount += 1;
        rows.push([
          "",
          "",
          index === 0 ? planCell(line.narration) : "",
          planCell(shot?.role ?? ""),
          planCell(shot?.angle ?? ""),
          planCell(shot?.visualFunction ?? ""),
          planCell(shot?.prompt ?? ""),
          index === 0 ? planCell(master) : "",
        ]);
      });
    }
    return rowCount > 0 ? [createBriefSequence(scene.title.trim() || "Sequence", rowCount)] : [];
  });
  const table = stringifyMarkdownTable(rows, { trimTrailingEmptyBodyRows: false });
  return sequences.length > 0 ? upsertBriefSequencesInMarkdown(table, sequences) : table;
}

export function buildPlanScript(script: VoiceOverScript): string {
  const brief = buildPlanBriefMarkdown(script);
  const voiceOver = voiceOverCopy(script);
  const concept = `## Concept of Content ##\n${serializeBriefConcept({
    ...(voiceOver ? { voiceOver } : {}),
    locations: script.assets.locations.map((item) => ({ handle: item.handle, description: item.description })),
    characters: script.assets.characters.map((item) => ({
      handle: item.handle,
      description: item.description,
      ...(item.portraitPath ? { portraitPath: item.portraitPath } : {}),
      ...(item.bodyPath ? { bodyPath: item.bodyPath } : {}),
      ...(item.visualRevision ? { visualRevision: item.visualRevision } : {}),
    })),
    properties: script.assets.properties.map((item) => ({ handle: item.handle, description: item.description })),
  })}`;
  const caption = script.caption.trim();
  if (!caption) return `${brief}\n\n${concept}`;
  return `${brief}\n\n${concept}\n\n## CAPTION ##\n${caption}`;
}

export function pillarLessSuitable(name: string, masterSells: true | false | "unresolved" | "unknown"): boolean {
  return masterSells === false && isFlashSalePillar(name);
}

export function scriptLineRepairReady(facts: ExecutionSemanticFacts, script: VoiceOverScript | null): boolean {
  if (facts.meaningAudit) return false;
  const hasNarration = Boolean(script?.scenes.some((scene) => scene.lines.some((line) => line.narration.trim())));
  if (!script || !hasNarration || script.lineIssues.length === 0) return false;
  if (facts.mechanismVisible === false || facts.pillarOutside === true) return false;
  if (isFlashSalePillar(facts.pillar) && facts.masterSells !== true) return false;
  if (
    facts.relationToParent === "PILLAR_OUTSIDE" ||
    facts.relationToParent === "PILLAR_NOT_SELLING" ||
    facts.relationToParent === "MECHANISM_HIDDEN"
  ) {
    return false;
  }
  return true;
}

export function parseLineIssues(raw: unknown, script: VoiceOverScript): Array<{ lineId: string; reason: string }> {
  const row = asRecord(raw);
  const list = row ? asList(row.lines ?? row.lineIssues) : asList(raw);
  const known = new Set(script.scenes.flatMap((scene) => scene.lines.map((line) => line.id)));
  return list.flatMap((item) => {
    const issue = asRecord(item);
    if (!issue) return [];
    const lineId = asText(issue.lineId ?? issue.id);
    const reason = asText(issue.reason);
    if (!known.has(lineId) || !reason) return [];
    if (issue.failed === false) return [];
    return [{ lineId, reason }];
  });
}

function readReplacementShot(value: unknown): Omit<ScriptShot, "id"> | null {
  const shot = readShot(value, "line", 0);
  if (!shot) return null;
  return { role: shot.role, angle: shot.angle, visualFunction: shot.visualFunction, prompt: shot.prompt };
}

export function parseLineReplacements(raw: unknown): ScriptLineReplacement[] {
  const row = asRecord(raw);
  const list = row ? asList(row.lines ?? row.replacements) : asList(raw);
  return list.flatMap((item) => {
    const line = asRecord(item);
    if (!line) return [];
    const lineId = asText(line.lineId ?? line.id);
    const narration = asText(line.narration ?? line.vo ?? line.text);
    if (!lineId || !narration) return [];
    const shots = asList(line.shots).flatMap((shot) => {
      const parsed = readReplacementShot(shot);
      return parsed ? [parsed] : [];
    });
    return [{ lineId, narration, shots }];
  });
}

function scriptLines(script: VoiceOverScript): ScriptLine[] {
  return script.scenes.flatMap((scene) => scene.lines);
}

function isSaidDialogue(line: ScriptLine): boolean {
  return line.delivery === "dialogue" && shotHasSaid(line.shots[0]?.prompt ?? "");
}

function isVoiceOverLine(line: ScriptLine): boolean {
  return line.delivery !== "dialogue" && line.delivery !== "silent" && line.shots.every((shot) => !shotHasSaid(shot.prompt));
}

function dialogueNeedsShots(line: ScriptLine): boolean {
  return line.delivery === "dialogue" && line.shots.length < 3;
}

function promptWordCount(prompt: string): number {
  return prompt.trim().split(/\s+/).filter(Boolean).length;
}

function visualLineIsThin(line: ScriptLine): boolean {
  return line.shots.length < 3 || line.shots.some((shot) => promptWordCount(shot.prompt) < 25);
}

const CHARACTER_TOKEN = /@character_[A-Za-z0-9_]+/i;
const LOCATION_TOKEN = /@location_[A-Za-z0-9_]+/i;

/** A Veo prompt that names a character must name a place in the same prompt. */
export function promptMissingLocation(prompt: string): boolean {
  return CHARACTER_TOKEN.test(prompt) && !LOCATION_TOKEN.test(prompt);
}

function lineMissingLocation(line: ScriptLine): boolean {
  return line.shots.some((_, index) => promptMissingLocation(visibleShotPrompt(line, index)));
}

export function speechNeedsRepair(script: VoiceOverScript, speech?: ScriptSpeech | null): boolean {
  const lines = scriptLines(script);
  const missingPlace = lines.some(lineMissingLocation);
  if (speech === "mix") return !lines.some(isSaidDialogue) || !lines.some(isVoiceOverLine) || lines.some(dialogueNeedsShots) || missingPlace;
  if (speech === "dialog") return lines.some((line) => !shotHasSaid(line.shots[0]?.prompt ?? "") || line.shots.length < 3) || missingPlace;
  if (speech === "silent") return lines.some(visualLineIsThin) || missingPlace;
  return missingPlace;
}

export type SpeechRepairLine = {
  lineId: string;
  narration: string;
  delivery: ScriptDelivery;
  shots: Array<Omit<ScriptShot, "id">>;
};

export function parseSpeechRepairs(raw: unknown): SpeechRepairLine[] {
  const row = asRecord(raw);
  const list = row ? asList(row.lines ?? row.replacements) : asList(raw);
  return list.flatMap((item) => {
    const line = asRecord(item);
    if (!line) return [];
    const lineId = asText(line.lineId ?? line.id);
    const narration = asText(line.narration ?? line.vo ?? line.text);
    const delivery = readStoredDelivery(line.delivery);
    if (!lineId || !narration || !delivery) return [];
    const shots = asList(line.shots).flatMap((shot) => {
      const parsed = readReplacementShot(shot);
      return parsed ? [parsed] : [];
    });
    return [{ lineId, narration, delivery, shots }];
  });
}

export function mergeSpeechRepairs(script: VoiceOverScript, repairs: SpeechRepairLine[]): VoiceOverScript {
  const known = new Set(scriptLines(script).map((line) => line.id));
  const byId = new Map(repairs.filter((line) => known.has(line.lineId)).map((line) => [line.lineId, line]));
  return {
    ...script,
    scenes: script.scenes.map((scene) => ({
      ...scene,
      lines: scene.lines.map((line) => {
        const next = byId.get(line.id);
        if (!next) return line;
        return {
          ...line,
          narration: next.narration.trim(),
          delivery: next.delivery,
          shots:
            next.shots.length > 0
              ? next.shots.map((shot, index) => ({ ...shot, id: `${line.id}-h${index + 1}` }))
              : line.shots,
        };
      }),
    })),
  };
}

export function buildSpeechRepairPrompt(input: {
  ideaStatement: string;
  pillarName: string;
  speech: "mix" | "dialog" | "silent" | "vo";
  script: VoiceOverScript;
}): string {
  const lines = scriptLines(input.script);
  const saidShape = '@character said: "the narration sentence, unchanged"';
  const missingDialogue = !lines.some(isSaidDialogue);
  const missingVoiceOver = !lines.some(isVoiceOverLine);
  const shortDialogue = lines.some(dialogueNeedsShots);
  const missingPlace = lines.some(lineMissingLocation);
  const brand = input.script.brandName?.trim() ?? "";
  const brandMissing = Boolean(brand) && !scriptMentionsBrand(input.script, brand);
  const brandGap = !brandMissing
    ? ""
    : input.speech === "silent"
      ? `The script never says "${brand}". Change one narration line so that exact name appears in the situation, and show that same name as readable text in one shot prompt of that line. Return that line.`
      : input.speech === "dialog"
        ? `The script never says "${brand}". Change one dialogue line so a character says that exact name, and put the same sentence in the main shot's said: quotation. Return that line.`
        : `The script never says "${brand}". Change one narration line so that exact name is spoken inside the situation. Return that line.`;
  const placeGap =
    "A shot that names a @character token is missing a @location token in that same prompt. Add a location from assets to those shots. Reuse the location already used with that character in the scene when the shot stays in that place. Leave a prompt with no @character unchanged. Return only the lines you change.";
  const shapeGap =
    input.speech === "silent"
      ? "There is no voice-over. Each sentence needs at least three shots. Each shot prompt is several sentences: who is present, where they are, the action, the object that shows the point, and the change a viewer can see. Together the shots make the unspoken narration understandable without anyone speaking it. Do not write said: or a voice-over. Return only the lines whose prompts are too short or that have fewer than three shots."
      : input.speech === "dialog"
      ? "Each line is dialogue and has at least three shots. The main shot includes the spoken line. Supporting shots do not repeat it. Return only the lines whose main shot lacks the spoken line or that have fewer than three shots."
      : input.speech === "vo"
        ? "Return only the lines that still do not match."
        : missingDialogue
          ? "The script has no complete on-screen dialogue yet. A dialogue line has at least three shots. Put the spoken line only on the main shot. Supporting shots do not repeat it. Leave at least one voice-over line. Return only the lines you change."
          : missingVoiceOver
            ? "The script has no voice-over line yet. Change only enough dialogue lines into voice-over, and leave at least one dialogue line with three shots. Return only the lines you change."
            : shortDialogue
              ? "A dialogue line needs at least three shots: the main shot with the spoken line, plus two supporting shots that do not repeat said:. Return only those short dialogue lines."
              : "Return only the lines that still do not match.";
  const speechShapeBroken =
    input.speech === "silent"
      ? lines.some(visualLineIsThin)
      : input.speech === "dialog"
        ? lines.some((line) => !shotHasSaid(line.shots[0]?.prompt ?? "") || line.shots.length < 3)
        : input.speech === "mix"
          ? missingDialogue || missingVoiceOver || shortDialogue
          : false;
  const gap = brandGap || (!speechShapeBroken && missingPlace ? placeGap : shapeGap);
  return [
    "Fix only the narration lines that do not match the speech mode.",
    gap,
    "When a shot prompt names a @character token, that same prompt also names a @location token.",
    "Reuse a location from assets. Prefer the location already used with that character in the scene when the shot stays in that place.",
    "A prompt with no @character does not need a location.",
    "Do not return a line that already matches.",
    `Only the main shot of a dialogue line includes this exact shape: ${saidShape}.`,
    "Supporting shots of that same line do not repeat said:.",
    "The quotation is that line's narration, unchanged, in the Idea's language. Do not translate it.",
    "The token is the speaking character's handle from assets.",
    "A voice-over shot prompt does not contain said:.",
    "Narration stays in the Idea's language. The rest of the shot prompt stays in English.",
    ...(input.script.brandName
      ? [
          `Keep the exact brand name "${input.script.brandName}" in the script.`,
          "If a line you change already says that name, keep the spelling.",
          "If the script never says it, add that exact name to one narration line you return.",
        ]
      : []),
    ...(input.script.cta?.trim()
      ? [
          `The call to action "${input.script.cta.trim()}" lives in its own final scene.`,
          "Do not append that label to a story line.",
        ]
      : []),
    ...confirmedDecisionRules(input.script.decisions, input.script.pointOfView),
    `Pillar: ${input.pillarName}.`,
    "Return JSON only: {\"lines\":[{\"lineId\":\"...\",\"narration\":\"...\",\"delivery\":\"vo\"|\"dialogue\",\"shots\":[{\"role\":\"...\",\"angle\":\"...\",\"visualFunction\":\"...\",\"prompt\":\"...\"}]}]}",
    "",
    "Idea:",
    input.ideaStatement.trim(),
    "",
    "Script:",
    JSON.stringify({
      scenes: input.script.scenes.map((scene) => ({
        title: scene.title,
        lines: scene.lines.map((line) => ({
          lineId: line.id,
          narration: line.narration,
          delivery: line.delivery ?? "vo",
          shots: line.shots.map((shot) => ({
            role: shot.role,
            angle: shot.angle,
            visualFunction: shot.visualFunction,
            prompt: shot.prompt,
          })),
        })),
      })),
    }),
  ].join("\n");
}

export function mergeRepairedLines(script: VoiceOverScript, replacements: ScriptLineReplacement[]): VoiceOverScript {
  const byId = new Map(replacements.map((line) => [line.lineId, line]));
  return {
    ...script,
    lineIssues: [],
    scenes: script.scenes.map((scene) => ({
      ...scene,
      lines: scene.lines.map((line) => {
        const next = byId.get(line.id);
        if (!next) return line;
        return {
          ...line,
          narration: next.narration.trim(),
          shots:
            next.shots.length > 0
              ? next.shots.map((shot, index) => ({ ...shot, id: `${line.id}-h${index + 1}` }))
              : line.shots,
        };
      }),
    })),
  };
}

export function buildMasterSellsPrompt(masterStatement: string): string {
  return [
    "Decide whether this Master Thought is actually selling something.",
    "Selling means the belief asks the audience to buy, pay, or take a priced offer.",
    "A belief about saving, time, or a life choice is not selling unless it also asks for a purchase.",
    "Return JSON only: {\"masterSells\":true} or {\"masterSells\":false} or {\"masterSells\":\"unresolved\"}.",
    "",
    masterStatement.trim(),
  ].join("\n");
}

export function parseMasterSells(raw: unknown): true | false | "unresolved" {
  const row = asRecord(raw);
  const value = row?.masterSells;
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return "unresolved";
}

export function buildViewpointAuditPrompt(input: {
  ideaStatement: string;
  pointOfView: string;
  lines: Array<{ id: string; narration: string }>;
}): string {
  const viewpoint = input.pointOfView.trim();
  return [
    "Read each narration line of a voice-over script.",
    `The locked point of view is "${viewpoint}".`,
    "A line fails when it states another person's private thoughts, feelings, intentions, or knowledge that this point of view cannot see or hear.",
    "A line passes when it describes what this point of view sees, hears, or thinks.",
    "A line passes when another person speaks out loud or performs an action this point of view can see.",
    "A line fails when it tells the same moment from inside two people.",
    `Example fail: the point of view is a documentation team, and a line narrates the couple's anxious nights at home as if the team lived them.`,
    `Example fail: the point of view is the wife, and a line enters the husband's private hope with "Dalam benaknya".`,
    "Return JSON only: {\"lines\":[{\"lineId\":\"...\",\"reason\":\"...\"}]}.",
    "Include only the failing lines. Return {\"lines\":[]} when every line stays inside the point of view.",
    "Write each reason in the same language as the Idea.",
    "",
    "Idea:",
    input.ideaStatement.trim(),
    "",
    "Lines:",
    ...input.lines.map((line) => `${line.id}: ${line.narration.trim()}`),
  ].join("\n");
}

export function buildContinuityAuditPrompt(input: {
  ideaStatement: string;
  lines: Array<{ id: string; narration: string }>;
}): string {
  return [
    "Read each narration line of a voice-over script.",
    "A line fails when it does not follow from the line before it.",
    "The first line of a new beat fails when it starts an event the previous line did not cause or show.",
    "Example fail: the previous line is still waiting with blurry photos, and the next line says they found a team.",
    "Write the reason as the missing step between those two lines.",
    "Do not fail a line for a new claim, a wrong cause, or a conclusion that misses the Master Thought.",
    "Return JSON only: {\"lines\":[{\"lineId\":\"...\",\"reason\":\"...\"}]}.",
    "Include only the failing lines. Return {\"lines\":[]} when every line follows the one before it.",
    "Write each reason in the same language as the Idea.",
    "",
    "Idea:",
    input.ideaStatement.trim(),
    "",
    "Lines:",
    ...input.lines.map((line) => `${line.id}: ${line.narration.trim()}`),
  ].join("\n");
}

export function buildProductionRepairPrompt(input: {
  ideaStatement: string;
  pointOfView?: string;
  lineId: string;
  narration: string;
  reason: string;
  kind: "viewpoint" | "continuity";
}): string {
  return [
    "Rewrite only this narration line.",
    input.kind === "viewpoint"
      ? "Keep the line inside the locked point of view. Do not enter another person's private thoughts."
      : "Make the line follow from the narration before it. Do not open an event the previous line did not cause or show.",
    "Do not change the story's belief, the shots, or the call to action.",
    "Return JSON only: {\"lines\":[{\"lineId\":\"...\",\"narration\":\"...\"}]}",
    "",
    "Idea:",
    input.ideaStatement.trim(),
    ...(input.pointOfView?.trim() ? ["", `Point of view: ${input.pointOfView.trim()}`] : []),
    "",
    `${input.lineId}: ${input.narration.trim()}`,
    `Why it failed: ${input.reason}`,
  ].join("\n");
}

export function mergeNarrationRepairs(
  script: VoiceOverScript,
  replacements: Array<{ lineId: string; narration: string }>,
): VoiceOverScript {
  const byId = new Map(replacements.map((line) => [line.lineId, line.narration.trim()]));
  return {
    ...script,
    scenes: script.scenes.map((scene) => ({
      ...scene,
      lines: scene.lines.map((line) => {
        const narration = byId.get(line.id);
        if (!narration) return line;
        return { ...line, narration };
      }),
    })),
  };
}

export function buildLineAuditPrompt(input: {
  ideaStatement: string;
  masterStatement: string;
  priorBelief?: string;
  ancestors?: AncestorStake[];
  lines: Array<{ id: string; narration: string }>;
}): string {
  return [
    "Read each narration line of a voice-over script.",
    "A line fails when it adds a claim the Idea does not already carry, or drops the Idea's message.",
    "A line also fails when it installs a cause that is not this chain: the Big Thought's stake happens, and that stake, not an advertisement, moves the Master Thought's outcome.",
    "A line also fails when it does not follow from the line before it.",
    "The first line of a new beat fails when it starts an event the previous line did not cause or show.",
    "Example fail: the previous line is still waiting with blurry photos, and the next line says they found a team.",
    "Write the reason as the missing step between those two lines.",
    "Do not require the line to quote those beliefs.",
    "The last narration lines below are the conclusion scene. A call-to-action scene is not included here.",
    "A viewer who hears only those conclusion lines must be able to say the Master Thought.",
    "Those closing lines fail when they only restate the mechanism, hide the Master Thought, or announce another cause.",
    "An invitation to follow, save, comment, share, or click is not part of this chain. Do not judge it, because it is not in these lines.",
    "Saying the Master Thought in the situation's words passes. Pasting it unchanged as a slogan is not required.",
    "A closing line that announces another cause fails. Example: this is not about price or need, it is about a fitting number.",
    "A short line, a question, or a line that only shows the Idea's mechanism does not fail when it comes before the conclusion.",
    "Return JSON only: {\"lines\":[{\"lineId\":\"...\",\"reason\":\"...\"}]}.",
    "Include only the failing lines. Return {\"lines\":[]} when every line carries the chain.",
    "Write each reason in the same language as the Idea.",
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...(input.priorBelief?.trim() ? ["", "Old belief to leave behind:", input.priorBelief.trim()] : []),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
    "",
    "Lines:",
    ...input.lines.map((line) => `${line.id}: ${line.narration.trim()}`),
  ].join("\n");
}

export function buildLineRepairPrompt(input: {
  ideaStatement: string;
  masterStatement: string;
  priorBelief?: string;
  ancestors?: AncestorStake[];
  pillarName: string;
  script: VoiceOverScript;
}): string {
  const failing = new Set(input.script.lineIssues.map((issue) => issue.lineId));
  return [
    "Rewrite only the narration lines that failed.",
    "Keep the picture on the chain: the Big Thought's stake happens, and that stake, not an advertisement, moves the Master Thought's outcome.",
    "If a failing line is in the conclusion, rewrite it so a viewer who hears only that line can say the Master Thought.",
    "Say it as what just happened in this situation. Leave the old belief behind. Do not stop at the mechanism.",
    "Do not install another cause. Do not title the scene Conclusion or Kesimpulan.",
    "A rewritten line must follow from the narration line before it.",
    "Do not open the line on an event the previous line did not cause or show.",
    "Return replacements only for the failing line ids. Do not return the other lines.",
    "Each replacement keeps more than one shot for that sentence, each with its own angle and its own English prompt.",
    "When a shot prompt names a @character token, that same prompt also names a @location token.",
    "Shots of every other line stay as they are.",
    "Narration stays in the Idea's language. Shot prompts stay in English.",
    "Do not add a claim the Idea does not already carry.",
    ...(input.script.brandName?.trim()
      ? [
          `Keep the exact brand name "${input.script.brandName.trim()}" in the script.`,
          "If a line you rewrite already says that name, keep the spelling.",
        ]
      : []),
    ...(input.script.cta?.trim()
      ? [
          `The action "${input.script.cta.trim()}" belongs in its own call-to-action scene.`,
          "Do not paste that label onto a conclusion line.",
        ]
      : []),
    ...confirmedDecisionRules(input.script.decisions, input.script.pointOfView),
    ...(input.script.pointOfView?.trim()
      ? ["Rewrite a failing line from that point of view. Keep the same story beat. Do not switch to another person."]
      : []),
    `Pillar: ${input.pillarName}.`,
    "Return JSON only: {\"lines\":[{\"lineId\":\"...\",\"narration\":\"...\",\"shots\":[{\"role\":\"...\",\"angle\":\"...\",\"visualFunction\":\"...\",\"prompt\":\"...\"}]}]}",
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...(input.priorBelief?.trim() ? ["", "Old belief to leave behind:", input.priorBelief.trim()] : []),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
    "",
    "Failing lines:",
    ...input.script.lineIssues.map((issue) => `${issue.lineId}: ${issue.reason}`),
    "",
    "Script:",
    JSON.stringify({
      scenes: input.script.scenes.map((scene) => ({
        title: scene.title,
        lines: scene.lines.map((line) => ({
          lineId: line.id,
          narration: line.narration,
          failing: failing.has(line.id),
          shots: line.shots.map((shot) => ({
            role: shot.role,
            angle: shot.angle,
            visualFunction: shot.visualFunction,
            prompt: shot.prompt,
          })),
        })),
      })),
    }),
  ].join("\n");
}
