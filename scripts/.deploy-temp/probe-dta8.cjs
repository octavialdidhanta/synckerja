const token = process.env.T1;
const id = "17997527381852675"; // DTA8e4RiW0U from earlier
async function get(url) {
  const r = await fetch(url);
  return r.json();
}
(async () => {
  const media = await get(`https://graph.facebook.com/v21.0/${id}?fields=caption,permalink,like_count,comments_count,total_views_count,total_like_count&access_token=${token}`);
  console.log("media", JSON.stringify(media));
  const insights = await get(`https://graph.facebook.com/v21.0/${id}/insights?metric=views,total_views,reach,follows,ig_reels_avg_watch_time,likes,saved,shares,total_interactions&metric_type=total_value&access_token=${token}`);
  if (insights.error) console.log("insights ERR", insights.error.message);
  else for (const row of insights.data||[]) {
    const v = row.values?.[0]?.value ?? row.total_value?.value;
    console.log(row.name, v, row.title);
  }
})();
