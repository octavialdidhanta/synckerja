import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';
import type { WhatsAppConfig, WhatsAppConfigUpsert } from '../types';

export function useWhatsAppConfig() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['whatsapp-config', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<WhatsAppConfig | null> => {
      if (!organizationId) return null;
      const { data: metaData, error } = await supabase
        .from('organization_meta_config')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error) throw error;
      const metaConfig = metaData as WhatsAppConfig | null;
      const { data: accounts } = await supabase
        .from('organization_whatsapp_accounts')
        .select('verify_token')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1);
      const verifyToken = (accounts?.[0] as { verify_token?: string } | undefined)?.verify_token?.trim() ?? '';
      return { ...(metaConfig ?? {}), verify_token: verifyToken } as WhatsAppConfig | null;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: Omit<WhatsAppConfigUpsert, 'organization_id'>) => {
      if (!organizationId) throw new Error('No organization selected');
      const { data: { user } } = await supabase.auth.getUser();
      const hasNewToken = payload.meta_access_token.trim() !== '';
      const { data: existingRow } = await supabase
        .from('organization_meta_config')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      const existing = existingRow as WhatsAppConfig | null;
      if (existing && !hasNewToken) {
        // No autofill: merge with existing so empty form fields don't overwrite DB
        const updatePayload: Record<string, unknown> = {
          whatsapp_business_account_id: (payload.whatsapp_business_account_id?.trim() || existing.whatsapp_business_account_id) ?? '',
          phone_number_id: payload.phone_number_id?.trim() !== undefined && payload.phone_number_id?.trim() !== ''
            ? payload.phone_number_id?.trim() ?? null
            : (existing.phone_number_id ?? null),
          display_phone_number: (payload.display_phone_number?.trim() ?? '') !== ''
            ? (payload.display_phone_number?.trim() || null)
            : (existing.display_phone_number ?? null),
          updated_at: new Date().toISOString(),
        };
        if (payload.whatsapp_business_name !== undefined) {
          updatePayload.whatsapp_business_name = payload.whatsapp_business_name ?? null;
        }
        if (payload.meta_business_manager_id !== undefined) {
          updatePayload.meta_business_manager_id = payload.meta_business_manager_id?.trim() || null;
        }
        const { data, error } = await supabase
          .from('organization_meta_config')
          .update(updatePayload)
          .eq('organization_id', organizationId)
          .select()
          .single();
        if (error) throw error;
        const verifyTokenToSync = (payload.verify_token?.trim() || existing.verify_token)?.trim();
        if (verifyTokenToSync) {
          const { data: first } = await supabase
            .from('organization_whatsapp_accounts')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (first?.id) {
            await supabase
              .from('organization_whatsapp_accounts')
              .update({ verify_token: verifyTokenToSync, updated_at: new Date().toISOString() })
              .eq('id', first.id);
          }
        }
        return data as WhatsAppConfig;
      }
      const row: Record<string, unknown> = {
        organization_id: organizationId,
        whatsapp_business_account_id: payload.whatsapp_business_account_id,
        meta_access_token: payload.meta_access_token,
        meta_business_manager_id: payload.meta_business_manager_id?.trim() || null,
        verify_token: '',
        phone_number_id: payload.phone_number_id ?? null,
        display_phone_number: payload.display_phone_number ?? null,
        updated_at: new Date().toISOString(),
        ...(user?.id && { created_by: user.id }),
      };
      if (payload.whatsapp_business_name !== undefined) {
        row.whatsapp_business_name = payload.whatsapp_business_name ?? null;
      }
      const { data, error } = await supabase
        .from('organization_meta_config')
        .upsert(row, { onConflict: 'organization_id', ignoreDuplicates: false })
        .select()
        .single();
      if (error) throw error;
      const verifyTokenToSync = payload.verify_token?.trim();
      if (verifyTokenToSync) {
        const { data: first } = await supabase
          .from('organization_whatsapp_accounts')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (first?.id) {
          await supabase
            .from('organization_whatsapp_accounts')
            .update({ verify_token: verifyTokenToSync, updated_at: new Date().toISOString() })
            .eq('id', first.id);
        }
      }
      return data as WhatsAppConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config', organizationId] });
      toast.success('WhatsApp config saved');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save config');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No organization selected');
      const { error } = await supabase
        .from('organization_meta_config')
        .delete()
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config', organizationId] });
      toast.success('WhatsApp disconnected. Fill the form and save to connect again.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to disconnect');
    },
  });

  const updateBusinessNameMutation = useMutation({
    mutationFn: async (name: string | null) => {
      if (!organizationId) throw new Error('No organization selected');
      const { data, error } = await supabase
        .from('organization_meta_config')
        .update({ whatsapp_business_name: name, updated_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .select()
        .single();
      if (error) throw error;
      return data as WhatsAppConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config', organizationId] });
    },
  });

  const updateDisplayPhoneMutation = useMutation({
    mutationFn: async (displayPhone: string | null) => {
      if (!organizationId) throw new Error('No organization selected');
      const { data, error } = await supabase
        .from('organization_meta_config')
        .update({ display_phone_number: displayPhone, updated_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .select()
        .single();
      if (error) throw error;
      return data as WhatsAppConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config', organizationId] });
    },
  });

  const updateInstagramMutation = useMutation({
    mutationFn: async (
      payload: { id: string | null; username?: string | null; name?: string | null; page_id?: string | null }
    ) => {
      if (!organizationId) throw new Error('No organization selected');
      const updates: Record<string, unknown> = {
        instagram_business_account_id: payload.id,
        updated_at: new Date().toISOString(),
      };
      if (payload.id == null) {
        updates.instagram_username = null;
        updates.instagram_name = null;
        updates.facebook_page_id = null;
      } else {
        if (payload.username !== undefined) updates.instagram_username = payload.username ?? null;
        if (payload.name !== undefined) updates.instagram_name = payload.name ?? null;
        if (payload.page_id !== undefined) updates.facebook_page_id = payload.page_id ?? null;
      }
      const { data, error } = await supabase
        .from('organization_meta_config')
        .update(updates)
        .eq('organization_id', organizationId)
        .select()
        .single();
      if (error) throw error;
      return data as WhatsAppConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config', organizationId] });
    },
  });

  /** Ensure org has instagram_verify_token (ig_xxx) for Instagram webhook. Updates existing meta row only. */
  const ensureInstagramVerifyTokenMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      if (!organizationId) throw new Error('No organization selected');

      const { data: existing, error: fetchError } = await supabase
        .from('organization_meta_config')
        .select('id, instagram_verify_token')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (fetchError) throw fetchError;

      const existingIg = (existing?.instagram_verify_token ?? '').trim();
      if (existingIg) return existingIg;

      const igToken = `ig_${organizationId.replace(/-/g, '').slice(0, 8)}_${Math.random().toString(36).slice(2, 14)}`;

      // No meta row yet — verify tokens belong on account rows when connected; avoid partial upsert (400).
      if (!existing?.id) return igToken;

      const { data, error } = await supabase
        .from('organization_meta_config')
        .update({ instagram_verify_token: igToken })
        .eq('organization_id', organizationId)
        .select('instagram_verify_token')
        .maybeSingle();
      if (error) throw error;
      return (data as { instagram_verify_token?: string } | null)?.instagram_verify_token ?? igToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config', organizationId] });
    },
  });

  /** Ensure org has meta_config row and verify_token on first WhatsApp account. For multi-account connect page. */
  const ensureOrgMetaConfigMutation = useMutation({
    mutationFn: async (payload: { verify_token?: string | null; meta_business_manager_id?: string | null; meta_access_token?: string | null }) => {
      if (!organizationId) throw new Error('No organization selected');
      const { data: { user } } = await supabase.auth.getUser();
      const { data: existing } = await supabase
        .from('organization_meta_config')
        .select('id, verify_token, meta_access_token, meta_business_manager_id')
        .eq('organization_id', organizationId)
        .maybeSingle();
      const existingConfig = existing as WhatsAppConfig | null;
      const { data: firstAccountRaw } = await supabase
        .from('organization_whatsapp_accounts')
        .select('id, verify_token')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1);
      const firstAccount = Array.isArray(firstAccountRaw) ? firstAccountRaw[0] : firstAccountRaw;
      const existingVerify = (firstAccount as { verify_token?: string } | null)?.verify_token?.trim() ?? existingConfig?.verify_token?.trim() ?? '';
      let verifyToken = existingVerify || payload.verify_token?.trim() || '';
      if (!verifyToken) {
        const orgPart = organizationId.replace(/-/g, '').slice(0, 8);
        const randomPart = Math.random().toString(36).slice(2, 18);
        verifyToken = `wa_${orgPart}_${randomPart}`;
      }
      const metaToken = payload.meta_access_token?.trim() || existingConfig?.meta_access_token || '';
      const metaBmId = payload.meta_business_manager_id?.trim() || existingConfig?.meta_business_manager_id || null;
      // organization_meta_config hanya untuk Instagram/Facebook; verify_token disimpan di organization_whatsapp_accounts
      const row = {
        organization_id: organizationId,
        verify_token: existingConfig?.verify_token ?? '',
        meta_access_token: metaToken || existingConfig?.meta_access_token || '',
        meta_business_manager_id: metaBmId,
        whatsapp_business_account_id: existingConfig?.whatsapp_business_account_id ?? '',
        phone_number_id: existingConfig?.phone_number_id ?? null,
        updated_at: new Date().toISOString(),
        ...(user?.id && { created_by: user.id }),
      };
      const { data, error } = await supabase
        .from('organization_meta_config')
        .upsert(row, { onConflict: 'organization_id', ignoreDuplicates: false })
        .select()
        .single();
      if (error) throw error;
      const accountIdToUpdate = (firstAccount as { id?: string } | null)?.id;
      if (accountIdToUpdate) {
        const { error: updateErr } = await supabase
          .from('organization_whatsapp_accounts')
          .update({ verify_token: verifyToken, updated_at: new Date().toISOString() })
          .eq('id', accountIdToUpdate);
        if (updateErr) console.error('ensureOrgMetaConfig: update verify_token failed', updateErr);
      }
      return { ...data, verify_token: verifyToken } as WhatsAppConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config', organizationId] });
    },
  });

  return {
    config: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    upsert: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    updateBusinessName: updateBusinessNameMutation.mutateAsync,
    updateDisplayPhone: updateDisplayPhoneMutation.mutateAsync,
    updateInstagram: updateInstagramMutation.mutateAsync,
    isUpdatingInstagram: updateInstagramMutation.isPending,
    ensureOrgMetaConfig: ensureOrgMetaConfigMutation.mutateAsync,
    ensureInstagramVerifyToken: ensureInstagramVerifyTokenMutation.mutateAsync,
  };
}
