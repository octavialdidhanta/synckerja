import { Capacitor } from "@capacitor/core";
import { supabase } from "@/shared/lib/supabaseClient";

export type GoogleSsoClientConfig = {
  webClientId: string | null;
  iosClientId: string | null;
};

let cachedConfig: GoogleSsoClientConfig | null = null;
let resolvePromise: Promise<GoogleSsoClientConfig> | null = null;

function readEnvGoogleSsoConfig(): GoogleSsoClientConfig {
  const web = import.meta.env.VITE_GOOGLE_SSO_WEB_CLIENT_ID?.trim() || "";
  const ios = import.meta.env.VITE_GOOGLE_SSO_IOS_CLIENT_ID?.trim() || "";
  return {
    webClientId: web || null,
    iosClientId: ios || null,
  };
}

async function fetchGoogleSsoConfigFromEdge(): Promise<GoogleSsoClientConfig> {
  const { data, error } = await supabase.functions.invoke<{
    webClientId?: string | null;
    iosClientId?: string | null;
  }>("google-sso-public-config", { body: {} });

  if (error) {
    return { webClientId: null, iosClientId: null };
  }

  const web =
    typeof data?.webClientId === "string" && data.webClientId.trim() ? data.webClientId.trim() : null;
  const ios =
    typeof data?.iosClientId === "string" && data.iosClientId.trim() ? data.iosClientId.trim() : null;
  return { webClientId: web, iosClientId: ios };
}

/** Resolves web/iOS client IDs from Vite env, then Supabase Edge secrets (cached). */
export async function resolveGoogleSsoClientConfig(): Promise<GoogleSsoClientConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }
  if (resolvePromise) {
    return resolvePromise;
  }

  resolvePromise = (async () => {
    const env = readEnvGoogleSsoConfig();
    const needsEdge =
      !env.webClientId || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios" && !env.iosClientId);

    const edge = needsEdge ? await fetchGoogleSsoConfigFromEdge() : { webClientId: null, iosClientId: null };

    cachedConfig = {
      webClientId: env.webClientId ?? edge.webClientId,
      iosClientId: env.iosClientId ?? edge.iosClientId,
    };
    return cachedConfig;
  })();

  return resolvePromise;
}

export function getGoogleSsoWebClientId(): string | null {
  return cachedConfig?.webClientId ?? readEnvGoogleSsoConfig().webClientId;
}

export function getGoogleSsoIosClientId(): string | null {
  return cachedConfig?.iosClientId ?? readEnvGoogleSsoConfig().iosClientId;
}

export function getConfiguredGoogleSsoClientIds(): string[] {
  const cfg = cachedConfig ?? readEnvGoogleSsoConfig();
  const ids = [cfg.webClientId, cfg.iosClientId].filter((v): v is string => Boolean(v));
  return [...new Set(ids)];
}

export async function assertGoogleSsoNativeConfigured(): Promise<string | null> {
  const cfg = await resolveGoogleSsoClientConfig();
  if (!cfg.webClientId) {
    return "missing_web_client_id";
  }
  if (Capacitor.getPlatform() === "ios" && !cfg.iosClientId) {
    return "missing_ios_client_id";
  }
  return null;
}
