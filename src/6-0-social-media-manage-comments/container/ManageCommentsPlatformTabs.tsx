import type { ComponentType } from "react";

import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { toast } from "sonner";

import { TikTokTabIcon } from "@/6-0-traffic/container/TikTokTabIcon";
import { ThreadsTabIcon } from "@/6-0-social-media-performance/components/ThreadsTabIcon";

import { cn } from "@/shared/lib/utils";

import { usePrefetchManageCommentsPlatforms } from "@/6-0-social-media-manage-comments/hooks/usePrefetchManageCommentsPlatforms";
import {
  SOCIAL_MEDIA_MANAGE_COMMENTS_FACEBOOK_PATH,
  SOCIAL_MEDIA_MANAGE_COMMENTS_INSTAGRAM_PATH,
  SOCIAL_MEDIA_MANAGE_COMMENTS_LINKEDIN_PATH,
  SOCIAL_MEDIA_MANAGE_COMMENTS_THREADS_PATH,
  SOCIAL_MEDIA_MANAGE_COMMENTS_TIKTOK_PATH,
  SOCIAL_MEDIA_MANAGE_COMMENTS_YOUTUBE_PATH,
} from "@/6-0-social-media-manage-comments/lib/manageCommentsPaths";



type PlatformId = "tiktok" | "facebook" | "instagram" | "youtube" | "linkedin" | "threads";



const platforms: Array<{

  id: PlatformId;

  labelKey: string;

  defaultLabel: string;

  icon: ComponentType<{ className?: string }>;

  enabled: boolean;

  path?: string;

}> = [

  {

    id: "tiktok",

    labelKey: "digitalMarketing.manageComments.platformTikTok",

    defaultLabel: "TikTok",

    icon: TikTokTabIcon,

    enabled: true,

    path: SOCIAL_MEDIA_MANAGE_COMMENTS_TIKTOK_PATH,

  },

  {

    id: "facebook",

    labelKey: "digitalMarketing.manageComments.platformFacebook",

    defaultLabel: "Facebook",

    icon: Facebook,

    enabled: true,

    path: SOCIAL_MEDIA_MANAGE_COMMENTS_FACEBOOK_PATH,

  },

  {

    id: "instagram",

    labelKey: "digitalMarketing.manageComments.platformInstagram",

    defaultLabel: "Instagram",

    icon: Instagram,

    enabled: true,

    path: SOCIAL_MEDIA_MANAGE_COMMENTS_INSTAGRAM_PATH,

  },

  {

    id: "youtube",

    labelKey: "digitalMarketing.manageComments.platformYouTube",

    defaultLabel: "YouTube",

    icon: Youtube,

    enabled: true,

    path: SOCIAL_MEDIA_MANAGE_COMMENTS_YOUTUBE_PATH,

  },

  {

    id: "linkedin",

    labelKey: "digitalMarketing.manageComments.platformLinkedIn",

    defaultLabel: "LinkedIn",

    icon: Linkedin,

    enabled: true,

    path: SOCIAL_MEDIA_MANAGE_COMMENTS_LINKEDIN_PATH,

  },

  {

    id: "threads",

    labelKey: "digitalMarketing.manageComments.platformThreads",

    defaultLabel: "Threads",

    icon: ThreadsTabIcon,

    enabled: true,

    path: SOCIAL_MEDIA_MANAGE_COMMENTS_THREADS_PATH,

  },

];



/** Platform tabs in the post-list sidebar (replaces search bar). */

export function ManageCommentsPlatformTabs() {

  const { t } = useTranslation();

  const navigate = useNavigate();

  const location = useLocation();
  usePrefetchManageCommentsPlatforms();



  const showComingSoon = () => {

    toast.info(

      t(

        "digitalMarketing.manageComments.platformComingSoon",

        "Coming in a future release.",

      ),

    );

  };



  return (

    <div

      className="border-b border-gray-100 px-3 pb-0 pt-3"

      role="tablist"

      aria-label={t("digitalMarketing.manageComments.platformPickerLabel", "Comment platform")}

    >

      <div className="scrollbar-hide flex flex-nowrap items-center justify-center gap-x-5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {platforms.map((platform) => {

          const Icon = platform.icon;

          const active = Boolean(

            platform.path && location.pathname.startsWith(platform.path),

          );

          const label = t(platform.labelKey, platform.defaultLabel);



          return (

            <button

              key={platform.id}

              type="button"

              role="tab"

              aria-selected={active}

              aria-label={label}

              title={label}

              disabled={!platform.enabled}

              onClick={() => {

                if (!platform.enabled) {

                  showComingSoon();

                  return;

                }

                if (platform.path) navigate(platform.path);

              }}

              className={cn(

                "flex shrink-0 items-center justify-center border-b-2 px-1 pb-2 transition-colors",

                active && "border-primary text-primary",

                !active &&

                  platform.enabled &&

                  "border-transparent text-muted-foreground hover:text-foreground",

                !platform.enabled &&

                  "cursor-not-allowed border-transparent text-muted-foreground/60",

              )}

            >

              <Icon className="h-5 w-5 shrink-0" aria-hidden />

            </button>

          );

        })}

      </div>

    </div>

  );

}



export const ManageCommentsPlatformPicker = ManageCommentsPlatformTabs;



ManageCommentsPlatformTabs.displayName = "ManageCommentsPlatformTabs";


