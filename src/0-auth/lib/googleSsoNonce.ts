/**
 * Nonce pair for Supabase + Google Sign-In (see Supabase Auth Google docs).
 * - rawNonce → signInWithIdToken({ nonce })
 * - nonceDigest (SHA-256 hex) → Google Sign-In API
 */
export function createGoogleSsoRawNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createGoogleSsoNoncePair(): Promise<{ rawNonce: string; nonceDigest: string }> {
  const rawNonce = createGoogleSsoRawNonce();
  const nonceDigest = await sha256Hex(rawNonce);
  return { rawNonce, nonceDigest };
}
