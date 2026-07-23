const token = process.env.IG_TOKEN;
const ig = "17841445621371498";
async function get(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 200));
  return j;
}
(async () => {
  const media = await get(`https://graph.facebook.com/v21.0/${ig}/media?fields=id,media_type,media_product_type,timestamp&limit=15&access_token=${token}`);
  for (const m of media.data) {
    const id = m.id;
    let views = null, total = null, err = "";
    try {
      const a = await get(`https://graph.facebook.com/v21.0/${id}/insights?metric=views,total_views&metric_type=total_value&access_token=${token}`);
      for (const row of a.data || []) {
        if (row.name === "views") views = row.values?.[0]?.value;
        if (row.name === "total_views") total = row.values?.[0]?.value;
      }
    } catch (e) {
      err = String(e.message || e).slice(0, 120);
    }
    const diff = (total != null && views != null && total !== views) ? " DIFF" : "";
    console.log(`${m.timestamp.slice(0,10)} ${m.media_type}/${m.media_product_type} views=${views} total=${total}${diff} ${err}`);
  }
})();
