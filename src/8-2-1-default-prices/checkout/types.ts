export type CatalogCheckoutApplicationMethod = "add" | "include";

export type CatalogCheckoutSettings = {
  organization_id: string;
  tax_enabled: boolean;
  gratuity_enabled: boolean;
  application_method: CatalogCheckoutApplicationMethod;
};

export type CatalogCheckoutSettingsSave = {
  tax_enabled: boolean;
  gratuity_enabled: boolean;
  application_method: CatalogCheckoutApplicationMethod;
};
