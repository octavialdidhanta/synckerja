const targets = new Set(["DTA8e4RiW0U","DTCV_dJCVJC","DTClkSnifn7","DTEza4KiYY1"]);
const accounts = [
  { name: "octa.vialdi", ig: "17841445621371498", token: process.env.T1 },
  { name: "vialdi_wedding", ig: "17841404143150543", token: process.env.T2 },
];
async function get(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 250));
  return j;
}
(async () => {
  const found = [];
  for (const acc of accounts) {
    let url = `https://graph.facebook.com/v21.0/${acc.ig}/media?fields=id,permalink,media_type,media_product_type,timestamp,like_count,comments_count&limit=50&access_token=${acc.token}`;
    let pages = 0;
    while (url && pages < 20) {
      pages++;
      const data = await get(url);
      for (const m of data.data || []) {
        const permalink = m.permalink || "";
        for (const sc of targets) {
          if (permalink.includes(sc)) {
            found.push({ account: acc.name, shortcode: sc, ...m });
          }
        }
      }
      url = data.paging?.next || null;
      if (found.length >= targets.size) break;
    }
    console.log(acc.name, "pages", pages, "found so far", found.length);
  }
  for (const m of found) {
    let views=null,total=null,reach=null,fieldViews=null,err="";
    try {
      const a = await get(`https://graph.facebook.com/v21.0/${m.id}/insights?metric=views,total_views,reach&metric_type=total_value&access_token=${accounts.find(a=>a.name===m.account).token}`);
      for (const row of a.data||[]) {
        const v = row.values?.[0]?.value ?? row.total_value?.value;
        if (row.name==="views") views=v;
        if (row.name==="total_views") total=v;
        if (row.name==="reach") reach=v;
      }
    } catch(e) { err = String(e.message||e).slice(0,160); }
    try {
      const f = await get(`https://graph.facebook.com/v21.0/${m.id}?fields=view_count,views_count,total_views_count,permalink&access_token=${accounts.find(a=>a.name===m.account).token}`);
      fieldViews = f.total_views_count ?? f.views_count ?? f.view_count ?? null;
    } catch(_) {}
    console.log(JSON.stringify({
      account: m.account, shortcode: m.shortcode, id: m.id,
      type: `${m.media_type}/${m.media_product_type}`,
      date: String(m.timestamp).slice(0,10),
      likes: m.like_count, comments: m.comments_count,
      views, total_views: total, reach, fieldViews, err, permalink: m.permalink
    }));
  }
  if (!found.length) console.log("NONE_FOUND");
})();
