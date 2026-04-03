export interface KPITemplate {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  type: CalculatorType;
  settings: ServiceKPISettings | SalesKPISettings;
  created_by: string;
  organization_id?: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  usage_count: number;
}

export type TemplateCategory =
  | "healthcare"
  | "legal"
  | "digital_agency"
  | "business_consulting"
  | "ecommerce"
  | "saas"
  | "digital_products"
  | "physical_products"
  | "custom";

export type CalculatorType = "services" | "sales";

export interface ServiceKPISettings {
  brandingBudget: string;
  brandingCpm: string;
  brandingFrequency: string;
  brandingEngagementRate: string;
  brandingQualificationRate: string;

  conversionFrequency: string;
  budget: string;
  cpm: string;
  cpc?: string;
  ctrLink: string;
  adsClickToVisit: string;
  whatsappClick: string;
  prospectToClient: string;
  reservation: string;
  crossSelling: string;
  servicePackageValue: string;
  serviceProfitMargin: string;
  clientRetentionRate: string;

  remarketingAudienceSource: string;
  remarketingAudience: string;

  adType?: "meta" | "google";
}

export interface SalesKPISettings {
  budget: string;
  cpc: string;
  landingPageCtr: string;
  productViewRate: string;
  addToCartRate: string;
  checkoutRate: string;
  paymentSuccessRate: string;
  productPrice: string;
  avgOrderValue: string;
  profitMargin: string;
  repeatPurchaseRate: string;
  upsellRate: string;
  seasonalMultiplier: string;
}

export interface TemplateUsage {
  template_id: string;
  used_by: string;
  used_at: string;
  results: unknown;
}

export const TEMPLATE_CATEGORIES = {
  services: [
    {
      value: "healthcare" as const,
      label: "Healthcare Services",
      description: "Patient acquisition and medical services",
    },
    {
      value: "legal" as const,
      label: "Legal Services",
      description: "Legal consultation and case management",
    },
    {
      value: "digital_agency" as const,
      label: "Digital Agency",
      description: "Marketing and creative services",
    },
    {
      value: "business_consulting" as const,
      label: "Business Consulting",
      description: "Professional consulting services",
    },
    { value: "custom" as const, label: "Custom Service", description: "User-defined service template" },
  ],
  sales: [
    {
      value: "ecommerce" as const,
      label: "E-commerce",
      description: "Online retail and product sales",
    },
    {
      value: "saas" as const,
      label: "SaaS Products",
      description: "Software as a Service subscriptions",
    },
    {
      value: "digital_products" as const,
      label: "Digital Products",
      description: "Digital downloads and courses",
    },
    {
      value: "physical_products" as const,
      label: "Physical Products",
      description: "Physical goods and merchandise",
    },
    { value: "custom" as const, label: "Custom Product", description: "User-defined product template" },
  ],
} as const;
