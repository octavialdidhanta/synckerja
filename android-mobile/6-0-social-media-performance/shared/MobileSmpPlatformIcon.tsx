import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { TikTokTabIcon } from "@/6-0-traffic/container/TikTokTabIcon";
import { ThreadsTabIcon } from "@/6-0-social-media-performance/components/ThreadsTabIcon";
import type { SocialMediaPlatform } from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";

export function MobileSmpPlatformIcon({
  platform,
  className = "h-4 w-4 shrink-0",
}: {
  platform: SocialMediaPlatform;
  className?: string;
}) {
  switch (platform) {
    case "tiktok":
      return <TikTokTabIcon className={className} />;
    case "youtube":
      return <Youtube className={className} />;
    case "instagram":
      return <Instagram className={className} />;
    case "facebook":
      return <Facebook className={className} />;
    case "linkedin":
      return <Linkedin className={className} />;
    case "threads":
      return <ThreadsTabIcon className={className} />;
  }
}
