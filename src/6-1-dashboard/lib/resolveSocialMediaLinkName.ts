import type { ServiceRequiredPlatform } from '@/6-1-dashboard/hook/useServiceRequiredPlatforms';
import type { SocialMediaName } from '@/shared/types/social-media-names';

export type ResolveSocialMediaLinkNameInput = {
  platform: string;
  storedName?: string | null;
  platformAccountOpenId?: string | null;
  url?: string | null;
  requiredPlatforms: ServiceRequiredPlatform[];
  namesForPlatform: SocialMediaName[];
};

function normalizePlatform(platform: string): string {
  return platform.trim();
}

function pickMasterName(
  candidate: string | null | undefined,
  namesForPlatform: SocialMediaName[],
): string {
  const value = candidate?.trim() ?? '';
  if (!value) return '';

  const exact = namesForPlatform.find((name) => name.name === value);
  if (exact) return exact.name;

  const caseInsensitive = namesForPlatform.find(
    (name) => name.name.toLowerCase() === value.toLowerCase(),
  );
  return caseInsensitive?.name ?? value;
}

export function resolveSocialMediaLinkName(input: ResolveSocialMediaLinkNameInput): string {
  const platform = normalizePlatform(input.platform);
  if (!platform) return '';

  const storedName = input.storedName?.trim() ?? '';
  const platformAccountOpenId = input.platformAccountOpenId?.trim() ?? '';
  const hasUrl = Boolean(input.url?.trim());
  const namesForPlatform = input.namesForPlatform;
  const activeRequired = input.requiredPlatforms.filter(
    (row) => row.is_active !== false && normalizePlatform(row.platform) === platform,
  );

  if (storedName) {
    const masterFromStored = pickMasterName(storedName, namesForPlatform);
    if (namesForPlatform.some((name) => name.name === masterFromStored)) {
      return masterFromStored;
    }

    const byLabel = activeRequired.find(
      (row) => row.platform_account_label?.trim() === storedName,
    );
    if (byLabel?.social_media_name?.name) {
      return byLabel.social_media_name.name;
    }
  }

  if (platformAccountOpenId) {
    const byAccount = activeRequired.find(
      (row) => row.platform_account_id?.trim() === platformAccountOpenId,
    );
    if (byAccount?.social_media_name?.name) {
      return byAccount.social_media_name.name;
    }
  }

  if (hasUrl && activeRequired.length === 1 && activeRequired[0].social_media_name?.name) {
    return activeRequired[0].social_media_name.name;
  }

  if (storedName) {
    return pickMasterName(storedName, namesForPlatform);
  }

  if (hasUrl && activeRequired.length === 1) {
    const label = activeRequired[0].platform_account_label?.trim();
    if (label) {
      const fromLabel = pickMasterName(label, namesForPlatform);
      if (namesForPlatform.some((name) => name.name === fromLabel)) {
        return fromLabel;
      }
    }
  }

  return '';
}
