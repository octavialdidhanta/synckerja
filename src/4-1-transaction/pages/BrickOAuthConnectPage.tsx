import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Link2 } from 'lucide-react';

function brickCallbackBaseUrl(): string {
  const explicit = import.meta.env.VITE_BRICK_OAUTH_CALLBACK_URL as string | undefined;
  if (explicit?.trim()) return explicit.trim().replace(/\/+$/, '');
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
  if (supabaseUrl) return `${supabaseUrl}/functions/v1/brick-oauth-callback`;
  return '';
}

export default function BrickOAuthConnectPage() {
  const { t } = useAppTranslation();
  const [searchParams] = useSearchParams();
  const state = searchParams.get('state')?.trim() ?? '';

  const callbackUrl = useMemo(() => {
    if (!state) return '';
    const base = brickCallbackBaseUrl();
    if (!base) return '';
    const params = new URLSearchParams({
      state,
      userAccessToken: 'sandbox-mock-user-access-token',
      user_id: 'sandbox-mock-user',
    });
    return `${base}?${params.toString()}`;
  }, [state]);

  const handleConnect = useCallback(() => {
    if (!callbackUrl) return;
    window.location.assign(callbackUrl);
  }, [callbackUrl]);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-base">
              {t('incomes.brick.connectInvalidTitle', 'Sesi Brick tidak valid')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t(
              'incomes.brick.connectInvalidDesc',
              'Mulai ulang dari halaman Rekening Bank atau Hutang, lalu klik Hubungkan via Brick.',
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            {t('incomes.brick.connectTitle', 'Hubungkan akun via Brick')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t(
              'incomes.brick.connectSandboxHint',
              'Widget Brick /v1/index tidak tersedia di sandbox saat ini. Gunakan koneksi sandbox MockBank untuk melanjutkan integrasi mutasi & kartu kredit.',
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
            <li>{t('incomes.brick.connectStep1', 'Rekening bank simulasi (MockBank)')}</li>
            <li>{t('incomes.brick.connectStep2', 'Setelah terhubung, jalankan sinkron untuk menarik mutasi ke Synckerja')}</li>
          </ul>
          <Button className="w-full" onClick={handleConnect} disabled={!callbackUrl}>
            <Link2 className="h-4 w-4 mr-2" />
            {t('incomes.brick.connectSandboxButton', 'Lanjutkan koneksi uji')}
          </Button>
          <p className="text-[11px] leading-snug text-muted-foreground/80">
            {t(
              'incomes.brick.connectStep3',
              'Production: tim IT mengatur widget Brick resmi setelah produk Financial Data diaktifkan Brick.',
            )}
          </p>
          {!callbackUrl ? (
            <p className="text-xs text-destructive">
              {t(
                'incomes.brick.connectMissingCallback',
                'VITE_SUPABASE_URL tidak dikonfigurasi — tidak dapat membangun callback URL.',
              )}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
