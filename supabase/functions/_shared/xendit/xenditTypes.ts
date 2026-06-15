export type XenditSubAccountRow = {
  organization_id: string;
  xendit_sub_account_id: string | null;
  business_name: string;
  email: string | null;
  account_type: string;
  is_enabled: boolean;
  status: string;
  kyc_status: string | null;
  linked_bank_account_id?: string | null;
};

export const XENDIT_VA_BANKS = [
  { code: "BCA", label: "BCA" },
  { code: "MANDIRI", label: "Bank Mandiri" },
  { code: "BNI", label: "BNI" },
  { code: "BRI", label: "BRI" },
  { code: "PERMATA", label: "Permata" },
  { code: "BJB", label: "BJB" },
  { code: "BSI", label: "BSI" },
  { code: "CIMB", label: "CIMB Niaga" },
  { code: "SAHABAT_SAMPOERNA", label: "Bank Sahabat Sampoerna" },
] as const;
