import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function pkceS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function pkceMatches(verifier: string, challenge: string): boolean {
  const left = encode(pkceS256(verifier));
  const right = encode(challenge);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
