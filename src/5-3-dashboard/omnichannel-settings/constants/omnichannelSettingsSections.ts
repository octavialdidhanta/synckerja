import type { LucideIcon } from "lucide-react";
import { ClipboardList, Code2, Megaphone, Target, Timer, Users } from "lucide-react";

export type OmnichannelSettingsSectionId =
  | "user-management"
  | "sla"
  | "survey"
  | "target"
  | "offline-conversion"
  | "api-integration";

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
  {
    id: "survey",
    urlSlug: "survey",
    icon: ClipboardList,
    titleKey: "omnichannel.settings.customerSurvey.sidebarTitle",
    descriptionKey: "omnichannel.settings.customerSurvey.sidebarDescription",
    status: "active",
  },
  {
    id: "target",
    urlSlug: "target",
    icon: Target,
    titleKey: "omnichannel.settings.customerSurveyTarget.sidebarTitle",
    descriptionKey: "omnichannel.settings.customerSurveyTarget.sidebarDescription",
    status: "active",
  },
  {
    id: "offline-conversion",
    urlSlug: "offline-conversion",
    icon: Megaphone,
    titleKey: "omnichannel.settings.offlineConversion.sidebarTitle",
    descriptionKey: "omnichannel.settings.offlineConversion.sidebarDescription",
    status: "active",
  },
  {
    id: "api-integration",
    urlSlug: "api-integration",
    icon: Code2,
    titleKey: "omnichannel.settings.apiIntegration.sidebarTitle",
    descriptionKey: "omnichannel.settings.apiIntegration.sidebarDescription",
    status: "active",
  },
];

const URL_SLUG_TO_SECTION_ID = new Map<string, OmnichannelSettingsSectionId>([
  ...OMNICHANNEL_SETTINGS_SECTIONS.map((s) => [s.urlSlug, s.id] as const),
  ["google-ads", "offline-conversion"],
  ["api-integration/docs", "api-integration"],
]);

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

/** Page Access path for a settings section (sidebar lock + content gate). */
export function omnichannelSettingsSectionPagePath(sectionId: OmnichannelSettingsSectionId): string {
  return omnichannelSettingsPath(sectionId);
}
