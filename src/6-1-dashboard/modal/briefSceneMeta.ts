/**
 * Per-scene metadata for Brief Content (character binding, etc.).
 * Stored as HTML comment so table markdown templates stay intact.
 */

export interface BriefSceneMeta {
  /** Body row index (0-based). */
  row: number;
  /** Digital asset character ids bound to this scene (multi-character). */
  characterIds: string[];
}

const SCENE_META_COMMENT_RE =
  /<!--\s*synckerja-brief-scene-meta:(\[[\s\S]*?\])\s*-->/;

function normalizeCharacterIds(item: Partial<BriefSceneMeta> & { characterId?: unknown }): string[] {
  if (Array.isArray(item.characterIds)) {
    return [
      ...new Set(
        item.characterIds
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          .map((id) => id.trim()),
      ),
    ];
  }
  // Backward compat: single characterId from earlier schema
  if (typeof item.characterId === 'string' && item.characterId.trim()) {
    return [item.characterId.trim()];
  }
  return [];
}

export function parseBriefSceneMetaFromMarkdown(markdown: string): BriefSceneMeta[] {
  const match = SCENE_META_COMMENT_RE.exec(markdown);
  if (!match?.[1]) return [];
  try {
    const parsed = JSON.parse(match[1]) as Array<Partial<BriefSceneMeta> & { characterId?: unknown }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        row: Math.max(0, Number(item.row) || 0),
        characterIds: normalizeCharacterIds(item),
      }))
      .filter((item) => item.characterIds.length > 0);
  } catch {
    return [];
  }
}

export function getSceneCharacterIds(
  meta: BriefSceneMeta[],
  rowIndex: number,
): string[] {
  return meta.find((m) => m.row === rowIndex)?.characterIds ?? [];
}

export function setSceneCharacterIds(
  meta: BriefSceneMeta[],
  rowIndex: number,
  characterIds: string[],
): BriefSceneMeta[] {
  const without = meta.filter((m) => m.row !== rowIndex);
  const unique = [
    ...new Set(
      characterIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()),
    ),
  ];
  if (unique.length === 0) return without;
  return [...without, { row: rowIndex, characterIds: unique }].sort((a, b) => a.row - b.row);
}

/** Shift row indices after insert/delete so character bindings stay on the right scenes. */
export function adjustSceneMetaForInsertRow(
  meta: BriefSceneMeta[],
  insertAtRowIndex: number,
): BriefSceneMeta[] {
  return meta.map((m) =>
    m.row >= insertAtRowIndex ? { ...m, row: m.row + 1 } : m,
  );
}

export function adjustSceneMetaForDeleteRow(
  meta: BriefSceneMeta[],
  rowIndex: number,
): BriefSceneMeta[] {
  return meta
    .filter((m) => m.row !== rowIndex)
    .map((m) => (m.row > rowIndex ? { ...m, row: m.row - 1 } : m));
}

export function upsertBriefSceneMetaInMarkdown(
  markdown: string,
  meta: BriefSceneMeta[],
): string {
  const cleaned = meta.filter((m) => m.characterIds.length > 0);
  const comment =
    cleaned.length === 0
      ? ''
      : `<!--synckerja-brief-scene-meta:${JSON.stringify(cleaned)}-->`;

  let next = String(markdown ?? '').replace(SCENE_META_COMMENT_RE, '').trimEnd();
  if (!comment) {
    return next.replace(/\n{3,}/g, '\n\n').trim();
  }
  if (!next) return comment;
  return `${next}\n\n${comment}`;
}

export function stripBriefSceneMetaComment(markdown: string): string {
  return String(markdown ?? '')
    .replace(SCENE_META_COMMENT_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
