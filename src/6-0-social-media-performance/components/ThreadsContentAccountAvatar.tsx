import { ThreadsTabIcon } from "@/6-0-social-media-performance/components/ThreadsTabIcon";
import { cn } from "@/shared/lib/utils";
import { useThreadsContentAvatarObjectUrl } from "@/threads-content/lib/useThreadsContentAvatarObjectUrl";

type Props = {
  organizationId: string | null | undefined;
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

export function ThreadsContentAccountAvatar({
  organizationId,
  accountId,
  accountLabel,
  className,
}: Props) {
  const objectUrl = useThreadsContentAvatarObjectUrl({
    organizationId,
    accountId,
    enabled: Boolean(organizationId && accountId),
  });
  const initials = accountInitials(accountLabel);

  if (objectUrl) {
    return (
      <img
        src={objectUrl}
        alt=""
        className={cn("h-8 w-8 shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  if (initials) {
    return (
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600",
          className,
        )}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100",
        className,
      )}
      aria-hidden
    >
      <ThreadsTabIcon className="h-4 w-4 text-gray-600" />
    </span>
  );
}
