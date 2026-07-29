import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { resolvePublishErrorKey } from './resolvePublishErrorKey';

export function isPublishRateLimitMessage(message: string): boolean {
  return message.startsWith('rate_limited:');
}

export function notifyPublishMutationError(
  error: unknown,
  t: TFunction,
  fallbackKey = 'digitalMarketing.scheduledPosts.publishFailed',
): void {
  const raw = error instanceof Error ? error.message : t(fallbackKey);

  if (raw.startsWith('rate_limited:org')) {
    toast.info(
      t(
        'digitalMarketing.scheduledPosts.rateLimitOrgToast',
        'Publish queue is full for this organization (max 3 posts per 5 minutes per platform). Retrying automatically in about 90 seconds.',
      ),
    );
    return;
  }

  if (raw.startsWith('rate_limited:global')) {
    toast.info(
      t(
        'digitalMarketing.scheduledPosts.rateLimitGlobalToast',
        'Platform publish queue is busy. Retrying automatically shortly.',
      ),
    );
    return;
  }

  if (isPublishRateLimitMessage(raw)) {
    toast.info(
      t(
        'digitalMarketing.scheduledPosts.rateLimitQueueToast',
        'Waiting in publish queue — retrying automatically.',
      ),
    );
    return;
  }

  const key = resolvePublishErrorKey(raw);
  toast.error(t(key, raw));
}
