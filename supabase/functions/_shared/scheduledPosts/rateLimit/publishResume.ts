function isTruthyFlag(value: unknown): boolean {
  return value === true || value === "true";
}

export function isTikTokResumeRow(providerConfig: Record<string, unknown>): boolean {
  return (
    typeof providerConfig.tiktok_publish_id === "string" &&
    providerConfig.tiktok_publish_id.length > 0 &&
    isTruthyFlag(providerConfig.tiktok_upload_completed)
  );
}

export function isYouTubeResumeRow(providerConfig: Record<string, unknown>): boolean {
  const videoId = providerConfig.youtube_video_id;
  if (typeof videoId === "string" && videoId.length > 0) {
    return true;
  }
  const uploadUrl = providerConfig.youtube_upload_url;
  return typeof uploadUrl === "string" && uploadUrl.length > 0;
}

export function isInstagramResumeRow(providerConfig: Record<string, unknown>): boolean {
  const containerId = providerConfig.ig_container_id;
  return typeof containerId === "string" && containerId.length > 0;
}

export function isLinkedInResumeRow(providerConfig: Record<string, unknown>): boolean {
  const uploadUrn = providerConfig.linkedin_upload_urn;
  const postUrn = providerConfig.linkedin_post_urn;
  return (
    (typeof uploadUrn === "string" && uploadUrn.length > 0) ||
    (typeof postUrn === "string" && postUrn.length > 0)
  );
}

export function isPublishResumeRow(
  platform: string,
  providerConfig: Record<string, unknown>,
): boolean {
  switch (platform.trim()) {
    case "TikTok":
      return isTikTokResumeRow(providerConfig);
    case "YouTube":
      return isYouTubeResumeRow(providerConfig);
    case "Instagram":
      return isInstagramResumeRow(providerConfig);
    case "LinkedIn":
      return isLinkedInResumeRow(providerConfig);
    default:
      return false;
  }
}

export function stripPublishResumeFlags(
  platform: string,
  providerConfig: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...providerConfig };
  switch (platform.trim()) {
    case "TikTok":
      delete next.tiktok_publish_id;
      delete next.tiktok_upload_completed;
      break;
    case "YouTube":
      delete next.youtube_upload_url;
      delete next.youtube_upload_bytes_sent;
      delete next.youtube_upload_completed;
      delete next.youtube_video_id;
      break;
    case "Instagram":
      delete next.ig_container_id;
      delete next.ig_upload_phase;
      delete next.ig_upload_session_id;
      break;
    case "LinkedIn":
      delete next.linkedin_upload_urn;
      delete next.linkedin_upload_instructions;
      delete next.linkedin_post_urn;
      break;
    default:
      break;
  }
  return next;
}
