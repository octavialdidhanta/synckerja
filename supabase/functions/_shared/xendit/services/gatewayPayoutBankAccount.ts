import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapToIlumaBankCode, normalizeAccountHolder, normalizeBankAccountNumber } from "../../iluma/ilumaBankCodes.ts";

export type GatewayPayoutBankInput = {
  linkedBankAccountId: string | null;
  payoutBankCode: string;
  payoutAccountNumber: string;
  payoutAccountHolder: string;
  businessName: string;
};

/** Upsert payout bank row without enabling payout (validation required first). */
export async function ensureGatewayPayoutBankAccount(
  admin: SupabaseClient,
  organizationId: string,
  input: GatewayPayoutBankInput,
): Promise<string> {
  const payoutBankCode = mapToIlumaBankCode(input.payoutBankCode);
  const payoutAccountNumber = normalizeBankAccountNumber(input.payoutAccountNumber)
    || input.payoutAccountNumber.trim();
  const payoutAccountHolder = normalizeAccountHolder(input.payoutAccountHolder);
  const businessName = input.businessName.trim() || "Organization";

  const { error: clearErr } = await admin
    .from("bank_accounts")
    .update({
      use_for_gateway_payout: false,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);
  if (clearErr) throw new Error(clearErr.message);

  if (input.linkedBankAccountId) {
    const bankId = input.linkedBankAccountId.trim();
    const { data: bankRow, error: bankErr } = await admin
      .from("bank_accounts")
      .select("id")
      .eq("id", bankId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (bankErr) throw new Error(bankErr.message);
    if (!bankRow) throw new Error("Invalid linked_bank_account_id for organization");

    const { error: updateErr } = await admin
      .from("bank_accounts")
      .update({
        use_for_gateway_payout: false,
        gateway_payout_bank_code: payoutBankCode,
        account_number: payoutAccountNumber,
        account_holder: payoutAccountHolder,
        bank_name: payoutBankCode,
        gateway_payout_validation_status: "none",
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bankId);
    if (updateErr) throw new Error(updateErr.message);
    return bankId;
  }

  const { data: created, error: insertErr } = await admin
    .from("bank_accounts")
    .insert({
      organization_id: organizationId,
      name: `${businessName} - Gateway payout`,
      bank_name: payoutBankCode,
      account_number: payoutAccountNumber,
      account_holder: payoutAccountHolder,
      gateway_payout_bank_code: payoutBankCode,
      use_for_gateway_payout: false,
      gateway_payout_validation_status: "none",
      is_active: true,
    })
    .select("id")
    .single();
  if (insertErr) throw new Error(insertErr.message);
  return String(created.id);
}
