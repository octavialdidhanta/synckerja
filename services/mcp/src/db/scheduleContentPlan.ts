import type { SchedulePlanResult } from "../tools/content/plansSchedule";

type Session = { userId: string; organizationId: string };
type ScheduleConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  scheduledPostsInternalSecret: string;
};

type PlatformRow = { platform?: unknown; reason?: unknown; error?: unknown };

function textList(value: unknown, secret: string): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const cleaned = item.split(secret).join("");
    return cleaned ? [cleaned] : [];
  });
}

function platformList(value: unknown, secret: string, field: "reason" | "error"): SchedulePlanResult["skipped"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as PlatformRow;
    const platform = typeof row.platform === "string" ? row.platform.split(secret).join("") : "";
    const raw = typeof row[field] === "string" ? row[field] : "";
    const reason = raw.split(secret).join("");
    if (!platform) return [];
    return [{ platform, reason }];
  });
}

export async function scheduleContentPlan(
  config: ScheduleConfig,
  ctx: Session,
  planId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SchedulePlanResult> {
  const secret = config.scheduledPostsInternalSecret;
  const response = await fetchImpl(`${config.supabaseUrl}/functions/v1/social-media-plan-auto-schedule`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      apikey: config.supabaseServiceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organization_id: ctx.organizationId,
      social_media_plan_id: planId,
      mcp_user_id: ctx.userId,
      internal_secret: secret,
    }),
  });

  if (response.status === 404) throw new Error("not_found");
  if (response.status === 403) throw new Error("forbidden");
  if (!response.ok) throw new Error("schedule_failed");

  const body = (await response.json()) as {
    eligible?: unknown;
    scheduled?: unknown;
    blocked?: unknown;
    skipped?: unknown;
    failed?: unknown;
  };
  return {
    eligible: body.eligible === true,
    scheduled: typeof body.scheduled === "number" ? body.scheduled : 0,
    blocked: textList(body.blocked, secret),
    skipped: platformList(body.skipped, secret, "reason"),
    failed: platformList(body.failed, secret, "error"),
  };
}
