import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import { scheduleStatusLabel } from '../lib/scheduleStatusLabel';
import type { ScheduledPostStatus } from '../types/scheduled-post';

const STATUS_VARIANT: Record<ScheduledPostStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  publishing: 'outline',
  published: 'default',
  failed: 'destructive',
  cancelled: 'outline',
};

export function ScheduleStatusBadge({
  status,
  className,
  publishStep,
  errorMessage,
}: {
  status: ScheduledPostStatus;
  className?: string;
  publishStep?: unknown;
  errorMessage?: string | null;
}) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={cn('text-xs', className)}>
      {scheduleStatusLabel(status, { publishStep, errorMessage })}
    </Badge>
  );
}
