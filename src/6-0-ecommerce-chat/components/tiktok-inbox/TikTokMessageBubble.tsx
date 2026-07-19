import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { TikTokConversationMessage } from './tiktokConversation.types';
import {
  formatTikTokConversationTime,
  messageTypeLabel,
  parseIdFromContent,
  parseImageContent,
  parseTextContent,
  parseVideoContent,
} from './TikTokConversationPreview';

type Props = {
  message: TikTokConversationMessage;
  unsupportedTip?: string;
};

function bubbleAlign(role: string | undefined): 'left' | 'right' | 'center' {
  const r = String(role ?? '').toUpperCase();
  if (r === 'BUYER') return 'left';
  if (r === 'SYSTEM' || r === 'ROBOT') return 'center';
  return 'right';
}

export function TikTokMessageBubble({ message, unsupportedTip }: Props) {
  const { t } = useTranslation();
  const role = message.sender?.role;
  const align = bubbleAlign(role);
  const type = String(message.type ?? 'OTHER').toUpperCase();
  const time = formatTikTokConversationTime(message.create_time);
  const nickname = message.sender?.nickname?.trim();

  return (
    <div
      className={cn(
        'flex w-full',
        align === 'left' && 'justify-start',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] space-y-1',
          align === 'center' && 'max-w-[95%] text-center',
        )}
      >
        {align !== 'center' && nickname && (
          <p
            className={cn(
              'px-1 text-[10px] text-muted-foreground',
              align === 'right' && 'text-right',
            )}
          >
            {nickname}
          </p>
        )}
        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm',
            align === 'left' && 'rounded-tl-md bg-muted text-foreground',
            align === 'right' && 'rounded-tr-md bg-primary text-primary-foreground',
            align === 'center' && 'rounded-md bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground',
          )}
        >
          <MessageBody
            type={type}
            message={message}
            unsupportedTip={unsupportedTip}
            onPrimary={align === 'right'}
          />
        </div>
        {time && (
          <p
            className={cn(
              'px-1 text-[10px] text-muted-foreground',
              align === 'right' && 'text-right',
              align === 'center' && 'text-center',
            )}
          >
            {time}
          </p>
        )}
      </div>
    </div>
  );
}

function MessageBody({
  type,
  message,
  unsupportedTip,
  onPrimary,
}: {
  type: string;
  message: TikTokConversationMessage;
  unsupportedTip?: string;
  onPrimary: boolean;
}) {
  const { t } = useTranslation();

  if (type === 'TEXT' || type === 'EMOTICONS' || type === 'ALLOCATED_SERVICE' ||
    type === 'NOTIFICATION' || type === 'BUYER_ENTER_FROM_TRANSFER') {
    const text = parseTextContent(message.content) || message.plaintext?.trim() || '';
    return <p className="whitespace-pre-wrap break-words">{text || messageTypeLabel(type, t)}</p>;
  }

  if (type === 'IMAGE') {
    const img = parseImageContent(message.content);
    if (img?.url) {
      return (
        <a href={img.url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={img.url}
            alt=""
            className="max-h-56 max-w-full rounded-md object-contain"
          />
        </a>
      );
    }
    return <p>{messageTypeLabel(type, t)}</p>;
  }

  if (type === 'VIDEO') {
    const video = parseVideoContent(message.content);
    return (
      <div className="space-y-1.5">
        {video?.cover && (
          <img
            src={video.cover}
            alt=""
            className="max-h-40 max-w-full rounded-md object-cover"
          />
        )}
        <p className="text-xs font-medium">{messageTypeLabel(type, t)}</p>
        {video?.url && (
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1 text-xs underline',
              onPrimary ? 'text-primary-foreground/90' : 'text-primary',
            )}
          >
            {t('operations.ecommerceChat.tiktok.thread.openMedia')}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}
      </div>
    );
  }

  const plaintext = message.plaintext?.trim();
  const productId = parseIdFromContent(message.content, 'product_id');
  const orderId = parseIdFromContent(message.content, 'order_id');
  const couponId = parseIdFromContent(message.content, 'coupon_id');
  const detail =
    plaintext ||
    (productId ? `${t('operations.ecommerceChat.tiktok.thread.productId')}: ${productId}` : '') ||
    (orderId ? `${t('operations.ecommerceChat.tiktok.thread.orderId')}: ${orderId}` : '') ||
    (couponId ? `${t('operations.ecommerceChat.tiktok.thread.couponId')}: ${couponId}` : '') ||
    unsupportedTip?.trim() ||
    messageTypeLabel(type, t);

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium opacity-80">{messageTypeLabel(type, t)}</p>
      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{detail}</p>
    </div>
  );
}
