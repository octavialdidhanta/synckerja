export const scheduledPostsCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function scheduledPostsJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...scheduledPostsCorsHeaders, "Content-Type": "application/json" },
  });
}

/** Service role JWT or SCHEDULED_POSTS_INTERNAL_SECRET (pg_cron). */
export function isScheduledPostsInternalAuthorized(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return token === serviceRoleKey || (cronSecret.length > 0 && token === cronSecret);
}
