import { Progress } from '@/shared/components/ui/progress';
import { Badge } from '@/shared/components/ui/badge';
import { Label } from '@/shared/components/ui/label';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  computeRequiredPlatformsProgress,
  type RequiredPlatformItemStatus,
  type RequiredPlatformInput,
  type SocialMediaLinkInput,
} from '../lib/computeRequiredPlatformsProgress';
import type { ScheduledPost } from '../types/scheduled-post';

type Props = {
  requiredPlatforms: RequiredPlatformInput[];
  links: SocialMediaLinkInput[];
  contentTypeName: string | null;
  schedules?: ScheduledPost[];
  showWhenDone?: boolean;
  planDone?: boolean;
};

const STATUS_LABEL: Record<RequiredPlatformItemStatus, string> = {
  missing: 'Missing',
  scheduled: 'Scheduled',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Failed',
  link_ready: 'Link added',
};

const STATUS_CLASS: Record<RequiredPlatformItemStatus, string> = {
  missing: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  publishing: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  published: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  link_ready: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300',
};

function PlatformStatusBadge({ status }: { status: RequiredPlatformItemStatus }) {
  return (
    <Badge variant="outline" className={cn('border-0 text-[10px] font-medium', STATUS_CLASS[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function RequiredPlatformsProgress({
  requiredPlatforms,
  links,
  contentTypeName,
  schedules = [],
  showWhenDone = false,
  planDone = false,
}: Props) {
  if (!showWhenDone && planDone) return null;

  const validation = computeRequiredPlatformsProgress(
    requiredPlatforms,
    links,
    contentTypeName,
    schedules,
  );

  if (validation.totalRequired === 0) return null;

  const showSuccess = validation.isValid && !validation.hasPublishing;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {showSuccess ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <AlertCircle
              className={cn(
                'h-5 w-5 shrink-0',
                validation.hasPublishing ? 'text-sky-600' : 'text-orange-600',
              )}
            />
          )}
          <Label className="text-sm font-semibold">Required Platforms Progress</Label>
        </div>
        <Badge variant={showSuccess ? 'default' : 'secondary'} className="shrink-0">
          {validation.filledRequired} / {validation.totalRequired}
        </Badge>
      </div>

      <Progress
        value={validation.progress}
        className={cn(
          'mb-3 h-2',
          validation.hasPublishing ? '[&>div]:animate-pulse [&>div]:bg-sky-500' : '[&>div]:bg-blue-600',
        )}
      />

      <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
        {validation.items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-2 rounded-md border border-blue-100/80 bg-white/70 px-2.5 py-1.5 dark:border-blue-900/50 dark:bg-black/20"
          >
            <span className="min-w-0 truncate text-xs font-medium text-foreground">{item.label}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              {item.status === 'publishing' && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" aria-hidden />
              )}
              <PlatformStatusBadge status={item.status} />
              {item.url && (item.status === 'published' || item.status === 'link_ready') && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                  title="Open published link"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
