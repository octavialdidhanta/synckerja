const token = process.env.T1;
const id = "17997527381852675";
(async () => {
  for (const fields of ["view_count","total_views_count","view_count,total_views_count","like_count,comments_count"]) {
    const r = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=${fields}&access_token=${token}`);
    const j = await r.json();
    console.log(fields, "=>", JSON.stringify(j).slice(0,200));
  }
})();
