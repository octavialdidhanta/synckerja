const token = process.env.T1;
const id = "17997527381852675";
async function tryM(metric) {
  for (const extra of ["metric_type=total_value", "period=lifetime"]) {
    const r = await fetch(`https://graph.facebook.com/v21.0/${id}/insights?metric=${metric}&${extra}&access_token=${token}`);
    const j = await r.json();
    if (j.error) console.log(metric, extra, "ERR", j.error.message.slice(0,140));
    else {
      const row = j.data?.[0];
      console.log(metric, extra, "=>", row?.values?.[0]?.value ?? row?.total_value?.value, row?.title);
    }
  }
}
(async () => {
  for (const m of ["views","total_views","reach","follows","ig_reels_avg_watch_time","likes","saved","facebook_views","crossposted_views"]) {
    await tryM(m);
  }
})();
