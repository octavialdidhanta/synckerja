export type BriefLayoutMode = 'storyline' | 'storyboard';

const STORAGE_KEY = 'synckerja.brief.layoutMode';

function isBriefLayoutMode(value: string | null): value is BriefLayoutMode {
  return value === 'storyline' || value === 'storyboard';
}

export function readBriefLayoutMode(): BriefLayoutMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isBriefLayoutMode(stored)) return stored;
  } catch {
    // ignore (private mode / blocked storage)
  }
  return 'storyline';
}

export function writeBriefLayoutMode(mode: BriefLayoutMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore (private mode / blocked storage)
  }
}
