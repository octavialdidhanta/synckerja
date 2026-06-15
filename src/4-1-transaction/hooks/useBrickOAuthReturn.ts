import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  parseBrickSyncCooldownSec,
  runBrickOAuthReturnSync,
} from '@/4-1-transaction/lib/brickOAuthReturnSync';

type BrickOAuthReturnScope = 'bank' | 'debt';

export function useBrickOAuthReturn(
  scope: BrickOAuthReturnScope,
  onSyncSuccess?: () => void,
) {
  const { organizationId } = useCurrentOrg();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useAppTranslation();

  const prefix = scope === 'bank' ? 'incomes.brick' : 'debt.brick';

  const handleSyncSuccess = useCallback(() => {
    onSyncSuccess?.();
  }, [onSyncSuccess]);

  useEffect(() => {
    const brickOAuth = searchParams.get('brick_oauth');
    if (!brickOAuth || !organizationId) return;

    const oauthError = searchParams.get('oauth_error');
    const oauthNonce = searchParams.get('oauth_nonce');

    const cleanParams = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('brick_oauth');
      next.delete('oauth_error');
      next.delete('oauth_nonce');
      setSearchParams(next, { replace: true });
    };

    if (brickOAuth === 'success') {
      toast({
        title: t(`${prefix}.oauthSuccessTitle`, scope === 'bank' ? 'Rekening terhubung ke Brick' : 'Kartu kredit terhubung ke Brick'),
        description: t(
          `${prefix}.oauthSuccessDesc`,
          scope === 'bank'
            ? 'Sinkron mutasi dari rekening bank sedang berjalan.'
            : 'Sinkron transaksi dan impor expense otomatis sedang berjalan.',
        ),
      });

      void runBrickOAuthReturnSync(organizationId, oauthNonce)
        .then((outcome) => {
          if (outcome.status === 'ok') handleSyncSuccess();
        })
        .catch((e: Error) => {
          const waitSec = parseBrickSyncCooldownSec(e.message);
          if (waitSec != null) {
            toast({
              title: t(`${prefix}.syncRateLimitTitle`, 'Sinkron baru saja dijalankan'),
              description: t(
                `${prefix}.syncRateLimitDesc`,
                'Mutasi sudah diperbarui. Tunggu {{sec}} detik sebelum refresh manual.',
                { sec: waitSec },
              ),
            });
            return;
          }
          toast({
            title: t(`${prefix}.oauthSyncErrorTitle`, 'Sinkron otomatis gagal'),
            description: e.message,
            variant: 'destructive',
          });
        })
        .finally(cleanParams);
      return;
    }

    if (brickOAuth === 'error') {
      toast({
        title: t(`${prefix}.oauthErrorTitle`, 'Gagal hubungkan Brick'),
        description: oauthError ?? t(`${prefix}.oauthErrorGeneric`, 'OAuth dibatalkan atau gagal.'),
        variant: 'destructive',
      });
      cleanParams();
    }
  }, [handleSyncSuccess, organizationId, prefix, scope, searchParams, setSearchParams, t, toast]);
}
