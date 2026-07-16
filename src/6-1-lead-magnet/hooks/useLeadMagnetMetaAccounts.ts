import { useMemo } from 'react';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useMetaContentConfig } from '@/meta-content/hooks/useMetaContentConfig';
import {
  getMetaContentSettingsPath,
  META_CONTENT_FACEBOOK_SETTINGS_PATH,
  META_CONTENT_INSTAGRAM_SETTINGS_PATH,
} from '@/meta-content/settings/metaContentSettingsPaths';
import type { MetaContentAccount } from '@/meta-platform/types/metaContentTypes';
import type { LeadMagnetPlatform } from '../types/leadMagnet.types';

export type LeadMagnetMetaAccountOption = {
  id: string;
  label: string;
  platform: LeadMagnetPlatform;
  scopesOk: boolean;
  missingScopes: string[];
  disabled: boolean;
};

function leadMagnetScopesOk(account: MetaContentAccount): { ok: boolean; missing: string[] } {
  const fs = account.feature_status ?? {};
  if (account.platform === 'instagram') {
    const dmOk = fs.instagram_dm?.ok ?? false;
    const commentsOk = fs.comments?.ok ?? false;
    const missing = [
      ...(fs.instagram_dm?.missing ?? []),
      ...(fs.comments?.missing ?? []),
    ];
    return { ok: dmOk && commentsOk, missing: [...new Set(missing)] };
  }
  const dmOk = fs.messenger_dm?.ok ?? false;
  const commentsOk = fs.comments?.ok ?? false;
  const missing = [
    ...(fs.messenger_dm?.missing ?? []),
    ...(fs.comments?.missing ?? []),
  ];
  return { ok: dmOk && commentsOk, missing: [...new Set(missing)] };
}

function mapAccountOption(account: MetaContentAccount): LeadMagnetMetaAccountOption {
  const { ok, missing } = leadMagnetScopesOk(account);
  return {
    id: account.account_id,
    label: account.account_label || account.account_id,
    platform: account.platform,
    scopesOk: ok,
    missingScopes: missing,
    disabled: !ok,
  };
}

export function useLeadMagnetMetaAccounts() {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { data, isLoading: configLoading, error } = useMetaContentConfig(organizationId);

  const igAccounts = useMemo(
    () => (data?.accounts ?? []).filter((a) => a.platform === 'instagram').map(mapAccountOption),
    [data?.accounts],
  );

  const fbAccounts = useMemo(
    () => (data?.accounts ?? []).filter((a) => a.platform === 'facebook').map(mapAccountOption),
    [data?.accounts],
  );

  return {
    igAccounts,
    fbAccounts,
    isLoading: orgLoading || configLoading,
    error,
    instagramSettingsPath: META_CONTENT_INSTAGRAM_SETTINGS_PATH,
    facebookSettingsPath: META_CONTENT_FACEBOOK_SETTINGS_PATH,
    getSettingsPath: getMetaContentSettingsPath,
  };
}
