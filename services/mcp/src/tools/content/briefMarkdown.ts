export type BriefShotInput = {
  timing?: string;
  visual?: string;
  vo?: string;
  element?: string;
  tagging?: string;
};

export type BriefSequenceInput = {
  name: string;
  shots: BriefShotInput[];
};

export type BriefAssetInput = {
  name: string;
  description?: string;
};

export type BriefConceptInput = {
  voiceOver?: string | null;
  postAspect?: "4:5" | "1:1" | null;
  characters?: BriefAssetInput[];
  locations?: BriefAssetInput[];
  properties?: BriefAssetInput[];
};

const MAX_SEQUENCES = 8;
const MAX_SHOTS = 30;
const MAX_CELL = 500;
const MAX_BRIEF = 20_000;

function cell(value: string | undefined): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\|/g, "/")
    .replace(/\n/g, "<br>");
}

function assetHandle(name: string, prefix: "location" | "character" | "property"): string {
  const body = name
    .replace(/^@+/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const key = body.startsWith(`${prefix}_`) ? body : `${prefix}_${body || "item"}`;
  return `@${key}`;
}

function withUniqueHandles(
  items: BriefAssetInput[],
  prefix: "location" | "character" | "property",
): { handle: string; description: string }[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = assetHandle(item.name, prefix);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const handle = count === 0 ? base : `${base}_${count + 1}`;
    return { handle, description: (item.description ?? "").trim() };
  });
}

export function buildBriefMarkdown(sequences: BriefSequenceInput[]): string {
  if (sequences.length < 1 || sequences.length > MAX_SEQUENCES) throw new Error("invalid_input");
  const shotCount = sequences.reduce((sum, sequence) => sum + sequence.shots.length, 0);
  if (shotCount < 1 || shotCount > MAX_SHOTS) throw new Error("invalid_input");

  for (const sequence of sequences) {
    const name = sequence.name.trim();
    if (!name || name.length > 80 || sequence.shots.length < 1) throw new Error("invalid_input");
    for (const shot of sequence.shots) {
      for (const value of [shot.timing, shot.visual, shot.vo, shot.element, shot.tagging]) {
        if ((value ?? "").length > MAX_CELL) throw new Error("invalid_input");
      }
    }
  }

  const hasVisual = sequences.some((sequence) =>
    sequence.shots.some((shot) => (shot.visual ?? "").trim().length > 0),
  );
  const headers = ["Timing", "Visual", "VO (Voice Over)"];
  if (hasVisual) headers.push("Scene Visual");
  headers.push("Element Lainnya", "Tagging");

  const body = sequences.flatMap((sequence) =>
    sequence.shots.map((shot) => {
      const cells = [cell(shot.timing), "", cell(shot.vo)];
      if (hasVisual) cells.push(cell(shot.visual));
      cells.push(cell(shot.element), cell(shot.tagging));
      return `| ${cells.join(" | ")} |`;
    }),
  );
  const header = `| ${headers.join(" | ")} |`;
  const align = `| ${headers.map(() => "---").join(" | ")} |`;
  const comment = `<!--synckerja-brief-sequences:${JSON.stringify(
    sequences.map((sequence) => ({
      id: crypto.randomUUID(),
      name: sequence.name.trim(),
      rowCount: sequence.shots.length,
    })),
  )}-->`;
  const brief = `${header}\n${align}\n${body.join("\n")}\n\n${comment}`;
  if (brief.length > MAX_BRIEF) throw new Error("invalid_input");
  return brief;
}

export function buildBriefConcept(input: BriefConceptInput, contentTypeName: string): string | null {
  const voiceOver = input.voiceOver?.trim() ?? "";
  const locations = withUniqueHandles(input.locations ?? [], "location");
  const characters = withUniqueHandles(input.characters ?? [], "character");
  const properties = withUniqueHandles(input.properties ?? [], "property");
  const shape = contentTypeName.trim().toLowerCase();
  const postAspect = shape === "post" || shape === "carousel" ? input.postAspect ?? null : null;
  if (!voiceOver && locations.length + characters.length + properties.length === 0 && !postAspect) {
    return null;
  }
  return JSON.stringify({
    v: 1,
    ...(voiceOver ? { voiceOver } : {}),
    ...(postAspect ? { postAspect } : {}),
    locations,
    characters,
    properties,
  });
}
