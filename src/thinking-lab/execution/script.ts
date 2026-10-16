import { stringifyMarkdownTable } from "@/6-1-dashboard/utils/markdownTableUtils";
import { createBriefSequence, upsertBriefSequencesInMarkdown } from "@/6-1-dashboard/modal/briefSequences";
import { serializeBriefConcept } from "@/6-1-dashboard/modal/briefConceptAssets";
import type { ExecutionSemanticFacts } from "@/thinking-lab/execution/types";
import { isFlashSalePillar } from "@/thinking-lab/execution/types";

const PLAN_TABLE_HEADERS = [
  "Timing",
  "Visual",
  "VO (Voice Over)",
  "Shot",
  "Angle",
  "Visual function",
  "Veo 3 prompt",
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

export type ScriptLine = {
  id: string;
  narration: string;
  shots: ScriptShot[];
};

export type ScriptScene = {
  id: string;
  title: string;
  lines: ScriptLine[];
};

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

function readLine(value: unknown, sceneId: string, index: number): ScriptLine | null {
  const id = `${sceneId}-l${index + 1}`;
  if (typeof value === "string") {
    const narration = value.trim();
    return narration ? { id, narration, shots: [] } : null;
  }
  const row = asRecord(value);
  if (!row) return null;
  const narration = asText(row.narration ?? row.vo ?? row.text ?? row.line);
  const shots = asList(row.shots ?? row.shot).flatMap((shot, shotIndex) => {
    const parsed = readShot(shot, id, shotIndex);
    return parsed ? [parsed] : [];
  });
  if (!narration && shots.length === 0) return null;
  return { id, narration, shots };
}

export function parseVoiceOverScript(raw: unknown): VoiceOverScript | null {
  const row = scriptRoot(raw);
  if (!row) return null;
  const scenes = asList(row.scenes).flatMap((scene, sceneIndex) => {
    const sceneRow = asRecord(scene);
    if (!sceneRow && typeof scene !== "string") return [];
    const id = `s${sceneIndex + 1}`;
    const title = sceneRow ? asText(sceneRow.title ?? sceneRow.name) : "";
    const source = sceneRow ? asList(sceneRow.lines ?? sceneRow.rows ?? sceneRow.narrations) : [scene];
    const lines = source.flatMap((line, lineIndex) => {
      const parsed = readLine(line, id, lineIndex);
      return parsed ? [parsed] : [];
    });
    if (lines.length === 0 || lines.every((line) => !line.narration.trim())) return [];
    return [{ id, title: title || `Scene ${sceneIndex + 1}`, lines }];
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
  };
}

export function flattenVoiceOver(script: VoiceOverScript): string {
  return script.scenes
    .map((scene) => [scene.title.trim(), ...scene.lines.map((line) => line.narration.trim())].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n")
    .trim();
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
    .flatMap((scene) => scene.lines.flatMap((line) => line.shots.map((shot) => shot.prompt.trim()).filter(Boolean)))
    .join("\n\n");
}

export function buildPlanBriefMarkdown(script: VoiceOverScript): string {
  const rows: string[][] = [[...PLAN_TABLE_HEADERS]];
  const sequences = script.scenes.flatMap((scene) => {
    let rowCount = 0;
    for (const line of scene.lines) {
      const shots = line.shots.length > 0 ? line.shots : [null];
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
  if (!script || script.lineIssues.length === 0) return false;
  if (facts.viewerClimb !== "CLIMBS" || facts.subjectMatch !== "MATCH") return false;
  if (facts.mechanismVisible === false || facts.pillarOutside === true) return false;
  if (isFlashSalePillar(facts.pillar) && facts.masterSells !== true) return false;
  if (
    facts.relationToParent === "CLIMB_MISSED" ||
    facts.relationToParent === "SUBJECT_MISMATCH" ||
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

export function buildLineAuditPrompt(input: { ideaStatement: string; lines: Array<{ id: string; narration: string }> }): string {
  return [
    "Read each narration line of a voice-over script.",
    "A line fails only when it adds a claim the Idea does not already carry, or drops the Idea's message.",
    "A short line, a question, or a line that only shows the Idea does not fail.",
    "Return JSON only: {\"lines\":[{\"lineId\":\"...\",\"reason\":\"...\"}]}.",
    "Include only the failing lines. Return {\"lines\":[]} when every line carries the Idea.",
    "Write each reason in the same language as the Idea.",
    "",
    "Idea:",
    input.ideaStatement.trim(),
    "",
    "Lines:",
    ...input.lines.map((line) => `${line.id}: ${line.narration.trim()}`),
  ].join("\n");
}

export function buildLineRepairPrompt(input: { ideaStatement: string; pillarName: string; script: VoiceOverScript }): string {
  const failing = new Set(input.script.lineIssues.map((issue) => issue.lineId));
  return [
    "Rewrite only the narration lines that failed the Idea message.",
    "The path already climbs to the Master Thought. Do not change that path.",
    "Return replacements only for the failing line ids. Do not return the other lines.",
    "Each replacement keeps more than one shot for that sentence, each with its own angle and its own English prompt.",
    "Shots of every other line stay as they are.",
    "Narration stays in the Idea's language. Shot prompts stay in English.",
    "Do not add a claim the Idea does not already carry.",
    `Pillar: ${input.pillarName}.`,
    "Return JSON only: {\"lines\":[{\"lineId\":\"...\",\"narration\":\"...\",\"shots\":[{\"role\":\"...\",\"angle\":\"...\",\"visualFunction\":\"...\",\"prompt\":\"...\"}]}]}",
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
