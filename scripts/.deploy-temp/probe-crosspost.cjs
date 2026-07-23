const token = process.env.T1;
const id = "18031678091564831";
async function get(url) {
  const r = await fetch(url);
  const j = await r.json();
  return { ok: r.ok, j };
}
(async () => {
  // raw responses for crosspost metrics
  for (const q of [
    "metric=facebook_views&metric_type=total_value",
    "metric=crossposted_views&metric_type=total_value",
    "metric=facebook_views&period=lifetime",
    "metric=crossposted_views&period=lifetime",
    "metric=views,total_views,facebook_views,crossposted_views&metric_type=total_value",
    "metric=total_likes,total_comments,total_views&metric_type=total_value",
    "metric=likes,comments,saved,shares,total_interactions&metric_type=total_value",
  ]) {
    const { ok, j } = await get(`https://graph.facebook.com/v21.0/${id}/insights?${q}&access_token=${token}`);
    console.log("\n"+q);
    console.log(JSON.stringify(j).slice(0,500));
  }
  // media fields
  for (const fields of [
    "total_views_count,like_count,comments_count",
    "total_like_count,total_comments_count,total_views_count",
    "is_shared_to_fb,boost_eligibility_info",
  ]) {
    const { j } = await get(`https://graph.facebook.com/v21.0/${id}?fields=${fields}&access_token=${token}`);
    console.log("\nfields", fields, JSON.stringify(j).slice(0,400));
  }
})();
