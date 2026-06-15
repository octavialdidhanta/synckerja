import { syncBrickBankMutations } from './brickBankApi';

const inflightKeys = new Set<string>();
const completedKeys = new Set<string>();

export function parseBrickSyncCooldownSec(message: string): number | null {
  const waitMatch = message.match(/tunggu (\d+) detik/i);
  if (!waitMatch) return null;
  const sec = Number(waitMatch[1]);
  return Number.isFinite(sec) && sec > 0 ? sec : null;
}

function oauthReturnSyncKey(organizationId: string, oauthNonce: string | null): string {
  const nonce = oauthNonce?.trim() || 'legacy';
  return `${organizationId}:${nonce}`;
}

export type BrickOAuthReturnSyncResult =
  | { status: 'skipped' }
  | { status: 'ok'; result: Awaited<ReturnType<typeof syncBrickBankMutations>> };

/** Post-OAuth auto-sync: dedupe Strict Mode double-mount; bypass 60s cooldown once. */
export async function runBrickOAuthReturnSync(
  organizationId: string,
  oauthNonce?: string | null,
): Promise<BrickOAuthReturnSyncResult> {
  const key = oauthReturnSyncKey(organizationId, oauthNonce ?? null);
  if (completedKeys.has(key) || inflightKeys.has(key)) {
    return { status: 'skipped' };
  }

  inflightKeys.add(key);
  try {
    const result = await syncBrickBankMutations(organizationId, { skipRateLimit: true });
    completedKeys.add(key);
    return { status: 'ok', result };
  } finally {
    inflightKeys.delete(key);
  }
}
