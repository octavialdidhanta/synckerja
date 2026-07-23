const token = process.env.T1;
const id = "18031678091564831";
async function tryUrl(label, url) {
  const r = await fetch(url);
  const j = await r.json();
  console.log(label, JSON.stringify(j).slice(0, 280));
}
(async () => {
  const metrics = [
    "plays","ig_reels_aggregated_all_plays_count","clips_replays_count",
    "impressions","video_views","ig_reels_video_view_total_time",
    "content_views","profile_visits","navigation"
  ];
  for (const ver of ["v19.0","v20.0","v21.0","v22.0"]) {
    for (const m of ["plays","ig_reels_aggregated_all_plays_count","clips_replays_count","impressions"]) {
      await tryUrl(`${ver} ${m}`, `https://graph.facebook.com/${ver}/${id}/insights?metric=${m}&period=lifetime&access_token=${token}`);
    }
  }
  // business discovery on self?
  await tryUrl("bd", `https://graph.facebook.com/v21.0/17841445621371498?fields=business_discovery.username(octa.vialdi){media.limit(1){id,like_count}}&access_token=${token}`);
})();
