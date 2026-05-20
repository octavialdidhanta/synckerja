import { supabase } from '@/shared/lib/supabaseClient';

export const INVOICE_TEMPLATE_LOGO_BUCKET = 'invoice-template-logos';

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const IMAGE_LOAD_TIMEOUT_MS = 30_000;
const MAX_PDF_LOGO_PX = 800;
const MAX_PDF_SIGNATURE_PX = 400;

/** Public URL for a stored template logo path (bucket is public). */
export function getInvoiceTemplateLogoPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(INVOICE_TEMPLATE_LOGO_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Resolves DB path or legacy full URL to a fetchable URL for invoice preview/PDF.
 */
export function resolveInvoiceTemplateLogoRef(
  logoRef: string | null | undefined,
): string | undefined {
  const ref = (logoRef ?? '').trim();
  if (!ref) return undefined;
  if (ref.startsWith('data:') || ref.startsWith('http://') || ref.startsWith('https://')) {
    return ref;
  }
  return getInvoiceTemplateLogoPublicUrl(ref);
}

/** Resolves logo or signature storage path to a fetchable URL. */
export function resolveInvoiceTemplateAssetRef(
  assetRef: string | null | undefined,
): string | undefined {
  return resolveInvoiceTemplateLogoRef(assetRef);
}

/** Extract storage object path from a public Supabase URL, or return path if already relative. */
export function invoiceTemplateStoragePathFromRef(ref: string): string | null {
  const trimmed = ref.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;
  const marker = `/storage/v1/object/public/${INVOICE_TEMPLATE_LOGO_BUCKET}/`;
  if (trimmed.includes(marker)) {
    const idx = trimmed.indexOf(marker);
    return decodeURIComponent(trimmed.slice(idx + marker.length).split('?')[0] ?? '');
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && trimmed.includes('/')) {
    return trimmed;
  }
  return null;
}

async function uploadInvoiceTemplateImage(
  organizationId: string,
  file: File,
  subfolder: 'invoice-templates' | 'invoice-template-signatures',
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('invalid_image_type');
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error('image_too_large');
  }

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : 'png';
  const path = `${organizationId}/${subfolder}/${Date.now()}.${safeExt}`;

  const { error } = await supabase.storage.from(INVOICE_TEMPLATE_LOGO_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) throw error;
  return path;
}

/** Upload logo; returns storage path `{organizationId}/invoice-templates/{timestamp}.{ext}`. */
export async function uploadInvoiceTemplateLogo(
  organizationId: string,
  file: File,
): Promise<string> {
  return uploadInvoiceTemplateImage(organizationId, file, 'invoice-templates');
}

/** Upload stamp/signature; returns storage path `{organizationId}/invoice-template-signatures/...`. */
export async function uploadInvoiceTemplateSignature(
  organizationId: string,
  file: File,
): Promise<string> {
  return uploadInvoiceTemplateImage(organizationId, file, 'invoice-template-signatures');
}

/**
 * Load image for jsPDF. Transparent PNG/WebP areas become black if flattened to JPEG
 * without a background — we composite on white first (invoice paper).
 */
export async function loadInvoiceImageForPdf(
  imageUrl: string | undefined,
  maxPx: number = MAX_PDF_LOGO_PX,
): Promise<string | undefined> {
  const url = (imageUrl ?? '').trim();
  if (!url) return undefined;

  try {
    let blob: Blob;
    if (url.startsWith('data:')) {
      const res = await fetch(url);
      blob = await res.blob();
    } else {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return undefined;
      blob = await res.blob();
    }
    return await withTimeout(blobToPdfDataUrl(blob, maxPx), IMAGE_LOAD_TIMEOUT_MS);
  } catch {
    return undefined;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('image load timeout')), ms);
    promise
      .then((v) => {
        window.clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        window.clearTimeout(timer);
        reject(e);
      });
  });
}

function blobToPdfDataUrl(blob: Blob, maxPx: number): Promise<string> {
  const jpegQuality = maxPx <= MAX_PDF_SIGNATURE_PX ? 0.82 : 0.9;
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        let w = Math.max(1, img.naturalWidth);
        let h = Math.max(1, img.naturalHeight);
        const scale = Math.min(1, maxPx / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas unavailable'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const isJpeg =
          blob.type === 'image/jpeg' || blob.type === 'image/jpg';
        resolve(
          isJpeg
            ? canvas.toDataURL('image/jpeg', jpegQuality)
            : canvas.toDataURL('image/png'),
        );
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('image decode failed'));
    };
    img.src = objectUrl;
  });
}
