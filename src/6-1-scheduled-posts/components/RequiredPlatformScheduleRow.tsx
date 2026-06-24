import { useMemo } from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { RequiredPlatformAutoTarget } from '../lib/resolveRequiredPlatformTargets';
import type { ScheduledPost } from '../types/scheduled-post';
import { getPlatformSettingsPath } from '../lib/platformOAuthConfig';
import { ScheduleStatusBadge } from './ScheduleStatusBadge';
import {
  SCHEDULE_TABLE_ACTIONS_CELL_CLASS,
  SCHEDULE_TABLE_BODY_ROW_CLASS,
  SCHEDULE_TABLE_CONNECTION_CELL_CLASS,
  SCHEDULE_TABLE_MIDDLE_GROUP_CLASS,
  SCHEDULE_TABLE_PLATFORM_CELL_CLASS,
  SCHEDULE_TABLE_STATUS_CELL_CLASS,
  SCHEDULE_TABLE_TIME_CELL_CLASS,
  SCHEDULE_TABLE_VISIBILITY_CELL_CLASS,
} from './scheduleTableColumnStyles';
import {
  DEFAULT_YOUTUBE_SCHEDULE_PRIVACY,
  YOUTUBE_SCHEDULE_PRIVACY_LEVELS,
} from '../lib/youtubeSchedulePrivacy';

const QUICK_TIMES = ['12:00', '15:00', '18:00', '20:00'];

type Props = {
  target: RequiredPlatformAutoTarget;
  schedule: ScheduledPost | null;
  activeSchedule: ScheduledPost | null;
  timeWib: string;
  onTimeChange: (value: string) => void;
  privacyLevel?: string;
  onPrivacyChange?: (value: string) => void;
  onSchedule: () => void;
  onPostNow: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  isSchedulePending: boolean;
  isPostNowPending: boolean;
  isCancelPending: boolean;
  isDeletePending?: boolean;
  bulkRunning?: boolean;
  reconnectHint: string | null;
};

export function RequiredPlatformScheduleRow({
  target,
  schedule,
  activeSchedule,
  timeWib,
  onTimeChange,
  privacyLevel = DEFAULT_YOUTUBE_SCHEDULE_PRIVACY,
  onPrivacyChange,
  onSchedule,
  onPostNow,
  onCancel,
  onDelete,
  canDelete = false,
  isSchedulePending,
  isPostNowPending,
  isCancelPending,
  isDeletePending = false,
  bulkRunning = false,
  reconnectHint,
}: Props) {
  const { t } = useTranslation();
  const { platform, accountLabel } = target;
  const controlsLocked = Boolean(activeSchedule);
  const publishScopesOk = target.publishScopesOk !== false && target.oauthConnected;
  const isBusy =
    isSchedulePending || isPostNowPending || isCancelPending || isDeletePending || bulkRunning;
  const settingsPath = getPlatformSettingsPath(platform);

  const lockedPrivacyLevel = activeSchedule?.privacy_level
    ? String(activeSchedule.privacy_level).trim().toUpperCase()
    : null;
  const displayPrivacyLevel =
    lockedPrivacyLevel &&
    (YOUTUBE_SCHEDULE_PRIVACY_LEVELS as readonly string[]).includes(lockedPrivacyLevel)
      ? lockedPrivacyLevel
      : privacyLevel;

  const privacyOptions = useMemo(
    () =>
      YOUTUBE_SCHEDULE_PRIVACY_LEVELS.map((value) => ({
        value,
        label:
          value === 'PUBLIC'
            ? t('digitalMarketing.youtubeContent.privacy.public', 'Public')
            : value === 'UNLISTED'
              ? t('digitalMarketing.youtubeContent.privacy.unlisted', 'Unlisted')
              : t('digitalMarketing.youtubeContent.privacy.private', 'Private'),
      })),
    [t],
  );

  const isRateLimitQueue =
    schedule?.status === 'pending' && Boolean(schedule.error_message?.startsWith('rate_limited:'));

  const connectionNote = !publishScopesOk
    ? reconnectHint
    : !target.oauthConnected && settingsPath
      ? t('digitalMarketing.scheduledPosts.connectOAuthAccountHint')
      : null;

  return (
    <div className={SCHEDULE_TABLE_BODY_ROW_CLASS}>
      <div className={SCHEDULE_TABLE_PLATFORM_CELL_CLASS}>
        <div className="space-y-0.5">
          <p className="text-sm font-medium leading-tight text-foreground">{platform}</p>
          <p className="text-xs text-muted-foreground">{accountLabel}</p>
        </div>
      </div>

      <div className={SCHEDULE_TABLE_MIDDLE_GROUP_CLASS}>
        <div className={cn(SCHEDULE_TABLE_STATUS_CELL_CLASS, 'whitespace-nowrap')}>
          {schedule ? (
            <ScheduleStatusBadge status={schedule.status} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>

        <div className={SCHEDULE_TABLE_CONNECTION_CELL_CLASS}>
          {connectionNote ? (
            <p className="text-xs leading-snug text-destructive">{connectionNote}</p>
          ) : !target.oauthConnected && settingsPath ? (
            <p className="text-xs leading-snug text-muted-foreground">
              <Link
                to={settingsPath}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {t('digitalMarketing.scheduledPosts.openPlatformSettings', { platform })}
              </Link>
            </p>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t('digitalMarketing.scheduledPosts.oauthReady', 'Ready')}
            </span>
          )}
          {schedule?.error_message ? (
            <p
              className={`mt-1 line-clamp-2 text-[11px] leading-snug ${
                isRateLimitQueue ? 'text-sky-700 dark:text-sky-400' : 'text-destructive'
              }`}
            >
              {schedule.error_message}
            </p>
          ) : null}
        </div>

        <div className={SCHEDULE_TABLE_VISIBILITY_CELL_CLASS}>
          {platform === 'YouTube' ? (
            <Select
              value={displayPrivacyLevel}
              onValueChange={onPrivacyChange}
              disabled={controlsLocked}
            >
              <SelectTrigger className="h-8 w-[7.5rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {privacyOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>

        <div className={SCHEDULE_TABLE_TIME_CELL_CLASS}>
          <div className="flex flex-nowrap items-center gap-1">
            <Input
              type="time"
              value={timeWib}
              onChange={(e) => onTimeChange(e.target.value.slice(0, 5))}
              className={cn(
                'h-8 w-[6.75rem] shrink-0 text-xs font-medium',
                QUICK_TIMES.includes(timeWib) && 'border-brand-blue ring-1 ring-brand-blue/30',
              )}
              disabled={controlsLocked}
            />
            {QUICK_TIMES.map((qt) => {
              const isActive = timeWib === qt;
              return (
                <Button
                  key={qt}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    'h-8 shrink-0 px-2.5 text-[11px] font-semibold transition-colors',
                    isActive &&
                      'border-brand-blue bg-brand-blue text-white shadow-sm hover:border-brand-blue hover:bg-brand-blue/90 hover:text-white',
                  )}
                  disabled={controlsLocked}
                  onClick={() => onTimeChange(qt)}
                >
                  {qt}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={SCHEDULE_TABLE_ACTIONS_CELL_CLASS}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 rounded-none p-0"
              disabled={isBusy && !isSchedulePending && !isPostNowPending && !isCancelPending}
              aria-label={t('digitalMarketing.scheduledPosts.rowActions', 'Row actions')}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {activeSchedule ? (
              <>
                <DropdownMenuItem
                  disabled={isBusy}
                  onClick={onCancel}
                  className="cursor-pointer text-xs text-destructive focus:text-destructive"
                >
                  {isCancelPending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {t('digitalMarketing.scheduledPosts.cancelSchedule')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  {t('digitalMarketing.scheduledPosts.activeScheduleLocked', 'Active schedule')}
                </DropdownMenuItem>
              </>
            ) : canDelete ? (
              <DropdownMenuItem
                disabled={isBusy}
                onClick={onDelete}
                className="cursor-pointer text-xs text-destructive focus:text-destructive"
              >
                {isDeletePending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : null}
                {t('digitalMarketing.scheduledPosts.deleteFromPlatform')}
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem
                  disabled={isBusy || !publishScopesOk}
                  onClick={onSchedule}
                  className="cursor-pointer text-xs"
                >
                  {isSchedulePending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {t('digitalMarketing.scheduledPosts.schedule')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isBusy || !publishScopesOk}
                  onClick={onPostNow}
                  className="cursor-pointer text-xs"
                >
                  {isPostNowPending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {t('digitalMarketing.scheduledPosts.postNow')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
