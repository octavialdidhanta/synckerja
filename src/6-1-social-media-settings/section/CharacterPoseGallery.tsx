import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useStorageSignedImageUrl } from '@/shared/hooks/useStorageSignedImageUrl';
import { storageUploadOptions } from '@/shared/lib/storageCacheControl';
import { toast } from 'sonner';
import { Download, ImageIcon, Loader2, Plus, Star, Trash2 } from 'lucide-react';
import type { DigitalAssetCharacterImage } from '../types/digitalAssetRecords';
import {
  CHARACTER_POSE_I18N_FALLBACKS,
  CHARACTER_POSE_PRESET_KEYS,
  MAX_CHARACTER_POSE_IMAGES,
  characterPoseLabelKey,
  isCharacterPoseKey,
  type CharacterPoseKey,
} from '../types/characterPoseKeys';
import {
  digitalAssetCharacterImagesKey,
  digitalAssetCharactersKey,
  useDigitalAssetCharacterImagesQuery,
} from '../hooks/useDigitalAssetsListQueries';

const BUCKET = 'digital-asset-character-images';

function PoseThumb({
  image,
  label,
  usedPresetKeys,
  onSetPrimary,
  onDelete,
  onPoseChange,
  onCustomLabelChange,
  busy,
  t,
}: {
  image: DigitalAssetCharacterImage;
  label: string;
  usedPresetKeys: Set<string>;
  onSetPrimary: () => void;
  onDelete: () => void;
  onPoseChange: (poseKey: CharacterPoseKey) => void;
  onCustomLabelChange: (value: string) => void;
  busy: boolean;
  t: (key: string, fallback?: string) => string;
}) {
  const { data: url } = useStorageSignedImageUrl({
    bucket: BUCKET,
    path: image.storage_path,
  });
  const poseKey = isCharacterPoseKey(image.pose_key) ? image.pose_key : 'custom';

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-2">
      <div className="relative aspect-square rounded-md overflow-hidden border border-gray-200 bg-white">
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-400">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
        {image.is_primary ? (
          <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            <Star className="h-3 w-3" />
            {t('digitalAssets.posePrimary', 'Primary')}
          </span>
        ) : null}
      </div>
      <p className="text-xs font-medium text-gray-800 truncate" title={label}>
        {label}
      </p>
      <Select
        value={poseKey}
        onValueChange={(v) => onPoseChange(v as CharacterPoseKey)}
        disabled={busy}
      >
        <SelectTrigger className="h-8 text-xs border-gray-300 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CHARACTER_POSE_PRESET_KEYS.map((key) => {
            // Presets may only be used once; keep current value + custom selectable.
            const takenByOther = key !== 'custom' && key !== poseKey && usedPresetKeys.has(key);
            return (
              <SelectItem key={key} value={key} className="text-xs" disabled={takenByOther}>
                {t(characterPoseLabelKey(key), CHARACTER_POSE_I18N_FALLBACKS[key])}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {poseKey === 'custom' ? (
        <Input
          value={image.label_custom ?? ''}
          onChange={(e) => onCustomLabelChange(e.target.value)}
          onBlur={(e) => onCustomLabelChange(e.target.value.trim())}
          placeholder={t('digitalAssets.poseCustomPlaceholder', 'Custom label')}
          className="h-8 text-xs border-gray-300 bg-white"
          disabled={busy}
        />
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
        <div className="min-w-0">
          {!image.is_primary ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-full min-w-0 truncate text-xs border-gray-300 px-1.5 gap-1 [&_svg]:size-3"
              onClick={onSetPrimary}
              disabled={busy}
              title={t('digitalAssets.setPrimary', 'Set primary')}
            >
              <Star className="shrink-0" />
              <span className="truncate">{t('digitalAssets.setPrimary', 'Set primary')}</span>
            </Button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {url ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 shrink-0 p-0 border-gray-300 [&_svg]:size-3"
              onClick={() => window.open(url, '_blank', 'noopener')}
              aria-label={t('digitalAssets.download', 'Download')}
            >
              <Download />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-7 shrink-0 p-0 border-red-200 text-red-600 [&_svg]:size-3"
            onClick={onDelete}
            disabled={busy}
            aria-label={t('common.delete', 'Delete')}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CharacterPoseGallery({
  characterId,
}: {
  characterId: string | null;
}) {
  const { organizationId } = useCurrentOrg();
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pendingPoseKey, setPendingPoseKey] = useState<CharacterPoseKey>('front_closeup');
  const [pendingCustomLabel, setPendingCustomLabel] = useState('');

  const { data: images = [], isPending } = useDigitalAssetCharacterImagesQuery(characterId);

  const usedPresetKeys = useMemo(
    () => new Set(images.filter((i) => i.pose_key !== 'custom').map((i) => i.pose_key)),
    [images],
  );

  const availablePoseKeys = useMemo(
    () =>
      CHARACTER_POSE_PRESET_KEYS.filter(
        (key) => key === 'custom' || !usedPresetKeys.has(key) || key === pendingPoseKey,
      ),
    [usedPresetKeys, pendingPoseKey],
  );

  const invalidate = useCallback(() => {
    if (!organizationId || !characterId) return;
    void queryClient.invalidateQueries({
      queryKey: digitalAssetCharacterImagesKey(organizationId, characterId),
    });
    void queryClient.invalidateQueries({
      queryKey: digitalAssetCharactersKey(organizationId),
    });
  }, [organizationId, characterId, queryClient]);

  const syncPrimaryPath = useCallback(
    async (path: string | null) => {
      if (!characterId) return;
      const { error } = await supabase
        .from('digital_asset_characters')
        .update({ reference_image_path: path })
        .eq('id', characterId);
      if (error) throw error;
    },
    [characterId],
  );

  const resolveLabel = useCallback(
    (image: DigitalAssetCharacterImage) => {
      if (image.pose_key === 'custom') {
        return (image.label_custom || '').trim() || t('digitalAssets.pose.custom', 'Custom');
      }
      if (isCharacterPoseKey(image.pose_key)) {
        return t(characterPoseLabelKey(image.pose_key), CHARACTER_POSE_I18N_FALLBACKS[image.pose_key]);
      }
      return image.pose_key;
    },
    [t],
  );

  const handleUploadFile = useCallback(
    async (file: File) => {
      if (!organizationId || !characterId) return;
      if (images.length >= MAX_CHARACTER_POSE_IMAGES) {
        toast.error(
          t(
            'digitalAssets.poseMaxReached',
            'Maximum of {{count}} photos per character.',
            { count: MAX_CHARACTER_POSE_IMAGES },
          ),
        );
        return;
      }
      if (pendingPoseKey !== 'custom' && usedPresetKeys.has(pendingPoseKey)) {
        toast.error(t('digitalAssets.poseDuplicate', 'This pose already exists for this character.'));
        return;
      }
      if (pendingPoseKey === 'custom' && !pendingCustomLabel.trim()) {
        toast.error(t('digitalAssets.poseCustomRequired', 'Enter a custom label for this photo.'));
        return;
      }

      setBusy(true);
      try {
        const imageId = crypto.randomUUID();
        const ext = file.name?.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '.jpg';
        const path = `${organizationId}/${characterId}/${imageId}${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, storageUploadOptions({ upsert: false, contentType: file.type || 'image/jpeg' }));
        if (uploadError) throw uploadError;

        const makePrimary = images.length === 0;
        if (makePrimary) {
          // clear any existing primary flag (shouldn't exist)
          await supabase
            .from('digital_asset_character_images')
            .update({ is_primary: false })
            .eq('character_id', characterId)
            .eq('is_primary', true);
        }

        const { error: insertError } = await supabase.from('digital_asset_character_images').insert({
          id: imageId,
          organization_id: organizationId,
          character_id: characterId,
          storage_path: path,
          pose_key: pendingPoseKey,
          label_custom: pendingPoseKey === 'custom' ? pendingCustomLabel.trim() : null,
          sort_order: images.length,
          is_primary: makePrimary,
        });
        if (insertError) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw insertError;
        }

        if (makePrimary) {
          await syncPrimaryPath(path);
        }

        toast.success(t('digitalAssets.poseAdded', 'Pose photo added.'));
        setPendingCustomLabel('');
        invalidate();
      } catch (err) {
        console.error(err);
        toast.error(t('digitalAssets.poseAddError', 'Failed to add pose photo.'));
      } finally {
        setBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [
      organizationId,
      characterId,
      images.length,
      pendingPoseKey,
      pendingCustomLabel,
      usedPresetKeys,
      syncPrimaryPath,
      invalidate,
      t,
    ],
  );

  const handleSetPrimary = useCallback(
    async (image: DigitalAssetCharacterImage) => {
      if (!characterId || image.is_primary) return;
      setBusy(true);
      try {
        await supabase
          .from('digital_asset_character_images')
          .update({ is_primary: false })
          .eq('character_id', characterId)
          .eq('is_primary', true);
        const { error } = await supabase
          .from('digital_asset_character_images')
          .update({ is_primary: true })
          .eq('id', image.id);
        if (error) throw error;
        await syncPrimaryPath(image.storage_path);
        toast.success(t('digitalAssets.posePrimaryUpdated', 'Primary photo updated.'));
        invalidate();
      } catch (err) {
        console.error(err);
        toast.error(t('digitalAssets.saveError', 'Failed to save.'));
      } finally {
        setBusy(false);
      }
    },
    [characterId, syncPrimaryPath, invalidate, t],
  );

  const handleDelete = useCallback(
    async (image: DigitalAssetCharacterImage) => {
      if (!characterId) return;
      if (!window.confirm(t('digitalAssets.poseDeleteConfirm', 'Delete this pose photo?'))) return;
      setBusy(true);
      try {
        const { error } = await supabase.from('digital_asset_character_images').delete().eq('id', image.id);
        if (error) throw error;
        await supabase.storage.from(BUCKET).remove([image.storage_path]);

        if (image.is_primary) {
          const { data: remaining } = await supabase
            .from('digital_asset_character_images')
            .select('*')
            .eq('character_id', characterId)
            .order('sort_order', { ascending: true })
            .limit(1);
          const next = (remaining as DigitalAssetCharacterImage[] | null)?.[0];
          if (next) {
            await supabase
              .from('digital_asset_character_images')
              .update({ is_primary: true })
              .eq('id', next.id);
            await syncPrimaryPath(next.storage_path);
          } else {
            await syncPrimaryPath(null);
          }
        }
        toast.success(t('digitalAssets.deleteSuccess', 'Deleted successfully.'));
        invalidate();
      } catch (err) {
        console.error(err);
        toast.error(t('digitalAssets.deleteError', 'Failed to delete.'));
      } finally {
        setBusy(false);
      }
    },
    [characterId, syncPrimaryPath, invalidate, t],
  );

  const handlePoseChange = useCallback(
    async (image: DigitalAssetCharacterImage, poseKey: CharacterPoseKey) => {
      if (poseKey === image.pose_key) return;
      if (poseKey !== 'custom' && usedPresetKeys.has(poseKey)) {
        toast.error(t('digitalAssets.poseDuplicate', 'This pose already exists for this character.'));
        return;
      }
      setBusy(true);
      try {
        const payload: Partial<DigitalAssetCharacterImage> = {
          pose_key: poseKey,
          label_custom:
            poseKey === 'custom'
              ? (image.label_custom?.trim() || t('digitalAssets.pose.custom', 'Custom'))
              : null,
        };
        const { error } = await supabase
          .from('digital_asset_character_images')
          .update(payload)
          .eq('id', image.id);
        if (error) throw error;
        invalidate();
      } catch (err) {
        console.error(err);
        toast.error(t('digitalAssets.saveError', 'Failed to save.'));
      } finally {
        setBusy(false);
      }
    },
    [usedPresetKeys, invalidate, t],
  );

  const handleCustomLabelChange = useCallback(
    async (image: DigitalAssetCharacterImage, value: string) => {
      const trimmed = value.trim();
      if (image.pose_key !== 'custom') return;
      if (trimmed === (image.label_custom ?? '').trim()) return;
      if (!trimmed) {
        toast.error(t('digitalAssets.poseCustomRequired', 'Enter a custom label for this photo.'));
        return;
      }
      setBusy(true);
      try {
        const { error } = await supabase
          .from('digital_asset_character_images')
          .update({ label_custom: trimmed })
          .eq('id', image.id);
        if (error) throw error;
        invalidate();
      } catch (err) {
        console.error(err);
        toast.error(t('digitalAssets.saveError', 'Failed to save.'));
      } finally {
        setBusy(false);
      }
    },
    [invalidate, t],
  );

  if (!characterId) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">
          {t('digitalAssets.poseGalleryTitle', 'Pose photos')}
        </h4>
        <p className="text-xs text-gray-500">
          {t(
            'digitalAssets.poseGallerySaveFirst',
            'Save the character first, then add up to {{count}} pose photos.',
            { count: MAX_CHARACTER_POSE_IMAGES },
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">
          {t('digitalAssets.poseGalleryTitle', 'Pose photos')}
        </h4>
        <p className="text-xs text-gray-500 mt-0.5">
          {t(
            'digitalAssets.poseGalleryHint',
            'Add angles (left/right, sitting, laughing, etc.). Primary is used as list thumbnail. Max {{count}}.',
            { count: MAX_CHARACTER_POSE_IMAGES },
          )}
        </p>
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('digitalAssets.loadingImage', 'Loading image...')}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
          {images.map((image) => (
            <div key={image.id} className="w-[148px] shrink-0">
              <PoseThumb
                image={image}
                label={resolveLabel(image)}
                usedPresetKeys={usedPresetKeys}
                busy={busy}
                t={t}
                onSetPrimary={() => handleSetPrimary(image)}
                onDelete={() => handleDelete(image)}
                onPoseChange={(key) => handlePoseChange(image, key)}
                onCustomLabelChange={(v) => handleCustomLabelChange(image, v)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
        <Label className="text-xs text-gray-700">
          {t('digitalAssets.addPose', 'Add pose')} ({images.length}/{MAX_CHARACTER_POSE_IMAGES})
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Select
            value={pendingPoseKey}
            onValueChange={(v) => setPendingPoseKey(v as CharacterPoseKey)}
            disabled={busy || images.length >= MAX_CHARACTER_POSE_IMAGES}
          >
            <SelectTrigger className="h-9 text-sm border-gray-300 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availablePoseKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  {t(characterPoseLabelKey(key), CHARACTER_POSE_I18N_FALLBACKS[key])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pendingPoseKey === 'custom' ? (
            <Input
              value={pendingCustomLabel}
              onChange={(e) => setPendingCustomLabel(e.target.value)}
              placeholder={t('digitalAssets.poseCustomPlaceholder', 'Custom label')}
              className="h-9 text-sm border-gray-300 bg-white"
              disabled={busy}
            />
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUploadFile(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-gray-300"
          disabled={busy || images.length >= MAX_CHARACTER_POSE_IMAGES}
          onClick={() => fileInputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          {t('digitalAssets.uploadPosePhoto', 'Upload photo')}
        </Button>
      </div>
    </div>
  );
}
