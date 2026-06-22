import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { cn } from "@/shared/lib/utils";
import { useMetaContentAvatarObjectUrl } from "@/meta-content/lib/useMetaContentAvatarObjectUrl";
import type { SocialMediaPlatform } from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";

type SocialMediaInsightAccountAvatarProps = {
  avatarUrl: string | null;
  accountLabel: string;
  className?: string;
  organizationId?: string | null;
  platform?: SocialMediaPlatform;
  accountId?: string;
};

function accountInitials(accountLabel: string): string {
  return accountLabel
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function SocialMediaInsightAccountAvatar({
  avatarUrl,
  accountLabel,
  className,
  organizationId,
  platform,
  accountId,
}: SocialMediaInsightAccountAvatarProps) {
  const initials = accountInitials(accountLabel);
  const useMetaProxy =
    (platform === "instagram" || platform === "facebook")
    && Boolean(organizationId && accountId);

  const metaObjectUrl = useMetaContentAvatarObjectUrl({
    organizationId,
    platform: platform === "facebook" ? "facebook" : "instagram",
    accountId: accountId ?? "",
    enabled: useMetaProxy,
  });

  const displaySrc = useMetaProxy ? metaObjectUrl : avatarUrl;

  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      <AvatarImage
        src={displaySrc ?? undefined}
        alt={accountLabel}
        className="object-cover"
        referrerPolicy="no-referrer"
      />
      <AvatarFallback className="bg-gray-200 text-xs font-medium text-gray-600">
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
