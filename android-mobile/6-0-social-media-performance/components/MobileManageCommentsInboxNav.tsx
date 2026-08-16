import type { ComponentType } from "react";
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TikTokTabIcon } from "@/6-0-traffic/container/TikTokTabIcon";
import { ThreadsTabIcon } from "@/6-0-social-media-performance/components/ThreadsTabIcon";
import { usePrefetchManageCommentsPlatforms } from "@/6-0-social-media-manage-comments/hooks/usePrefetchManageCommentsPlatforms";
import {
  SOCIAL_MEDIA_MANAGE_COMMENTS_FACEBOOK_PATH,
  SOCIAL_MEDIA_MANAGE_COMMENTS_INSTAGRAM_PATH,
  SOCIAL_MEDIA_MANAGE_COMMENTS_LINKEDIN_PATH,
  SOCIAL_MEDIA_MANAGE_COMMENTS_THREADS_PATH,
  SOCIAL_MEDIA_MANAGE_COMMENTS_TIKTOK_PATH,
  SOCIAL_MEDIA_MANAGE_COMMENTS_YOUTUBE_PATH,
} from "@/6-0-social-media-manage-comments/lib/manageCommentsPaths";
import type { ManageCommentsPostFilter } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";
import { cn } from "@/shared/lib/utils";

type PlatformId = "tiktok" | "facebook" | "instagram" | "youtube" | "linkedin" | "threads";

const FILTERS: ManageCommentsPostFilter[] = [
  "all",
  "unread",
  "with_comments",
  "no_comments",
];

const PLATFORMS: Array<{
  id: PlatformId;
  labelKey: string;
  defaultLabel: string;
  icon: ComponentType<{ className?: string }>;
  path: string;
}> = [
  {
    id: "tiktok",
    labelKey: "digitalMarketing.manageComments.platformTikTok",
    defaultLabel: "TikTok",
    icon: TikTokTabIcon,
    path: SOCIAL_MEDIA_MANAGE_COMMENTS_TIKTOK_PATH,
  },
  {
    id: "facebook",
    labelKey: "digitalMarketing.manageComments.platformFacebook",
    defaultLabel: "Facebook",
    icon: Facebook,
    path: SOCIAL_MEDIA_MANAGE_COMMENTS_FACEBOOK_PATH,
  },
  {
    id: "instagram",
    labelKey: "digitalMarketing.manageComments.platformInstagram",
    defaultLabel: "Instagram",
    icon: Instagram,
    path: SOCIAL_MEDIA_MANAGE_COMMENTS_INSTAGRAM_PATH,
  },
  {
    id: "youtube",
    labelKey: "digitalMarketing.manageComments.platformYouTube",
    defaultLabel: "YouTube",
    icon: Youtube,
    path: SOCIAL_MEDIA_MANAGE_COMMENTS_YOUTUBE_PATH,
  },
  {
    id: "linkedin",
    labelKey: "digitalMarketing.manageComments.platformLinkedIn",
    defaultLabel: "LinkedIn",
    icon: Linkedin,
    path: SOCIAL_MEDIA_MANAGE_COMMENTS_LINKEDIN_PATH,
  },
  {
    id: "threads",
    labelKey: "digitalMarketing.manageComments.platformThreads",
    defaultLabel: "Threads",
    icon: ThreadsTabIcon,
    path: SOCIAL_MEDIA_MANAGE_COMMENTS_THREADS_PATH,
  },
];

type MobileManageCommentsInboxNavProps = {
  filter: ManageCommentsPostFilter;
  onFilterChange: (value: ManageCommentsPostFilter) => void;
};

export function MobileManageCommentsInboxNav({
  filter,
  onFilterChange,
}: MobileManageCommentsInboxNavProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  usePrefetchManageCommentsPlatforms();

  const filterLabels: Record<ManageCommentsPostFilter, string> = {
    all: t("digitalMarketing.manageComments.filterAll", "All"),
    unread: t("digitalMarketing.manageComments.filterUnread", "Unread"),
    with_comments: t(
      "digitalMarketing.manageComments.filterWithComments",
      "With comments",
    ),
    no_comments: t(
      "digitalMarketing.manageComments.filterNoComments",
      "No comments",
    ),
  };

  return (
    <div className="-mx-2 shrink-0 overflow-hidden border-y border-border bg-card">
      <div
        className="border-b border-gray-100 px-4 pb-0 pt-3"
        role="tablist"
        aria-label={t("digitalMarketing.manageComments.platformPickerLabel", "Comment platform")}
      >
        <div className="flex w-full items-center justify-evenly">
          {PLATFORMS.map((platform) => {
            const Icon = platform.icon;
            const active = location.pathname.startsWith(platform.path);
            const label = t(platform.labelKey, platform.defaultLabel);

            return (
              <button
                key={platform.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={label}
                title={label}
                onClick={() => navigate(platform.path)}
                className={cn(
                  "flex min-w-[2.75rem] items-center justify-center border-b-2 px-2 pb-2 transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-b border-gray-100 px-4 pb-0 pt-2">
        <div
          className="flex w-full items-center justify-evenly"
          role="tablist"
        >
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={filter === item}
              onClick={() => onFilterChange(item)}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-1 pb-2 text-sm font-medium transition-colors",
                filter === item
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {filterLabels[item]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

MobileManageCommentsInboxNav.displayName = "MobileManageCommentsInboxNav";
