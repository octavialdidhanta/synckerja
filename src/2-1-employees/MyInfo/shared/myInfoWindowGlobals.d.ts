/**
 * Legacy bridges between My Info tabs and their pages (set in AddressInfoTab /
 * PersonalInfoForm, read by the page save handlers).
 */
export {};

declare global {
  interface Window {
    addressTabSave?: () => unknown;
    personalInfoFormData?: unknown;
  }
}
