export const TOOL_RATE_LIMIT = 60;
export const TOOL_RATE_WINDOW_MS = 5 * 60 * 1000;

export type ToolRateState = {
  windowStart: string;
  callCount: number;
  denialLogged: boolean;
};

export type ToolRateDecision = {
  allowed: boolean;
  recordDenial: boolean;
  state: ToolRateState;
};

export function isAccessRevoked(iat: number, revokedAt: string | null): boolean {
  if (!revokedAt) return false;
  const cutoffSeconds = Math.floor(new Date(revokedAt).getTime() / 1000);
  if (!Number.isFinite(cutoffSeconds)) return true;
  return iat <= cutoffSeconds;
}

export function decideToolRate(state: ToolRateState | null, now: Date): ToolRateDecision {
  const nowIso = now.toISOString();
  if (!state || new Date(state.windowStart).getTime() <= now.getTime() - TOOL_RATE_WINDOW_MS) {
    return {
      allowed: true,
      recordDenial: false,
      state: { windowStart: nowIso, callCount: 1, denialLogged: false },
    };
  }
  if (state.callCount < TOOL_RATE_LIMIT) {
    return {
      allowed: true,
      recordDenial: false,
      state: { ...state, callCount: state.callCount + 1 },
    };
  }
  if (state.denialLogged) {
    return { allowed: false, recordDenial: false, state };
  }
  return {
    allowed: false,
    recordDenial: true,
    state: { ...state, denialLogged: true },
  };
}
