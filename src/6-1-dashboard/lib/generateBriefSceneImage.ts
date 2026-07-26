import { supabase } from '@/shared/lib/supabaseClient';
import { loadPoseReferencesForCharacters } from '@/6-1-social-media-settings/lib/loadCharacterPoseReferences';

export type BriefSceneGenerateT = (
  key: string,
  fallback?: string,
  options?: Record<string, string | number>,
) => string;

function base64ToFile(base64: string, mimeType: string, fileName: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mimeType || 'image/png' });
}

type BriefFieldKind = 'visual' | 'vo' | 'timing' | 'tagging' | 'onScreenText' | 'other';

/** Classify a brief column by its header so the prompt can weight it correctly. */
function classifyBriefHeader(header: string): BriefFieldKind {
  const h = header.toLowerCase();
  if (/(scene\s*visual|visual|shot|scene|adegan|gambar|frame|composition|komposisi)/.test(h)) {
    return 'visual';
  }
  if (/(vo|voice[\s-]*over|voiceover|narasi|narration|dialog|dialogue|script|naskah)/.test(h)) {
    return 'vo';
  }
  if (/(timing|durasi|duration|time|waktu)/.test(h)) return 'timing';
  if (/(tag|hashtag)/.test(h)) return 'tagging';
  if (/(text\s*on\s*screen|on[\s-]*screen|caption|teks|subtitle|overlay|cta|title|judul|headline)/.test(h)) {
    return 'onScreenText';
  }
  return 'other';
}

/** Strip bracket markers like "[VISUAL: ...]" that are storyboard annotations, not content. */
function cleanBriefValue(value: string): string {
  return value
    .replace(/^\s*\[?\s*(scene\s*visual|visual|shot)\s*:\s*/i, '')
    .replace(/\]\s*$/, '')
    .trim();
}

type ClassifiedBriefFields = {
  visual: string[];
  vo: string[];
  onScreenText: string[];
  timing: string[];
  tagging: string[];
  other: string[];
};

function classifyBriefFields(
  headers: string[],
  row: string[],
  imageColumnIndex: number,
): ClassifiedBriefFields {
  const acc: ClassifiedBriefFields = {
    visual: [],
    vo: [],
    onScreenText: [],
    timing: [],
    tagging: [],
    other: [],
  };
  headers.forEach((header, colIdx) => {
    if (colIdx === imageColumnIndex) return;
    const raw = String(row[colIdx] ?? '').trim();
    if (!raw) return;
    const kind = classifyBriefHeader(header);
    const value = cleanBriefValue(raw);
    if (!value) return;
    if (kind === 'visual') acc.visual.push(value);
    else if (kind === 'vo') acc.vo.push(value);
    else if (kind === 'onScreenText') acc.onScreenText.push(value);
    else if (kind === 'timing') acc.timing.push(`${header}: ${value}`);
    else if (kind === 'tagging') acc.tagging.push(value);
    else acc.other.push(`${header}: ${value}`);
  });
  return acc;
}

export function hasBriefSceneTextContent(
  headers: string[],
  row: string[],
  imageColumnIndex: number,
): boolean {
  return headers.some((_, colIdx) => {
    if (colIdx === imageColumnIndex) return false;
    return String(row[colIdx] ?? '').trim().length > 0;
  });
}

export function buildBriefScenePrompt(
  headers: string[],
  row: string[],
  imageColumnIndex: number,
  options?: { hasCharacterReferences?: boolean },
): string {
  const fields = classifyBriefFields(headers, row, imageColumnIndex);
  const withRefs = Boolean(options?.hasCharacterReferences);

  const sections: string[] = [];

  if (fields.visual.length > 0) {
    sections.push(
      `PRIMARY VISUAL (draw exactly this scene):\n${fields.visual.join('\n')}`,
    );
  }
  if (fields.vo.length > 0) {
    sections.push(
      `NARRATION / VOICE-OVER (context and mood only — do NOT render this text in the image):\n${fields.vo.join('\n')}`,
    );
  }
  if (fields.onScreenText.length > 0) {
    sections.push(
      `ON-SCREEN TEXT (render these words as text in the frame, spelled exactly):\n${fields.onScreenText.join('\n')}`,
    );
  }
  if (fields.other.length > 0) {
    sections.push(`SUPPORTING DETAILS:\n${fields.other.join('\n')}`);
  }
  if (fields.timing.length > 0) {
    sections.push(`PACING (do not render as text):\n${fields.timing.join('\n')}`);
  }
  if (fields.tagging.length > 0) {
    sections.push(
      `THEME TAGS (mood/topic hints only — do NOT render hashtags in the image):\n${fields.tagging.join(', ')}`,
    );
  }

  // When there is no explicit visual column, fall back to VO as the main driver.
  const hasExplicitVisual = fields.visual.length > 0;

  const intro = [
    'You are generating ONE realistic storyboard frame for a single scene of a marketing/social video.',
    hasExplicitVisual
      ? 'Build the image strictly from the PRIMARY VISUAL description below; use the other sections only as supporting context.'
      : 'There is no separate visual description, so infer the most fitting concrete scene from the NARRATION / VOICE-OVER and supporting details below.',
    withRefs
      ? 'Keep any people consistent with the attached character pose references.'
      : 'No reference photos are attached; invent suitable subjects that fit the scene.',
    'STRICT RULES: Do NOT render voice-over/narration text, hashtags, timing, or field labels as text inside the image. Only render text listed under ON-SCREEN TEXT (if any). No watermarks, no UI chrome, no decorative borders, no collage of multiple panels — a single cohesive photographic frame at 16:9.',
  ].join(' ');

  return [intro, sections.join('\n\n')].filter(Boolean).join('\n\n');
}

/**
 * Build a storyboard frame from scene text fields.
 * Character pose photos are optional — when present they improve likeness;
 * when absent, generation uses Timing / VO / Scene Visual / other columns only.
 */
export async function generateBriefSceneImageFile(params: {
  characterIds: string[];
  characterNamesById: Record<string, string>;
  headers: string[];
  row: string[];
  imageColumnIndex: number;
  t: BriefSceneGenerateT;
}): Promise<{
  file: File;
  truncated: boolean;
  included: number;
  totalAvailable: number;
}> {
  const { characterIds, characterNamesById, headers, row, imageColumnIndex, t } = params;
  const ids = [...new Set(characterIds.filter(Boolean))];
  const hasSceneText = hasBriefSceneTextContent(headers, row, imageColumnIndex);

  let characterPoseReferences: Array<{
    characterId: string;
    poseKey: string;
    label: string;
    imageBase64: string;
    mimeType: string;
    isPrimary: boolean;
  }> = [];
  let included = 0;
  let totalAvailable = 0;
  let truncated = false;

  if (ids.length > 0) {
    const { refs, summary } = await loadPoseReferencesForCharacters(ids, { t });
    if (refs.length > 0) {
      characterPoseReferences = refs.map((ref) => {
        const name =
          characterNamesById[ref.characterId]?.trim() ||
          ref.characterId.slice(0, 8);
        return {
          ...ref,
          label: `${name} — ${ref.label}`,
        };
      });
      included = summary.reduce((n, s) => n + s.included, 0);
      totalAvailable = summary.reduce((n, s) => n + s.totalAvailable, 0);
      truncated = summary.some((s) => s.included < s.totalAvailable);
    }
  }

  if (!hasSceneText && characterPoseReferences.length === 0) {
    throw new Error(
      t(
        'briefDialog.layout.generateNeedsSceneDetails',
        'Add scene details (VO, Scene Visual, etc.) before generating.',
      ),
    );
  }

  const prompt = buildBriefScenePrompt(headers, row, imageColumnIndex, {
    hasCharacterReferences: characterPoseReferences.length > 0,
  });

  const { data: refreshed } = await supabase.auth.refreshSession();
  const session =
    refreshed.session ?? (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) {
    throw new Error(t('briefDialog.layout.generateAuthError', 'Please sign in again to generate.'));
  }

  const body: {
    prompt: string;
    aspectRatio: string;
    characterPoseReferences?: typeof characterPoseReferences;
  } = {
    prompt,
    aspectRatio: '16:9',
  };
  if (characterPoseReferences.length > 0) {
    body.characterPoseReferences = characterPoseReferences;
  }

  const { data, error } = await supabase.functions.invoke('generate-design-image', {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (data?.error) {
    throw new Error(String(data.error));
  }
  if (error) throw error;

  const base64 = data?.imageBase64;
  const mimeType = (data?.mimeType as string | undefined) ?? 'image/png';
  if (!base64 || typeof base64 !== 'string') {
    throw new Error(t('briefDialog.layout.generateFailed', 'Image generation failed.'));
  }

  const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
  const file = base64ToFile(base64, mimeType, `storyboard-scene-${Date.now()}.${ext}`);

  return {
    file,
    truncated,
    included,
    totalAvailable,
  };
}
