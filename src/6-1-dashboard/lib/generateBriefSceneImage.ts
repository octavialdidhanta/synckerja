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

export function buildBriefScenePrompt(
  headers: string[],
  row: string[],
  imageColumnIndex: number,
): string {
  const lines: string[] = [];
  headers.forEach((header, colIdx) => {
    if (colIdx === imageColumnIndex) return;
    const value = String(row[colIdx] ?? '').trim();
    if (!value) return;
    lines.push(`${header}: ${value}`);
  });
  const sceneBody = lines.join('\n');
  return [
    'Generate one storyboard frame for this video scene.',
    'Match the brief timing and description. Keep composition clear and production-ready for a content storyboard (16:9).',
    sceneBody ? `\nScene details:\n${sceneBody}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Load all labeled poses for selected characters, call generate-design-image,
 * and return a File ready for storyboard upload.
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
  if (ids.length === 0) {
    throw new Error(
      t('briefDialog.layout.generateNeedsCharacter', 'Select at least one character before generating.'),
    );
  }

  const { refs, summary } = await loadPoseReferencesForCharacters(ids, { t });
  if (refs.length === 0) {
    throw new Error(
      t(
        'briefDialog.layout.generateNoPoses',
        'Selected character(s) have no pose photos. Add poses in Digital Assets first.',
      ),
    );
  }

  const characterPoseReferences = refs.map((ref) => {
    const name =
      characterNamesById[ref.characterId]?.trim() ||
      ref.characterId.slice(0, 8);
    return {
      ...ref,
      label: `${name} — ${ref.label}`,
    };
  });

  const prompt = buildBriefScenePrompt(headers, row, imageColumnIndex);

  const { data: refreshed } = await supabase.auth.refreshSession();
  const session =
    refreshed.session ?? (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) {
    throw new Error(t('briefDialog.layout.generateAuthError', 'Please sign in again to generate.'));
  }

  const { data, error } = await supabase.functions.invoke('generate-design-image', {
    body: {
      prompt,
      aspectRatio: '16:9',
      characterPoseReferences,
    },
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
  const included = summary.reduce((n, s) => n + s.included, 0);
  const totalAvailable = summary.reduce((n, s) => n + s.totalAvailable, 0);

  return {
    file,
    truncated: summary.some((s) => s.included < s.totalAvailable),
    included,
    totalAvailable,
  };
}
