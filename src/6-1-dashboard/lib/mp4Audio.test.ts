import { describe, expect, it } from "vitest";
import { extractMp4Audio } from "../../../supabase/functions/_shared/mp4Audio";

function box(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.byteLength);
  new DataView(out.buffer).setUint32(0, out.byteLength);
  out.set(new TextEncoder().encode(type), 4);
  out.set(payload, 8);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function u32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value);
  return out;
}

function sampleMp4(sample: Uint8Array): Uint8Array {
  const ftyp = box("ftyp", concat([
    new TextEncoder().encode("isom"),
    u32(0),
    new TextEncoder().encode("isom"),
  ]));
  const mdhd = new Uint8Array(24);
  new DataView(mdhd.buffer).setUint32(12, 44100);
  new DataView(mdhd.buffer).setUint32(16, 1024);
  const hdlr = new Uint8Array(37);
  hdlr.set(new TextEncoder().encode("soun"), 8);
  const sampleEntry = box("mp4a", new Uint8Array(28));
  const stsd = box("stsd", concat([new Uint8Array(4), u32(1), sampleEntry]));
  const stts = box("stts", concat([new Uint8Array(4), u32(1), u32(1), u32(1024)]));
  const stsc = box("stsc", concat([new Uint8Array(4), u32(1), u32(1), u32(1), u32(1)]));
  const stsz = box("stsz", concat([new Uint8Array(4), u32(0), u32(1), u32(sample.byteLength)]));
  const moovBeforeMdat = (mdatOffset: number) => {
    const stco = box("stco", concat([new Uint8Array(4), u32(1), u32(mdatOffset)]));
    const stbl = box("stbl", concat([stsd, stts, stsc, stsz, stco]));
    const minf = box("minf", concat([box("smhd", new Uint8Array(8)), box("dinf", box("dref", new Uint8Array(8))), stbl]));
    const mdia = box("mdia", concat([box("mdhd", mdhd), box("hdlr", hdlr), minf]));
    const trak = box("trak", concat([box("tkhd", new Uint8Array(84)), mdia]));
    return box("moov", concat([box("mvhd", new Uint8Array(100)), trak]));
  };
  const moovSize = moovBeforeMdat(0).byteLength;
  const mdatOffset = ftyp.byteLength + moovSize + 8;
  return concat([ftyp, moovBeforeMdat(mdatOffset), box("mdat", sample)]);
}

describe("extractMp4Audio", () => {
  it("keeps the audio sample bytes inside a readable m4a", () => {
    const sample = new TextEncoder().encode("spoken-by-seedance");
    const audio = extractMp4Audio(sampleMp4(sample));
    const again = extractMp4Audio(audio);
    expect(new TextDecoder().decode(audio)).toContain("spoken-by-seedance");
    expect(new TextDecoder().decode(again)).toContain("spoken-by-seedance");
    expect(String.fromCharCode(audio[4], audio[5], audio[6], audio[7])).toBe("ftyp");
  });
});
