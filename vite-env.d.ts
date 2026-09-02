/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_OAUTH_REDIRECT_URI?: string;
  /** Supabase Auth Google — Web client ID (native Android serverClientId + Supabase id token). */
  readonly VITE_GOOGLE_SSO_WEB_CLIENT_ID?: string;
  /** Supabase Auth Google — iOS OAuth client ID (native iOS only). */
  readonly VITE_GOOGLE_SSO_IOS_CLIENT_ID?: string;
  /** Public survey mini-app: exact hostname match → mount SurveyPublicApp (DNS points here). */
  readonly VITE_PUBLIC_SURVEY_HOSTNAME?: string;
  /** Public Synckerja Order storefront: exact hostname match → mount OrderStoreApp. */
  readonly VITE_PUBLIC_ORDER_HOSTNAME?: string;
  /** Full origin for preview links in omnichannel settings & Edge SURVEY_PUBLIC_ORIGIN should match. */
  readonly VITE_PUBLIC_SURVEY_ORIGIN?: string;
  /** Meta Facebook/Instagram Login app ID. */
  readonly VITE_META_APP_ID?: string;
  readonly VITE_META_OAUTH_CONFIG_ID?: string;
  /** Business Login configuration ID for Facebook Page connect (separate from Instagram). */
  readonly VITE_META_FACEBOOK_OAUTH_CONFIG_ID?: string;
  /** Meta Threads API app ID (separate app from VITE_META_APP_ID). */
  readonly VITE_THREADS_APP_ID?: string;
  /** Optional override when Meta whitelist differs from window.location.origin (must match opener origin for popup). */
  readonly VITE_THREADS_OAUTH_REDIRECT_URI?: string;
}

declare module "*.json" {
  const value: Record<string, unknown>;
  export default value;
}
