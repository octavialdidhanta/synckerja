import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/shared/lib/supabaseClient';

/**
 * Public review RPCs must not send the signed-in JWT.
 * A stale session otherwise fails the request, refresh fails, and the app sends the visitor to /login.
 */
export async function publicReviewRpc<T>(
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(args),
    });
    if (!response.ok) {
      return { data: null, error: new Error(`Review request failed (${response.status})`) };
    }
    if (response.status === 204) return { data: null, error: null };
    return { data: (await response.json()) as T, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Review request failed') };
  }
}
