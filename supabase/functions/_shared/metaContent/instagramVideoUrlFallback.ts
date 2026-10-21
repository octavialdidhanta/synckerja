/** URL fetch failures can still be published by uploading the bytes. A container that is only still processing must keep its id. */
export function shouldFallbackFromInstagramVideoUrl(message: string): boolean {
  const normalized = message.toLowerCase();
  if (normalized.includes("media_not_ready")) return false;
  return (
    normalized.includes("meta_reels_container_error") ||
    normalized.includes("meta_reels_container_expired") ||
    normalized.includes("meta_reels_container http") ||
    normalized.includes("meta_reels_missing")
  );
}
