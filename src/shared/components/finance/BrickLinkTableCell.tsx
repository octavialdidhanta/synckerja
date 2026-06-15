import { format } from 'date-fns';
import { Link2, Loader2, MoreHorizontal, RefreshCw, Unlink } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import type { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export type BrickLinkStatus = 'linked' | 'unlinked' | 'pending' | 'error' | null | undefined;

type I18nPrefix = 'debt.brick' | 'incomes.brick';

function statusLabel(
  status: BrickLinkStatus,
  t: ReturnType<typeof useAppTranslation>['t'],
  prefix: I18nPrefix,
) {
  switch (status) {
    case 'linked':
      return t(`${prefix}.statusLinked`, 'Terhubung');
    case 'pending':
      return t(`${prefix}.statusPending`, 'Menghubungkan…');
    case 'error':
      return t(`${prefix}.statusError`, 'Error');
    default:
      return t(`${prefix}.statusUnlinked`, 'Belum terhubung');
  }
}

function statusVariant(status: BrickLinkStatus) {
  switch (status) {
    case 'linked':
      return 'default' as const;
    case 'error':
      return 'destructive' as const;
    case 'pending':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
}

type BrickLinkBaseProps = {
  status: BrickLinkStatus;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  busy?: boolean;
  i18nPrefix: I18nPrefix;
  t: ReturnType<typeof useAppTranslation>['t'];
  onLink?: () => void;
  onSync?: () => void;
  onUnlink?: () => void;
};

function useBrickLinkActions({
  status,
  onLink,
  onSync,
  onUnlink,
}: Pick<BrickLinkBaseProps, 'status' | 'onLink' | 'onSync' | 'onUnlink'>) {
  const hasLink = status !== 'linked' && Boolean(onLink);
  const hasSync = status === 'linked' && Boolean(onSync);
  const hasUnlink = status === 'linked' && Boolean(onUnlink);
  const hasAny = hasLink || hasSync || hasUnlink;
  return { hasLink, hasSync, hasUnlink, hasAny };
}

/** Badge + tooltip only (status & last sync). */
export function BrickLinkStatusBadge({
  status,
  lastSyncAt,
  lastSyncError,
  busy = false,
  i18nPrefix,
  t,
}: Pick<
  BrickLinkBaseProps,
  'status' | 'lastSyncAt' | 'lastSyncError' | 'busy' | 'i18nPrefix' | 't'
>) {
  const syncLabel = lastSyncAt
    ? t(`${i18nPrefix}.lastSync`, 'Terakhir sync: {{at}}', {
        at: format(new Date(lastSyncAt), 'dd MMM yyyy, HH:mm'),
      })
    : t(`${i18nPrefix}.noSyncYet`, 'Belum pernah disinkron');

  return (
    <div className="inline-flex max-w-full items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={statusVariant(status)}
            className="shrink-0 cursor-default text-[10px] font-normal"
          >
            {statusLabel(status, t, i18nPrefix)}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p>{syncLabel}</p>
          {lastSyncError ? (
            <p className="mt-1 text-destructive">{lastSyncError}</p>
          ) : null}
        </TooltipContent>
      </Tooltip>
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      ) : null}
    </div>
  );
}

/** Menu items to embed in an existing Actions dropdown. */
export function BrickLinkDropdownMenuItems({
  status,
  i18nPrefix,
  t,
  onLink,
  onSync,
  onUnlink,
  disabled = false,
  withSeparator = true,
}: BrickLinkBaseProps & { disabled?: boolean; withSeparator?: boolean }) {
  const { hasLink, hasSync, hasUnlink, hasAny } = useBrickLinkActions({
    status,
    onLink,
    onSync,
    onUnlink,
  });

  if (!hasAny) return null;

  return (
    <>
      {withSeparator ? <DropdownMenuSeparator /> : null}
      {hasLink ? (
        <DropdownMenuItem disabled={disabled} onClick={onLink}>
          <Link2 className="mr-2 h-3.5 w-3.5" />
          {t(`${i18nPrefix}.linkAction`, 'Hubungkan via Brick Widget')}
        </DropdownMenuItem>
      ) : null}
      {hasSync ? (
        <DropdownMenuItem disabled={disabled} onClick={onSync}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          {t(
            i18nPrefix === 'debt.brick' ? `${i18nPrefix}.syncAction` : 'incomes.brick.refreshAll',
            i18nPrefix === 'debt.brick' ? 'Sinkron mutasi kartu kredit' : 'Refresh mutasi',
          )}
        </DropdownMenuItem>
      ) : null}
      {hasUnlink ? (
        <DropdownMenuItem
          disabled={disabled}
          onClick={onUnlink}
          className="text-destructive focus:text-destructive"
        >
          <Unlink className="mr-2 h-3.5 w-3.5" />
          {t(`${i18nPrefix}.unlinkAction`, 'Putuskan Brick')}
        </DropdownMenuItem>
      ) : null}
    </>
  );
}

type BrickLinkTableCellProps = BrickLinkBaseProps & {
  /** When false, only badge + tooltip (no action menu). */
  showActions?: boolean;
};

export function BrickLinkTableCell({
  status,
  lastSyncAt,
  lastSyncError,
  busy = false,
  i18nPrefix,
  t,
  onLink,
  onSync,
  onUnlink,
  showActions = true,
}: BrickLinkTableCellProps) {
  const { hasAny } = useBrickLinkActions({ status, onLink, onSync, onUnlink });
  const hasMenu = showActions && hasAny && !busy;

  return (
    <div className="inline-flex max-w-full items-center gap-1">
      <BrickLinkStatusBadge
        status={status}
        lastSyncAt={lastSyncAt}
        lastSyncError={lastSyncError}
        busy={false}
        i18nPrefix={i18nPrefix}
        t={t}
      />
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      ) : hasMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 shrink-0 p-0"
              aria-label={t(`${i18nPrefix}.actionsMenu`, 'Aksi Brick')}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <BrickLinkDropdownMenuItems
              status={status}
              i18nPrefix={i18nPrefix}
              t={t}
              onLink={onLink}
              onSync={onSync}
              onUnlink={onUnlink}
              withSeparator={false}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
