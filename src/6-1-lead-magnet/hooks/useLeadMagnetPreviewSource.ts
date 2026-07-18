import { useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { LEAD_MAGNET_ASSETS_BUCKET } from '../lib/leadMagnetDeliveryAsset';
import { isLikelyPdf } from '../lib/summarizeCampaignLeadMagnet';

export type LeadMagnetPreviewKind = 'pdf' | 'embed' | 'unsupported';

export type LeadMagnetPreviewSource = {
  kind: LeadMagnetPreviewKind;
  /** Blob/object URL or remote embed URL ready for iframe. */
  src: string | null;
  loading: boolean;
  error: boolean;
};

type ResolveArgs = {
  open: boolean;
  /** When true, load from private bucket via authenticated download. */
  storagePath?: string | null;
  fileName?: string | null;
  fileMime?: string | null;
  /** External / public URL fallback. */
  url?: string | null;
};

/**
 * Resolve an in-panel preview URL.
 * Uploaded PDFs are downloaded via Supabase Storage into a blob URL so Chrome's
 * PDF viewer works reliably (public URL + sandbox often shows a broken icon).
 */
export function useLeadMagnetPreviewSource(args: ResolveArgs): LeadMagnetPreviewSource {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [kind, setKind] = useState<LeadMagnetPreviewKind>('embed');

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const reset = () => {
      setSrc(null);
      setLoading(false);
      setError(false);
    };

    if (!args.open) {
      reset();
      setKind('embed');
      return;
    }

    const storagePath = args.storagePath?.trim() || null;
    const url = args.url?.trim() || null;
    const pdf = isLikelyPdf({
      url,
      fileName: args.fileName,
      mime: args.fileMime,
    });

    const run = async () => {
      setLoading(true);
      setError(false);
      setSrc(null);

      // Uploaded asset: prefer authenticated download → blob (works for PDF in iframe).
      if (storagePath) {
        if (!pdf && !isOfficePreviewable(args.fileName, args.fileMime)) {
          // Non-PDF office files: no reliable in-browser preview.
          if (!cancelled) {
            setKind('unsupported');
            setLoading(false);
            setError(false);
          }
          return;
        }

        const { data, error: dlError } = await supabase.storage
          .from(LEAD_MAGNET_ASSETS_BUCKET)
          .download(storagePath);

        if (cancelled) return;

        if (dlError || !data) {
          // Fallback: signed URL (still better than broken public iframe for some browsers).
          const { data: signed, error: signError } = await supabase.storage
            .from(LEAD_MAGNET_ASSETS_BUCKET)
            .createSignedUrl(storagePath, 3600);

          if (cancelled) return;

          if (signError || !signed?.signedUrl) {
            setKind(pdf ? 'pdf' : 'embed');
            setError(true);
            setLoading(false);
            return;
          }

          setKind(pdf ? 'pdf' : 'embed');
          setSrc(signed.signedUrl);
          setLoading(false);
          return;
        }

        // Force PDF MIME — storage often returns application/octet-stream, which breaks Chrome's viewer.
        const blob =
          pdf && data.type !== 'application/pdf'
            ? new Blob([data], { type: 'application/pdf' })
            : data;
        objectUrl = URL.createObjectURL(blob);
        setKind(pdf ? 'pdf' : 'embed');
        setSrc(objectUrl);
        setLoading(false);
        return;
      }

      if (!url) {
        setKind('embed');
        setError(true);
        setLoading(false);
        return;
      }

      // External PDF: try fetch → blob when CORS allows; else iframe direct URL (no sandbox).
      if (pdf) {
        setKind('pdf');
        try {
          const res = await fetch(url, { mode: 'cors' });
          if (!cancelled && res.ok) {
            const blob = await res.blob();
            if (!cancelled) {
              objectUrl = URL.createObjectURL(blob);
              setSrc(objectUrl);
              setLoading(false);
              return;
            }
          }
        } catch {
          // CORS blocked — fall through to direct embed.
        }
        if (!cancelled) {
          setSrc(url);
          setLoading(false);
        }
        return;
      }

      setKind('embed');
      setSrc(toEmbedUrl(url));
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [args.open, args.storagePath, args.fileName, args.fileMime, args.url]);

  return { kind, src, loading, error };
}

function isOfficePreviewable(fileName?: string | null, mime?: string | null): boolean {
  // Only PDF gets blob preview for uploads; other types are unsupported in-panel.
  return isLikelyPdf({ fileName, mime });
}

function toEmbedUrl(url: string): string {
  if (url.includes('docs.google.com/document')) {
    const docIdMatch = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    if (docIdMatch) return `https://docs.google.com/document/d/${docIdMatch[1]}/preview`;
  }
  if (url.includes('docs.google.com/spreadsheets')) {
    const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (idMatch) return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/preview`;
  }
  if (url.includes('docs.google.com/presentation')) {
    const idMatch = url.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
    if (idMatch) return `https://docs.google.com/presentation/d/${idMatch[1]}/preview`;
  }
  if (url.includes('drive.google.com/file/d/')) {
    const idMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  }
  return url;
}
