import type { MentionableEmployee } from '../types';

const MENTION_PATTERN = /@([^\s@][^\n@]*?)(?=\s@|\s|$|[.,!?])/g;

export function parseMentionedProfileIds(
  body: string,
  employees: MentionableEmployee[],
): string[] {
  const text = body.trim();
  if (!text || employees.length === 0) return [];

  const byName = new Map<string, string>();
  for (const emp of employees) {
    const nameKey = emp.fullName.trim().toLowerCase();
    if (nameKey) byName.set(nameKey, emp.profileId);
    const emailKey = (emp.email ?? '').trim().toLowerCase();
    if (emailKey) byName.set(emailKey, emp.profileId);
  }

  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION_PATTERN.source, 'g');
  while ((match = re.exec(text)) !== null) {
    const token = (match[1] ?? '').trim().toLowerCase();
    const profileId = byName.get(token);
    if (profileId) found.add(profileId);
  }
  return [...found];
}

export function getActiveMentionQuery(
  text: string,
  caretIndex: number,
): { query: string; start: number } | null {
  const before = text.slice(0, caretIndex);
  const atIndex = before.lastIndexOf('@');
  if (atIndex < 0) return null;
  const between = before.slice(atIndex + 1);
  if (/\s/.test(between)) return null;
  return { query: between, start: atIndex };
}

export function filterMentionCandidates(
  employees: MentionableEmployee[],
  query: string,
): MentionableEmployee[] {
  const q = query.trim().toLowerCase();
  if (!q) return employees.slice(0, 8);
  return employees
    .filter((e) => {
      const name = e.fullName.toLowerCase();
      const email = (e.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    })
    .slice(0, 8);
}

export function insertMention(
  text: string,
  caretIndex: number,
  employee: MentionableEmployee,
): { nextText: string; nextCaret: number } {
  const active = getActiveMentionQuery(text, caretIndex);
  if (!active) {
    const insert = `@${employee.fullName} `;
    const nextText = text.slice(0, caretIndex) + insert + text.slice(caretIndex);
    return { nextText, nextCaret: caretIndex + insert.length };
  }
  const before = text.slice(0, active.start);
  const after = text.slice(caretIndex);
  const insert = `@${employee.fullName} `;
  const nextText = before + insert + after;
  return { nextText, nextCaret: before.length + insert.length };
}

export type CommentBodySegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string };

export function splitCommentBodySegments(body: string): CommentBodySegment[] {
  const segments: CommentBodySegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(MENTION_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: body.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'mention', value: match[1] ?? '' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) segments.push({ type: 'text', value: body.slice(lastIndex) });
  return segments.length > 0 ? segments : [{ type: 'text', value: body }];
}
