import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/shared/lib/utils";
import {
  FLOW_BUILDER_LISTING_PATH,
  FLOW_BUILDER_SETTINGS_BASE_PATH,
  flowBuilderTabPath,
  parseFlowBuilderTabFromPathname,
  type FlowBuilderTabId,
} from "@/5-3-dashboard/omnichannel-settings/constants/flowBuilderPaths";
import {
  OMNICHANNEL_SETTINGS_CARD_HEADER_BASE,
  OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS,
  OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS,
} from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsCardHeader";
import { FlowBuilderListingPanel } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/FlowBuilderListingPanel";
import { FlowBuilderUsagePanel } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/FlowBuilderUsagePanel";
import { MetaWhatsAppFormFlowsPanel } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/meta-form-flows/MetaWhatsAppFormFlowsPanel";

const panelScrollClass =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const FLOW_BUILDER_TABS: FlowBuilderTabId[] = ["listing", "usage", "form-flows"];

export function FlowBuilderSettingsShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = useMemo(
    () => parseFlowBuilderTabFromPathname(location.pathname),
    [location.pathname],
  );

  useEffect(() => {
    const normalized = location.pathname.replace(/\/+$/, "");
    if (normalized === FLOW_BUILDER_SETTINGS_BASE_PATH) {
      navigate(FLOW_BUILDER_LISTING_PATH, { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={`${OMNICHANNEL_SETTINGS_CARD_HEADER_BASE} shrink-0`}>
        <h2 className={OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS}>
          {t("omnichannel.settings.flowBuilder.pageTitle")}
        </h2>
        <p className={OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS}>
          {t("omnichannel.settings.flowBuilder.intro")}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2">
        <div className="flex shrink-0 gap-1 border-b border-border" role="tablist" aria-label={t("omnichannel.settings.flowBuilder.pageTitle")}>
          {FLOW_BUILDER_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => navigate(flowBuilderTabPath(tab))}
                className={cn(
                  "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`omnichannel.settings.flowBuilder.tab.${tab}`)}
              </button>
            );
          })}
        </div>

        <div className={`${panelScrollClass} mt-4`} role="tabpanel">
          {activeTab === "listing" ? <FlowBuilderListingPanel /> : null}
          {activeTab === "usage" ? <FlowBuilderUsagePanel /> : null}
          {activeTab === "form-flows" ? <MetaWhatsAppFormFlowsPanel /> : null}
        </div>
      </div>
    </div>
  );
}
