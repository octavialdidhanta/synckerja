const token = process.env.T1;
const ig = "17841445621371498";
const ids = ["17997527381852675","18064566611228290","18051519191429439","17851446903612581"];
(async () => {
  // try insights with breakdowns / lifetime without metric_type
  for (const id of ids) {
    for (const q of [
      `metric=views&period=lifetime`,
      `metric=views&metric_type=total_value`,
      `metric=total_views&metric_type=total_value`,
    ]) {
      const r = await fetch(`https://graph.facebook.com/v22.0/${id}/insights?${q}&access_token=${token}`);
      const j = await r.json();
      const val = j.data?.[0]?.values?.[0]?.value ?? j.error?.message?.slice(0,80);
      console.log(id.slice(-6), q, "=>", val);
    }
  }
})();
