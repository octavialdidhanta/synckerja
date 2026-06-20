import {
  META_BUSINESS_OAUTH_SCOPES,
  META_FACEBOOK_PAGE_OAUTH_SCOPES,
} from '@/meta-platform/constants/metaOAuthScopes';

export type MetaOAuthConnectFlow = 'instagram' | 'facebook';

function readEnv(key: string): string {
  const raw = import.meta.env[key as keyof ImportMetaEnv];
  return typeof raw === 'string' ? raw.trim() : '';
}

/** Business Login configuration for Instagram (e.g. Vialdi ID — Instagram Graph API variation). */
export function getMetaInstagramOAuthConfigId(): string {
  return readEnv('VITE_META_OAUTH_CONFIG_ID');
}

/** Business Login configuration for Facebook Page only (e.g. Integrasi Visual Digital). */
export function getMetaFacebookOAuthConfigId(): string {
  return readEnv('VITE_META_FACEBOOK_OAUTH_CONFIG_ID');
}

export function resolveMetaOAuthConfigId(flow: MetaOAuthConnectFlow): string {
  return flow === 'facebook' ? getMetaFacebookOAuthConfigId() : getMetaInstagramOAuthConfigId();
}

export function resolveMetaOAuthScopes(flow: MetaOAuthConnectFlow): string {
  return flow === 'facebook' ? META_FACEBOOK_PAGE_OAUTH_SCOPES : META_BUSINESS_OAUTH_SCOPES;
}
