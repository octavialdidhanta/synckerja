import { Facebook, Instagram } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useMetaContentAvatarObjectUrl } from "@/meta-content/lib/useMetaContentAvatarObjectUrl";
import type { MetaContentPlatform } from "@/meta-platform/types/metaContentTypes";

type Props = {
  organizationId: string | null | undefined;
  platform: MetaContentPlatform;
  accountId: string;
  accountLabel: string;
  className?: string;
};

function accountInitials(accountLabel: string): string {
  return accountLabel
    .trim()
    .replace(/^@/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MetaContentAccountAvatar({
  organizationId,
  platform,
  accountId,
  accountLabel,
  className,
}: Props) {
  const objectUrl = useMetaContentAvatarObjectUrl({
    organizationId,
    platform,
    accountId,
    enabled: Boolean(organizationId && accountId),
  });
  const initials = accountInitials(accountLabel);
  const PlatformIcon = platform === "instagram" ? Instagram : Facebook;

  if (objectUrl) {
    return (
      <img
        src={objectUrl}
        alt=""
        className={cn("h-5 w-5 shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  if (initials) {
    return (
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[9px] font-medium text-gray-600",
          className,
        )}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    <PlatformIcon className={cn("h-4 w-4 shrink-0 text-muted-foreground", className)} aria-hidden />
  );
}
