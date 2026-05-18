function countPlaceholders(text: string): number {
  return (text.match(/\{\{[^}]+\}\}/g) ?? []).length;
}

/** Human-readable template follow-up preview for leads history. */
export function renderTemplateBodyPreview(
  templateName: string,
  templateComponents: unknown[] | null | undefined,
  parameterValues: unknown,
): string {
  const params = Array.isArray(parameterValues) ? parameterValues.map((x) => String(x ?? '').trim()) : [];
  let idx = 0;
  const parts: string[] = [`[Template: ${templateName}]`];
  if (!Array.isArray(templateComponents)) return parts.join('\n');
  for (const raw of templateComponents) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const c = raw as Record<string, unknown>;
    const type = String(c.type ?? '').toUpperCase();
    if (type === 'HEADER') {
      const fmt = String(c.format ?? 'TEXT').toUpperCase();
      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(fmt)) {
        parts.push(`[${fmt}]`);
        const n = countPlaceholders(String(c.text ?? ''));
        for (let i = 0; i < n; i++) idx++;
        continue;
      }
      let text = String(c.text ?? '');
      const n = countPlaceholders(text);
      for (let i = 0; i < n; i++) {
        const val = params[idx++] ?? '—';
        text = text.replace(/\{\{[^}]+\}\}/, val);
      }
      if (text.trim()) parts.push(text.trim());
    } else if (type === 'BODY') {
      let text = String(c.text ?? '');
      const n = countPlaceholders(text);
      for (let i = 0; i < n; i++) {
        const val = params[idx++] ?? '—';
        text = text.replace(/\{\{[^}]+\}\}/, val);
      }
      if (text.trim()) parts.push(text.trim());
    }
  }
  return parts.join('\n').slice(0, 4090);
}
