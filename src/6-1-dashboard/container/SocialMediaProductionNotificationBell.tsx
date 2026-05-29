import React, { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Locale } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import {
  useSocialMediaProductionNotifications,
  type SocialMediaProductionNotificationRow,
} from '../hook/useSocialMediaProductionNotifications';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { useNavigate } from 'react-router-dom';

interface SocialMediaProductionNotificationBellProps {
  onOpenPreview?: (planId: string) => void;
}

export function SocialMediaProductionNotificationBell({
  onOpenPreview,
}: SocialMediaProductionNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const { t, dateFnsLocale } = useAppTranslation();
  const { notifications, unreadCount, markOneRead } = useSocialMediaProductionNotifications();
  const unreadNotifications = notifications.filter((n) => n.read_at == null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
        aria-label={t('socialMediaProductionNotifications.title', 'Production notifications')}
      >
        <ClipboardCheck className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {t('socialMediaProductionNotifications.title', 'Production notifications')}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-1 flex-col gap-4 overflow-hidden">
            <div className="seamless-scroll nested-scroll-touch-chain max-h-[calc(100vh-120px)] min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
              {unreadNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('socialMediaProductionNotifications.empty', 'No notifications')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {unreadNotifications.map((n) => (
                    <NotificationItem
                      key={n.id}
                      item={n}
                      locale={dateFnsLocale}
                      t={t}
                      onNavigate={() => setOpen(false)}
                      onOpenPreview={onOpenPreview}
                      onMarkAsRead={markOneRead}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NotificationItem({
  item,
  locale,
  t,
  onNavigate,
  onOpenPreview,
  onMarkAsRead,
}: {
  item: SocialMediaProductionNotificationRow;
  locale: Locale;
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string;
  onNavigate: () => void;
  onOpenPreview?: (planId: string) => void;
  onMarkAsRead: (id: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale });
  const isUnread = item.read_at == null;

  const handleClick = () => {
    onNavigate();
    if (onOpenPreview && item.event_type !== 'revision_submitted') {
      onOpenPreview(item.social_media_plan_id);
      return;
    }
    const path = item.url?.startsWith('/') ? item.url : null;
    if (path) {
      navigate(path);
      return;
    }
    if (item.review_token) {
      window.open(`/review/${item.review_token}`, '_blank', 'noopener,noreferrer');
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMarkAsRead(item.id);
  };

  return (
    <li>
      <div className="rounded-lg border border-border bg-muted/50 p-2 transition-colors hover:bg-muted/70">
        <button type="button" onClick={handleClick} className="block w-full text-left text-sm">
          <span className="font-medium text-foreground">{item.title}</span>
          {item.body && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>}
        </button>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
          {isUnread && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 border-input text-xs"
              onClick={handleMarkAsRead}
            >
              {t('socialMediaProductionNotifications.markAsRead', 'Mark as read')}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
