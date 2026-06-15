import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'img', 'div', 'span'];
const ALLOWED_ATTR = ['src', 'alt', 'class', 'loading'];

export function looksLikeHtml(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain text for line-clamp previews; preserves paragraph breaks from HTML. */
export function plainTextPreview(value: string | null | undefined, maxLen = 80): string {
  if (!value?.trim()) return '';
  let text = value;
  if (looksLikeHtml(value)) {
    const doc = new DOMParser().parseFromString(value, 'text/html');
    text = doc.body.innerText.replace(/\u00a0/g, ' ');
  }
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen).trimEnd()}…`;
}

export function sanitizeTaskStepDescriptionHtml(html: string): string {
  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
  return cleaned.replace(/\u200B/g, '').trim();
}

export function isDescriptionEmpty(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  const sanitized = sanitizeTaskStepDescriptionHtml(value);
  if (!sanitized) return true;
  const hasImage = /<img\b/i.test(sanitized);
  const textOnly = sanitized
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return !textOnly && !hasImage;
}

export function toEditorHtml(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  if (looksLikeHtml(value)) return value;
  return escapeHtml(value).replace(/\n/g, '<br>');
}

export function finalizeDescriptionForSave(html: string): string | null {
  const sanitized = sanitizeTaskStepDescriptionHtml(html);
  return isDescriptionEmpty(sanitized) ? null : sanitized;
}
