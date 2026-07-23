const token = process.env.T1;
const ig = "17841445621371498";
const target = "DTE93QpiVRT";
async function get(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
  return j;
}
(async () => {
  let url = `https://graph.facebook.com/v21.0/${ig}/media?fields=id,permalink,media_type,media_product_type,timestamp,like_count,comments_count&limit=50&access_token=${token}`;
  let found = null;
  for (let p=0; p<10 && !found; p++) {
    const data = await get(url);
    found = (data.data||[]).find(m => (m.permalink||"").includes(target)) || null;
    url = data.paging?.next || null;
    if (!url) break;
  }
  if (!found) { console.log("NOT_FOUND"); return; }
  console.log("media", JSON.stringify({ id: found.id, type: found.media_type+"/"+found.media_product_type, date: found.timestamp, likes: found.like_count, comments: found.comments_count, permalink: found.permalink }));
  const id = found.id;
  const metrics = [
    ["views","metric_type=total_value"],
    ["total_views","metric_type=total_value"],
    ["reach","metric_type=total_value"],
    ["facebook_views","metric_type=total_value"],
    ["crossposted_views","metric_type=total_value"],
    ["total_interactions","metric_type=total_value"],
    ["shares","metric_type=total_value"],
  ];
  for (const [m,e] of metrics) {
    try {
      const a = await get(`https://graph.facebook.com/v21.0/${id}/insights?metric=${m}&${e}&access_token=${token}`);
      const row = a.data?.[0];
      const val = row?.values?.[0]?.value ?? row?.total_value?.value;
      console.log(m, val, row?.title||"");
    } catch (err) {
      console.log(m, "ERR", String(err.message).slice(0,120));
    }
  }
  try {
    const f = await get(`https://graph.facebook.com/v21.0/${id}?fields=total_views_count&access_token=${token}`);
    console.log("total_views_count field", f.total_views_count);
  } catch (err) {
    console.log("field ERR", String(err.message).slice(0,120));
  }
  // try v22 same
  try {
    const a = await get(`https://graph.facebook.com/v22.0/${id}/insights?metric=views,total_views,facebook_views,crossposted_views&metric_type=total_value&access_token=${token}`);
    for (const row of a.data||[]) console.log("v22", row.name, row.values?.[0]?.value);
  } catch (err) {
    console.log("v22 ERR", String(err.message).slice(0,160));
  }
})();
