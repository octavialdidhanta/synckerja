import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Locale } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { useReviewCommentNotifications, type ReviewCommentNotificationRow } from '../hook/useReviewCommentNotifications';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';

interface ReviewCommentNotificationBellProps {
  /** When provided, clicking a notification opens this plan in the dashboard preview modal instead of the public page */
  onOpenPreview?: (planId: string) => void;
}

export function ReviewCommentNotificationBell({ onOpenPreview }: ReviewCommentNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const { t, dateLocale } = useAppTranslation();
  const { notifications, unreadCount, markOneRead } = useReviewCommentNotifications();
  const unreadNotifications = notifications.filter((n) => n.read_at == null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
        aria-label={t('reviewCommentNotifications.title', 'Comment notifications')}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('reviewCommentNotifications.title', 'Comment notifications')}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-1 flex-col gap-4 overflow-hidden">
            <div className="seamless-scroll nested-scroll-touch-chain overflow-y-auto overflow-x-hidden max-h-[calc(100vh-120px)] flex-1 min-h-0 pr-2">
              {unreadNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('reviewCommentNotifications.empty', 'No notifications')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {unreadNotifications.map((n) => (
                    <NotificationItem
                      key={n.id}
                      item={n}
                      locale={dateLocale}
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
  item: ReviewCommentNotificationRow;
  locale: Locale;
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string;
  onNavigate: () => void;
  onOpenPreview?: (planId: string) => void;
  onMarkAsRead: (id: string) => Promise<void>;
}) {
  const name = (item.commenter_display_name && item.commenter_display_name.trim()) || 'Someone';
  const planTitle = (item.plan_title && item.plan_title.trim()) || 'plan';
  const label = t('reviewCommentNotifications.commentedOn', '{{name}} commented on {{planTitle}}', {
    name,
    planTitle,
  });
  const commentText = (item.comment_text && item.comment_text.trim()) || null;
  const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale });
  const isUnread = item.read_at == null;

  const handleClick = () => {
    onNavigate();
    if (onOpenPreview) {
      onOpenPreview(item.social_media_plan_id);
    } else {
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
        <button
          type="button"
          onClick={handleClick}
          className="block w-full text-left text-sm"
        >
          <span className="font-medium text-foreground">{label}</span>
          {commentText && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{commentText}</p>
          )}
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
              {t('reviewCommentNotifications.markAsRead', 'Mark as read')}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
