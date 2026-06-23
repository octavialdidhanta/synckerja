export const TIKTOK_PUBLISH_SCOPES = ['video.upload', 'video.publish'] as const;

export function scopesIncludePublish(scope: string | null | undefined): boolean {
  const parts = String(scope ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return TIKTOK_PUBLISH_SCOPES.every((required) => parts.includes(required));
}
