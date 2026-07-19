import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  TIKTOK_SEND_MAX_LENGTH,
  useTikTokShopSendMessage,
} from '../../hooks/useTikTokShopSendMessage';
import {
  TIKTOK_IMAGE_ACCEPT,
  useTikTokShopSendImageMessage,
  validateTikTokImageFile,
} from '../../hooks/useTikTokShopSendImageMessage';

type Props = {
  organizationId: string;
  accountId: string;
  conversationId: string;
  canSend: boolean;
  onSent?: () => void;
};

function mapSendError(code: string | undefined, fallback: string, t: (k: string) => string) {
  switch (code) {
    case 'RATE_LIMIT':
      return t('operations.ecommerceChat.tiktok.errors.rateLimit');
    case 'TTS_DAILY_QUOTA':
      return t('operations.ecommerceChat.tiktok.errors.dailyQuota');
    case 'TTS_SENSITIVE':
      return t('operations.ecommerceChat.tiktok.send.errors.sensitive');
    case 'TTS_CONVERSATION_RULE':
      return t('operations.ecommerceChat.tiktok.send.errors.conversationRule');
    case 'TTS_NO_PERMISSION':
      return t('operations.ecommerceChat.tiktok.send.errors.noPermission');
    case 'TTS_INVALID_PARAMS':
      return t('operations.ecommerceChat.tiktok.send.errors.invalidParams');
    case 'TTS_NOT_FOUND':
      return t('operations.ecommerceChat.tiktok.errors.notFound');
    case 'TTS_INTERNAL':
      return t('operations.ecommerceChat.tiktok.errors.internal');
    case 'INVALID_IMAGE':
      return t('operations.ecommerceChat.tiktok.send.errors.invalidImage');
    case 'IMAGE_TOO_LARGE':
      return t('operations.ecommerceChat.tiktok.send.errors.imageTooLarge');
    case 'NOT_CONNECTED':
    case 'TOKEN_ERROR':
      return t('operations.ecommerceChat.tiktok.errors.notConnected');
    default:
      return fallback || t('operations.ecommerceChat.tiktok.send.errors.generic');
  }
}

export function TikTokMessageComposer({
  organizationId,
  accountId,
  conversationId,
  canSend,
  onSent,
}: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const send = useTikTokShopSendMessage();
  const sendImage = useTikTokShopSendImageMessage();

  const trimmed = text.trim();
  const tooLong = text.length > TIKTOK_SEND_MAX_LENGTH;
  const busy = send.isPending || sendImage.isPending;
  const textDisabled = !canSend || busy || !trimmed || tooLong;

  const clearPendingImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onPickFile = (file: File | null) => {
    if (!file) return;
    const err = validateTikTokImageFile(file);
    if (err === 'INVALID_TYPE') {
      toast.error(t('operations.ecommerceChat.tiktok.send.errors.invalidImage'));
      return;
    }
    if (err === 'TOO_LARGE') {
      toast.error(t('operations.ecommerceChat.tiktok.send.errors.imageTooLarge'));
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const submitText = () => {
    if (textDisabled) return;
    if (!trimmed) {
      toast.error(t('operations.ecommerceChat.tiktok.send.empty'));
      return;
    }
    if (tooLong) {
      toast.error(t('operations.ecommerceChat.tiktok.send.tooLong'));
      return;
    }
    send.mutate(
      { organizationId, accountId, conversationId, text },
      {
        onSuccess: () => {
          setText('');
          onSent?.();
          toast.success(t('operations.ecommerceChat.tiktok.send.success'));
        },
        onError: (err) => {
          const e = err as Error & { code?: string };
          if (e.message === 'EMPTY') {
            toast.error(t('operations.ecommerceChat.tiktok.send.empty'));
            return;
          }
          if (e.message === 'TOO_LONG') {
            toast.error(t('operations.ecommerceChat.tiktok.send.tooLong'));
            return;
          }
          toast.error(mapSendError(e.code, e.message, t));
        },
      },
    );
  };

  const submitImage = () => {
    if (!canSend || busy || !pendingFile) return;
    sendImage.mutate(
      { organizationId, accountId, conversationId, file: pendingFile },
      {
        onSuccess: () => {
          clearPendingImage();
          onSent?.();
          toast.success(t('operations.ecommerceChat.tiktok.send.imageSuccess'));
        },
        onError: (err) => {
          const e = err as Error & { code?: string };
          if (e.message === 'INVALID_TYPE') {
            toast.error(t('operations.ecommerceChat.tiktok.send.errors.invalidImage'));
            return;
          }
          if (e.message === 'TOO_LARGE') {
            toast.error(t('operations.ecommerceChat.tiktok.send.errors.imageTooLarge'));
            return;
          }
          toast.error(mapSendError(e.code, e.message, t));
        },
      },
    );
  };

  return (
    <div className="shrink-0 space-y-2 border-t border-border px-3 py-2.5">
      {!canSend && (
        <p className="text-[11px] text-muted-foreground">
          {t('operations.ecommerceChat.tiktok.cannotSendHint')}
        </p>
      )}

      {previewUrl && pendingFile && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
          <img
            src={previewUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{pendingFile.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {(pendingFile.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 shrink-0 p-0"
            disabled={busy}
            onClick={clearPendingImage}
            aria-label={t('operations.ecommerceChat.tiktok.send.removeImage')}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSend || busy}
            onClick={submitImage}
          >
            {sendImage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            <span className="ml-1.5">
              {sendImage.isPending
                ? t('operations.ecommerceChat.tiktok.send.uploadingImage')
                : t('operations.ecommerceChat.tiktok.send.sendImage')}
            </span>
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={TIKTOK_IMAGE_ACCEPT}
          className="hidden"
          disabled={!canSend || busy}
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 w-9 shrink-0 p-0"
          disabled={!canSend || busy}
          onClick={() => fileInputRef.current?.click()}
          aria-label={t('operations.ecommerceChat.tiktok.send.attachImage')}
          title={t('operations.ecommerceChat.tiktok.send.attachImage')}
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1 space-y-1">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!canSend || busy}
            placeholder={t('operations.ecommerceChat.tiktok.send.placeholder')}
            rows={2}
            className="min-h-[64px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitText();
              }
            }}
          />
          <p
            className={`text-[10px] ${
              tooLong ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {text.length}/{TIKTOK_SEND_MAX_LENGTH}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={textDisabled}
          onClick={submitText}
          className="shrink-0"
        >
          {send.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          <span className="ml-1.5">
            {send.isPending
              ? t('operations.ecommerceChat.tiktok.send.sending')
              : t('operations.ecommerceChat.tiktok.send.button')}
          </span>
        </Button>
      </div>
    </div>
  );
}
