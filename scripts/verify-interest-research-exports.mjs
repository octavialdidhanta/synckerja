/**
 * Offline proof for Interest Research export helpers + overlap math.
 * Run: node scripts/verify-interest-research-exports.mjs
 */

function targetingItemsToCsv(items) {
  const header = "id,name,type,path,audience_size_lower,audience_size_upper";
  const rows = items.map((i) =>
    [
      i.id,
      JSON.stringify(i.name),
      i.type,
      JSON.stringify((i.path ?? []).join(" > ")),
      i.audience_size_lower ?? "",
      i.audience_size_upper ?? "",
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

function approxOverlap(a, b, unionAb) {
  const overlap = Math.max(0, a + b - unionAb);
  const smaller = Math.min(a, b);
  return {
    overlap,
    overlap_pct_of_smaller: smaller > 0 ? Math.min(100, (overlap / smaller) * 100) : null,
  };
}

const items = [
  {
    id: "6003396051089",
    name: "fashion  (film)",
    type: "interest",
    path: ["Interests", "Additional interests", "fashion  (film)"],
    audience_size_lower: 125749323,
    audience_size_upper: 125749323,
  },
  {
    id: "6002892294422",
    name: "Art museum (museums)",
    type: "interest",
    path: ["Interests", "Additional interests", "Art museum (museums)"],
    audience_size_lower: 214661187,
    audience_size_upper: 214661187,
  },
];

const csv = targetingItemsToCsv(items);
const ids = items.map((i) => i.id).join("\n");
const midA = (3_900_000 + 4_600_000) / 2;
const midB = (5_000_000 + 6_000_000) / 2;
const midU = (7_000_000 + 8_000_000) / 2;
const overlap = approxOverlap(midA, midB, midU);

const checks = {
  csv_has_header: csv.startsWith("id,name,type,path,"),
  csv_has_fashion_id: csv.includes("6003396051089"),
  csv_quotes_name: csv.includes('"fashion  (film)"'),
  ids_two_lines: ids.split("\n").length === 2,
  overlap_non_negative: overlap.overlap >= 0,
  overlap_pct_bounded: overlap.overlap_pct_of_smaller != null && overlap.overlap_pct_of_smaller <= 100,
};

const failed = Object.entries(checks).filter(([, ok]) => !ok);
console.log(JSON.stringify({ checks, overlap, csv_preview: csv.split("\n").slice(0, 3), ids }, null, 2));
if (failed.length) {
  console.error("FAIL", failed.map(([k]) => k));
  process.exit(1);
}
console.log("EXPORT_AND_OVERLAP_MATH_OK");
