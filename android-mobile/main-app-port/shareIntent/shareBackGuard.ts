/** Android hardware back: when share flow consumes back (e.g. modal locked), skip history.back(). */

type GuardFn = () => boolean;

let guard: GuardFn | null = null;

export function setShareBackGuard(fn: GuardFn | null) {
  guard = fn;
}

export function tryConsumeShareBack(): boolean {
  if (guard && guard()) return true;
  return false;
}
