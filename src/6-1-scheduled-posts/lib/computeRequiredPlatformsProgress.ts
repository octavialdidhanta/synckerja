export type RequiredPlatformInput = {
  platform: string;
  is_active?: boolean | null;
  social_media_name?: { name: string } | null;
  custom_platform_name?: string | null;
};

export type SocialMediaLinkInput = {
  platform: string;
  url: string | null;
  social_media_name?: string | null;
};

export function filterRequiredPlatformsForContentType(
  required: RequiredPlatformInput[],
  contentTypeName: string | null | undefined,
): RequiredPlatformInput[] {
  const active = required.filter((rp) => rp.is_active !== false);
  const contentType = String(contentTypeName ?? '').trim();
  if (contentType === 'Carousel' || contentType === 'Post') {
    return active.filter((rp) => rp.platform !== 'YouTube' && rp.platform !== 'Shopee');
  }
  return active;
}

function isValidLink(link: SocialMediaLinkInput): boolean {
  const url = link.url?.trim() ?? '';
  const platform = link.platform?.trim() ?? '';
  return Boolean(platform && url.startsWith('http'));
}

export function computePlanDoneState(
  requiredPlatforms: RequiredPlatformInput[],
  links: SocialMediaLinkInput[],
  contentTypeName: string | null | undefined,
): boolean {
  const activeRequired = filterRequiredPlatformsForContentType(requiredPlatforms, contentTypeName);
  const validLinks = links.filter(isValidLink);

  if (activeRequired.length > 0) {
    const filledPlatforms = new Set(validLinks.map((l) => l.platform.trim()));
    return activeRequired.every((rp) => filledPlatforms.has(rp.platform.trim()));
  }

  return validLinks.length >= 1;
}

export function computeRequiredPlatformsProgress(
  requiredPlatforms: RequiredPlatformInput[],
  links: SocialMediaLinkInput[],
  contentTypeName: string | null | undefined,
): {
  totalRequired: number;
  filledRequired: number;
  missingPlatforms: string[];
  isValid: boolean;
  progress: number;
} {
  const activeRequired = filterRequiredPlatformsForContentType(requiredPlatforms, contentTypeName);
  const validLinks = links.filter(isValidLink);
  const filledPlatforms = new Set(validLinks.map((l) => l.platform.trim()));

  const missingPlatforms = activeRequired
    .filter((rp) => !filledPlatforms.has(rp.platform.trim()))
    .map((rp) => {
      if (rp.social_media_name?.name) return `${rp.platform} - ${rp.social_media_name.name}`;
      if (rp.custom_platform_name) return `${rp.platform} - ${rp.custom_platform_name}`;
      return rp.platform;
    });

  const filledRequired = activeRequired.length - missingPlatforms.length;
  const progress = activeRequired.length > 0
    ? Math.round((filledRequired / activeRequired.length) * 100)
    : 100;

  return {
    totalRequired: activeRequired.length,
    filledRequired,
    missingPlatforms,
    isValid: missingPlatforms.length === 0,
    progress,
  };
}
