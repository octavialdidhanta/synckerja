export type MetaAudienceSectionKey =
  | "locations"
  | "excludedLocations"
  | "age"
  | "gender"
  | "includedAudiences"
  | "excludedAudiences"
  | "detailedTargeting"
  | "exclusions"
  | "placements";

export type MetaAudienceSection = {
  key: MetaAudienceSectionKey;
  values: string[];
};

export type MetaAudienceSentenceLine = {
  label: string;
  values: string[];
};

const TARGETING_CATEGORY_LABELS: Record<string, string> = {
  interests: "Interests",
  behaviors: "Behaviors",
  life_events: "Life events",
  industries: "Industries",
  family_statuses: "Family statuses",
  education_statuses: "Education",
  relationship_statuses: "Relationship",
  work_positions: "Job titles",
  work_employers: "Employers",
  education_majors: "Fields of study",
  education_schools: "Schools",
  income: "Income",
  user_adclusters: "Demographics",
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  messenger: "Messenger",
  audience_network: "Audience Network",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function namedItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const text = item.trim();
      if (text) names.push(text);
      continue;
    }
    const record = asRecord(item);
    if (!record) continue;
    const name = String(record.name ?? record.key ?? "").trim();
    if (!name) continue;
    const radius = Number(record.radius);
    const unit = String(record.distance_unit ?? "").trim();
    if (Number.isFinite(radius) && radius > 0) {
      const unitLabel = unit === "mile" ? "mi" : "km";
      names.push(`${name} (+${radius} ${unitLabel})`);
      continue;
    }
    names.push(name);
  }
  return names;
}

function locationLabels(geo: unknown): string[] {
  const record = asRecord(geo);
  if (!record) return [];
  return [
    ...asStringList(record.countries),
    ...namedItems(record.regions),
    ...namedItems(record.cities),
    ...namedItems(record.zips),
    ...namedItems(record.geo_markets),
    ...namedItems(record.places),
    ...namedItems(record.custom_locations),
    ...namedItems(record.electoral_districts),
    ...namedItems(record.country_groups),
  ];
}

function categoryLabel(key: string): string {
  return TARGETING_CATEGORY_LABELS[key] ?? key.replace(/_/g, " ");
}

function specLines(spec: unknown): string[] {
  if (!Array.isArray(spec)) {
    const record = asRecord(spec);
    if (!record) return [];
    return Object.entries(record).flatMap(([key, value]) => {
      const names = namedItems(value);
      if (names.length === 0) return [];
      return [`${categoryLabel(key)}: ${names.join(", ")}`];
    });
  }
  const groups: string[] = [];
  spec.forEach((group, index) => {
    const lines = specLines(group);
    if (lines.length === 0) return;
    if (index > 0) groups.push("or");
    groups.push(...lines);
  });
  return groups;
}

function platformLabel(value: string): string {
  const key = value.trim().toLowerCase();
  return PLATFORM_LABELS[key] ?? value.replace(/_/g, " ");
}

function placementLabels(targeting: Record<string, unknown>): string[] {
  const platforms = asStringList(targeting.publisher_platforms).map(platformLabel);
  const positions = [
    ...asStringList(targeting.facebook_positions),
    ...asStringList(targeting.instagram_positions),
    ...asStringList(targeting.threads_positions),
    ...asStringList(targeting.messenger_positions),
    ...asStringList(targeting.audience_network_positions),
  ].map((value) => value.replace(/_/g, " "));
  const devices = asStringList(targeting.device_platforms).map((value) =>
    value === "mobile" ? "Mobile" : value === "desktop" ? "Desktop" : value,
  );
  if (platforms.length === 0 && positions.length === 0 && devices.length === 0) {
    return ["Advantage+ placements"];
  }
  return [...platforms, ...positions, ...devices];
}

export function metaAdsetAdvantageAudience(targeting: unknown): boolean {
  const record = asRecord(targeting);
  const automation = asRecord(record?.targeting_automation);
  return Number(automation?.advantage_audience) === 1;
}

export function metaAdsetAudienceSections(targeting: unknown): MetaAudienceSection[] {
  const record = asRecord(targeting);
  if (!record) return [];
  const sections: MetaAudienceSection[] = [];
  const push = (key: MetaAudienceSectionKey, values: string[]) => {
    const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
    if (unique.length > 0) sections.push({ key, values: unique });
  };

  push("locations", locationLabels(record.geo_locations));
  push("excludedLocations", locationLabels(record.excluded_geo_locations));

  const ageMin = Number(record.age_min);
  const ageMax = Number(record.age_max);
  if (Number.isFinite(ageMin) || Number.isFinite(ageMax)) {
    const min = Number.isFinite(ageMin) ? ageMin : 18;
    const max = Number.isFinite(ageMax) ? ageMax : 65;
    push("age", [max >= 65 ? `${min}–65+` : `${min}–${max}`]);
  }

  const genders = Array.isArray(record.genders) ? record.genders.map((value) => Number(value)) : [];
  if (genders.length === 0) push("gender", ["All"]);
  else {
    const labels = genders.map((value) => (value === 1 ? "Men" : value === 2 ? "Women" : String(value)));
    push("gender", labels);
  }

  push("includedAudiences", namedItems(record.custom_audiences));
  push("excludedAudiences", namedItems(record.excluded_custom_audiences));
  push("detailedTargeting", specLines(record.flexible_spec));
  push("exclusions", specLines(record.exclusions));
  push("placements", placementLabels(record));
  return sections;
}

export function metaAudienceSentenceLines(raw: unknown): MetaAudienceSentenceLine[] {
  const list = Array.isArray(raw) ? raw : [];
  const lines: MetaAudienceSentenceLine[] = [];
  for (const item of list) {
    const record = asRecord(item);
    if (!record) continue;
    const label = String(record.content ?? "").trim().replace(/:$/, "");
    const values = asStringList(record.children);
    if (!label || values.length === 0) continue;
    lines.push({ label, values });
  }
  return lines;
}

export type MetaAdReviewAudienceBlock = {
  key: "custom" | "match" | "location" | "age";
  values: string[];
};

const REVIEW_ORDER: MetaAdReviewAudienceBlock["key"][] = ["custom", "match", "location", "age"];

function reviewLineKind(label: string): MetaAdReviewAudienceBlock["key"] | null {
  const key = label.trim().toLowerCase();
  if (
    key.includes("language") ||
    key.includes("bahasa") ||
    key.includes("placement") ||
    key.includes("penempatan") ||
    key.includes("gender") ||
    key.includes("exclude")
  ) {
    return null;
  }
  if (key.includes("custom")) return "custom";
  if (key.includes("people who match") || key.includes("orang yang cocok") || key.includes("detailed")) {
    return "match";
  }
  if (key.startsWith("location") || key.startsWith("lokasi")) return "location";
  if (key.startsWith("age") || key.startsWith("usia")) return "age";
  return null;
}

/** Short audience for an ad preview: custom audience or people who match, plus location and age. */
export function metaAdReviewAudience(args: {
  targeting: unknown;
  sentenceLines: unknown;
}): MetaAdReviewAudienceBlock[] {
  const fromSentences = new Map<MetaAdReviewAudienceBlock["key"], string[]>();
  for (const line of metaAudienceSentenceLines(args.sentenceLines)) {
    const kind = reviewLineKind(line.label);
    if (!kind) continue;
    const prev = fromSentences.get(kind) ?? [];
    fromSentences.set(kind, [...prev, ...line.values]);
  }
  if (fromSentences.size > 0) {
    return REVIEW_ORDER.flatMap((key) => {
      const values = [...new Set(fromSentences.get(key) ?? [])];
      return values.length > 0 ? [{ key, values }] : [];
    });
  }

  const byKey = new Map(metaAdsetAudienceSections(args.targeting).map((section) => [section.key, section.values]));
  const fromTargeting: Array<[MetaAdReviewAudienceBlock["key"], string[] | undefined]> = [
    ["custom", byKey.get("includedAudiences")],
    ["match", byKey.get("detailedTargeting")],
    ["location", byKey.get("locations")],
    ["age", byKey.get("age")],
  ];
  return fromTargeting.flatMap(([key, values]) => (values && values.length > 0 ? [{ key, values }] : []));
}
