import DOMPurify from 'dompurify';

/** A URL token, plus the same token continued after a line break. */
const URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^`[\]]+(?:\r?\n[^\s<>"'{}|\\^`[\]]+)*/gi;

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'img', 'div', 'span', 'a', 'h1', 'h2', 'h3'];
const ALLOWED_ATTR = ['src', 'alt', 'class', 'loading', 'href', 'target', 'rel'];

export type TextUrlSegment = { type: 'text' | 'url'; value: string };

function trimTrailingUrlPunctuation(url: string): { url: string; trailing: string } {
  let trimmed = url;
  let trailing = '';
  while (trimmed.length > 0 && /[.,;:!?)]+$/.test(trimmed)) {
    const match = trimmed.match(/([.,;:!?)]+)$/);
    if (!match) break;
    trailing = match[1] + trailing;
    trimmed = trimmed.slice(0, -match[1].length);
  }
  return { url: trimmed, trailing };
}

export function isSafeDescriptionHref(href: string): boolean {
  const value = href.trim();
  if (!value) return false;
  if (/^mailto:/i.test(value)) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Split plain text into text / URL segments for clickable rendering. */
export function splitTextWithUrls(text: string): TextUrlSegment[] {
  if (!text) return [];
  const segments: TextUrlSegment[] = [];
  const re = new RegExp(URL_REGEX.source, 'gi');
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const collapsed = match[0].replace(/\r?\n/g, '');
    const { url, trailing } = trimTrailingUrlPunctuation(collapsed);
    if (url) segments.push({ type: 'url', value: url });
    if (trailing) segments.push({ type: 'text', value: trailing });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}

function normalizeAnchorsInHtmlRoot(root: HTMLElement): void {
  root.querySelectorAll('a').forEach((anchor) => {
    const href = anchor.getAttribute('href') ?? '';
    if (!isSafeDescriptionHref(href)) {
      const text = anchor.textContent ?? '';
      anchor.replaceWith(document.createTextNode(text));
      return;
    }
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
    anchor.spellcheck = false;
    anchor.classList.add('cursor-pointer', 'text-primary', 'underline', 'break-all', 'hover:text-primary/90');
  });
}

type LinkPiece =
  | { kind: 'text'; node: Text; start: number; end: number }
  | { kind: 'br'; node: HTMLBRElement; start: number; end: number };

function isInsideAnchor(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  return Boolean(el?.closest('a'));
}

function collectLinkPieces(root: HTMLElement): { text: string; pieces: LinkPiece[] } {
  const pieces: LinkPiece[] = [];
  let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (isInsideAnchor(node)) continue;
    if (node instanceof HTMLBRElement) {
      const start = text.length;
      text += '\n';
      pieces.push({ kind: 'br', node, start, end: text.length });
      continue;
    }
    if (node instanceof Text) {
      const value = node.textContent ?? '';
      if (!value) continue;
      const start = text.length;
      text += value;
      pieces.push({ kind: 'text', node, start, end: text.length });
    }
  }
  return { text, pieces };
}

function styleDescriptionAnchor(anchor: HTMLAnchorElement, href: string) {
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.spellcheck = false;
  anchor.className = 'cursor-pointer text-primary underline break-all hover:text-primary/90';
  anchor.textContent = href;
}

function replacePiecesWithAnchor(pieces: LinkPiece[], start: number, end: number, href: string) {
  const overlapping = pieces.filter((piece) => piece.end > start && piece.start < end);
  if (overlapping.length === 0) return;
  const anchor = document.createElement('a');
  styleDescriptionAnchor(anchor, href);
  const first = overlapping[0];
  const last = overlapping[overlapping.length - 1];

  let prefixNode: Text | null = null;
  let suffixNode: Text | null = null;

  if (first.kind === 'text' && first.start < start) {
    const original = first.node.textContent ?? '';
    first.node.textContent = original.slice(0, start - first.start);
    prefixNode = first.node;
    if (first === last && first.end > end) {
      suffixNode = document.createTextNode(original.slice(end - first.start));
    }
  } else if (first === last && first.kind === 'text' && first.end > end) {
    suffixNode = document.createTextNode((first.node.textContent ?? '').slice(end - first.start));
  }

  if (last !== first && last.kind === 'text' && last.end > end) {
    suffixNode = document.createTextNode((last.node.textContent ?? '').slice(end - last.start));
  }

  if (prefixNode) prefixNode.after(anchor);
  else first.node.parentNode?.insertBefore(anchor, first.node);
  if (suffixNode) anchor.after(suffixNode);

  for (const piece of overlapping) {
    if (piece.node === prefixNode) continue;
    piece.node.remove();
  }
}

function linkifyBareUrlsInHtmlRoot(root: HTMLElement): void {
  for (let guard = 0; guard < 50; guard += 1) {
    const { text, pieces } = collectLinkPieces(root);
    if (!text || pieces.length === 0) return;
    const match = new RegExp(URL_REGEX.source, 'i').exec(text);
    if (!match || match.index == null) return;
    const collapsed = match[0].replace(/\r?\n/g, '');
    const { url } = trimTrailingUrlPunctuation(collapsed);
    if (!url || !isSafeDescriptionHref(url)) return;
    const before = root.innerHTML;
    const trailing = collapsed.length - url.length;
    replacePiecesWithAnchor(pieces, match.index, match.index + match[0].length - trailing, url);
    if (root.innerHTML === before) return;
  }
}

/** Turn bare URLs in an editor or view root into links, including URLs split by line breaks. */
export function linkifyDescriptionElement(root: HTMLElement): boolean {
  const before = root.innerHTML;
  linkifyBareUrlsInHtmlRoot(root);
  normalizeAnchorsInHtmlRoot(root);
  return root.innerHTML !== before;
}

function enrichDescriptionHtml(html: string): string {
  if (!html.trim() || typeof document === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return html;
  linkifyBareUrlsInHtmlRoot(root);
  normalizeAnchorsInHtmlRoot(root);
  return root.innerHTML;
}

export function linkifyPlainTextToHtml(text: string): string {
  const segments = splitTextWithUrls(text);
  return segments
    .map((seg) => {
      if (seg.type === 'url' && isSafeDescriptionHref(seg.value)) {
        const href = escapeHtml(seg.value);
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" spellcheck="false" class="cursor-pointer text-primary underline break-all hover:text-primary/90">${href}</a>`;
      }
      return escapeHtml(seg.value).replace(/\n/g, '<br>');
    })
    .join('');
}

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

/** Sanitize stored HTML and make links clickable in a new tab. */
export function prepareTaskStepDescriptionHtmlForView(html: string): string {
  const sanitized = sanitizeTaskStepDescriptionHtml(html);
  if (!sanitized) return '';
  return enrichDescriptionHtml(sanitized);
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
