import type { CatalogBrandColor, CatalogOption } from "./types";

export type StoryBriefDraft = {
  serviceIds: string[];
  angleIds: string[];
  pillarIds: string[];
  brandColorId: string | null;
  headlineFont: string;
  bodyFont: string;
  storyAutoApprove: boolean;
};

export type StoryBriefLabels = {
  services: CatalogOption[];
  angles: CatalogOption[];
  pillars: CatalogOption[];
};

export type StoryBriefPageSlice = {
  draft: StoryBriefDraft;
  labels: StoryBriefLabels;
  brandColors: CatalogBrandColor[];
};
