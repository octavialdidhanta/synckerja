import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { supabase } from '@/shared/lib/supabaseClient';
import { readEdgeFunctionError } from '@/shared/ai/geminiSpendCap';
import { useWhatsAppConfig } from '../../hooks/useWhatsAppConfig';
import { useWhatsAppAccounts } from '../../hooks/useWhatsAppAccounts';
import type { WhatsAppAccount } from '../../types';

type PhoneProfile = { verified_name: string | null; display_phone_number: string | null };
export interface WhatsAppConnectFormProps {
  /** When set, form is in edit mode for this account. */
  editingAccount?: WhatsAppAccount | null;
  /** Called when user cancels edit or after successful submit. */
  onClearEdit?: () => void;
  /** Called after save so parent can sync from Meta API (e.g. fetch real name_status). */
  onAfterSave?: (account: WhatsAppAccount) => void | Promise<void>;
}

export function WhatsAppConnectForm({ editingAccount = null, onClearEdit, onAfterSave }: WhatsAppConnectFormProps) {
  const { config: orgConfig, isLoading: orgConfigLoading, ensureOrgMetaConfig } = useWhatsAppConfig();
  const { accounts, upsert, isUpserting, updateName, maxAccounts } = useWhatsAppAccounts();
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [metaBusinessManagerId, setMetaBusinessManagerId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');

  const hasSharedToken = orgConfig?.has_meta_access_token === true;
  const canAddMore = accounts.length < maxAccounts;

  useEffect(() => {
    if (editingAccount) {
      setBusinessAccountId(editingAccount.whatsapp_business_account_id);
      setPhoneNumberId(editingAccount.phone_number_id);
      setAccessToken(''); // write-only: the stored token is never sent to the browser
      setMetaBusinessManagerId('');
    } else {
      setBusinessAccountId('');
      setPhoneNumberId('');
      setAccessToken('');
      setMetaBusinessManagerId('');
    }
  }, [editingAccount]);

  const handleCancelEdit = () => {
    onClearEdit?.();
    setBusinessAccountId('');
    setPhoneNumberId('');
    setAccessToken('');
    setMetaBusinessManagerId('');
  };

  /**
   * Checks the Phone Number ID at Meta on the server (whatsapp-phone-lookup). The browser never holds the
   * stored token: it sends only a newly typed token, otherwise the server uses the stored/shared one.
   */
  const lookupPhoneAtMeta = async (pnId: string, wabaId: string, typedToken: string): Promise<PhoneProfile> => {
    const { data, error } = await supabase.functions.invoke('whatsapp-phone-lookup', {
      body: {
        organization_id: orgConfig?.organization_id ?? editingAccount?.organization_id,
        phone_number_id: pnId,
        waba_id: wabaId || undefined,
        account_id: editingAccount?.id,
        access_token: typedToken || undefined,
      },
    });
    const message = await readEdgeFunctionError(data, error);
    if (message) throw new Error(message);
    return data as PhoneProfile;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wabaId = businessAccountId.trim();
    const pnId = phoneNumberId.trim();
    const tokenInput = accessToken.trim();
    if (!wabaId || !pnId) return;
    if (!tokenInput && !hasSharedToken && !editingAccount?.has_meta_access_token) {
      return; // validation will show
    }
    if (!editingAccount && !canAddMore) return;

    // Validasi ke Meta (di server): pastikan pnId adalah WhatsApp Phone Number ID (bukan Instagram/Page ID)
    let profile: PhoneProfile;
    try {
      profile = await lookupPhoneAtMeta(pnId, wabaId, tokenInput);
    } catch (validateErr) {
      const msg = validateErr instanceof Error ? validateErr.message : 'Phone Number ID tidak valid.';
      toast.error(msg);
      return;
    }

    const saved = await upsert({
      accountId: editingAccount?.id ?? null,
      payload: {
        whatsapp_business_account_id: wabaId,
        phone_number_id: pnId,
        meta_access_token: tokenInput || null,
        display_phone_number: null,
        whatsapp_business_name: null,
      },
      hasSharedToken,
    });

    if (saved) {
      const updatedConfig = await ensureOrgMetaConfig({
        verify_token: null,
        meta_business_manager_id: metaBusinessManagerId.trim() || null,
        // Only a newly typed token becomes the shared one; empty keeps what is stored.
        meta_access_token: tokenInput || null,
      });
      if (updatedConfig?.verify_token?.trim() && saved.id) {
        await supabase
          .from('organization_whatsapp_accounts')
          .update({ verify_token: updatedConfig.verify_token.trim(), updated_at: new Date().toISOString() })
          .eq('id', saved.id);
      }

      try {
        await updateName({
          accountId: saved.id,
          whatsapp_business_name: profile.verified_name ?? null,
          display_phone_number: profile.display_phone_number ?? null,
        });
      } catch {
        // ignore
      }
      // Sync from Meta API so name_status (Display name verification) reflects reality
      try {
        await onAfterSave?.(saved);
      } catch {
        // ignore; user can use "Refresh dari Meta" manually
      }
    }

    onClearEdit?.();
    setBusinessAccountId('');
    setPhoneNumberId('');
    setAccessToken('');
  };

  if (orgConfigLoading) {
    return null;
  }

  const isEdit = !!editingAccount;
  const canSubmit =
    businessAccountId.trim() &&
    phoneNumberId.trim() &&
    (isEdit ? true : (accessToken.trim() || hasSharedToken));

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      {editingAccount && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Mengedit akun: {editingAccount.whatsapp_business_name || editingAccount.display_phone_number || editingAccount.phone_number_id}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="business-account-id">WhatsApp Business Account ID</Label>
        <Input
          id="business-account-id"
          value={businessAccountId}
          onChange={(e) => setBusinessAccountId(e.target.value)}
          className="bg-gray-50"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="access-token">Access Token</Label>
        <Input
          id="access-token"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          className="bg-gray-50"
          autoComplete="new-password"
          placeholder={
            editingAccount?.has_meta_access_token || hasSharedToken
              ? 'Token tersimpan. Kosongkan untuk tetap memakai token lama.'
              : undefined
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="meta-business-manager-id">Meta Business Manager ID</Label>
        <Input
          id="meta-business-manager-id"
          value={metaBusinessManagerId}
          onChange={(e) => setMetaBusinessManagerId(e.target.value)}
          className="bg-gray-50"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone-number-id">Phone Number ID</Label>
        <Input
          id="phone-number-id"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          className="bg-gray-50"
          autoComplete="off"
          readOnly={!!editingAccount}
        />
        {editingAccount && <p className="text-xs text-gray-500">Phone Number ID tidak dapat diubah. Disconnect dan tambah akun baru jika perlu.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isUpserting || !canSubmit || (!isEdit && !canAddMore)}>
          {isUpserting ? 'Menyimpan...' : isEdit ? 'Update' : 'Tambah akun'}
        </Button>
        {isEdit && (
          <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isUpserting}>
            Batal
          </Button>
        )}
      </div>
      {!canAddMore && !isEdit && (
        <p className="text-sm text-amber-700">Maksimal {maxAccounts} akun WhatsApp. Disconnect salah satu untuk menambah akun baru.</p>
      )}
    </form>
  );
}
