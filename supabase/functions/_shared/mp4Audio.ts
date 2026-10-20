type Box = { type: string; start: number; header: number; end: number };

const text = new TextEncoder();

function view(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function u32(data: Uint8Array, offset: number): number {
  return view(data).getUint32(offset);
}

function fourcc(data: Uint8Array, offset: number): string {
  return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

function readBoxes(data: Uint8Array, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = u32(data, offset);
    const type = fourcc(data, offset + 4);
    let header = 8;
    if (size === 1) {
      if (u32(data, offset + 8) !== 0) throw new Error("Berkas video terlalu besar untuk diambil suaranya.");
      size = u32(data, offset + 12);
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) break;
    boxes.push({ type, start: offset, header, end: offset + size });
    offset += size;
  }
  return boxes;
}

function children(data: Uint8Array, box: Box): Box[] {
  return readBoxes(data, box.start + box.header, box.end);
}

function child(data: Uint8Array, box: Box, type: string): Box | undefined {
  return children(data, box).find((item) => item.type === type);
}

function findPath(data: Uint8Array, box: Box, types: string[]): Box | undefined {
  let current: Box | undefined = box;
  for (const type of types) {
    if (!current) return undefined;
    current = child(data, current, type);
  }
  return current;
}

function audioTrack(data: Uint8Array): Box | null {
  const moov = readBoxes(data, 0, data.byteLength).find((box) => box.type === "moov");
  if (!moov) return null;
  for (const trak of children(data, moov).filter((box) => box.type === "trak")) {
    const hdlr = findPath(data, trak, ["mdia", "hdlr"]);
    if (hdlr && fourcc(data, hdlr.start + hdlr.header + 8) === "soun") return trak;
  }
  return null;
}

function sampleSizes(data: Uint8Array, stsz: Box): number[] {
  const payload = stsz.start + stsz.header;
  const constant = u32(data, payload + 4);
  const count = u32(data, payload + 8);
  if (constant > 0) return Array.from({ length: count }, () => constant);
  return Array.from({ length: count }, (_, index) => u32(data, payload + 12 + index * 4));
}

function chunkOffsets(data: Uint8Array, box: Box): number[] {
  const payload = box.start + box.header;
  const count = u32(data, payload + 4);
  const wide = box.type === "co64";
  return Array.from({ length: count }, (_, index) => {
    const offset = payload + 8 + index * (wide ? 8 : 4);
    if (!wide) return u32(data, offset);
    if (u32(data, offset) !== 0) throw new Error("Berkas video terlalu besar untuk diambil suaranya.");
    return u32(data, offset + 4);
  });
}

function audioSamples(data: Uint8Array, stbl: Box): Array<{ offset: number; size: number }> {
  const stsz = child(data, stbl, "stsz");
  const stsc = child(data, stbl, "stsc");
  const stco = child(data, stbl, "stco") ?? child(data, stbl, "co64");
  if (!stsz || !stsc || !stco) throw new Error("Video ini tidak punya tabel suara yang bisa dibaca.");
  const sizes = sampleSizes(data, stsz);
  const offsets = chunkOffsets(data, stco);
  const payload = stsc.start + stsc.header;
  const entries = u32(data, payload + 4);
  const first = Array.from({ length: entries }, (_, index) => u32(data, payload + 8 + index * 12));
  const perChunk = Array.from({ length: entries }, (_, index) => u32(data, payload + 12 + index * 12));
  const samples: Array<{ offset: number; size: number }> = [];
  let sampleIndex = 0;
  for (let chunk = 0; chunk < offsets.length; chunk += 1) {
    let count = perChunk[0] ?? 1;
    for (let entry = 0; entry < first.length; entry += 1) {
      if (first[entry] <= chunk + 1) count = perChunk[entry] ?? count;
    }
    let cursor = offsets[chunk];
    for (let index = 0; index < count && sampleIndex < sizes.length; index += 1) {
      const size = sizes[sampleIndex];
      samples.push({ offset: cursor, size });
      cursor += size;
      sampleIndex += 1;
    }
  }
  if (samples.length === 0) throw new Error("Video ini tidak punya sampel suara.");
  return samples;
}

function box(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.byteLength);
  view(out).setUint32(0, out.byteLength);
  out.set(text.encode(type), 4);
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

function putU32(target: Uint8Array, offset: number, value: number) {
  view(target).setUint32(offset, value);
}

function putU16(target: Uint8Array, offset: number, value: number) {
  view(target).setUint16(offset, value);
}

function identityMatrix(target: Uint8Array, offset: number) {
  putU32(target, offset, 0x00010000);
  putU32(target, offset + 16, 0x00010000);
  putU32(target, offset + 32, 0x40000000);
}

function buildM4a(input: {
  mdhd: Uint8Array;
  sampleEntry: Uint8Array;
  stts: Uint8Array;
  stsz: Uint8Array;
  sampleBytes: Uint8Array;
  sampleCount: number;
  timescale: number;
  duration: number;
  mdatOffset: number;
}): Uint8Array {
  const ftypPayload = new Uint8Array(20);
  ftypPayload.set(text.encode("M4A "), 0);
  ftypPayload.set(text.encode("M4A "), 8);
  ftypPayload.set(text.encode("mp42"), 12);
  ftypPayload.set(text.encode("isom"), 16);

  const mvhd = new Uint8Array(100);
  putU32(mvhd, 12, input.timescale || 44100);
  putU32(mvhd, 16, input.duration);
  putU32(mvhd, 20, 0x00010000);
  putU16(mvhd, 24, 0x0100);
  identityMatrix(mvhd, 36);
  putU32(mvhd, 96, 2);

  const tkhd = new Uint8Array(84);
  putU32(tkhd, 0, 3);
  putU32(tkhd, 12, 1);
  putU32(tkhd, 20, input.duration);
  putU16(tkhd, 36, 0x0100);
  identityMatrix(tkhd, 40);

  const hdlr = new Uint8Array(37);
  hdlr.set(text.encode("soun"), 8);
  hdlr.set(text.encode("SoundHandler"), 24);
  const url = box("url ", new Uint8Array([0, 0, 0, 1]));
  const drefPayload = new Uint8Array(8);
  putU32(drefPayload, 4, 1);
  const stsdPayload = new Uint8Array(8);
  putU32(stsdPayload, 4, 1);
  const stscPayload = new Uint8Array(20);
  putU32(stscPayload, 4, 1);
  putU32(stscPayload, 8, 1);
  putU32(stscPayload, 12, input.sampleCount);
  putU32(stscPayload, 16, 1);
  const stcoPayload = new Uint8Array(12);
  putU32(stcoPayload, 4, 1);
  putU32(stcoPayload, 8, input.mdatOffset);

  const stbl = box("stbl", concat([
    box("stsd", concat([stsdPayload, input.sampleEntry])),
    input.stts,
    box("stsc", stscPayload),
    input.stsz,
    box("stco", stcoPayload),
  ]));
  const minf = box("minf", concat([box("smhd", new Uint8Array(8)), box("dinf", box("dref", concat([drefPayload, url]))), stbl]));
  const mdia = box("mdia", concat([box("mdhd", input.mdhd), box("hdlr", hdlr), minf]));
  const moov = box("moov", concat([box("mvhd", mvhd), box("trak", concat([box("tkhd", tkhd), mdia]))]));
  return concat([box("ftyp", ftypPayload), moov, box("mdat", input.sampleBytes)]);
}

/** Pull the audio track out of an MP4 and wrap it as an M4A ElevenLabs can accept. */
export function extractMp4Audio(data: Uint8Array): Uint8Array {
  const trak = audioTrack(data);
  if (!trak) throw new Error("Video ini tidak punya trek suara.");
  const mdia = child(data, trak, "mdia");
  const mdhd = mdia ? child(data, mdia, "mdhd") : undefined;
  const stbl = mdia ? findPath(data, mdia, ["minf", "stbl"]) : undefined;
  if (!mdhd || !stbl) throw new Error("Video ini tidak punya trek suara yang lengkap.");
  const stsd = child(data, stbl, "stsd");
  const stts = child(data, stbl, "stts");
  const stsz = child(data, stbl, "stsz");
  if (!stsd || !stts || !stsz) throw new Error("Video ini tidak punya deskripsi suara.");
  const entryStart = stsd.start + stsd.header + 8;
  const entrySize = u32(data, entryStart);
  if (entrySize < 8 || entryStart + entrySize > stsd.end) throw new Error("Deskripsi suara video kosong.");

  const mdhdPayload = data.slice(mdhd.start + mdhd.header, mdhd.end);
  const version = mdhdPayload[0] ?? 0;
  const timescale = u32(mdhdPayload, version === 1 ? 20 : 12);
  const duration = u32(mdhdPayload, version === 1 ? 28 : 16);
  const samples = audioSamples(data, stbl);
  const sampleBytes = concat(samples.map((sample) => data.slice(sample.offset, sample.offset + sample.size)));
  const parts = {
    mdhd: mdhdPayload,
    sampleEntry: data.slice(entryStart, entryStart + entrySize),
    stts: data.slice(stts.start, stts.end),
    stsz: data.slice(stsz.start, stsz.end),
    sampleBytes,
    sampleCount: samples.length,
    timescale,
    duration,
  };
  const measured = buildM4a({ ...parts, mdatOffset: 0 });
  const moov = readBoxes(measured, 0, measured.byteLength).find((item) => item.type === "moov");
  const mdatOffset = (moov?.end ?? 0) + 8;
  return buildM4a({ ...parts, mdatOffset });
}
