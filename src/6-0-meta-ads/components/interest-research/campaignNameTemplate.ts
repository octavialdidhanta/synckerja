export const CAMPAIGN_ID_PLACEHOLDER = "{{campaign_id}}";
export const CAMPAIGN_ID_PREVIEW = "campaign_group_id";

export const DEFAULT_OBJECTIVE_DISPLAYS: Record<string, string> = {
  app_promotion: "App promotion",
  awareness: "Awareness",
  traffic: "Traffic",
  engagement: "Engagement",
  leads: "Leads",
  conversions: "Sales",
};

export const DEFAULT_CONVERSION_LOCATION_DISPLAYS: Record<string, string> = {
  WEBSITE: "Website",
  WEBSITE_AND_APP: "Website and app",
  WEBSITE_AND_CALLS: "Website and calls",
  INSTAGRAM_LIVE: "Instagram live video",
  APP: "App",
  MESSENGER: "Message destinations",
  PHONE_CALL: "Calls",
};

export const DEFAULT_PLACEMENT_DISPLAYS: Record<string, string> = {
  automatic: "Automatic",
  facebook: "Facebook",
  instagram: "Instagram",
  audience_network: "Audience Network",
  messenger: "Messenger",
};

export const FIELD_SEPARATORS = [
  "—",
  "::",
  ":",
  "--",
  "..",
  "||",
  "|",
  "+",
  "-",
  "/",
  "\\",
  "&",
  "//",
  "]-[",
  "]_[",
] as const;

export const ITEM_SEPARATORS = ["", "--", "..", "||", "+", "-", "/", "\\", "&", "//", "]-[", "]_["] as const;

export type CampaignNameToken =
  | { id: string; kind: "text"; value: string }
  | { id: string; kind: "objective"; displays: Record<string, string> }
  | { id: string; kind: "campaign_id" }
  | { id: string; kind: "cbo"; onLabel: string; offLabel: string }
  | { id: string; kind: "conversion_location"; displays: Record<string, string> }
  | { id: string; kind: "location" }
  | { id: string; kind: "interest" }
  | { id: string; kind: "placement"; displays: Record<string, string> }
  | { id: string; kind: "custom"; title: string; options: string[]; selected: string };

export type CampaignNameTemplate = {
  tokens: CampaignNameToken[];
  fieldSeparator: string;
  itemSeparator: string;
};

export type CampaignNameContext = {
  objective: string;
  objectiveLabel: string;
  cbo: boolean;
  campaignId?: string | null;
  conversionLocation?: string;
  conversionLocationLabel?: string;
  locationLabel?: string;
  interestLabel?: string;
  placement?: string;
  placementLabel?: string;
};

export function formatLocationNameLabel(
  locations: Array<{ name?: string | null; display_name?: string | null }>,
  countryFallback = "",
): string {
  const names = (locations ?? [])
    .map((row) => String(row.display_name || row.name || "").trim())
    .filter(Boolean);
  if (names.length === 0) return countryFallback.trim();
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `tok-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyCampaignNameTemplate(): CampaignNameTemplate {
  return { tokens: [], fieldSeparator: "|", itemSeparator: "" };
}

export function defaultCampaignNameTemplate(openText: string): CampaignNameTemplate {
  const value = openText.trim() || "Open text field";
  return {
    tokens: [
      { id: newId(), kind: "text", value },
      { id: newId(), kind: "objective", displays: { ...DEFAULT_OBJECTIVE_DISPLAYS } },
      { id: newId(), kind: "campaign_id" },
      { id: newId(), kind: "cbo", onLabel: "CBO on", offLabel: "CBO off" },
    ],
    fieldSeparator: "|",
    itemSeparator: "",
  };
}

export function tokenChipLabel(token: CampaignNameToken): string {
  if (token.kind === "text") return "Open text field";
  if (token.kind === "objective") return "Objective";
  if (token.kind === "campaign_id") return "Campaign ID";
  if (token.kind === "cbo") return "Advantage+ campaign budget";
  if (token.kind === "conversion_location") return "Conversion location";
  if (token.kind === "location") return "Location";
  if (token.kind === "interest") return "Interest";
  if (token.kind === "placement") return "Placement";
  return token.title.trim() || "Custom field";
}

export function resolveTokenValue(token: CampaignNameToken, ctx: CampaignNameContext): string {
  if (token.kind === "text") return token.value.trim();
  if (token.kind === "objective") {
    return (token.displays[ctx.objective] ?? ctx.objectiveLabel ?? ctx.objective).trim();
  }
  if (token.kind === "campaign_id") {
    const id = String(ctx.campaignId ?? "").trim();
    return id || CAMPAIGN_ID_PLACEHOLDER;
  }
  if (token.kind === "cbo") return (ctx.cbo ? token.onLabel : token.offLabel).trim();
  if (token.kind === "conversion_location") {
    const key = String(ctx.conversionLocation ?? "");
    return (token.displays[key] ?? ctx.conversionLocationLabel ?? key).trim();
  }
  if (token.kind === "location") return String(ctx.locationLabel ?? "").trim();
  if (token.kind === "interest") return String(ctx.interestLabel ?? "").trim();
  if (token.kind === "placement") {
    const key = String(ctx.placement ?? "");
    return (token.displays[key] ?? ctx.placementLabel ?? key).trim();
  }
  return (token.selected || token.options[0] || token.title).trim();
}

function joinNameParts(parts: string[], separator: string): string {
  if (parts.length === 0) return "";
  const joined = parts.join(separator);
  if (separator.startsWith("]") && separator.endsWith("[") && separator.length >= 2) {
    return `[${joined}]`;
  }
  return joined;
}

export function resolveCampaignName(template: CampaignNameTemplate, ctx: CampaignNameContext): string {
  const parts = template.tokens
    .map((token) => resolveTokenValue(token, ctx))
    .filter((part) => part.length > 0);
  return joinNameParts(parts, template.fieldSeparator);
}

export function previewCampaignName(template: CampaignNameTemplate, ctx: CampaignNameContext): string {
  return resolveCampaignName(template, { ...ctx, campaignId: CAMPAIGN_ID_PREVIEW });
}

export function hasTokenKind(template: CampaignNameTemplate, kind: CampaignNameToken["kind"]): boolean {
  return template.tokens.some((token) => token.kind === kind);
}

export function parseCampaignNameTemplate(raw: unknown): CampaignNameTemplate {
  const empty = emptyCampaignNameTemplate();
  if (!raw || typeof raw !== "object") return empty;
  const row = raw as { tokens?: unknown; fieldSeparator?: unknown; itemSeparator?: unknown };
  const tokens = Array.isArray(row.tokens)
    ? row.tokens.map(parseToken).filter((token): token is CampaignNameToken => token != null)
    : [];
  return {
    tokens,
    fieldSeparator: typeof row.fieldSeparator === "string" && row.fieldSeparator ? row.fieldSeparator : "|",
    itemSeparator: typeof row.itemSeparator === "string" ? row.itemSeparator : "",
  };
}

function parseToken(raw: unknown): CampaignNameToken | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.trim() ? row.id : `tok-${Math.random().toString(36).slice(2, 10)}`;
  const kind = row.kind;
  if (kind === "text") return { id, kind: "text", value: typeof row.value === "string" ? row.value : "" };
  if (kind === "campaign_id") return { id, kind: "campaign_id" };
  if (kind === "location") return { id, kind: "location" };
  if (kind === "interest") return { id, kind: "interest" };
  if (kind === "conversion_location") {
    const displays =
      row.displays && typeof row.displays === "object" && !Array.isArray(row.displays)
        ? Object.fromEntries(
            Object.entries(row.displays as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : { ...DEFAULT_CONVERSION_LOCATION_DISPLAYS };
    return { id, kind: "conversion_location", displays: { ...DEFAULT_CONVERSION_LOCATION_DISPLAYS, ...displays } };
  }
  if (kind === "placement") {
    const displays =
      row.displays && typeof row.displays === "object" && !Array.isArray(row.displays)
        ? Object.fromEntries(
            Object.entries(row.displays as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : { ...DEFAULT_PLACEMENT_DISPLAYS };
    return { id, kind: "placement", displays: { ...DEFAULT_PLACEMENT_DISPLAYS, ...displays } };
  }
  if (kind === "objective") {
    const displays =
      row.displays && typeof row.displays === "object" && !Array.isArray(row.displays)
        ? Object.fromEntries(
            Object.entries(row.displays as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : { ...DEFAULT_OBJECTIVE_DISPLAYS };
    return { id, kind: "objective", displays: { ...DEFAULT_OBJECTIVE_DISPLAYS, ...displays } };
  }
  if (kind === "cbo") {
    return {
      id,
      kind: "cbo",
      onLabel: typeof row.onLabel === "string" && row.onLabel.trim() ? row.onLabel : "CBO on",
      offLabel: typeof row.offLabel === "string" && row.offLabel.trim() ? row.offLabel : "CBO off",
    };
  }
  if (kind === "custom") {
    const options = Array.isArray(row.options)
      ? row.options.filter((item): item is string => typeof item === "string")
      : [];
    return {
      id,
      kind: "custom",
      title: typeof row.title === "string" && row.title.trim() ? row.title : "Custom field",
      options,
      selected: typeof row.selected === "string" ? row.selected : "",
    };
  }
  return null;
}

export function makeToken(kind: CampaignNameToken["kind"], textValue?: string): CampaignNameToken {
  if (kind === "text") return { id: newId(), kind: "text", value: textValue?.trim() || "Open text field" };
  if (kind === "objective") {
    return { id: newId(), kind: "objective", displays: { ...DEFAULT_OBJECTIVE_DISPLAYS } };
  }
  if (kind === "campaign_id") return { id: newId(), kind: "campaign_id" };
  if (kind === "cbo") return { id: newId(), kind: "cbo", onLabel: "CBO on", offLabel: "CBO off" };
  if (kind === "location") return { id: newId(), kind: "location" };
  if (kind === "interest") return { id: newId(), kind: "interest" };
  if (kind === "conversion_location") {
    return { id: newId(), kind: "conversion_location", displays: { ...DEFAULT_CONVERSION_LOCATION_DISPLAYS } };
  }
  if (kind === "placement") {
    return { id: newId(), kind: "placement", displays: { ...DEFAULT_PLACEMENT_DISPLAYS } };
  }
  return { id: newId(), kind: "custom", title: "Custom field", options: [], selected: "" };
}
