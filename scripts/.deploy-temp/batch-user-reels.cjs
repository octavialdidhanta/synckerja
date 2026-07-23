const token = process.env.T1;
const ids = ["17997527381852675","18064566611228290","18051519191429439","17851446903612581","18099221558582904"];
(async () => {
  const batch = ids.map(id => ({
    method: "GET",
    relative_url: `${id}/insights?metric=reach,views,total_views,total_interactions,shares&metric_type=total_value`,
  }));
  const res = await fetch("https://graph.facebook.com/v21.0/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: token, batch: JSON.stringify(batch) }),
  });
  const data = await res.json();
  data.forEach((item, i) => {
    const body = JSON.parse(item.body||"{}");
    if (body.error) console.log(ids[i], "FAIL", body.error.message.slice(0,120));
    else {
      const map={};
      for (const row of body.data||[]) map[row.name]=row.values?.[0]?.value;
      console.log(ids[i], "OK", map);
    }
  });
})();
