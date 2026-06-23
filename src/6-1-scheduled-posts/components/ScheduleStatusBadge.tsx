import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { ScheduledPostStatus } from '../types/scheduled-post';

const STATUS_LABEL: Record<ScheduledPostStatus, string> = {
  pending: 'Scheduled',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

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
}: {
  status: ScheduledPostStatus;
  className?: string;
}) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={cn('text-xs', className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
