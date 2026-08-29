import type { EntitySubtype, XenditBusinessAddress } from "@/xendit/lib/xenditKycEntityConfig";

export type XenditOrgAccount = {
  organization_id: string;
  xendit_sub_account_id: string | null;
  business_name: string;
  email: string | null;
  account_type: string;
  is_enabled: boolean;
  status: string;
  kyc_status: string | null;
  linked_bank_account_id?: string | null;
  payout_bank?: XenditGatewayPayoutBank | null;
};

export type GatewayPayoutValidationStatus =
  | "none"
  | "pending"
  | "match"
  | "not_match"
  | "unclear"
  | "failed"
  | "error"
  | "stale";

export type XenditGatewayPayoutBank = {
  id: string;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  gateway_payout_bank_code: string | null;
  use_for_gateway_payout: boolean;
  gateway_payout_validation_status?: GatewayPayoutValidationStatus;
  gateway_payout_validated_holder?: string | null;
  gateway_payout_validated_at?: string | null;
  gateway_payout_is_normal_account?: boolean | null;
  gateway_payout_validation_error?: string | null;
};

export type XenditVaBank = { code: string; label: string };

export type XenditPaymentRequest = {
  id: string;
  organization_id: string;
  sales_activity_payment_id: string | null;
  payment_type?: "va" | "qris";
  pos_pending_checkout_id?: string | null;
  sales_activity_id?: string | null;
  bank_code: string;
  account_number: string | null;
  expected_amount: number;
  platform_fee_amount?: number;
  split_rule_id?: string | null;
  platform_fee_status?: string | null;
  status: string;
  expires_at: string | null;
  external_id: string;
  qr_string?: string | null;
  xendit_qr_id?: string | null;
};

export type XenditDisbursementRow = {
  id: string;
  source_type: string;
  source_id: string;
  status: string;
  amount: number;
  failure_message: string | null;
};

export type DocumentUploadStatus = "pending" | "completed" | "failed" | "not_required";

export type XenditSubAccountRow = {
  id: string;
  organization_id: string;
  xendit_sub_account_id: string | null;
  business_name: string;
  email: string;
  account_type: "OWNED" | "MANAGED";
  status: string;
  kyc_status: string | null;
  document_upload_status: DocumentUploadStatus;
  document_upload_error: string | null;
  is_primary: boolean;
  linked_bank_account_id: string | null;
  created_at: string;
  updated_at: string;
};

export type XenditSubAccountWallet = {
  id: string;
  organization_id: string;
  sub_account_row_id: string;
  xendit_sub_account_id: string;
  usable_balance: number;
  pending_balance: number;
  total_balance: number;
  currency: string;
  synced_at: string | null;
  sync_error: string | null;
  email?: string;
  business_name?: string;
  is_primary?: boolean;
  status?: string;
};

export type XenditWalletAggregate = {
  usableBalance: number;
  pendingBalance: number;
  totalBalance: number;
  syncedAt: string | null;
};

export type OrganizationKycDocument = {
  id: string;
  organization_id: string;
  business_type: "individual" | "company";
  entity_subtype: EntitySubtype | null;
  legal_name: string;
  identity_number: string | null;
  npwp: string | null;
  nib: string | null;
  director_npwp: string | null;
  ktp_storage_path: string | null;
  nib_storage_path: string | null;
  npwp_storage_path: string | null;
  director_npwp_storage_path: string | null;
  akta_storage_path: string | null;
  sk_menkeh_storage_path: string | null;
  entity_extra_documents: Record<string, string> | null;
  /** @deprecated Use nib_storage_path / npwp_storage_path */
  legal_doc_storage_path: string | null;
  service_agreement_storage_path: string | null;
  business_address: XenditBusinessAddress | null;
  business_website: string | null;
  proof_of_business_storage_path: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
  updated_at: string;
};

export type RequestSubAccountResponse = {
  ok: boolean;
  require_kyc: boolean;
  can_create: boolean;
  is_internal: boolean;
  account_type: "OWNED" | "MANAGED";
  kyc_status: string | null;
  message?: string;
};

export type XenditSettingsResponse = {
  serverConfigured: boolean;
  isSandbox: boolean;
  keyKind: "development" | "production" | "public" | "unknown";
  publicKey: string | null;
  account: XenditOrgAccount | null;
  primarySubAccount: XenditSubAccountRow | null;
  subAccounts: XenditSubAccountRow[];
  kyc: OrganizationKycDocument | null;
  isInternalOrg: boolean;
  platformConfig: { flat_fee_amount: number; split_rule_id: string | null } | null;
};
