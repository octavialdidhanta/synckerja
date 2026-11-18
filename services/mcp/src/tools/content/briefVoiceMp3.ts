/** ElevenLabs TTS is stored as MP3. This cap keeps one MCP response small. */
export const VOICE_GET_MAX_BYTES = 1_000_000;

const MPEG1_L3_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG2_L3_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

export type Mp3Info = {
  mimeType: "audio/mpeg";
  durationSeconds: number | null;
};

function id3v2Bytes(bytes: Uint8Array): number {
  if (bytes.length < 10) return 0;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  const size =
    ((bytes[6]! & 0x7f) << 21) |
    ((bytes[7]! & 0x7f) << 14) |
    ((bytes[8]! & 0x7f) << 7) |
    (bytes[9]! & 0x7f);
  return 10 + size;
}

function findFrame(bytes: Uint8Array, start: number): number {
  const end = Math.min(bytes.length - 4, start + 8192);
  for (let i = Math.max(0, start); i < end; i += 1) {
    if (bytes[i] === 0xff && (bytes[i + 1]! & 0xe0) === 0xe0) return i;
  }
  return -1;
}

/** True when the bytes are an MP3 (including an MP3 mislabeled as .wav). Duration is a CBR estimate. */
export function readMp3(bytes: Uint8Array, maxBytes: number = VOICE_GET_MAX_BYTES): Mp3Info | null {
  if (bytes.length < 4 || bytes.length > maxBytes) return null;
  const id3 = id3v2Bytes(bytes);
  const frameAt = findFrame(bytes, id3 > 0 && id3 < bytes.length ? id3 : 0);
  if (frameAt < 0 || frameAt + 3 >= bytes.length) return null;
  const version = (bytes[frameAt + 1]! >> 3) & 0x3;
  const layer = (bytes[frameAt + 1]! >> 1) & 0x3;
  if (layer !== 1 || version === 1) return null;
  const bitrateIndex = (bytes[frameAt + 2]! >> 4) & 0xf;
  const sampleIndex = (bytes[frameAt + 2]! >> 2) & 0x3;
  if (bitrateIndex === 0 || bitrateIndex === 15 || sampleIndex === 3) return null;
  const bitrateKbps = version === 3 ? MPEG1_L3_KBPS[bitrateIndex] : MPEG2_L3_KBPS[bitrateIndex];
  if (!bitrateKbps) return null;
  const audioStart = id3 > 0 && id3 <= frameAt ? id3 : frameAt;
  const audioBytes = bytes.length - audioStart;
  const duration = (audioBytes * 8) / (bitrateKbps * 1000);
  const durationSeconds = Math.round(duration * 100) / 100;
  return { mimeType: "audio/mpeg", durationSeconds: durationSeconds > 0 ? durationSeconds : null };
}

export function mp3FileName(fileName: string, rowIndex: number): string {
  const trimmed = fileName.trim();
  const base = trimmed.replace(/\.[a-z0-9]+$/i, "").trim();
  return `${base || `vo-${rowIndex + 1}`}.mp3`;
}
