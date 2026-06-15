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
  sales_activity_payment_id: string;
  bank_code: string;
  account_number: string | null;
  expected_amount: number;
  platform_fee_amount?: number;
  split_rule_id?: string | null;
  platform_fee_status?: string | null;
  status: string;
  expires_at: string | null;
  external_id: string;
};

export type XenditDisbursementRow = {
  id: string;
  source_type: string;
  source_id: string;
  status: string;
  amount: number;
  failure_message: string | null;
};
