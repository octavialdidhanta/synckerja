import type { MintBlibliChatOttResult } from "./blibliSellerChatOtt.ts";

/** Maps Blibli OTT API failure payloads to UI-facing codes. */
export function mapBlibliOttErrorCode(
  result: Extract<MintBlibliChatOttResult, { ok: false }>,
): string {
  if (result.errorCode === "ERR-PA400054") return "STORE_UNBOUND";
  if (result.errorCode === "ERR-MA500007") return "BLIBLI_SERVER_ERROR";
  if (result.status === 401 || result.status === 403) return "AUTH_FAILED";
  return result.errorCode ?? "BLIBLI_OTT_FAILED";
}
