import type { LucideIcon } from "lucide-react";
import {
  BookUser,
  ClipboardList,
  Code2,
  Magnet,
  Megaphone,
  Target,
  Timer,
  Users,
} from "lucide-react";
import { FlowBuilderIcon } from "@/5-3-dashboard/omnichannel-settings/components/icons/FlowBuilderIcon";

export type OmnichannelSettingsSectionId =
  | "user-management"
  | "sla"
  | "survey"
  | "flow"
  | "target"
  | "offline-conversion"
  | "google-contacts"
  | "api-integration"
  | "lead-magnet";

export type OmnichannelSettingsSectionMeta = {
  id: OmnichannelSettingsSectionId;
  /** Path segment(s) under `/omnichannel/settings/` (may include nested paths). */
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
    id: "flow",
    urlSlug: "flow-builder/listing",
    icon: FlowBuilderIcon as LucideIcon,
    titleKey: "omnichannel.settings.flowBuilder.sidebarTitle",
    descriptionKey: "omnichannel.settings.flowBuilder.sidebarDescription",
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
    id: "google-contacts",
    urlSlug: "google-contacts",
    icon: BookUser,
    titleKey: "omnichannel.settings.googleContacts.sidebarTitle",
    descriptionKey: "omnichannel.settings.googleContacts.sidebarDescription",
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
  {
    id: "lead-magnet",
    urlSlug: "lead-magnet",
    icon: Magnet,
    titleKey: "omnichannel.settings.leadMagnet.sidebarTitle",
    descriptionKey: "omnichannel.settings.leadMagnet.sidebarDescription",
    status: "active",
  },
];

const URL_SLUG_TO_SECTION_ID = new Map<string, OmnichannelSettingsSectionId>([
  ...OMNICHANNEL_SETTINGS_SECTIONS.map((s) => [s.urlSlug, s.id] as const),
  ["google-ads", "offline-conversion"],
  ["api-integration/docs", "api-integration"],
  ["flow-builder", "flow"],
  ["flow-builder/usage", "flow"],
  ["flow-builder/form-flows", "flow"],
]);

const OMNICHANNEL_SETTINGS_PATH_PREFIX = "/omnichannel/settings/";

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

/** Resolve section from full pathname (supports nested slugs such as `flow-builder/listing`). */
export function parseOmnichannelSettingsPathname(pathname: string): OmnichannelSettingsSectionId | null {
  if (!pathname.startsWith(OMNICHANNEL_SETTINGS_PATH_PREFIX)) return null;
  const rest = pathname.slice(OMNICHANNEL_SETTINGS_PATH_PREFIX.length).replace(/\/+$/, "");
  if (!rest) return null;

  const direct = URL_SLUG_TO_SECTION_ID.get(rest);
  if (direct) return direct;

  const firstSegment = rest.split("/")[0];
  return URL_SLUG_TO_SECTION_ID.get(firstSegment ?? "") ?? null;
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
