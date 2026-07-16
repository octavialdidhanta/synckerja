import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useLeadMagnetEntitlement } from "@/6-1-lead-magnet/hooks/useLeadMagnetEntitlement";
import {
  OMNICHANNEL_SETTINGS_SECTIONS,
  omnichannelSettingsSectionPagePath,
  type OmnichannelSettingsSectionId,
} from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsSections";

type OmnichannelSettingsSidebarProps = {
  activeSection: OmnichannelSettingsSectionId;
  onSectionChange: (id: OmnichannelSettingsSectionId) => void;
};

export function OmnichannelSettingsSidebar({ activeSection, onSectionChange }: OmnichannelSettingsSidebarProps) {
  const { t } = useTranslation();
  const { isTabLocked } = useHeaderTabPageAccess();
  const { hasEntitlement: hasLeadMagnetEntitlement, isPending: leadMagnetPending } =
    useLeadMagnetEntitlement();

  const visibleSections = OMNICHANNEL_SETTINGS_SECTIONS.filter((section) => {
    if (section.id !== "lead-magnet") return true;
    if (leadMagnetPending) return true;
    return hasLeadMagnetEntitlement;
  });

  return (
    <div className="space-y-2">
      {visibleSections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        const title = t(section.titleKey);
        const description = t(section.descriptionKey);
        const sectionPath = omnichannelSettingsSectionPagePath(section.id);
        const locked = isTabLocked(sectionPath);

        return (
          <button
            key={section.id}
            type="button"
            title={
              locked
                ? t("accessDenied.message", "You do not have permission to view this page.")
                : undefined
            }
            onClick={() => {
              onSectionChange(section.id);
            }}
            className={cn(
              "group w-full rounded-[5px] p-3 text-left transition-all duration-200 ease-out",
              locked && "opacity-70",
              isActive
                ? "border-2 border-primary/50 bg-accent shadow-sm"
                : "border border-border bg-card hover:border-primary/30 hover:bg-muted/60",
            )}
          >
            <div className="flex items-start space-x-3">
              <div
                className={cn(
                  "flex-shrink-0 rounded-[5px] p-2 transition-colors duration-200",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-medium text-foreground">
                    {title}
                    {locked ? <Lock className="ml-1 inline h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
                  </h3>
                  <span
                    className={cn(
                      "ml-1 inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      section.status === "active"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {section.status === "active"
                      ? t("omnichannel.settings.sectionStatusActive")
                      : t("omnichannel.settings.sectionStatusBeta")}
                  </span>
                </div>
                <p
                  className={cn(
                    "text-xs leading-tight",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground/80",
                  )}
                >
                  {description}
                </p>
              </div>
            </div>
          </button>
        );
      })}

      <div className="mt-4 rounded-[5px] border border-primary/30 bg-primary/10 p-3">
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden />
          <span className="text-xs font-medium text-primary">{t("omnichannel.settings.shell.realtimeLabel")}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("omnichannel.settings.shell.realtimeHint")}</p>
      </div>
    </div>
  );
}
