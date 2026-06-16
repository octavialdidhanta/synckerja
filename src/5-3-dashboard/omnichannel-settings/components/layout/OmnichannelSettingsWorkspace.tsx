import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  OMNICHANNEL_SETTINGS_INDEX_REDIRECT_TO,
  OMNICHANNEL_SETTINGS_SECTIONS,
  parseOmnichannelSettingsSectionSlug,
  omnichannelSettingsPath,
  omnichannelSettingsSectionPagePath,
  type OmnichannelSettingsSectionId,
} from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsSections";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { OmnichannelSettingsSidebar } from "@/5-3-dashboard/omnichannel-settings/components/sidebar/OmnichannelSettingsSidebar";
import { UserManagementSection } from "@/5-3-dashboard/omnichannel-settings/components/user-management/UserManagementSection";
import { SlaManagementSection } from "@/5-3-dashboard/omnichannel-settings/components/sla/SlaManagementSection";
import { CustomerSurveySettingsShell } from "@/features/customer-survey/settings/CustomerSurveySettingsShell";
import { CustomerSurveyTargetSettingsShell } from "@/features/customer-survey/settings/CustomerSurveyTargetSettingsShell";
import { OfflineConversionSettingsShell } from "@/meta-ads/settings/OfflineConversionSettingsShell";
import { ApiIntegrationSection } from "@/5-3-dashboard/omnichannel-settings/components/api-integration/ApiIntegrationSection";
import { cn } from "@/shared/lib/utils";
import {
  OMNICHANNEL_SETTINGS_CARD_HEADER_BASE,
  OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS,
  OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS,
} from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsCardHeader";

const panelScrollClass =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function OmnichannelSettingsWorkspace() {
  const { t } = useTranslation();
  const { section: sectionSlug } = useParams<{ section: string }>();
  const navigate = useNavigate();

  const activeSection = useMemo(
    () => parseOmnichannelSettingsSectionSlug(sectionSlug),
    [sectionSlug],
  );

  useEffect(() => {
    if (!activeSection) {
      navigate(OMNICHANNEL_SETTINGS_INDEX_REDIRECT_TO, { replace: true });
    }
  }, [activeSection, navigate]);

  const handleSectionChange = (id: OmnichannelSettingsSectionId) => {
    navigate(omnichannelSettingsPath(id));
  };

  if (!activeSection) {
    return null;
  }

  return (
    <div className="grid min-h-[calc(100vh-120px)] w-full min-w-0 flex-1 grid-cols-12 gap-2 items-stretch [grid-template-rows:minmax(0,1fr)] lg:max-h-[calc(100vh-120px)] lg:overflow-hidden">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-col overflow-hidden md:col-span-3 lg:h-full">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[5px] border border-border bg-card shadow-sm lg:h-full">
          <div
            className={cn(OMNICHANNEL_SETTINGS_CARD_HEADER_BASE, "flex flex-col justify-center")}
          >
            <h3 className={OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS}>
              {t("omnichannel.settings.shell.sidebarTitle")}
            </h3>
            <p className={OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS}>
              {t("omnichannel.settings.shell.sidebarSubtitle")}
            </p>
          </div>
          <div className={`${panelScrollClass} p-3`}>
            <OmnichannelSettingsSidebar activeSection={activeSection} onSectionChange={handleSectionChange} />
          </div>
          <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("omnichannel.settings.shell.footerLeft")}</span>
              <span className="text-primary/80">{t("omnichannel.settings.shell.footerRight")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-12 flex min-h-0 min-w-0 flex-col overflow-hidden md:col-span-9 lg:h-full">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[5px] border border-border bg-card shadow-sm lg:h-full">
          <ModuleShellContentGate pagePath={omnichannelSettingsSectionPagePath(activeSection)}>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:h-full">
              {activeSection === "user-management" ? <UserManagementSection /> : null}
              {activeSection === "sla" ? <SlaManagementSection /> : null}
              {activeSection === "survey" ? <CustomerSurveySettingsShell /> : null}
              {activeSection === "target" ? <CustomerSurveyTargetSettingsShell /> : null}
              {activeSection === "offline-conversion" ? <OfflineConversionSettingsShell /> : null}
              {activeSection === "api-integration" ? <ApiIntegrationSection /> : null}
            </div>
          </ModuleShellContentGate>
        </div>
      </div>
    </div>
  );
}
