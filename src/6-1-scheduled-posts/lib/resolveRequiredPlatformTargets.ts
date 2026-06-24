import type { ServiceRequiredPlatform } from '@/6-1-dashboard/hook/useServiceRequiredPlatforms';
import type { ConnectedPlatformAccount } from '../hooks/useConnectedPlatformAccounts';
import { platformSupportsAutoSchedule } from '../types/platform-delivery';

export type RequiredPlatformAutoTarget = {
  requiredPlatformRowId: string;
  platform: string;
  accountId: string;
  accountLabel: string;
  publishScopesOk: boolean;
  oauthConnected: boolean;
};

export function needsOAuthAccountUpdate(platform: ServiceRequiredPlatform): boolean {
  if (!platform.is_active) return false;
  if (!platformSupportsAutoSchedule(platform.platform)) return false;
  return !String(platform.platform_account_id ?? '').trim();
}

export function listAutoSchedulePlatforms(
  requiredPlatforms: ServiceRequiredPlatform[],
): string[] {
  const seen = new Set<string>();
  const platforms: string[] = [];
  for (const row of requiredPlatforms) {
    if (!row.is_active) continue;
    if (!platformSupportsAutoSchedule(row.platform)) continue;
    if (!String(row.platform_account_id ?? '').trim()) continue;
    if (seen.has(row.platform)) continue;
    seen.add(row.platform);
    platforms.push(row.platform);
  }
  return platforms.sort((a, b) => a.localeCompare(b));
}

export function listAccountTargetsForPlatform(
  requiredPlatforms: ServiceRequiredPlatform[],
  platform: string,
  connectedAccounts: ConnectedPlatformAccount[],
): RequiredPlatformAutoTarget[] {
  const platformTrim = platform.trim();
  const rows = requiredPlatforms.filter(
    (row) =>
      row.is_active &&
      row.platform === platformTrim &&
      String(row.platform_account_id ?? '').trim(),
  );

  return rows.map((row) => {
    const accountId = String(row.platform_account_id).trim();
    const connected = connectedAccounts.find(
      (acc) => acc.platform === platformTrim && acc.accountId === accountId,
    );
    return {
      requiredPlatformRowId: row.id,
      platform: platformTrim,
      accountId,
      accountLabel:
        connected?.accountLabel ??
        (String(row.platform_account_label ?? '').trim() || accountId),
      publishScopesOk: connected?.publishScopesOk !== false,
      oauthConnected: Boolean(connected),
    };
  });
}

export function listAllAutoScheduleTargets(
  requiredPlatforms: ServiceRequiredPlatform[],
  connectedAccounts: ConnectedPlatformAccount[],
): RequiredPlatformAutoTarget[] {
  const targets: RequiredPlatformAutoTarget[] = [];

  for (const row of requiredPlatforms) {
    if (!row.is_active) continue;
    if (!platformSupportsAutoSchedule(row.platform)) continue;
    const accountId = String(row.platform_account_id ?? '').trim();
    if (!accountId) continue;

    const platformTrim = row.platform.trim();
    const connected = connectedAccounts.find(
      (acc) => acc.platform === platformTrim && acc.accountId === accountId,
    );
    targets.push({
      requiredPlatformRowId: row.id,
      platform: platformTrim,
      accountId,
      accountLabel:
        connected?.accountLabel ??
        (String(row.platform_account_label ?? '').trim() || accountId),
      publishScopesOk: connected?.publishScopesOk !== false,
      oauthConnected: Boolean(connected),
    });
  }

  return targets.sort((a, b) => {
    const byPlatform = a.platform.localeCompare(b.platform);
    if (byPlatform !== 0) return byPlatform;
    return a.accountLabel.localeCompare(b.accountLabel);
  });
}

export function resolveRequiredPlatformTarget(
  requiredPlatforms: ServiceRequiredPlatform[],
  platform: string,
  accountId: string,
  connectedAccounts: ConnectedPlatformAccount[],
): RequiredPlatformAutoTarget | null {
  const targets = listAccountTargetsForPlatform(requiredPlatforms, platform, connectedAccounts);
  return targets.find((t) => t.accountId === accountId.trim()) ?? null;
}
