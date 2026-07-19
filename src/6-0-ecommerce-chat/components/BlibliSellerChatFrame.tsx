import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { useMintBlibliSellerChatOtt } from '../hooks/useMintBlibliSellerChatOtt';
import { BLIBLI_CHAT_SESSION_REFRESH_MS, isBlibliIframeUrl } from '../lib/blibliSellerChat';

type Props = {
  organizationId: string | null | undefined;
  connectionId?: string | null;
  className?: string;
};

type FrameState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; iframeUrl: string; mintedAt: string }
  | { status: 'error'; message: string; code?: string };

export function BlibliSellerChatFrame({ organizationId, connectionId, className }: Props) {
  const { t } = useTranslation();
  const mint = useMintBlibliSellerChatOtt(organizationId);
  const [state, setState] = useState<FrameState>({ status: 'idle' });
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mintInFlight = useRef(false);

  const clearRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  const runMint = async (reason: 'mount' | 'refresh' | 'manual') => {
    if (!organizationId || mintInFlight.current) return;
    mintInFlight.current = true;
    setState({ status: 'loading' });
    try {
      const res = await mint.mutateAsync(connectionId);
      if (!isBlibliIframeUrl(res.iframeUrl)) {
        throw new Error(t('operations.ecommerceChat.blibli.invalidIframeUrl'));
      }
      setState({ status: 'ready', iframeUrl: res.iframeUrl, mintedAt: res.mintedAt });
      clearRefreshTimer();
      refreshTimerRef.current = setTimeout(() => {
        void runMint('refresh');
      }, BLIBLI_CHAT_SESSION_REFRESH_MS);
      void reason;
    } catch (err) {
      const message = err instanceof Error ? err.message : t('operations.ecommerceChat.blibli.mintError');
      const code = err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: string }).code ?? '')
        : undefined;
      setState({ status: 'error', message, code });
    } finally {
      mintInFlight.current = false;
    }
  };

  useEffect(() => {
    void runMint('mount');
    return () => {
      clearRefreshTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remint when org/connection changes
  }, [organizationId, connectionId]);

  return (
    <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${className ?? ''}`}>
      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-sm font-medium text-foreground">
          {t('operations.ecommerceChat.blibli.frameTitle')}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={state.status === 'loading' || !organizationId}
          onClick={() => void runMint('manual')}
        >
          {state.status === 'loading'
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            : <RefreshCw className="mr-2 h-4 w-4" aria-hidden />}
          {t('operations.ecommerceChat.blibli.reloadChat')}
        </Button>
      </div>

      {state.status === 'loading' || state.status === 'idle' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t('operations.ecommerceChat.blibli.minting')}</p>
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10">
          <Alert variant="destructive" className="max-w-md">
            <AlertTitle>
              {state.code === 'RATE_LIMIT'
                ? t('operations.ecommerceChat.blibli.rateLimitTitle')
                : t('operations.ecommerceChat.blibli.mintErrorTitle')}
            </AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
          <Button type="button" size="sm" onClick={() => void runMint('manual')}>
            {t('operations.ecommerceChat.blibli.retry')}
          </Button>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <iframe
          title={t('operations.ecommerceChat.blibli.iframeTitle')}
          src={state.iframeUrl}
          className="min-h-0 w-full flex-1 rounded-b-lg border-0 bg-background"
          referrerPolicy="no-referrer"
          allow="clipboard-read; clipboard-write"
          // Seller Center needs scripts/forms; keep sandbox permissive enough for chat UI.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      ) : null}
    </div>
  );
}
