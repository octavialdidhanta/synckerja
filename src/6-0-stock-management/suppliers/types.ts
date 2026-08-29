export type CatalogSupplier = {
  id: string;
  organizationId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  bankCode: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
};

export type SupplierFormValues = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  bankCode: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
};
