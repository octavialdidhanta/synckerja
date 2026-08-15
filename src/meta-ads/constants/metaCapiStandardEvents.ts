/** Meta standard events recommended for CRM Converted offline CAPI uploads. */

export const META_CAPI_CUSTOM_EVENT_VALUE = "__custom__";

export const META_CAPI_STANDARD_EVENTS = [
  "Purchase",
  "Lead",
  "CompleteRegistration",
  "Contact",
  "Schedule",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Subscribe",
] as const;

export type MetaCapiStandardEvent = (typeof META_CAPI_STANDARD_EVENTS)[number];

export const META_CAPI_DEFAULT_EVENT_NAME: MetaCapiStandardEvent = "Purchase";

export const META_CAPI_CUSTOM_EVENT_MAX_LENGTH = 64;
