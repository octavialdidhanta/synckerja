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
import { boxEdges, boxRect, FRAME_W, menuLines, menuTypingSeconds } from "./textLayout";

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

/** Gaya baku asks not to show prices ("Jangan sebut harga", "jangan tulis harga"). */
export function forbidsPrice(gaya: CatalogTextBlocks): boolean {
  return Object.values(gaya).some((b) => typeof b === "string" && /jangan\s+(?:sebut|menyebut|tulis|menulis|tampilkan|cantumkan)\s+harga/i.test(b));
}

/** "Rp 45.000", "45 ribu", "45rb", "45k", "1,5 juta", "harga cuma 45". */
export function mentionsPrice(text: string): boolean {
  return /\brp\.?\s?\d|\b\d+(?:[.,]\d+)?\s?(?:rb|ribu|k|jt|juta)\b|\bharga(?:nya)?\s+(?:cuma|hanya|mulai|seharga)?\s*\d/i.test(text);
}

/**
 * Brand / place spellings from Gaya baku: the written form ('ditulis "Sate Sultan PIK"') and the forms to avoid
 * ('bukan "P.I.K"', 'bukan cuma "Sate Sultan"').
 */
export function brandSpellings(gaya: CatalogTextBlocks): { preferred: string[]; avoid: string[] } {
  const preferred: string[] = [];
  const avoid: string[] = [];
  for (const box of Object.values(gaya)) {
    if (typeof box !== "string") continue;
    // Only a name line ("Nama brand ditulis "X""), not phrases like 'yang ditulis "varian"'.
    for (const m of box.matchAll(/(?:nama|brand|merek|lokasi)[^\n"“]{0,30}ditulis\s+["“]([^"”]{2,60})["”]/gi)) preferred.push(m[1]!.trim());
    for (const m of box.matchAll(/bukan(?:\s+(?:cuma|hanya))?\s+["“]([^"”]{2,40})["”]/gi)) avoid.push(m[1]!.trim());
  }
  return { preferred: [...new Set(preferred)], avoid: [...new Set(avoid)] };
}

/** A spelling to avoid, ignoring places where it is only part of the preferred written name. */
export function hitsAvoidedSpelling(text: string, avoid: string, preferred: string[]): boolean {
  let t = ` ${norm(text)} `;
  for (const p of preferred) {
    const np = norm(p);
    if (np) t = t.split(` ${np} `).join(" ");
  }
  const a = norm(avoid);
  return Boolean(a) && t.includes(` ${a} `);
}

/** Gaya baku asks every CTWA ad to close with a WhatsApp call to action. */
export function wantsWhatsappCta(gaya: CatalogTextBlocks): boolean {
  return Object.values(gaya).some((b) => typeof b === "string" && /ctwa/i.test(b) && /(ditutup|penutup|tutup)[^\n]*whats\s?app/i.test(b));
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
    code: "price_mentioned",
    levels: { ketat: "wajib", seimbang: "saran", bebas: "mati" },
    check: (spec, gaya) =>
      forbidsPrice(gaya)
        ? spec.texts.filter((t) => mentionsPrice(t.text)).map((t) => `"${t.text}" menyebut harga, padahal Gaya baku melarang menyebut harga. Hapus harganya.`)
        : [],
  },
  {
    code: "brand_spelling",
    levels: { ketat: "wajib", seimbang: "saran", bebas: "mati" },
    check: (spec, gaya) => {
      const { preferred, avoid } = brandSpellings(gaya);
      const out: string[] = [];
      for (const t of spec.texts) {
        const hit = avoid.find((a) => hitsAvoidedSpelling(t.text, a, preferred));
        if (hit) out.push(`"${t.text}" memakai "${hit}"; Gaya baku minta ${preferred.length ? `"${preferred.join('" / "')}"` : "ejaan lain"}.`);
      }
      return out;
    },
  },
  {
    // A render spec does not say whether the video is an ad, so this only suggests (organic posts end without WhatsApp).
    code: "cta_wa_missing",
    levels: { ketat: "saran", seimbang: "saran", bebas: "mati" },
    check: (spec, gaya) => {
      if (!wantsWhatsappCta(gaya)) return [];
      const dur = specDuration(spec);
      const tail = spec.texts.filter((t) => t.end > dur * 0.6);
      return tail.some((t) => t.anim === "wa_button" || /whats\s?app|\bwa\b/i.test(t.text))
        ? []
        : ["Kalau ini iklan CTWA: Gaya baku minta penutup ajakan chat WhatsApp, tapi tidak ada teks WhatsApp/WA di bagian akhir video. Pakai cta_wa di render.jobs.draft untuk tombol WhatsApp."];
    },
  },
  {
    // Two texts on screen at the same time whose boxes surely overlap (estimated on the low side). Subtitle under the
    // menu label has its own rule (sub_overlaps_menu). Only suggests: some layouts stack on purpose.
    code: "texts_overlap",
    levels: { ketat: "saran", seimbang: "saran", bebas: "mati" },
    check: (spec) => {
      const out: string[] = [];
      const items = spec.texts.filter((t) => spec.styles[t.style]).map((t) => ({ t, r: boxRect(t, spec.styles[t.style]!) }));
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i]!, b = items[j]!;
          if (Math.min(a.t.end, b.t.end) - Math.max(a.t.start, b.t.start) < 0.1) continue;
          const pair = [a.t.style, b.t.style].sort().join("+");
          if (pair === "menu+sub") continue;
          const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
          const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (w > 4 && h > 4) {
            out.push(
              `"${a.t.text}" (${a.t.style}) dan "${b.t.text}" (${b.t.style}) tampil bersamaan di ${Math.max(a.t.start, b.t.start).toFixed(2)}–${Math.min(a.t.end, b.t.end).toFixed(2)} s dan saling menumpuk; geser y salah satunya atau atur waktunya.`,
            );
          }
        }
      }
      return out;
    },
  },
  {
    // Gaya baku asks numbered points and titles to stay short; the line count is an estimate, so it only suggests.
    code: "label_too_long",
    levels: { ketat: "saran", seimbang: "saran", bebas: "mati" },
    check: (spec) =>
      spec.texts
        .filter((t) => t.anim === "menu_label" && spec.styles[t.style])
        .map((t) => ({ t, lines: menuLines(t, spec.styles[t.style]!) }))
        .filter((x) => x.lines > 2)
        .map((x) => `Label "${x.t.text}" kira-kira ${x.lines} baris; pendekkan teksnya supaya muat maksimal 2 baris.`),
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
      const files = [spec.audio.vo?.file, ...(spec.audio.vo_parts ?? []).map((v) => v.file), spec.audio.music?.file, spec.outro?.logo].filter(
        (f): f is string => Boolean(f),
      );
      return files
        // "@musik/…", "@brand/…": org libraries the Agent reads in place (0.1.17+), never copied into the production folder.
        .filter((f) => !/^(vo|_build)[\\/]/i.test(f) && !/^@[a-z][a-z0-9_-]{0,31}[\\/]/.test(f))
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
    } else if (t.anim === "menu_label" && menuTypingSeconds(t.text) > t.end - t.start - 0.05) {
      out.push({
        code: "label_typing_unfinished",
        kind: "teknis",
        level: "error",
        message: `"${t.text}" diketik ±${menuTypingSeconds(t.text).toFixed(1)} s tapi cuma tampil ${(t.end - t.start).toFixed(2)} s, jadi hilang sebelum selesai diketik. Panjangkan waktunya atau pendekkan teksnya.`,
      });
    }
    const style = spec.styles[t.style];
    if (style) {
      const { left, right } = boxEdges(t, style);
      if (left < -2 || right > FRAME_W + 2) {
        out.push({
          code: "text_off_screen",
          kind: "teknis",
          level: "error",
          message: `"${t.text}" (style ${t.style}${t.anim ? `, anim ${t.anim}` : ""}) keluar dari layar ${left < -2 ? "di kiri" : "di kanan"}. Geser x, kecilkan size/max_width, atau pendekkan teksnya${t.style === "judul" || t.style === "menu" ? `; style ${t.style} pakai anim menu_label (nempel kiri)` : ""}.`,
        });
      }
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
export type FootageLookup = (fileKey: string) => Promise<{ duration_seconds: number | null; scene_starts?: number[] } | null>;

/** A shot that keeps less than this much of another scene is a stray-frame glitch, not a deliberate cut. */
const STRAY_SCENE_SECONDS = 0.5;

/**
 * Scene changes inside one shot (from the catalog scenes of the clip). AI clips often hold 2–4 scenes in 10 seconds:
 * an in/out a few frames before a scene change shows a flash of the other scene, a longer overlap is a jump cut.
 */
export function sceneCutFinding(shotIndex: number, fileKey: string, inS: number, outS: number, starts: number[]): Finding | null {
  const inside = starts.filter((b) => b > inS + 0.02 && b < outS - 0.02);
  if (!inside.length) return null;
  const first = inside[0]!;
  const last = inside[inside.length - 1]!;
  const label = `Shot ${shotIndex + 1} (${fileKey}, ${inS}–${outS}s)`;
  if (inside.length === 1 && first - inS < STRAY_SCENE_SECONDS) {
    return {
      code: "shot_near_scene_cut",
      kind: "teknis",
      level: "error",
      message: `${label} mulai ${(first - inS).toFixed(2)}s sebelum pergantian scene di ${first}s: frame scene sebelumnya ikut kelihatan (glitch). Set in ke ${(first + 0.05).toFixed(2)}s atau lebih.`,
    };
  }
  if (inside.length === 1 && outS - last < STRAY_SCENE_SECONDS) {
    return {
      code: "shot_near_scene_cut",
      kind: "teknis",
      level: "error",
      message: `${label} berakhir ${(outS - last).toFixed(2)}s setelah pergantian scene di ${last}s: frame scene berikutnya ikut kelihatan (glitch). Set out ke ${Math.max(inS, last - 0.05).toFixed(2)}s atau kurang.`,
    };
  }
  return {
    code: "shot_crosses_scene",
    kind: "teknis",
    level: "error",
    message: `${label} melewati pergantian scene di ${inside.join(", ")}s (lompatan gambar di tengah shot). Pecah jadi shot terpisah di batas scene, atau pilih rentang dalam satu scene.`,
  };
}

/**
 * Technical checks that need the footage catalog. A file_key the catalog does not know, or a shot that ends past the
 * end of its source clip, would make the Agent fail (for example "pecah frame kurang: 537 dari 538") and retry for nothing.
 */
export async function footageFindings(spec: RenderSpecV1, lookup: FootageLookup): Promise<Finding[]> {
  const out: Finding[] = [];
  const durations = new Map<string, number | null>();
  const sceneStarts = new Map<string, number[]>();
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
    sceneStarts.set(key, clip.scene_starts ?? []);
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
    const cut = sceneCutFinding(i, s.file_key, s.in, s.out, sceneStarts.get(s.file_key) ?? []);
    if (cut) out.push(cut);
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
