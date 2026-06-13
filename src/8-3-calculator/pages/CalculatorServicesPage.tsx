import { useState } from "react";
import { CalculatorModuleShell } from "@/8-3-calculator/layout/CalculatorModuleShell";
import { TutorialSidebar } from "@/8-3-calculator/components/TutorialSidebar";
import CalculatorMainFooter from "@/8-3-calculator/components/CalculatorMainFooter";
import EngagementCalculator from "@/8-3-calculator/components/services/EngagementCalculator";
import TrafficCalculator from "@/8-3-calculator/components/services/TrafficCalculator";
import ConversionCalculator from "@/8-3-calculator/components/services/ConversionCalculator";
import type { ServiceKPISettings } from "@/8-3-calculator/types/kpi-templates";

const CalculatorServicesPage = () => {
  const [servicesSettings, setServicesSettings] = useState<ServiceKPISettings>({
    brandingBudget: "",
    brandingCpm: "",
    brandingFrequency: "",
    brandingEngagementRate: "",
    brandingQualificationRate: "",
    conversionFrequency: "",
    budget: "",
    cpm: "",
    conversionCpm: "",
    cpc: "",
    ctrLink: "",
    adsClickToVisit: "",
    whatsappClick: "",
    prospectToClient: "",
    reservation: "",
    crossSelling: "",
    servicePackageValue: "",
    serviceProfitMargin: "",
    clientRetentionRate: "",
    remarketingAudienceSource: "manual",
    remarketingAudience: "",
    adType: "meta",
  });

  const [brandingWarmAudience, setBrandingWarmAudience] = useState<number>(0);
  const [trafficWebsiteVisitors, setTrafficWebsiteVisitors] = useState<number>(0);

  return (
    <CalculatorModuleShell>
      <div className="col-span-12 flex min-h-0 min-w-0 flex-col xl:col-span-9">
        <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="space-y-4 pb-4">
                <div className="overflow-hidden rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
                  <div className="p-6">
                    <EngagementCalculator
                      initialSettings={{
                        brandingBudget: servicesSettings.brandingBudget,
                        brandingCpm: servicesSettings.brandingCpm,
                        brandingFrequency: servicesSettings.brandingFrequency,
                        brandingEngagementRate: servicesSettings.brandingEngagementRate,
                        brandingQualificationRate: "100",
                      }}
                      onSettingsChange={(settings) => {
                        setServicesSettings((prev) => ({
                          ...prev,
                          brandingBudget: settings.brandingBudget,
                          brandingCpm: settings.brandingCpm,
                          brandingFrequency: settings.brandingFrequency,
                          brandingEngagementRate: settings.brandingEngagementRate,
                        }));
                      }}
                      onWarmAudienceChange={setBrandingWarmAudience}
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
                  <div className="p-6">
                    <TrafficCalculator
                      initialSettings={{
                        budget: servicesSettings.budget,
                        cpm: servicesSettings.cpm,
                        cpc: servicesSettings.cpc,
                        ctrLink: servicesSettings.ctrLink,
                        adsClickToVisit: servicesSettings.adsClickToVisit,
                        adType: servicesSettings.adType || "meta",
                      }}
                      onSettingsChange={(settings) => {
                        setServicesSettings((prev) => ({
                          ...prev,
                          budget: settings.budget,
                          cpm: settings.cpm,
                          cpc: settings.cpc,
                          ctrLink: settings.ctrLink,
                          adsClickToVisit: settings.adsClickToVisit,
                          adType: settings.adType,
                        }));
                      }}
                      onWebsiteVisitorsChange={setTrafficWebsiteVisitors}
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
                  <div className="p-6">
                    <ConversionCalculator
                      initialSettings={{
                        conversionFrequency: servicesSettings.conversionFrequency,
                        conversionCpm:
                          servicesSettings.conversionCpm || servicesSettings.cpm,
                        ctrLink: servicesSettings.ctrLink,
                        adsClickToVisit: servicesSettings.adsClickToVisit,
                        whatsappClick: servicesSettings.whatsappClick,
                        prospectToClient: servicesSettings.prospectToClient,
                        reservation: servicesSettings.reservation,
                        crossSelling: servicesSettings.crossSelling,
                        servicePackageValue: servicesSettings.servicePackageValue,
                        serviceProfitMargin: servicesSettings.serviceProfitMargin,
                        clientRetentionRate: servicesSettings.clientRetentionRate,
                        remarketingAudienceSource: servicesSettings.remarketingAudienceSource,
                        remarketingAudience: servicesSettings.remarketingAudience,
                      }}
                      onSettingsChange={(settings) => {
                        setServicesSettings((prev) => ({
                          ...prev,
                          conversionFrequency: settings.conversionFrequency,
                          conversionCpm: settings.conversionCpm,
                          ctrLink: settings.ctrLink,
                          adsClickToVisit: settings.adsClickToVisit,
                          whatsappClick: settings.whatsappClick,
                          prospectToClient: settings.prospectToClient,
                          reservation: settings.reservation,
                          crossSelling: settings.crossSelling,
                          servicePackageValue: settings.servicePackageValue,
                          serviceProfitMargin: settings.serviceProfitMargin,
                          clientRetentionRate: settings.clientRetentionRate,
                          remarketingAudienceSource: settings.remarketingAudienceSource,
                          remarketingAudience: settings.remarketingAudience,
                        }));
                      }}
                      brandingWarmAudience={brandingWarmAudience}
                      trafficWebsiteVisitors={trafficWebsiteVisitors}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <CalculatorMainFooter activeTab="services" />
        </div>
      </div>

      <TutorialSidebar activeTab="services" />
    </CalculatorModuleShell>
  );
};

export default CalculatorServicesPage;
