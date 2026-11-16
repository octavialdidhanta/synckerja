import { normalizeBrandFont } from "./brandFonts";
import type { BriefChange, CatalogBrandColor, CatalogOption } from "./types";
import type { StoryBriefDraft, StoryBriefLabels, StoryBriefPageSlice } from "./storyBriefTypes";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sameIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const item of value) {
    const id = asString(item);
    if (!UUID_PATTERN.test(id) || seen.has(id)) continue;
    seen.add(id);
    rows.push(id);
  }
  return rows;
}

function asOptions(value: unknown): CatalogOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.id !== "string") return [];
    return [{
      id: row.id,
      label: asString(row.label, asString(row.name, "Tanpa nama")),
    }];
  });
}

function parseBrandColors(value: unknown): CatalogBrandColor[] {
  if (!Array.isArray(value)) return [];
  const rows: CatalogBrandColor[] = [];
  for (const item of value) {
    const row = asRecord(item);
    const id = asString(row?.id);
    if (!UUID_PATTERN.test(id)) continue;
    rows.push({
      id,
      brandName: asString(row?.brand_name),
      primary: asString(row?.primary_color_hex),
      secondary: asString(row?.secondary_color_hex),
      accent: asString(row?.accent_color_hex),
    });
  }
  return rows;
}

function selectedCatalogId(value: unknown, ids: string[]): string | null {
  const id = asString(value);
  return UUID_PATTERN.test(id) && ids.includes(id) ? id : null;
}

export function emptyStoryBriefDraft(): StoryBriefDraft {
  return {
    serviceIds: [],
    angleIds: [],
    pillarIds: [],
    brandColorId: null,
    headlineFont: "",
    bodyFont: "",
    storyAutoApprove: true,
  };
}

export function storyBriefFromPayload(value: unknown): StoryBriefPageSlice {
  const row = asRecord(value) ?? {};
  const brandColors = parseBrandColors(row.brand_colors);
  const angleIds = asStringArray(row.angle_ids);
  const pillarIdsRaw = asStringArray(row.pillar_ids);
  return {
    draft: {
      serviceIds: asStringArray(row.service_ids),
      angleIds,
      pillarIds: angleIds.length === 0 ? [] : pillarIdsRaw,
      brandColorId: selectedCatalogId(row.brand_color_id, brandColors.map((item) => item.id)),
      headlineFont: normalizeBrandFont(asString(row.headline_font)),
      bodyFont: normalizeBrandFont(asString(row.body_font)),
      storyAutoApprove: row.story_auto_approve !== false,
    },
    labels: {
      services: asOptions(row.services),
      angles: asOptions(row.angles),
      pillars: asOptions(row.pillars),
    },
    brandColors,
  };
}

export function storyBriefPayloadFromDraft(draft: StoryBriefDraft) {
  return {
    service_ids: draft.serviceIds,
    angle_ids: draft.angleIds,
    pillar_ids: draft.angleIds.length === 0 ? [] : draft.pillarIds,
    brand_color_id: draft.brandColorId,
    headline_font: normalizeBrandFont(draft.headlineFont),
    body_font: normalizeBrandFont(draft.bodyFont),
    story_auto_approve: draft.storyAutoApprove,
  };
}

export function sameStoryBrief(left: StoryBriefDraft, right: StoryBriefDraft): boolean {
  return sameIds(left.serviceIds, right.serviceIds)
    && sameIds(left.angleIds, right.angleIds)
    && sameIds(left.pillarIds, right.pillarIds)
    && left.brandColorId === right.brandColorId
    && normalizeBrandFont(left.headlineFont) === normalizeBrandFont(right.headlineFont)
    && normalizeBrandFont(left.bodyFont) === normalizeBrandFont(right.bodyFont)
    && left.storyAutoApprove === right.storyAutoApprove;
}

function nameList(ids: string[], names: Map<string, string>): string {
  if (ids.length === 0) return "—";
  return ids.map((id) => names.get(id) ?? "Tidak ada di katalog").join(", ");
}

function textValue(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "—";
}

export function storyBriefChanges(
  before: StoryBriefDraft,
  after: StoryBriefDraft,
  names: {
    services: Map<string, string>;
    angles: Map<string, string>;
    pillars: Map<string, string>;
  },
): BriefChange[] {
  const rows: BriefChange[] = [];
  const push = (label: string, changed: boolean, previous: string, next: string) => {
    if (changed) rows.push({ label, before: previous, after: next });
  };
  push("Katalog", !sameIds(before.serviceIds, after.serviceIds), nameList(before.serviceIds, names.services), nameList(after.serviceIds, names.services));
  push("Fokus angle", !sameIds(before.angleIds, after.angleIds), nameList(before.angleIds, names.angles), nameList(after.angleIds, names.angles));
  push("Pilar", !sameIds(before.pillarIds, after.pillarIds), nameList(before.pillarIds, names.pillars), nameList(after.pillarIds, names.pillars));
  push(
    "Headline font",
    normalizeBrandFont(before.headlineFont) !== normalizeBrandFont(after.headlineFont),
    textValue(normalizeBrandFont(before.headlineFont)),
    textValue(normalizeBrandFont(after.headlineFont)),
  );
  push(
    "Deskripsi font",
    normalizeBrandFont(before.bodyFont) !== normalizeBrandFont(after.bodyFont),
    textValue(normalizeBrandFont(before.bodyFont)),
    textValue(normalizeBrandFont(after.bodyFont)),
  );
  push(
    "Story auto approve",
    before.storyAutoApprove !== after.storyAutoApprove,
    before.storyAutoApprove ? "Hidup" : "Mati",
    after.storyAutoApprove ? "Hidup" : "Mati",
  );
  return rows;
}

export type { StoryBriefLabels };
