import { readPlatformTikTokAdsOAuth, tiktokAdsOAuthRedirectUri } from "./tiktokAdsAuth.ts";
import {
  readPlatformTikTokContentOAuth,
  readPlatformTikTokContentPublishOAuth,
  tiktokContentOAuthRedirectUri,
} from "./tiktokContentAuth.ts";

/** business-api — Synkerja Content Insight (account holder: organic, comments). */
export const TIKTOK_BUSINESS_CONTENT_APP_ID = "7649637336472354817";

/** business-api — Synkerja Office (advertiser OAuth: TikTok Ads). */
export const TIKTOK_BUSINESS_ADS_APP_ID = "7649636462582366225";

/** developers.tiktok.com — Login Kit / Direct Post (open.tiktokapis.com). */
export const TIKTOK_DEVELOPERS_CONTENT_APP_ID = "7654513562417039368";

export type TikTokContentAppMatch = "business_content" | "business_ads" | "developers_content" | "unknown";
export type TikTokAdsAppMatch = "business_ads" | "business_content" | "developers_content" | "unknown";

export type TikTokCredentialSlotDiagnostic = {
  env_keys: string[];
  configured: boolean;
  client_id_masked: string | null;
  matched_app: TikTokContentAppMatch | TikTokAdsAppMatch | null;
  matched_app_label: string | null;
  oauth_redirect_uri: string | null;
  recommendation: string | null;
};

function maskClientId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}…${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

function matchContentAppId(clientId: string): {
  matched_app: TikTokContentAppMatch;
  matched_app_label: string | null;
} {
  const id = clientId.trim();
  if (id === TIKTOK_BUSINESS_CONTENT_APP_ID) {
    return {
      matched_app: "business_content",
      matched_app_label: "Synkerja Content Insight (business-api.tiktok.com)",
    };
  }
  if (id === TIKTOK_BUSINESS_ADS_APP_ID) {
    return {
      matched_app: "business_ads",
      matched_app_label: "Synkerja Office (business-api) — seharusnya untuk TIKTOK_ADS_*, bukan CONTENT",
    };
  }
  if (id === TIKTOK_DEVELOPERS_CONTENT_APP_ID) {
    return {
      matched_app: "developers_content",
      matched_app_label: "Synckerja Office (developers.tiktok.com — Login Kit / Direct Post)",
    };
  }
  return { matched_app: "unknown", matched_app_label: null };
}

function matchAdsAppId(clientId: string): {
  matched_app: TikTokAdsAppMatch;
  matched_app_label: string | null;
} {
  const id = clientId.trim();
  if (id === TIKTOK_BUSINESS_ADS_APP_ID) {
    return {
      matched_app: "business_ads",
      matched_app_label: "Synkerja Office (business-api.tiktok.com)",
    };
  }
  if (id === TIKTOK_BUSINESS_CONTENT_APP_ID) {
    return {
      matched_app: "business_content",
      matched_app_label: "Synkerja Content Insight — seharusnya untuk TIKTOK_CONTENT_*, bukan ADS",
    };
  }
  if (id === TIKTOK_DEVELOPERS_CONTENT_APP_ID) {
    return {
      matched_app: "developers_content",
      matched_app_label: "developers.tiktok.com — bukan untuk TikTok Ads",
    };
  }
  return { matched_app: "unknown", matched_app_label: null };
}

function buildContentRecommendation(matched: TikTokContentAppMatch): string | null {
  if (matched === "business_content") {
    return "Benar untuk organic analytics & komentar. Auto-post publik tetap butuh app review di developers.tiktok.com (Login Kit).";
  }
  if (matched === "business_ads") {
    return `Salah slot — pindahkan Synkerja Office (${TIKTOK_BUSINESS_ADS_APP_ID}) ke TIKTOK_ADS_*. CONTENT harus Synkerja Content Insight (${TIKTOK_BUSINESS_CONTENT_APP_ID}).`;
  }
  if (matched === "developers_content") {
    return "Ini app developers.tiktok.com (Synckerja Office) — cocok untuk Direct Post setelah App Review + Direct Post audit. Untuk organic/komentar gunakan Synkerja Content Insight di business-api.";
  }
  if (matched === "unknown") {
    return "Client key tidak cocok dengan App ID Synckerja yang dikenal. Cek Supabase secrets vs TikTok portal.";
  }
  return null;
}

function buildAdsRecommendation(matched: TikTokAdsAppMatch): string | null {
  if (matched === "business_ads") {
    return "Benar — Synkerja Office untuk modul TikTok Ads (advertiser OAuth).";
  }
  if (matched === "business_content") {
    return `Salah slot — Synkerja Content Insight (${TIKTOK_BUSINESS_CONTENT_APP_ID}) untuk TIKTOK_CONTENT_*, bukan ADS.`;
  }
  if (matched === "developers_content") {
    return "TIKTOK_ADS harus memakai Synkerja Office di business-api.tiktok.com, bukan developers.tiktok.com.";
  }
  if (matched === "unknown") {
    return `App ID tidak dikenali — gunakan Synkerja Office (${TIKTOK_BUSINESS_ADS_APP_ID}).`;
  }
  return null;
}

function isKnownTikTokBusinessAppId(id: string): boolean {
  return id === TIKTOK_BUSINESS_CONTENT_APP_ID || id === TIKTOK_BUSINESS_ADS_APP_ID;
}

/** Login Kit client key is often an opaque string, not the numeric App ID in the portal URL. */
function looksLikeDevelopersLoginKitClientKey(clientId: string): boolean {
  const id = clientId.trim();
  if (!id || isKnownTikTokBusinessAppId(id)) return false;
  if (id === TIKTOK_DEVELOPERS_CONTENT_APP_ID) return true;
  if (/^\d{15,22}$/.test(id)) return false;
  return id.length >= 6;
}

function matchPublishAppId(clientId: string): {
  matched_app: TikTokContentAppMatch;
  matched_app_label: string | null;
} {
  const id = clientId.trim();
  if (id === TIKTOK_BUSINESS_CONTENT_APP_ID) {
    return {
      matched_app: "business_content",
      matched_app_label: "Synkerja Content Insight (business-api) — seharusnya untuk TIKTOK_CONTENT_*, bukan PUBLISH",
    };
  }
  if (id === TIKTOK_BUSINESS_ADS_APP_ID) {
    return {
      matched_app: "business_ads",
      matched_app_label: "Synkerja Office (business-api) — seharusnya untuk TIKTOK_ADS_*, bukan PUBLISH",
    };
  }
  if (id === TIKTOK_DEVELOPERS_CONTENT_APP_ID) {
    return {
      matched_app: "developers_content",
      matched_app_label: "Synckerja Office (developers.tiktok.com — Login Kit / Direct Post)",
    };
  }
  if (looksLikeDevelopersLoginKitClientKey(id)) {
    return {
      matched_app: "developers_content",
      matched_app_label: "Synckerja Office Login Kit client key (developers.tiktok.com)",
    };
  }
  return { matched_app: "unknown", matched_app_label: null };
}

function buildPublishRecommendation(matched: TikTokContentAppMatch, configured: boolean): string | null {
  if (matched === "developers_content") {
    return "Benar — Synckerja Office (developers.tiktok.com) untuk Login Kit / Direct Post (video.upload, video.publish).";
  }
  if (matched === "business_content") {
    return `Salah slot — gunakan developers app (App ID portal ${TIKTOK_DEVELOPERS_CONTENT_APP_ID}), bukan Synkerja Content Insight business-api.`;
  }
  if (matched === "business_ads") {
    return `Salah slot — ini App Synkerja Office. Publish butuh developers.tiktok.com (App ID portal ${TIKTOK_DEVELOPERS_CONTENT_APP_ID}).`;
  }
  if (matched === "unknown") {
    if (!configured) {
      return "Belum diisi — tambahkan credential developers.tiktok.com untuk authorize publish (video.upload / video.publish).";
    }
    return "Client key tidak valid — pastikan TIKTOK_CONTENT_PUBLISH_CLIENT_KEY adalah Client key dari developers.tiktok.com (bukan Client secret atau App ID business-api).";
  }
  return null;
}

export function buildTikTokCredentialDiagnostics(): {
  content: TikTokCredentialSlotDiagnostic;
  publish: TikTokCredentialSlotDiagnostic;
  ads: TikTokCredentialSlotDiagnostic;
  content_matches_ads: boolean | null;
  summary: string;
} {
  const contentOAuth = readPlatformTikTokContentOAuth();
  const publishOAuth = readPlatformTikTokContentPublishOAuth();
  const adsOAuth = readPlatformTikTokAdsOAuth();

  const contentMatch = contentOAuth
    ? matchContentAppId(contentOAuth.clientKey)
    : { matched_app: null, matched_app_label: null };

  const adsMatch = adsOAuth
    ? matchAdsAppId(adsOAuth.appId)
    : { matched_app: null, matched_app_label: null };

  const publishMatch = publishOAuth
    ? matchPublishAppId(publishOAuth.clientKey)
    : { matched_app: null, matched_app_label: null };

  const content: TikTokCredentialSlotDiagnostic = {
    env_keys: ["TIKTOK_CONTENT_CLIENT_KEY", "TIKTOK_CONTENT_CLIENT_SECRET"],
    configured: Boolean(contentOAuth),
    client_id_masked: contentOAuth ? maskClientId(contentOAuth.clientKey) : null,
    matched_app: contentMatch.matched_app,
    matched_app_label: contentMatch.matched_app_label,
    oauth_redirect_uri: contentOAuth ? tiktokContentOAuthRedirectUri() : null,
    recommendation: contentMatch.matched_app
      ? buildContentRecommendation(contentMatch.matched_app)
      : null,
  };

  const publish: TikTokCredentialSlotDiagnostic = {
    env_keys: ["TIKTOK_CONTENT_PUBLISH_CLIENT_KEY", "TIKTOK_CONTENT_PUBLISH_CLIENT_SECRET"],
    configured: Boolean(publishOAuth),
    client_id_masked: publishOAuth ? maskClientId(publishOAuth.clientKey) : null,
    matched_app: publishMatch.matched_app,
    matched_app_label: publishMatch.matched_app_label,
    oauth_redirect_uri: tiktokContentOAuthRedirectUri(),
    recommendation: publishMatch.matched_app
      ? buildPublishRecommendation(publishMatch.matched_app, true)
      : buildPublishRecommendation("unknown", false),
  };

  const ads: TikTokCredentialSlotDiagnostic = {
    env_keys: ["TIKTOK_ADS_CLIENT_KEY", "TIKTOK_ADS_CLIENT_SECRET"],
    configured: Boolean(adsOAuth),
    client_id_masked: adsOAuth ? maskClientId(adsOAuth.appId) : null,
    matched_app: adsMatch.matched_app,
    matched_app_label: adsMatch.matched_app_label,
    oauth_redirect_uri: adsOAuth ? tiktokAdsOAuthRedirectUri() : null,
    recommendation: adsMatch.matched_app ? buildAdsRecommendation(adsMatch.matched_app) : null,
  };

  const content_matches_ads = contentOAuth && adsOAuth
    ? contentOAuth.clientKey.trim() === adsOAuth.appId.trim()
    : null;

  let summary = "Konfigurasi TikTok server belum lengkap.";
  if (content.matched_app === "business_content" && ads.matched_app === "business_ads") {
    summary = publish.matched_app === "developers_content"
      ? "OK: CONTENT (business) + PUBLISH (developers) + ADS (Synkerja Office)."
      : "CONTENT & ADS OK. Tambahkan TIKTOK_CONTENT_PUBLISH_* (developers.tiktok.com) untuk auto-post.";
  } else if (content.matched_app === "business_content") {
    summary = "TIKTOK_CONTENT OK (Synkerja Content Insight). Periksa TIKTOK_ADS (harus Synkerja Office).";
  } else if (ads.matched_app === "business_ads" && content.configured) {
    summary = "TIKTOK_ADS OK (Synkerja Office). Periksa TIKTOK_CONTENT (harus Synkerja Content Insight).";
  } else if (content.matched_app === "developers_content") {
    summary = "TIKTOK_CONTENT memakai developers.tiktok.com — tunggu App Review untuk publish publik.";
  } else if (content.configured || ads.configured) {
    summary = "Salah satu atau kedua App ID tidak cocok dengan pemetaan Synckerja yang diharapkan.";
  }

  return { content, publish, ads, content_matches_ads, summary };
}
