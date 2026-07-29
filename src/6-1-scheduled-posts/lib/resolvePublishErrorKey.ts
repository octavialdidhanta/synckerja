/**
 * Map edge-function publish errors to i18n keys (digitalMarketing.scheduledPosts.errors.*).
 */
export function resolvePublishErrorKey(error: string | undefined): string {
  const raw = String(error ?? '').trim().toLowerCase();
  if (!raw) return 'digitalMarketing.scheduledPosts.errors.publishFailed';

  if (raw.includes('youtube_video_not_found')) {
    return 'digitalMarketing.scheduledPosts.errors.youtubeNotIndexed';
  }
  if (raw.includes('processing_timeout') || raw.includes('youtube_processing_failed')) {
    return 'digitalMarketing.scheduledPosts.errors.youtubeProcessing';
  }
  if (raw.includes('tiktok_public_post_id_timeout')) {
    return 'digitalMarketing.scheduledPosts.errors.tiktokPublicIdTimeout';
  }
  if (raw.includes('tiktok_public_privacy_unavailable')) {
    return 'digitalMarketing.scheduledPosts.errors.tiktokPublicPrivacy';
  }
  if (raw.includes('invalid_video_file') || raw.includes('drive_upload_size_mismatch')) {
    return 'digitalMarketing.scheduledPosts.errors.invalidVideoFile';
  }
  if (raw.includes('drive_download_failed') || raw.includes('html instead of video')) {
    return 'digitalMarketing.scheduledPosts.errors.driveNotPublic';
  }
  if (raw.includes('plan_not_eligible') || raw.includes('not_eligible')) {
    return 'share.publish.errors.notEligible';
  }
  if (raw.includes('no_schedules_created') || raw.includes('schedule_insert_failed')) {
    return 'digitalMarketing.scheduledPosts.errors.publishFailed';
  }
  if (raw.includes('tiktok_pull_failed') || raw.includes('tiktok_publish_path')) {
    return 'digitalMarketing.scheduledPosts.errors.publishFailed';
  }
  if (raw === 'oauth_or_scopes') {
    return 'digitalMarketing.scheduledPosts.errors.oauthOrScopes';
  }
  if (raw.startsWith('share.')) return error!;
  if (raw.startsWith('digitalmarketing.')) return error!;

  return 'digitalMarketing.scheduledPosts.errors.publishFailed';
}
