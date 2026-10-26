/** Drive download is usually a few seconds; don't leave the worker blocked on a hung connection. */
export const DRIVE_DOWNLOAD_TIMEOUT_MS = 60_000;

/** One platform byte upload. Longer than a healthy reel upload, shorter than the stall window. */
export const PLATFORM_BYTE_UPLOAD_TIMEOUT_MS = 90_000;

export function isFetchAbortError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === "TimeoutError" || err.name === "AbortError";
  }
  if (err instanceof Error) {
    return err.name === "TimeoutError" || err.name === "AbortError";
  }
  return false;
}
