export type BlibliConnectWizardStep = 1 | 2 | 3 | 4;

export type BlibliConnectDraft = {
  readyChecked: boolean;
  bindChecked: boolean;
  storeCode: string;
  username: string;
  storeId: string;
  apiSellerKey: string;
  signatureKey: string;
  displayName: string;
};

export const EMPTY_BLIBLI_CONNECT_DRAFT: BlibliConnectDraft = {
  readyChecked: false,
  bindChecked: false,
  storeCode: '',
  username: '',
  storeId: '',
  apiSellerKey: '',
  signatureKey: '',
  displayName: '',
};

export const BLIBLI_STORE_INFO_URL = 'https://seller.blibli.com/MTA/store-info/store-info';

export function maskSecret(value: string, visible = 4): string {
  const v = value.trim();
  if (!v) return '—';
  if (v.length <= visible) return '•'.repeat(v.length);
  return `${'•'.repeat(Math.min(12, v.length - visible))}${v.slice(-visible)}`;
}

export function validateCredentialsStep(draft: BlibliConnectDraft): string | null {
  if (!draft.storeCode.trim()) return 'storeCode';
  if (!draft.username.trim()) return 'username';
  const sid = Number(draft.storeId.trim());
  if (!Number.isFinite(sid) || sid <= 0) return 'storeId';
  if (!draft.apiSellerKey.trim()) return 'apiSellerKey';
  return null;
}
