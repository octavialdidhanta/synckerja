/** Web build: optional back-navigation guard hook (no-op unless wired by mobile shell). */
type ShareBackGuardFn = () => boolean;

let activeGuard: ShareBackGuardFn | null = null;

export function setShareBackGuard(fn: ShareBackGuardFn | null): void {
  activeGuard = fn;
}

export function runShareBackGuard(): boolean {
  return activeGuard?.() ?? false;
}
