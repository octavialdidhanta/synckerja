const token = process.env.IG_TOKEN;
const ig = "17841445621371498";
async function get(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 250));
  return j;
}
(async () => {
  const media = await get(`https://graph.facebook.com/v21.0/${ig}/media?fields=id,media_type,media_product_type,timestamp&limit=12&access_token=${token}`);
  const ids = media.data.map(m => m.id);
  const batch = ids.map(id => ({
    method: "GET",
    relative_url: `${id}/insights?${new URLSearchParams({ metric: "reach,views,total_views,total_interactions,shares", metric_type: "total_value" }).toString()}`,
  }));
  const res = await fetch("https://graph.facebook.com/v21.0/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: token, batch: JSON.stringify(batch) }),
  });
  const data = await res.json();
  data.forEach((item, i) => {
    const m = media.data[i];
    let summary = `code=${item.code}`;
    try {
      const body = JSON.parse(item.body || "{}");
      if (body.error) summary += ` ERR=${String(body.error.message).slice(0,100)}`;
      else {
        const map = {};
        for (const row of body.data || []) map[row.name] = row.values?.[0]?.value;
        summary += ` views=${map.views} total=${map.total_views} reach=${map.reach}`;
      }
    } catch (e) { summary += " parsefail"; }
    console.log(`${m.timestamp.slice(0,10)} ${m.media_type}/${m.media_product_type} ${summary}`);
  });
})();
