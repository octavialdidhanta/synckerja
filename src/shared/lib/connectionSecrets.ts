import { supabase } from '@/shared/lib/supabaseClient';

/**
 * Connection secrets (Meta / WhatsApp tokens, AI provider API keys) cannot be read or written
 * from the browser: the token columns have no SELECT/INSERT/UPDATE privilege for signed-in users.
 * The only way to set or clear one is the set_org_connection_secret RPC, which checks that the
 * caller is owner/admin of the row's organization. The UI reads the has_* / *_configured flags.
 */
export type ConnectionSecretKind =
  | 'facebook_page_token'
  | 'instagram_page_token'
  | 'meta_config_token'
  | 'whatsapp_account_token'
  | 'whatsapp_config_token'
  | 'script_ai_google'
  | 'script_ai_openai'
  | 'script_ai_claude'
  | 'video_ai_byteplus'
  | 'voice_ai_elevenlabs';

const OWNER_ADMIN_ONLY = 'Hanya owner atau admin yang bisa mengubah kunci koneksi.';

export function connectionSecretErrorText(error: { message?: string; code?: string } | null | undefined): string {
  const message = error?.message ?? '';
  if (error?.code === '42501' || message.includes('Hanya owner atau admin')) return OWNER_ADMIN_ONLY;
  if (message.includes('connection_not_found')) return 'Koneksi tidak ditemukan. Muat ulang halaman lalu coba lagi.';
  return message || 'Kunci koneksi gagal disimpan.';
}

/** Sets (or clears, with null/blank) one secret on one row. Throws a readable Error. */
export async function setConnectionSecret(
  kind: ConnectionSecretKind,
  rowId: string,
  value: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('set_org_connection_secret', {
    p_kind: kind,
    p_row_id: rowId,
    p_value: value,
  });
  if (error) throw new Error(connectionSecretErrorText(error));
}

/** Copies the org's shared Meta token onto a WhatsApp number. Returns false when no shared token exists. */
export async function applySharedWhatsAppToken(accountId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('use_shared_whatsapp_token', { p_account_id: accountId });
  if (error) throw new Error(connectionSecretErrorText(error));
  return data === true;
}
