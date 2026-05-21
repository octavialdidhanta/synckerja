/** Survey invite sent via Meta only; agents must not see or copy the public survey URL in inbox UI. */

const SURVEY_PUBLIC_URL_PATTERN = /https?:\/\/[^\s)\]]+\/s\/[A-Za-z0-9_-]+/gi;

export function parseMessageRawMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function isSystemCustomerSurveyMessage(raw: unknown): boolean {
  const meta = parseMessageRawMetadata(raw);
  return meta?.system_customer_survey === true;
}

/** Remove public survey URLs from text (legacy rows may still store full outbound body). */
export function stripSurveyLinksFromText(text: string): string {
  return text.replace(SURVEY_PUBLIC_URL_PATTERN, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function agentFacingSurveyBody(
  body: string | null | undefined,
  raw: unknown,
): string {
  if (!isSystemCustomerSurveyMessage(raw)) {
    return (body ?? '').trim();
  }
  return stripSurveyLinksFromText(body ?? '');
}
