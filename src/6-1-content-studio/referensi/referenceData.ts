/** Reference videos from catalog_references.document (the original referensi.json), same shape as katalog.html REF. */

export interface RefSegment {
  a: number;
  b: number;
}

export interface RefBeat extends RefSegment {
  index: number;
  hook: boolean;
  peran: string;
  jenis: string;
  visual: string;
  kenapa: string;
  thumbPath: string | null;
  sate: { ide: string; action: string; produk: string; lokasi: string; area: string };
}

export interface RefFont {
  asli: string;
  mirip: string[];
  warna: string[];
  catatan: string;
}

export interface RefMotion extends RefSegment {
  index: number;
  jenis: string;
  nama: string;
  deskripsi: string;
  animasi: string;
  kenapa: string;
  sate: string;
  /** how to build it: Remotion, SAM 2 + RVM, chroma key, Python effect … */
  cara: string;
  font: RefFont | null;
  thumbPath: string | null;
  samplePath: string | null;
}

export interface Reference {
  id: string;
  judul: string;
  kreator: string;
  durasi: number;
  adaVo: boolean;
  bahasa: string;
  file: string;
  struktur: Array<RefSegment & { bagian: string; isi: string }>;
  vo: Array<RefSegment & { t: string }>;
  kenapa: string[];
  editing: string[];
  beats: RefBeat[];
  mg: RefMotion[];
}

/** Roles of a visual, in katalog.html PERAN order. */
export const PERAN = ["Hook", "Bukti proses", "Produk", "Detail", "Reveal", "Reaksi", "Penutup"];

/** Motion graphic kinds shown as filters, in this order; unknown kinds come after. */
export const MG_JENIS = [
  "Subtitle",
  "Hook",
  "Label / judul",
  "Chat",
  "Stiker / panah",
  "Transisi",
  "Teks di belakang orang",
  "Green screen / ganti background",
  "Lainnya",
];

type Doc = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const list = (v: unknown): Doc[] => (Array.isArray(v) ? v.filter((x): x is Doc => Boolean(x) && typeof x === "object") : []);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const path = (v: unknown) => (typeof v === "string" && v ? v : null);

export function parseReference(externalId: string, doc: Doc): Reference {
  return {
    id: externalId,
    judul: str(doc.judul) || externalId,
    kreator: str(doc.kreator),
    durasi: num(doc.durasi),
    adaVo: doc.ada_vo === true,
    bahasa: str(doc.bahasa),
    file: str(doc.file),
    struktur: list(doc.struktur).map((s) => ({ a: num(s.a), b: num(s.b), bagian: str(s.bagian), isi: str(s.isi) })),
    vo: list(doc.vo).map((v) => ({ a: num(v.a), b: num(v.b), t: str(v.t) })),
    kenapa: strings(doc.kenapa),
    editing: strings(doc.editing),
    beats: list(doc.beats).map((x, index) => {
      const s = (x.sate && typeof x.sate === "object" ? x.sate : {}) as Doc;
      return {
        index,
        a: num(x.a),
        b: num(x.b),
        hook: x.hook === true,
        peran: str(x.peran),
        jenis: str(x.jenis),
        visual: str(x.visual),
        kenapa: str(x.kenapa),
        thumbPath: path(x.storage_path),
        sate: { ide: str(s.ide), action: str(s.action), produk: str(s.produk), lokasi: str(s.lokasi), area: str(s.area) },
      };
    }),
    mg: list(doc.mg).map((x, index) => {
      const f = x.font && typeof x.font === "object" ? (x.font as Doc) : null;
      return {
        index,
        a: num(x.a),
        b: num(x.b),
        jenis: str(x.jenis) || "Lainnya",
        nama: str(x.nama),
        deskripsi: str(x.deskripsi),
        animasi: str(x.animasi),
        kenapa: str(x.kenapa),
        sate: str(x.sate),
        cara: str(x.cara_bikin) || str(x.cara),
        font: f ? { asli: str(f.asli), mirip: strings(f.mirip), warna: strings(f.warna), catatan: str(f.catatan) } : null,
        thumbPath: path(x.storage_path),
        samplePath: path(x.sample_storage_path),
      };
    }),
  };
}

/** "1:05" like katalog.html fmtT(). */
export function fmtT(s: number): string {
  const t = Math.max(0, Number(s) || 0);
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}

/** Filter chips for the motion graphic bank: kinds that exist, in MG_JENIS order, with counts. */
export function motionKinds(all: RefMotion[]): Array<{ jenis: string; n: number }> {
  const present = [...new Set(all.map((m) => m.jenis))];
  const ordered = [...MG_JENIS.filter((j) => present.includes(j)), ...present.filter((j) => !MG_JENIS.includes(j))];
  return ordered.map((jenis) => ({ jenis, n: all.filter((m) => m.jenis === jenis).length }));
}

/** The line katalog.html mgStd() adds to the Gaya teks box. */
export function standardLine(ref: Reference, m: RefMotion): string {
  const font = m.font ? ` Font mirip ${m.font.mirip[0] ?? m.font.asli}, warna ${m.font.warna.join(" / ")}.` : "";
  return `- ${m.jenis} (dari ${ref.judul.split(" — ")[0]}): ${m.nama}. ${m.animasi}${font}`;
}

/** Video files in the referensi folder that no reference points at yet: waiting for Claude's analysis. */
export function unanalyzedFiles(files: string[], refs: Reference[]): string[] {
  const known = new Set(refs.map((r) => r.file.toLowerCase()));
  return files.filter((f) => /\.(mp4|mov|m4v|webm)$/i.test(f) && !known.has(f.toLowerCase()));
}
