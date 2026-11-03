/**
 * A short, readable summary of a Meta ad set's targeting for the MCP ads tools:
 * where (radius pins, cities, regions, countries), who (age, gender, languages),
 * interests and exclusions, and placements. Raw ids and tokens are not returned.
 */

export type AudienceLocation = {
  type: "radius" | "city" | "region" | "country" | "zip" | "place";
  name: string;
  radius: number | null;
  unit: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type AudienceSummary = {
  locations: AudienceLocation[];
  excluded_locations: AudienceLocation[];
  location_types: string[];
  age_min: number | null;
  age_max: number | null;
  genders: string;
  interests: string[];
  excluded_interests: string[];
  custom_audiences: string[];
  excluded_custom_audiences: string[];
  advantage_audience: boolean | null;
  placements: string[];
  sentence_lines: string[];
};

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Record<string, unknown>[] : [];
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function names(value: unknown): string[] {
  return list(value).map((item) => text(item.name)).filter(Boolean);
}

function geo(spec: Record<string, unknown>): AudienceLocation[] {
  const out: AudienceLocation[] = [];
  for (const item of list(spec.custom_locations)) {
    const lat = numOrNull(item.latitude);
    const lng = numOrNull(item.longitude);
    const label = text(item.name) || text(item.address_string) || text(item.primary_city)
      || (lat != null && lng != null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "Pin");
    out.push({
      type: "radius",
      name: label,
      radius: numOrNull(item.radius),
      unit: text(item.distance_unit) || null,
      latitude: lat,
      longitude: lng,
    });
  }
  for (const item of list(spec.places)) {
    out.push({
      type: "place",
      name: text(item.name) || "Place",
      radius: numOrNull(item.radius),
      unit: text(item.distance_unit) || null,
      latitude: numOrNull(item.latitude),
      longitude: numOrNull(item.longitude),
    });
  }
  for (const item of list(spec.cities)) {
    const region = text(item.region);
    out.push({
      type: "city",
      name: region ? `${text(item.name)}, ${region}` : text(item.name) || "City",
      radius: numOrNull(item.radius),
      unit: text(item.distance_unit) || null,
      latitude: null,
      longitude: null,
    });
  }
  for (const item of list(spec.regions)) {
    out.push({ type: "region", name: text(item.name) || "Region", radius: null, unit: null, latitude: null, longitude: null });
  }
  for (const item of list(spec.zips)) {
    out.push({ type: "zip", name: text(item.name) || text(item.key) || "Zip", radius: null, unit: null, latitude: null, longitude: null });
  }
  for (const code of Array.isArray(spec.countries) ? spec.countries : []) {
    const name = text(code);
    if (name) out.push({ type: "country", name, radius: null, unit: null, latitude: null, longitude: null });
  }
  return out;
}

function genderLabel(value: unknown): string {
  const genders = Array.isArray(value) ? value.map(Number) : [];
  if (genders.length === 1 && genders[0] === 1) return "male";
  if (genders.length === 1 && genders[0] === 2) return "female";
  return "all";
}

function interestNames(targeting: Record<string, unknown>): string[] {
  const out: string[] = [];
  const add = (spec: Record<string, unknown>) => {
    for (const key of ["interests", "behaviors", "life_events", "industries", "work_positions", "family_statuses", "income"]) {
      out.push(...names(spec[key]));
    }
  };
  add(targeting);
  for (const spec of list(targeting.flexible_spec)) add(spec);
  return [...new Set(out)].slice(0, 30);
}

function placements(targeting: Record<string, unknown>): string[] {
  const publishers = Array.isArray(targeting.publisher_platforms) ? targeting.publisher_platforms.map(text).filter(Boolean) : [];
  if (publishers.length === 0) return ["automatic (Advantage+ placements)"];
  const out: string[] = [];
  const positions: Record<string, string> = {
    facebook: "facebook_positions",
    instagram: "instagram_positions",
    messenger: "messenger_positions",
    audience_network: "audience_network_positions",
  };
  for (const publisher of publishers) {
    const list = targeting[positions[publisher] ?? ""];
    const spots = Array.isArray(list) ? list.map(text).filter(Boolean) : [];
    out.push(spots.length > 0 ? `${publisher}: ${spots.join(", ")}` : publisher);
  }
  return out;
}

function sentences(lines: unknown): string[] {
  return list(lines).flatMap((line) => {
    const head = text(line.content);
    const children = Array.isArray(line.children) ? line.children.map(text).filter(Boolean) : [];
    if (!head && children.length === 0) return [];
    return [children.length > 0 ? `${head} ${children.join("; ")}`.trim() : head];
  }).slice(0, 20);
}

export function summarizeAudience(targetingRaw: unknown, sentenceLines: unknown): AudienceSummary {
  const targeting = rec(targetingRaw);
  const included = rec(targeting.geo_locations);
  const excluded = rec(targeting.excluded_geo_locations);
  const automation = rec(targeting.targeting_automation);
  const advantage = automation.advantage_audience;
  const exclusions = rec(targeting.exclusions);
  return {
    locations: geo(included),
    excluded_locations: geo(excluded),
    location_types: Array.isArray(included.location_types) ? included.location_types.map(text).filter(Boolean) : [],
    age_min: numOrNull(targeting.age_min),
    age_max: numOrNull(targeting.age_max),
    genders: genderLabel(targeting.genders),
    interests: interestNames(targeting),
    excluded_interests: [...new Set([...names(exclusions.interests), ...names(exclusions.behaviors)])],
    custom_audiences: names(targeting.custom_audiences),
    excluded_custom_audiences: names(targeting.excluded_custom_audiences),
    advantage_audience: advantage == null ? null : Number(advantage) === 1,
    placements: placements(targeting),
    sentence_lines: sentences(sentenceLines),
  };
}
