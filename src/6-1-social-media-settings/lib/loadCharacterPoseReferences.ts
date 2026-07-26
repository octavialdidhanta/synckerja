import { supabase } from '@/shared/lib/supabaseClient';
import type { DigitalAssetCharacterImage } from '@/6-1-social-media-settings/types/digitalAssetRecords';
import {
  CHARACTER_POSE_I18N_FALLBACKS,
  isCharacterPoseKey,
  type CharacterPoseKey,
} from '@/6-1-social-media-settings/types/characterPoseKeys';

export type CharacterPoseReferencePayload = {
  characterId: string;
  poseKey: string;
  label: string;
  imageBase64: string;
  mimeType: string;
  isPrimary: boolean;
};

const BUCKET = 'digital-asset-character-images';
/** Soft payload budget for Gemini multipart requests. */
const MAX_TOTAL_BASE64_CHARS = 900_000;
const COMPRESS_MAX_WIDTH = 480;
const COMPRESS_QUALITY = 0.62;

function resolvePoseLabel(
  poseKey: string,
  labelCustom: string | null,
  t?: (key: string, fallback?: string) => string,
): string {
  if (poseKey === 'custom') {
    return (labelCustom || '').trim() || 'Custom';
  }
  const fallback = isCharacterPoseKey(poseKey)
    ? CHARACTER_POSE_I18N_FALLBACKS[poseKey as CharacterPoseKey]
    : poseKey;
  if (!t) return fallback;
  return t(`digitalAssets.pose.${poseKey}`, fallback);
}

async function blobToCompressedBase64(
  blob: Blob,
  maxWidth = COMPRESS_MAX_WIDTH,
  quality = COMPRESS_QUALITY,
): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxWidth / Math.max(bitmap.width, 1));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas unavailable');
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const mimeType = 'image/jpeg';
  const dataUrl = canvas.toDataURL(mimeType, quality);
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return { base64, mimeType };
}

/**
 * Load all pose images for a character (primary first), compress, and fit under payload budget.
 */
export async function loadCharacterPoseReferences(
  characterId: string,
  options?: {
    t?: (key: string, fallback?: string) => string;
    maxImages?: number;
  },
): Promise<{ refs: CharacterPoseReferencePayload[]; totalAvailable: number; included: number }> {
  const { data, error } = await supabase
    .from('digital_asset_character_images')
    .select('*')
    .eq('character_id', characterId)
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  const rows = (data as DigitalAssetCharacterImage[]) || [];
  const totalAvailable = rows.length;
  if (totalAvailable === 0) {
    // Fallback: character.reference_image_path only
    const { data: character } = await supabase
      .from('digital_asset_characters')
      .select('id, reference_image_path')
      .eq('id', characterId)
      .maybeSingle();
    const path = (character as { reference_image_path?: string | null } | null)?.reference_image_path;
    if (!path?.trim()) {
      return { refs: [], totalAvailable: 0, included: 0 };
    }
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (!signed.data?.signedUrl) return { refs: [], totalAvailable: 0, included: 0 };
    const res = await fetch(signed.data.signedUrl);
    if (!res.ok) return { refs: [], totalAvailable: 0, included: 0 };
    const blob = await res.blob();
    const { base64, mimeType } = await blobToCompressedBase64(blob);
    return {
      refs: [
        {
          characterId,
          poseKey: 'full_body',
          label: resolvePoseLabel('full_body', null, options?.t),
          imageBase64: base64,
          mimeType,
          isPrimary: true,
        },
      ],
      totalAvailable: 1,
      included: 1,
    };
  }

  const maxImages = options?.maxImages ?? 12;
  const refs: CharacterPoseReferencePayload[] = [];
  let usedChars = 0;

  for (const row of rows.slice(0, maxImages)) {
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 60 * 60);
    if (!signed.data?.signedUrl) continue;
    const res = await fetch(signed.data.signedUrl);
    if (!res.ok) continue;
    const blob = await res.blob();
    const { base64, mimeType } = await blobToCompressedBase64(blob);
    if (usedChars + base64.length > MAX_TOTAL_BASE64_CHARS && refs.length > 0) {
      break;
    }
    usedChars += base64.length;
    refs.push({
      characterId,
      poseKey: row.pose_key,
      label: resolvePoseLabel(row.pose_key, row.label_custom, options?.t),
      imageBase64: base64,
      mimeType,
      isPrimary: row.is_primary,
    });
  }

  return { refs, totalAvailable, included: refs.length };
}

/**
 * Load pose refs for multiple characters (concatenated, primary-first per character).
 */
export async function loadPoseReferencesForCharacters(
  characterIds: string[],
  options?: {
    t?: (key: string, fallback?: string) => string;
  },
): Promise<{
  refs: CharacterPoseReferencePayload[];
  summary: Array<{ characterId: string; totalAvailable: number; included: number }>;
}> {
  const unique = [...new Set(characterIds.filter(Boolean))];
  const refs: CharacterPoseReferencePayload[] = [];
  const summary: Array<{ characterId: string; totalAvailable: number; included: number }> = [];
  let usedChars = 0;

  for (const characterId of unique) {
    const remainingBudget = Math.max(0, MAX_TOTAL_BASE64_CHARS - usedChars);
    if (remainingBudget < 20_000 && refs.length > 0) break;
    const result = await loadCharacterPoseReferences(characterId, options);
    const batch: CharacterPoseReferencePayload[] = [];
    for (const ref of result.refs) {
      if (usedChars + ref.imageBase64.length > MAX_TOTAL_BASE64_CHARS && (refs.length > 0 || batch.length > 0)) {
        break;
      }
      usedChars += ref.imageBase64.length;
      batch.push(ref);
    }
    refs.push(...batch);
    summary.push({
      characterId,
      totalAvailable: result.totalAvailable,
      included: batch.length,
    });
  }

  return { refs, summary };
}
