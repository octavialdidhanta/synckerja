import { Badge } from '@/shared/components/ui/badge';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  formatLateDurationParts,
  getClientVisitTimeliness,
  type ClientVisitTimelinessInput,
} from '../utils/clientVisitTimeDisplay';

interface ClientVisitTimelinessBadgeProps {
  visit: ClientVisitTimelinessInput;
  className?: string;
}

export function ClientVisitTimelinessBadge({ visit, className }: ClientVisitTimelinessBadgeProps) {
  const { t } = useAppTranslation();
  const timeliness = getClientVisitTimeliness(visit);

  if (timeliness.kind === 'pending') {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (timeliness.kind === 'unknown') {
    return (
      <span className="text-xs text-muted-foreground">
        {t('clientVisits.timeliness.unknown', 'N/A')}
      </span>
    );
  }

  if (timeliness.kind === 'on_time') {
    return (
      <Badge
        className={`border-green-200 bg-green-100 text-green-800 text-xs px-2 py-0.5 ${className ?? ''}`}
      >
        {t('clientVisits.timeliness.onTime', 'On time')}
      </Badge>
    );
  }

  const { hours, minutes } = formatLateDurationParts(timeliness.lateMinutes);
  let label: string;
  if (hours > 0 && minutes > 0) {
    label = t('clientVisits.timeliness.lateHoursMinutes', 'Late {{hours}} hr {{minutes}} min', {
      hours,
      minutes,
    });
  } else if (hours > 0) {
    label = t('clientVisits.timeliness.lateHours', 'Late {{hours}} hr', { hours });
  } else {
    label = t('clientVisits.timeliness.lateMinutes', 'Late {{minutes}} min', { minutes });
  }

  return (
    <Badge
      className={`border-amber-200 bg-amber-100 text-amber-900 text-xs px-2 py-0.5 whitespace-normal text-left leading-snug ${className ?? ''}`}
    >
      {label}
    </Badge>
  );
}
