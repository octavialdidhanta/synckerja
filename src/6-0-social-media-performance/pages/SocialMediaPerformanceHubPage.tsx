import { Navigate } from "react-router-dom";
import { SOCIAL_MEDIA_PERFORMANCE_TIKTOK_PATH } from "@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab";

/** Landing route redirects to the default platform tab (TikTok). */
export default function SocialMediaPerformanceHubPage() {
  return <Navigate to={SOCIAL_MEDIA_PERFORMANCE_TIKTOK_PATH} replace />;
}
