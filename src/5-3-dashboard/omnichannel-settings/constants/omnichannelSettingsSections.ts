import type { LucideIcon } from "lucide-react";
import { Timer, Users } from "lucide-react";

export type OmnichannelSettingsSectionId = "user-management" | "sla";

export type OmnichannelSettingsSectionMeta = {
  id: OmnichannelSettingsSectionId;
  /** Last path segment under `/omnichannel/settings/`. */
  urlSlug: string;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
  status: "active" | "beta";
};

export const OMNICHANNEL_SETTINGS_SECTIONS: OmnichannelSettingsSectionMeta[] = [
  {
    id: "user-management",
    urlSlug: "user-management",
    icon: Users,
    titleKey: "omnichannel.settings.userManagement.sidebarTitle",
    descriptionKey: "omnichannel.settings.userManagement.sidebarDescription",
    status: "active",
  },
  {
    id: "sla",
    urlSlug: "sla-management",
    icon: Timer,
    titleKey: "omnichannel.settings.slaManagement.sidebarTitle",
    descriptionKey: "omnichannel.settings.slaManagement.sidebarDescription",
    status: "active",
  },
];

const URL_SLUG_TO_SECTION_ID = new Map<string, OmnichannelSettingsSectionId>(
  OMNICHANNEL_SETTINGS_SECTIONS.map((s) => [s.urlSlug, s.id]),
);

export const OMNICHANNEL_SETTINGS_DEFAULT_SECTION_ID: OmnichannelSettingsSectionId =
  OMNICHANNEL_SETTINGS_SECTIONS[0]?.id ?? "user-management";

/** `/omnichannel/settings` without a section redirects here. */
export const OMNICHANNEL_SETTINGS_INDEX_REDIRECT_TO = `/omnichannel/settings/${
  OMNICHANNEL_SETTINGS_SECTIONS[0]?.urlSlug ?? "user-management"
}`;

export function parseOmnichannelSettingsSectionSlug(
  slug: string | undefined,
): OmnichannelSettingsSectionId | null {
  if (!slug) return null;
  return URL_SLUG_TO_SECTION_ID.get(slug) ?? null;
}

export function omnichannelSettingsPath(sectionId: OmnichannelSettingsSectionId): string {
  const slug =
    OMNICHANNEL_SETTINGS_SECTIONS.find((s) => s.id === sectionId)?.urlSlug ??
    OMNICHANNEL_SETTINGS_SECTIONS[0]?.urlSlug ??
    "user-management";
  return `/omnichannel/settings/${slug}`;
}
