import { TikTokContentPerformancePageSkeleton } from "@/6-0-social-media-performance/skeletons/TikTokContentPerformancePageSkeleton";

/** Hub redirects to TikTok; reuse the TikTok page skeleton for guard/Suspense. */
export function SocialMediaPerformanceHubPageSkeleton() {
  return <TikTokContentPerformancePageSkeleton />;
}
