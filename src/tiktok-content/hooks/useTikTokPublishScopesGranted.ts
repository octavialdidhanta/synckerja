import { useMemo } from 'react';
import { useTikTokContentSettings } from './useTikTokContentSettings';

/** True when every active account has publish scopes, or there are no active accounts. */
export function useTikTokPublishScopesGranted(organizationId: string | null | undefined) {
  const { data, isLoading } = useTikTokContentSettings(organizationId);

  const publishScopesGranted = useMemo(() => {
    const accounts = (data?.accounts ?? []).filter((a) => a.is_active);
    if (accounts.length === 0) return true;
    return accounts.every((a) => a.publish_scopes_granted !== false);
  }, [data?.accounts]);

  const needsPublishAuth = useMemo(() => {
    const accounts = (data?.accounts ?? []).filter((a) => a.is_active);
    return accounts.some((a) => !a.publish_token_granted || a.publish_scopes_granted === false);
  }, [data?.accounts]);

  const needsReconnect = needsPublishAuth;

  return { publishScopesGranted, needsReconnect, isLoading };
}
