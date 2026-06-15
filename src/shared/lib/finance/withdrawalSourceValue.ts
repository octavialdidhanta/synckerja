export type GatewayWalletProvider = 'xendit' | 'brick';

export type WithdrawalSourceValue = {
  debtId?: string;
  bankAccountId?: string;
  gatewayProvider?: GatewayWalletProvider;
};

export function encodeWithdrawalSourceValue(v: WithdrawalSourceValue): string {
  if (v.gatewayProvider) return `gateway_${v.gatewayProvider}`;
  if (v.debtId) return `debt_${v.debtId}`;
  if (v.bankAccountId) return `bank_${v.bankAccountId}`;
  return 'none';
}

export function decodeWithdrawalSourceValue(raw: string): WithdrawalSourceValue {
  if (raw === 'none' || !raw) return {};
  if (raw.startsWith('gateway_')) {
    const provider = raw.replace('gateway_', '') as GatewayWalletProvider;
    if (provider === 'xendit' || provider === 'brick') {
      return { gatewayProvider: provider };
    }
    return {};
  }
  if (raw.startsWith('debt_')) return { debtId: raw.replace('debt_', '') };
  if (raw.startsWith('bank_')) return { bankAccountId: raw.replace('bank_', '') };
  return {};
}

export function normalizeWithdrawalSourceValue(v: WithdrawalSourceValue): WithdrawalSourceValue {
  if (v.gatewayProvider) {
    return { gatewayProvider: v.gatewayProvider };
  }
  if (v.debtId) {
    return { debtId: v.debtId };
  }
  if (v.bankAccountId) {
    return { bankAccountId: v.bankAccountId };
  }
  return {};
}

export function hasWithdrawalSource(v: WithdrawalSourceValue): boolean {
  return Boolean(v.debtId || v.bankAccountId || v.gatewayProvider);
}

export type WithdrawalFormFields = {
  withdrawal_from_balance?: string | null;
  bank_account_id?: string | null;
  gateway_wallet_provider?: GatewayWalletProvider | null;
};

export function withdrawalSourceFromFormFields(fields: WithdrawalFormFields): WithdrawalSourceValue {
  if (fields.gateway_wallet_provider) {
    return { gatewayProvider: fields.gateway_wallet_provider };
  }
  if (fields.withdrawal_from_balance && fields.withdrawal_from_balance !== 'none') {
    return { debtId: fields.withdrawal_from_balance };
  }
  if (fields.bank_account_id) {
    return { bankAccountId: fields.bank_account_id };
  }
  return {};
}

export function hasWithdrawalFormFields(fields: WithdrawalFormFields): boolean {
  return hasWithdrawalSource(withdrawalSourceFromFormFields(fields));
}

export function applyWithdrawalSourceToFormFields(
  source: WithdrawalSourceValue,
): WithdrawalFormFields {
  const normalized = normalizeWithdrawalSourceValue(source);
  if (normalized.gatewayProvider) {
    return {
      withdrawal_from_balance: undefined,
      bank_account_id: undefined,
      gateway_wallet_provider: normalized.gatewayProvider,
    };
  }
  if (normalized.debtId) {
    return {
      withdrawal_from_balance: normalized.debtId,
      bank_account_id: undefined,
      gateway_wallet_provider: undefined,
    };
  }
  if (normalized.bankAccountId) {
    return {
      withdrawal_from_balance: undefined,
      bank_account_id: normalized.bankAccountId,
      gateway_wallet_provider: undefined,
    };
  }
  return {
    withdrawal_from_balance: undefined,
    bank_account_id: undefined,
    gateway_wallet_provider: undefined,
  };
}
