/**
 * Checks on a render spec before it is queued, so the same mistakes are caught for every organization and every AI.
 *
 * Two kinds of rule:
 * - teknis: always on, cannot be turned off or overridden (the video would be broken).
 * - gaya: per organization, level mati (off) | saran (warning, never blocks) | wajib (must be fixed, or overridden for
 *   one video with a reason). Levels come from a preset and per-rule lines in the Gaya baku box "aturan":
 *     preset: ketat
 *     sub_overlaps_menu: wajib
 *   No box means preset "seimbang". There is no toggle screen yet on purpose: the data model is ready for one.
 *
 * Numbers live here or in Gaya baku, never in the playbook (which only says: fix every finding).
 */
import type { CatalogTextBlocks } from "../../db/catalog";
import { specDuration, type RenderSpecV1 } from "./renderSpec";

export type RuleLevel = "mati" | "saran" | "wajib";
export type Preset = "ketat" | "seimbang" | "bebas";

export type Finding = {
  code: string;
  kind: "teknis" | "gaya";
  level: "error" | RuleLevel;
  message: string;
};

export type SpecCheckResult = {
  preset: Preset;
  errors: Finding[];
  required: Finding[];
  suggestions: Finding[];
  overridden: Array<Finding & { reason: string }>;
};

type GayaRule = {
  code: string;
  levels: Record<Preset, RuleLevel>;
  check: (spec: RenderSpecV1, gaya: CatalogTextBlocks) => string[];
};

const MENU_SAFE_Y = -0.45; // menu label centre must sit at or below this (CapCut y, up = positive): under the food

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end - 0.01 && b.start < a.end - 0.01;
}

const STOP = new Set(["di", "ke", "dan", "yang", "nya", "the", "a", "an", "of", "to", "aja", "itu", "ini", "jadi", "bikin", "auto"]);

/** Quoted phrases on Gaya baku lines that say what to avoid ("Hindari ...", "Jangan ..."). */
export function bannedPhrases(gaya: CatalogTextBlocks): string[] {
  const out: string[] = [];
  for (const box of Object.values(gaya)) {
    if (typeof box !== "string") continue;
    for (const line of box.split(/\r?\n/)) {
      if (!/hindari|jangan|larang/i.test(line)) continue;
      for (const m of line.matchAll(/["“”']([^"“”']{3,80})["“”']/g)) out.push(m[1]!.trim().toLowerCase());
    }
  }
  return [...new Set(out)];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** A text hits a banned phrase when it contains the phrase, or two of its meaningful words in a row (e.g. "tinggal sedot"). */
export function hitsBannedPhrase(text: string, phrase: string): boolean {
  const t = ` ${norm(text)} `;
  const p = norm(phrase);
  if (!p) return false;
  if (t.includes(` ${p} `)) return true;
  const words = p.split(" ");
  for (let i = 0; i + 1 < words.length; i++) {
    const a = words[i]!;
    const b = words[i + 1]!;
    if (STOP.has(a) || STOP.has(b) || a.length < 4 || b.length < 4) continue;
    if (t.includes(` ${a} ${b} `)) return true;
  }
  return false;
}

const GAYA_RULES: GayaRule[] = [
  {
    code: "menu_covers_food",
    levels: { ketat: "wajib", seimbang: "saran", bebas: "mati" },
    check: (spec) => {
      const menu = spec.styles.menu;
      if (!menu || !spec.texts.some((t) => t.style === "menu")) return [];
      const y = menu.y ?? 0;
      return y > MENU_SAFE_Y ? [`Label menu di y ${y} jatuh di tengah layar dan menutupi makanan; turunkan ke ${MENU_SAFE_Y} atau lebih rendah.`] : [];
    },
  },
  {
    code: "sub_overlaps_menu",
    levels: { ketat: "wajib", seimbang: "saran", bebas: "mati" },
    check: (spec) => {
      const menus = spec.texts.filter((t) => t.style === "menu");
      const out: string[] = [];
      for (const t of spec.texts) {
        if (t.style === "menu" || t.style === "hook") continue;
        const hit = menus.find((m) => overlaps(t, m));
        if (hit) out.push(`"${t.text}" (${t.start}-${t.end}s) tampil bersamaan dengan label menu "${hit.text}"; subtitle disembunyikan selama label menu.`);
      }
      return out;
    },
  },
  {
    code: "banned_phrase",
    levels: { ketat: "wajib", seimbang: "saran", bebas: "mati" },
    check: (spec, gaya) => {
      const banned = bannedPhrases(gaya);
      const out: string[] = [];
      for (const t of spec.texts) {
        const p = banned.find((b) => hitsBannedPhrase(t.text, b));
        if (p) out.push(`"${t.text}" mirip kalimat yang dilarang Gaya baku ("${p}"). Pakai fakta (proses, bahan, porsi).`);
      }
      return out;
    },
  },
  {
    code: "no_vo_original_sound",
    levels: { ketat: "saran", seimbang: "saran", bebas: "mati" },
    check: (spec, gaya) => {
      if (spec.audio.vo || !spec.audio.music) return [];
      return /tanpa vo|asmr|suara asli/i.test(gaya.musik ?? "")
        ? ["Tanpa VO: Gaya baku minta suara asli footage dan musik hanya di penutup, tapi Agent belum bisa memakai suara asli. Sebutkan ke user."]
        : [];
    },
  },
  {
    code: "output_name_format",
    levels: { ketat: "wajib", seimbang: "mati", bebas: "mati" },
    check: (spec) =>
      /_v\d+_9x16$/i.test(spec.output_name)
        ? []
        : [`output_name "${spec.output_name}" belum ikut format <ContentID>_<Judul>_<VO|ASMR>_v<N>_9x16.`],
  },
  {
    code: "production_subfolder",
    levels: { ketat: "wajib", seimbang: "mati", bebas: "mati" },
    check: (spec) => {
      const files = [spec.audio.vo?.file, spec.audio.music?.file, spec.outro?.logo].filter((f): f is string => Boolean(f));
      return files
        .filter((f) => !/^(vo|_build)[\\/]/i.test(f))
        .map((f) => `${f} ada di luar vo/ atau _build/; folder produksi hanya vo, _build, _capcut, output.`);
    },
  },
  {
    // Creative input, not a spec rule: checked by render.jobs.draft from its references input (see referenceFindings).
    // It only ever suggests (wajib in the aturan box is read as saran), so it never blocks a render.
    code: "reference_unused",
    levels: { ketat: "saran", seimbang: "saran", bebas: "mati" },
    check: () => [],
  },
];

export const GAYA_RULE_CODES = GAYA_RULES.map((r) => r.code);

/**
 * Was the edit built on the organization's reference videos? The AI names the ids it used (references) or says why
 * none fit (no_reference_reason). Unknown ids and silence become one suggestion that lists what is available.
 */
export function referenceFindings(
  gaya: CatalogTextBlocks,
  input: { references?: string[]; no_reference_reason?: string },
  available: Array<{ id: string; title: string | null }>,
): Finding[] {
  if (available.length === 0) return [];
  const level = ruleLevels(gaya).levels["reference_unused"];
  if (level === "mati") return [];
  const list = available
    .slice(0, 8)
    .map((r) => `${r.id}${r.title ? ` (${r.title})` : ""}`)
    .join(", ");
  const used = input.references ?? [];
  const known = new Set(available.map((r) => r.id));
  const unknown = used.filter((id) => !known.has(id));
  const out: Finding[] = [];
  if (unknown.length) {
    out.push({
      code: "reference_unused",
      kind: "gaya",
      level: "saran",
      message: `Referensi ${unknown.join(", ")} tidak ada di katalog org ini. Yang ada: ${list}.`,
    });
  } else if (used.length === 0 && !input.no_reference_reason?.trim()) {
    out.push({
      code: "reference_unused",
      kind: "gaya",
      level: "saran",
      message: `Edit ini belum memakai referensi. Baca catalog.reference.get untuk struktur, beat, dan motion graphic, lalu isi references [id], atau isi no_reference_reason kalau memang tidak ada yang cocok. Yang ada: ${list}.`,
    });
  }
  return out;
}
export const TEKNIS_RULE_CODES = ["text_outside_video", "text_too_short", "shots_empty_duration"] as const;

function teknisFindings(spec: RenderSpecV1): Finding[] {
  const out: Finding[] = [];
  const dur = specDuration(spec);
  if (!(dur > 0)) out.push({ code: "shots_empty_duration", kind: "teknis", level: "error", message: "Durasi total shot 0 detik." });
  for (const t of spec.texts) {
    if (t.start >= dur - 0.01) {
      out.push({ code: "text_outside_video", kind: "teknis", level: "error", message: `"${t.text}" mulai di ${t.start}s, setelah video selesai (${dur.toFixed(2)}s).` });
    } else if (t.end - t.start < 0.4) {
      out.push({ code: "text_too_short", kind: "teknis", level: "error", message: `"${t.text}" cuma tampil ${(t.end - t.start).toFixed(2)}s, tidak terbaca.` });
    }
  }
  return out;
}

/** Levels for this organization: preset plus per-rule lines from the Gaya baku box "aturan". */
export function ruleLevels(gaya: CatalogTextBlocks): { preset: Preset; levels: Record<string, RuleLevel> } {
  const box = (gaya as Record<string, string | null | undefined>)["aturan"] ?? "";
  let preset: Preset = "seimbang";
  const pm = /preset\s*:\s*(ketat|seimbang|bebas)/i.exec(box);
  if (pm) preset = pm[1]!.toLowerCase() as Preset;
  const levels: Record<string, RuleLevel> = {};
  for (const r of GAYA_RULES) levels[r.code] = r.levels[preset];
  for (const m of box.matchAll(/^\s*-?\s*([a-z_]+)\s*:\s*(mati|saran|wajib)\b/gim)) {
    const code = m[1]!.toLowerCase();
    if (code in levels) levels[code] = m[2]!.toLowerCase() as RuleLevel;
  }
  return { preset, levels };
}

/** Catalog facts about one footage file: null when the organization's catalog has no such file_key. */
export type FootageLookup = (fileKey: string) => Promise<{ duration_seconds: number | null } | null>;

/**
 * Technical checks that need the footage catalog. A file_key the catalog does not know, or a shot that ends past the
 * end of its source clip, would make the Agent fail (for example "pecah frame kurang: 537 dari 538") and retry for nothing.
 */
export async function footageFindings(spec: RenderSpecV1, lookup: FootageLookup): Promise<Finding[]> {
  const out: Finding[] = [];
  const durations = new Map<string, number | null>();
  for (const key of new Set(spec.shots.map((s) => s.file_key))) {
    const clip = await lookup(key);
    if (!clip) {
      out.push({
        code: "footage_unknown",
        kind: "teknis",
        level: "error",
        message: `file_key ${key} tidak ada di katalog footage org ini. Ambil file_key dari footage.search / footage.get.`,
      });
      continue;
    }
    durations.set(key, clip.duration_seconds);
  }
  spec.shots.forEach((s, i) => {
    const dur = durations.get(s.file_key);
    if (dur != null && s.out > dur + 0.001) {
      out.push({
        code: "shot_past_clip_end",
        kind: "teknis",
        level: "error",
        message: `Shot ${i + 1} (${s.file_key}) berhenti di ${s.out}s, padahal klipnya cuma ${dur}s. Set out paling banyak ${Math.max(0, dur - 0.05).toFixed(2)}s.`,
      });
    }
  });
  return out;
}

export function checkSpec(
  spec: RenderSpecV1,
  gaya: CatalogTextBlocks,
  overrides: Array<{ code: string; reason: string }> = [],
  extraErrors: Finding[] = [],
): SpecCheckResult {
  const { preset, levels } = ruleLevels(gaya);
  const result: SpecCheckResult = {
    preset,
    errors: [...teknisFindings(spec), ...extraErrors],
    required: [],
    suggestions: [],
    overridden: [],
  };
  for (const rule of GAYA_RULES) {
    const level = levels[rule.code]!;
    if (level === "mati") continue;
    for (const message of rule.check(spec, gaya)) {
      const f: Finding = { code: rule.code, kind: "gaya", level, message };
      if (level === "saran") {
        result.suggestions.push(f);
        continue;
      }
      const o = overrides.find((x) => x.code === rule.code && x.reason.trim().length >= 5);
      if (o) result.overridden.push({ ...f, reason: o.reason.trim() });
      else result.required.push(f);
    }
  }
  return result;
}

/** True when the spec may be queued: no technical error and every wajib finding fixed or overridden with a reason. */
export function specCheckPasses(r: SpecCheckResult): boolean {
  return r.errors.length === 0 && r.required.length === 0;
}
