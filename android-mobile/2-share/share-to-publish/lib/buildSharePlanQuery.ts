export type ShareableSocialMediaPlan = {
  id: string;
  title: string | null;
  post_date: string | null;
  actual_post_date: string | null;
  created_at: string;
  brief: string | null;
  approved: boolean | null;
  production_approved: boolean | null;
  production_status: string | null;
  production_revision_baseline_link: string | null;
  production_revision_count: number | null;
  done: boolean | null;
  on_time_status: string | null;
  google_drive_link: string | null;
  service_id: string | null;
  sub_service_id: string | null;
  content_type_id: string | null;
  content_pillar_id: string | null;
  pic_id: string | null;
  pic_production_source: string | null;
  content_type: { id: string; name: string } | null;
  service: { id: string; name: string } | null;
  sub_service: { id: string; name: string } | null;
  content_pillar: { id: string; name: string; color?: string | null } | null;
  pic: { id: string; full_name: string | null } | null;
  pic_production: { id: string; full_name: string | null } | null;
  post_link_creator: { id: string; full_name: string | null } | null;
};

export const SHAREABLE_PLAN_SELECT = `
  id,
  title,
  post_date,
  actual_post_date,
  created_at,
  brief,
  approved,
  production_approved,
  production_status,
  production_revision_baseline_link,
  production_revision_count,
  done,
  on_time_status,
  google_drive_link,
  service_id,
  sub_service_id,
  content_type_id,
  content_pillar_id,
  pic_id,
  pic_production_source,
  content_type:content_types(id, name),
  service:services(id, name),
  sub_service:sub_services(id, name),
  content_pillar:content_pillars(id, name, color),
  pic:employees!social_media_plans_pic_id_fkey(id, full_name),
  pic_production:employees!social_media_plans_pic_production_id_fkey(id, full_name),
  post_link_creator:employees!social_media_plans_post_link_created_by_fkey(id, full_name)
`.replace(/\s+/g, " ").trim();

/** Prefer Reel (or unset type), nearer post_date, PIC match, missing drive link. */
export function sortShareablePlans(
  plans: ShareableSocialMediaPlan[],
  currentEmployeeId: string | undefined,
): ShareableSocialMediaPlan[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  return [...plans].sort((a, b) => {
    const aReel = String(a.content_type?.name ?? "").toLowerCase() === "reel" ? 0 : a.content_type_id ? 2 : 1;
    const bReel = String(b.content_type?.name ?? "").toLowerCase() === "reel" ? 0 : b.content_type_id ? 2 : 1;
    if (aReel !== bReel) return aReel - bReel;

    const aPic = currentEmployeeId && a.pic_id === currentEmployeeId ? 0 : 1;
    const bPic = currentEmployeeId && b.pic_id === currentEmployeeId ? 0 : 1;
    if (aPic !== bPic) return aPic - bPic;

    const aMissingLink = a.google_drive_link?.trim() ? 1 : 0;
    const bMissingLink = b.google_drive_link?.trim() ? 1 : 0;
    if (aMissingLink !== bMissingLink) return aMissingLink - bMissingLink;

    const aDate = a.post_date ? new Date(a.post_date.slice(0, 10)).getTime() : Number.POSITIVE_INFINITY;
    const bDate = b.post_date ? new Date(b.post_date.slice(0, 10)).getTime() : Number.POSITIVE_INFINITY;
    return Math.abs(aDate - todayMs) - Math.abs(bDate - todayMs);
  });
}
