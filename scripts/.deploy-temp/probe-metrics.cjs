const token = process.env.T1;
const id = "17997527381852675"; // DTA8e4RiW0U
const metrics = [
  ["views","metric_type=total_value"],
  ["total_views","metric_type=total_value"],
  ["reach","metric_type=total_value"],
  ["plays","period=lifetime"],
  ["ig_reels_aggregated_all_plays_count","period=lifetime"],
  ["clips_replays_count","period=lifetime"],
  ["ig_reels_avg_watch_time","metric_type=total_value"],
  ["facebook_views","metric_type=total_value"],
  ["crossposted_views","metric_type=total_value"],
  ["reels_skip_rate","metric_type=total_value"],
];
async function tryMetric(metric, extra) {
  const url = `https://graph.facebook.com/v21.0/${id}/insights?metric=${metric}&${extra}&access_token=${token}`;
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) return { metric, err: (j.error?.message||JSON.stringify(j)).slice(0,140) };
  const row = j.data?.[0];
  const val = row?.values?.[0]?.value ?? row?.total_value?.value ?? JSON.stringify(row)?.slice(0,80);
  return { metric, val, period: row?.period, title: row?.title };
}
(async () => {
  for (const [m,e] of metrics) console.log(JSON.stringify(await tryMetric(m,e)));
  // also list all insights without specifying? 
  const fields = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=id,permalink,media_type,media_product_type,like_count,comments_count,view_count,views_count,total_views_count,play_count&access_token=${token}`).then(r=>r.json());
  console.log("fields", JSON.stringify(fields));
})();
