export function calculateOnTimeStatus(
  actualPostDateIso: string | null,
  postDateIso: string | null,
): string {
  if (!actualPostDateIso || !postDateIso) return "";
  const actual = new Date(actualPostDateIso);
  const planned = new Date(postDateIso);
  if (Number.isNaN(actual.getTime()) || Number.isNaN(planned.getTime())) return "";
  if (actual <= planned) return "Ontime";
  const diffTime = Math.abs(actual.getTime() - planned.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return `Late ${diffDays} Day${diffDays > 1 ? "s" : ""}`;
}

export function todayDateIsoUtc(): string {
  return new Date().toISOString().split("T")[0];
}

export function buildPlanPostMetadataUpdates(
  postDateIso: string | null,
  publishedAtIso: string = new Date().toISOString(),
): { actual_post_date: string; on_time_status: string } {
  const actualDate = publishedAtIso.split("T")[0];
  return {
    actual_post_date: actualDate,
    on_time_status: calculateOnTimeStatus(actualDate, postDateIso),
  };
}
