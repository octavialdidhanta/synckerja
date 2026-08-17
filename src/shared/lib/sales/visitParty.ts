export type VisitPartyKind = 'lead' | 'client';

export type ParsedVisitParty = {
  kind: VisitPartyKind;
  id: string;
};

const PARTY_KEY_RE = /^(lead|client):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function encodeVisitPartyKey(kind: VisitPartyKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseVisitPartyKey(value: string | null | undefined): ParsedVisitParty | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const match = PARTY_KEY_RE.exec(raw);
  if (!match) return null;
  return {
    kind: match[1].toLowerCase() as VisitPartyKind,
    id: match[2],
  };
}
