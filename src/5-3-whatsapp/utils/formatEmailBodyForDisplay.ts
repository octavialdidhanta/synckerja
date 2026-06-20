function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, '&#39;');
}

function shortUrlLabel(url: string, maxLen = 48): string {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    const query = u.search ? `${u.search.slice(0, 20)}${u.search.length > 20 ? '…' : ''}` : '';
    const label = `${u.hostname}${path}${query}`;
    return label.length > maxLen ? `${label.slice(0, maxLen - 1)}…` : label;
  } catch {
    return url.length > maxLen ? `${url.slice(0, maxLen - 1)}…` : url;
  }
}

function normalizePlainBody(raw: string): string {
  return decodeHtmlEntities(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\u2026/g, '…')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const n = parseInt(code, 10);
      if (Number.isNaN(n)) return '';
      try {
        return String.fromCodePoint(n);
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      const n = parseInt(hex, 16);
      if (Number.isNaN(n)) return '';
      try {
        return String.fromCodePoint(n);
      } catch {
        return '';
      }
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

function stripEmailPreviewPadding(text: string): string {
  return text
    .replace(/(?:&#8199;|&#65279;|&#847;|\u200c|\u200b|\ufeff|\u034f|\u2007|\u00a0|\s)+/g, ' ')
    .replace(/^\d+\s*$/gm, '')
    .replace(/\*{5,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function joinBrokenUrlLines(text: string): string {
  return text
    .replace(/https?:\/\/\n(?=[^\s/])/gi, '')
    .replace(/\n(?=vercel\.com|supabase\.com|linkedin\.com|hostinger\.com|google\.com)/gi, '');
}

function friendlyLinkLabel(url: string): string {
  try {
    const u = new URL(url);
    if (/linkedin\.com\/help/i.test(url)) return 'Bantuan LinkedIn';
    if (/request-password-reset|uas\/login/i.test(url)) return 'Ubah kata sandi';
    if (/linkedin\.com\/e\/v2/i.test(url)) return 'Buka di LinkedIn';
    if (/linkedin\.com\/comm\/feed/i.test(url)) return 'Lihat di LinkedIn';
    return shortUrlLabel(url);
  } catch {
    return shortUrlLabel(url);
  }
}

function linkifyPlainSegment(text: string): string {
  const withAngles = text.replace(/<(https?:\/\/[^>\s]+)>/gi, '$1');
  const urlPattern = /(https?:\/\/[^\s<>"{}|\\^`[\]()]+)/gi;
  let result = '';
  let lastIndex = 0;
  for (const match of withAngles.matchAll(urlPattern)) {
    const url = match[0].replace(/[.,;:!?)]+$/, '');
    const index = match.index ?? 0;
    result += escapeHtml(withAngles.slice(lastIndex, index));
    result += `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">${escapeHtml(friendlyLinkLabel(url))}</a>`;
    lastIndex = index + match[0].length;
  }
  result += escapeHtml(withAngles.slice(lastIndex));
  return result;
}

const GOOGLE_LOGO_URL =
  'https://www.gstatic.com/images/branding/googlelogo/2x/googlelogo_color_74x24dp.png';

function extractAngleBracketUrl(text: string): string | null {
  const match = /<((?:https?:\/\/)[^>\s]+)>/.exec(text);
  return match?.[1]?.trim() ?? null;
}

/** Google security alerts stored as plain text (Gmail text/plain part). */
function formatGoogleSecurityPlain(body: string): string | null {
  if (/<(?:html|!doctype)\b/i.test(body)) return null;
  if (!/\[image:\s*Google\]/i.test(body) && !/myaccount\.google\.com/i.test(body)) return null;

  const normalized = stripGenericEmailFooter(normalizePlainBody(body));
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);
  const contentLines = lines.filter((l) => !/^\[image:/i.test(l));
  if (contentLines.length === 0) return null;

  const title = contentLines[0] ?? 'Notifikasi keamanan';
  const emailLine = contentLines.find((l) => /@/.test(l) && !/^https?:\/\//i.test(l)) ?? '';
  const ctaUrl =
    extractAngleBracketUrl(normalized) ??
    contentLines.map((l) => (l.match(/^(https?:\/\/\S+)/i)?.[1] ?? null)).find(Boolean) ??
    null;

  const bodyText = contentLines
    .slice(1)
    .filter(
      (l) =>
        l !== emailLine &&
        !/^Periksa aktivitas/i.test(l) &&
        !/^https?:\/\//i.test(l) &&
        !/^<https?:\/\//i.test(l) &&
        !/^Jangan balas email ini/i.test(l),
    )
    .join(' ')
    .trim();

  return `
    <div class="mx-auto max-w-md rounded-lg border border-[#dadce0] bg-white p-6 text-center shadow-sm">
      <img src="${escapeAttr(GOOGLE_LOGO_URL)}" width="74" height="24" alt="Google" class="mx-auto mb-4 block" loading="lazy" referrerpolicy="no-referrer" />
      <h3 class="text-xl font-normal text-[rgba(0,0,0,0.87)] leading-8 border-b border-[#dadce0] pb-4 mb-4">${escapeHtml(title)}</h3>
      ${emailLine ? `<p class="text-sm text-[rgba(0,0,0,0.87)] mb-4">${escapeHtml(emailLine)}</p>` : ''}
      ${bodyText ? `<p class="text-sm leading-5 text-[rgba(0,0,0,0.87)] mb-6">${linkifyPlainSegment(bodyText)}</p>` : ''}
      ${
        ctaUrl
          ? `<a href="${escapeAttr(ctaUrl)}" target="_blank" rel="noopener noreferrer" class="inline-block rounded-full bg-[#0b57d0] px-6 py-3 text-sm font-medium text-white no-underline hover:bg-[#0842a0]">Periksa aktivitas</a>`
          : ''
      }
    </div>
  `;
}

/** Remove standard email footers (LinkedIn, marketing, legal). */
function stripGenericEmailFooter(text: string): string {
  const markers = [
    /(?:\n|^)-{5,}/,
    /(?:\n|^)_{5,}/,
    /(?:\n|^)Email ini ditujukan untuk /i,
    /(?:\n|^)This email was intended for /i,
    /(?:\n|^)Pelajari mengapa kami menyertakan/i,
    /(?:\n|^)Learn why we included this/i,
    /(?:\n|^)Anda menerima email /i,
    /(?:\n|^)You are receiving .* email/i,
    /(?:\n|^)Bantuan:\s*https?:\/\//i,
    /(?:\n|^)Help:\s*https?:\/\//i,
    /(?:\n|^)©\s*20\d{2}/,
    /(?:\n|^)LinkedIn dan logo LinkedIn/i,
    /(?:\n|^)Lihat lainnya di LinkedIn:/i,
    /(?:\n|^)View more on LinkedIn:/i,
    /(?:\n|^)Berhenti berlangganan/i,
    /(?:\n|^)Unsubscribe/i,
    /(?:\n|^)Jangan balas email ini/i,
    /(?:\n|^)Anda menerima email ini sebagai pemberitahuan/i,
    /(?:\n|^)You received this email to notify/i,
  ];
  let cut = text.length;
  for (const marker of markers) {
    const idx = text.search(marker);
    if (idx !== -1 && idx < cut) cut = idx;
  }
  return text.slice(0, cut).trim();
}

function formatLinkedInSecurityPlain(body: string): string | null {
  if (!/login ke akun LinkedIn|verifikasi perangkat|harap verifikasi|two_step_verification|device baru/i.test(body)) {
    return null;
  }
  const main = stripGenericEmailFooter(normalizePlainBody(body));
  if (!main) return null;

  const paragraphs = main
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const htmlParts = paragraphs.map((p) => {
    if (/^Waktu dan tempat kejadian:/i.test(p)) {
      const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);
      const rows = lines.slice(1).map((line) => `<li class="text-sm text-slate-700">${linkifyPlainSegment(line)}</li>`).join('');
      return `<div class="mt-3 rounded-md bg-slate-50 p-3"><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(lines[0] ?? 'Detail')}</p><ul class="mt-2 space-y-1 list-none pl-0">${rows}</ul></div>`;
    }
    return `<p class="my-2 leading-relaxed text-slate-800">${linkifyPlainSegment(p.replace(/\n/g, ' '))}</p>`;
  });

  return `<div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">${htmlParts.join('')}</div>`;
}

function formatLinkedInPlainEmail(body: string): string | null {
  if (/<!DOCTYPE html/i.test(body) || /<html[\s>]/i.test(body)) return null;

  const normalized = stripGenericEmailFooter(normalizePlainBody(body));
  if (!/linkedin/i.test(normalized) && !/membagikan posting:/i.test(normalized)) return null;

  const digest = formatLinkedInDigestPlain(body);
  if (digest) return digest;

  const security = formatLinkedInSecurityPlain(body);
  if (security) return security;

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !/^https?:\/\//i.test(p))
    .slice(0, 12);

  if (paragraphs.length === 0) return null;

  return `<div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-2">${paragraphs
    .map((p) => `<p class="leading-relaxed text-slate-800">${linkifyPlainSegment(p.replace(/\n/g, ' '))}</p>`)
    .join('')}</div>`;
}

/** Plain text snapshot for matching heuristics (subject/body guards). */
export function emailBodyPlainTextForMatch(body: string): string {
  if (!body?.trim()) return '';
  const trimmed = body.trim();
  if (/^<!DOCTYPE html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    return stripHtmlToPlainForFormat(body);
  }
  return stripEmailPreviewPadding(normalizePlainBody(body));
}

function stripHtmlToPlainForFormat(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripLinkedInNetworkFooter(text: string): string {
  return stripGenericEmailFooter(text);
}

function truncateEntryRest(rest: string): string {
  let out = rest;
  const cutMarkers = [
    /\nLihat lainnya di LinkedIn:/i,
    /\nView more on LinkedIn:/i,
    /\n-{5,}/,
    /\nEmail ini ditujukan untuk /i,
    /\nPelajari mengapa kami menyertakan/i,
    /\nAnda menerima email/i,
  ];
  for (const marker of cutMarkers) {
    const idx = out.search(marker);
    if (idx !== -1) out = out.slice(0, idx);
  }
  return out.trim();
}

function extractLinkedInReadLink(rest: string): { link: string | null; restWithoutLink: string } {
  let remaining = rest;
  const patterns = [
    /Baca selengkapnya:\s*(https?:\/\/[^\s<\n]+)/i,
    /Read more:\s*(https?:\/\/[^\s<\n]+)/i,
    /Lihat lainnya di LinkedIn:\s*(https?:\/\/[^\s<\n]+)/i,
    /View more on LinkedIn:\s*(https?:\/\/[^\s<\n]+)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(remaining);
    if (match?.[1]) {
      const link = match[1].replace(/[.,;:!?)]+$/, '');
      remaining = remaining.replace(match[0], '').trim();
      return { link, restWithoutLink: remaining };
    }
  }
  return { link: null, restWithoutLink: remaining };
}

/** LinkedIn network digest stored as plain text (no HTML/images in DB). */
function formatLinkedInDigestPlain(body: string): string | null {
  if (!/membagikan posting:/i.test(body)) return null;

  const normalized = stripLinkedInNetworkFooter(normalizePlainBody(body));
  const entryPattern =
    /([\p{L}][\p{L}\p{M}\s.'-]{1,60})membagikan posting:\s*([\s\S]*?)(?=(?:[\p{L}][\p{L}\p{M}\s.'-]{1,60})membagikan posting:|$)/gu;

  const cards: string[] = [];
  for (const match of normalized.matchAll(entryPattern)) {
    const author = match[1]?.trim() ?? '';
    let rest = truncateEntryRest((match[2] ?? '').trim());
    if (!author || !rest) continue;

    const { link, restWithoutLink } = extractLinkedInReadLink(rest);
    rest = restWithoutLink;

    const engageMatch = /(SUKA[\s\S]*?Komentar)/i.exec(rest);
    const engagement = engageMatch?.[1]?.trim() ?? '';
    if (engageMatch) {
      rest = rest.replace(engageMatch[0], '').trim();
    }

    const content = rest
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !/^https?:\/\//i.test(line))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    cards.push(`
      <div class="rounded-lg border border-slate-200 bg-white p-4 mb-3 last:mb-0 shadow-sm">
        <p class="font-semibold text-[#0a66c2]">${escapeHtml(author)}</p>
        ${content ? `<p class="mt-2 text-sm leading-relaxed text-slate-800">${escapeHtml(content)}</p>` : ''}
        ${engagement ? `<p class="mt-2 text-xs font-medium text-slate-500">${escapeHtml(engagement)}</p>` : ''}
        ${
          link
            ? `<a href="${escapeAttr(link)}" target="_blank" rel="noopener noreferrer" class="mt-3 inline-flex w-full items-center justify-center rounded-full border border-[#0a66c2] px-4 py-2 text-sm font-semibold text-[#0a66c2] no-underline hover:bg-blue-50">Baca selengkapnya</a>`
            : ''
        }
      </div>
    `);
  }

  if (cards.length === 0) return null;
  return `<div class="space-y-0 bg-slate-100 rounded-lg p-2">${cards.join('')}</div>`;
}

function formatHostingerWelcomePlain(body: string): string | null {
  if (/<html/i.test(body)) return null;
  const cleaned = stripGenericEmailFooter(stripEmailPreviewPadding(normalizePlainBody(body)));
  if (!/welcome to hostinger email/i.test(cleaned)) return null;

  const titleMatch = /Three\.\s*Two\.\s*Online/i.exec(cleaned);
  const title = titleMatch?.[0] ?? 'Welcome to Hostinger Email!';
  const main = cleaned
    .replace(/welcome to hostinger email!/i, '')
    .replace(/three\.\s*two\.\s*online/i, '')
    .trim();

  return `
    <div class="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wide text-violet-700">Hostinger Email</p>
      <h3 class="mt-2 text-xl font-semibold text-slate-900">${escapeHtml(title)}</h3>
      <p class="mt-4 text-sm leading-relaxed text-slate-700">${linkifyPlainSegment(main.replace(/\n+/g, ' '))}</p>
    </div>
  `;
}

/** Break dense marketing plain text into readable blocks. */
function preprocessPlainEmailBody(raw: string): string {
  let text = stripEmailPreviewPadding(normalizePlainBody(raw));
  if (!text) return '';

  text = joinBrokenUrlLines(text);
  text = text.replace(/\((https?:\/\/[^)\s]+)\)/g, '\n$1\n');
  text = text.replace(/([.!?])\s+(https?:\/\/)/g, '$1\n\n$2');
  text = text.replace(/\s+(https?:\/\/)/g, '\n$1\n');
  text = text.replace(/([\p{L}][\p{L}\p{M}\s.'-]{1,60})membagikan posting:/gu, '\n\n$1membagikan posting:\n');
  text = text.replace(/\s+(Baca selengkapnya:)/gi, '\n\n$1\n');
  text = text.replace(/\s+(Read more:)/gi, '\n\n$1\n');
  text = text.replace(/\s+(SUKA[\s\p{L}]*\s*\d+[\s,]*\d*\s*Komentar)/giu, '\n\n$1\n');
  text = text.replace(/[ \t]+/g, ' ');
  return text.trim();
}

function looksLikeHtmlBody(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  if (/^<!DOCTYPE html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return true;
  if (/^<(table|div|center|body|head|tbody)\b/i.test(trimmed)) return true;
  const tagCount = (trimmed.match(/<(table|div|td|tr|p|br|span|img|tbody|thead)\b/gi) ?? []).length;
  return tagCount >= 8;
}

/** Format plain-text email body into readable HTML paragraphs. */
export function formatPlainEmailBodyHtml(body: string): string {
  const linkedIn = formatLinkedInPlainEmail(body);
  if (linkedIn) return linkedIn;

  const cleaned = stripGenericEmailFooter(normalizePlainBody(body));
  const preprocessed = preprocessPlainEmailBody(cleaned);
  if (!preprocessed) return '';

  const blocks = preprocessed.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        return `<p class="my-2 leading-relaxed">${linkifyPlainSegment(lines[0] ?? block)}</p>`;
      }
      return `<div class="my-3 space-y-1 leading-relaxed">${lines
        .map((line) => {
          if (/^https?:\/\//i.test(line)) {
            return `<p><a href="${escapeAttr(line)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline break-all">${escapeHtml(shortUrlLabel(line))}</a></p>`;
          }
          return `<p>${linkifyPlainSegment(line)}</p>`;
        })
        .join('')}</div>`;
    })
    .join('');
}

function isRichHtmlEmail(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  if (/^<!DOCTYPE html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return true;
  if (/<!DOCTYPE html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) return true;
  if (/<img[^>]+(?:src|data-src)=/i.test(trimmed) && /<table/i.test(trimmed)) return true;
  if (/gstatic\.com\/images\/branding\/googlelogo|googleusercontent\.com/i.test(trimmed) && /<table/i.test(trimmed)) {
    return true;
  }
  if (/licdn\.com|linkedin\.com\/emimp|email_network_conversations/i.test(trimmed) && /<table/i.test(trimmed)) {
    return true;
  }
  const tagCount = (trimmed.match(/<(table|td|tr|div|img)\b/gi) ?? []).length;
  return tagCount >= 12 && trimmed.length > 1500;
}

/** Choose HTML vs plain formatter for email thread display. */
export function formatEmailBodyForDisplay(body: string): string {
  if (!body?.trim()) return '';
  const trimmed = body.trim();

  if (isRichHtmlEmail(trimmed)) return trimmed;

  const plainCandidate = stripHtmlToPlainForFormat(trimmed);
  const googleFormatted = formatGoogleSecurityPlain(plainCandidate || trimmed);
  if (googleFormatted) return googleFormatted;

  const hostingerFormatted = formatHostingerWelcomePlain(plainCandidate || trimmed);
  if (hostingerFormatted) return hostingerFormatted;

  const linkedInFormatted = formatLinkedInPlainEmail(plainCandidate || trimmed);
  if (linkedInFormatted) return linkedInFormatted;

  if (looksLikeHtmlBody(trimmed)) return trimmed;
  return formatPlainEmailBodyHtml(plainCandidate || trimmed);
}
