const token = process.env.T1;
const ids = [
  ["18099221558582904","boosted Jul"],
  ["17997527381852675","DTA8e4RiW0U"],
  ["18064566611228290","DTCV_dJCVJC"],
];
(async () => {
  for (const [id,label] of ids) {
    const r = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=total_views_count&access_token=${token}`);
    const j = await r.json();
    console.log(label, j.total_views_count ?? j.error?.message);
  }
})();
