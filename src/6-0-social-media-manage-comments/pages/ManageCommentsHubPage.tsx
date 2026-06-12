import { Navigate } from "react-router-dom";
import { SOCIAL_MEDIA_MANAGE_COMMENTS_TIKTOK_PATH } from "@/6-0-social-media-manage-comments/lib/manageCommentsPaths";

export default function ManageCommentsHubPage() {
  return <Navigate to={SOCIAL_MEDIA_MANAGE_COMMENTS_TIKTOK_PATH} replace />;
}
