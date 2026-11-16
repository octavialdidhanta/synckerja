/** Story Publish targets: Content Scheduling required IG/FB ∩ Meta OAuth. */

import type { ServiceRequiredPlatform } from "@/6-1-dashboard/hook/useServiceRequiredPlatforms";
import type { RequiredPlatformAutoTarget } from "@/6-1-scheduled-posts/lib/resolveRequiredPlatformTargets";
import type { MetaContentAccount } from "@/meta-platform/types/metaContentTypes";
import {
  facebookPublishScopesOk,
  instagramPublishScopesOk,
} from "@/meta-platform/constants/metaOAuthScopes";

const STORY_PLATFORMS = ["Instagram", "Facebook"] as const;

type StoryMetaPlatform = (typeof STORY_PLATFORMS)[number];

function scopesForPlatform(platform: StoryMetaPlatform, scopes: string[]): boolean {
  return platform === "Instagram"
    ? instagramPublishScopesOk(scopes)
    : facebookPublishScopesOk(scopes);
}

export function storyPublishTargetsFromRequired(
  requiredPlatforms: ServiceRequiredPlatform[],
  metaAccounts: MetaContentAccount[],
): RequiredPlatformAutoTarget[] {
  const targets: RequiredPlatformAutoTarget[] = [];

  for (const row of requiredPlatforms) {
    if (!row.is_active) continue;
    if (row.platform !== "Instagram" && row.platform !== "Facebook") continue;
    const accountId = String(row.platform_account_id ?? "").trim();
    if (!accountId) continue;

    const platform = row.platform as StoryMetaPlatform;
    const metaPlatform = platform === "Instagram" ? "instagram" : "facebook";
    const meta = metaAccounts.find(
      (account) => account.platform === metaPlatform && account.account_id === accountId,
    );

    targets.push({
      requiredPlatformRowId: row.id,
      platform,
      accountId,
      accountLabel:
        (meta?.account_label || "").trim() ||
        String(row.platform_account_label ?? "").trim() ||
        accountId,
      publishScopesOk: meta ? scopesForPlatform(platform, meta.granted_scopes ?? []) : false,
      oauthConnected: Boolean(meta),
    });
  }

  return targets.sort((left, right) => {
    const byPlatform = left.platform.localeCompare(right.platform);
    if (byPlatform !== 0) return byPlatform;
    return left.accountLabel.localeCompare(right.accountLabel);
  });
}

export function storyTargetEligible(target: RequiredPlatformAutoTarget): boolean {
  return target.oauthConnected && target.publishScopesOk !== false;
}
