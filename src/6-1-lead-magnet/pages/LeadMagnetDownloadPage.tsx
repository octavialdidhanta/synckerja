import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SUPABASE_URL } from '@/shared/lib/supabaseClient';

type DownloadApiResponse = {
  ok: boolean;
  code: string;
  title: string;
  message: string;
  fileUrl?: string | null;
  buttonLabel?: string | null;
  fileName?: string | null;
};

type ViewState = 'loading' | 'ready' | 'error';

export function LeadMagnetDownloadPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<ViewState>('loading');
  const [payload, setPayload] = useState<DownloadApiResponse | null>(null);

  const queryString = useMemo(() => {
    const e = searchParams.get('e') ?? '';
    const a = searchParams.get('a') ?? '';
    const t = searchParams.get('t') ?? '';
    const s = searchParams.get('s') ?? '';
    if (!e || a !== 'download' || !t || !s) return null;
    return new URLSearchParams({ e, a, t, s }).toString();
  }, [searchParams]);

  useEffect(() => {
    if (!queryString) {
      setState('error');
      setPayload({
        ok: false,
        code: 'invalid_params',
        title: 'Link tidak valid',
        message: 'Parameter tautan tidak lengkap.',
      });
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/lead-magnet-runtime/download?${queryString}`,
          { headers: { Accept: 'application/json' } },
        );
        const data = (await res.json()) as DownloadApiResponse;
        if (cancelled) return;
        setPayload(data);
        setState(data.ok && data.fileUrl ? 'ready' : 'error');
      } catch {
        if (cancelled) return;
        setState('error');
        setPayload({
          ok: false,
          code: 'network_error',
          title: 'Gagal memuat',
          message: 'Periksa koneksi internet lalu coba buka link dari Messenger lagi.',
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const title = payload?.title ?? 'Memuat materi…';
  const message = payload?.message ?? 'Mohon tunggu sebentar.';
  const buttonLabel = payload?.buttonLabel ?? 'Unduh';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-sm">
        {state === 'loading' ? (
          <div className="space-y-3" aria-busy="true">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            <p className="text-sm text-gray-600">Menyiapkan unduhan…</p>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{message}</p>
            {state === 'ready' && payload?.fileUrl ? (
              <a
                href={payload.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={payload.fileName ?? undefined}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {buttonLabel}
              </a>
            ) : null}
            <p className="mt-4 text-xs text-gray-500">
              File dikirim melalui Messenger via Synckerja. Anda bisa menutup halaman ini setelah unduh.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
