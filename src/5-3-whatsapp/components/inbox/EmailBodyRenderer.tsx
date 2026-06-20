import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { formatEmailBodyForDisplay } from '../../utils/formatEmailBodyForDisplay';

const EMAIL_PURIFY_CONFIG: DOMPurify.Config = {
  WHOLE_DOCUMENT: true,
  ADD_ATTR: [
    'target', 'rel', 'class', 'src', 'alt', 'width', 'height', 'style', 'align', 'valign',
    'border', 'cellpadding', 'cellspacing', 'bgcolor', 'colspan', 'rowspan', 'role',
    'data-tracking-control-name', 'data-tracking-will-navigate', 'loading', 'referrerpolicy',
    'itemscope', 'itemtype', 'itemprop', 'link-id', 'aria-hidden', 'lang',
  ],
  ADD_TAGS: [
    'a', 'p', 'div', 'br', 'span', 'strong', 'b', 'em', 'i', 'u',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'hr', 'blockquote', 'center', 'font',
    'html', 'head', 'body', 'meta', 'style', 'title', 'link',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|cid|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

function extractBodyInnerHtml(html: string): string {
  const match = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return match?.[1]?.trim() || html;
}

function sanitizeEmailHtml(body: string): string {
  const formatted = formatEmailBodyForDisplay(body);
  const sanitized = DOMPurify.sanitize(formatted, EMAIL_PURIFY_CONFIG);
  if (/<(?:html|body)\b/i.test(sanitized)) {
    return extractBodyInnerHtml(sanitized);
  }
  return sanitized;
}

interface EmailBodyRendererProps {
  body: string;
  className?: string;
}

export function EmailBodyRenderer({ body, className }: EmailBodyRendererProps) {
  const html = useMemo(() => sanitizeEmailHtml(body), [body]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
