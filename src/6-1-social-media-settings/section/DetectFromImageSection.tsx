import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/shared/components/ui/button';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { storageUploadOptions } from '@/shared/lib/storageCacheControl';
import { toast } from 'sonner';
import { Lightbulb, ImageIcon, Copy, User, Box, Layout, Download, Trash2, RectangleHorizontal, RectangleVertical, Square, Loader2, RefreshCw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/shared/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { digitalAssetCharactersKey } from '../hooks/useDigitalAssetsListQueries';

export type DesignResult = {
  headline?: string;
  sub_headline?: string;
  main_color?: string;
  other_colors?: string;
  text?: string;
  elements?: string;
  font?: string;
  layout_style_description?: string;
  layout_change_recommendation?: string;
  character_in_design?: string;
  product_in_design?: string;
};

export type CharacterResult = {
  name?: string;
  age?: string;
  nationality?: string;
  gender?: string;
  hair_description?: string;
  face_description?: string;
  clothing_description?: string;
  additional_details?: string;
  accessories?: string;
  body_shape?: string;
  height?: string;
};

export type CharacterSlot = {
  characterId: string | null;
  expression: string | null;
  bodyPose: string | null;
  handGesture: string | null;
};

const CHAR_AI = '__ai__';
/** Sentinel for Radix Select (no empty string value). */
const SELECT_NONE = '__none__';
/** Double-click vs single-click discrimination (ms). */
const CLICK_VS_DBLCLICK_MS = 300;

/** Clipboard often puts text/html before image/* — scan all items. */
function getImageFileFromClipboardData(data: DataTransfer | null | undefined): File | null {
  const items = data?.items;
  if (!items?.length) return null;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
}

const EXPRESSION_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'happy', labelKey: 'detectFromImage.expressionHappy' },
  { value: 'sad', labelKey: 'detectFromImage.expressionSad' },
  { value: 'angry', labelKey: 'detectFromImage.expressionAngry' },
  { value: 'cool', labelKey: 'detectFromImage.expressionCool' },
  { value: 'bad_mood', labelKey: 'detectFromImage.expressionBadMood' },
  { value: 'surprised', labelKey: 'detectFromImage.expressionSurprised' },
  { value: 'neutral', labelKey: 'detectFromImage.expressionNeutral' },
  { value: 'excited', labelKey: 'detectFromImage.expressionExcited' },
  { value: 'confused', labelKey: 'detectFromImage.expressionConfused' },
  { value: 'thoughtful', labelKey: 'detectFromImage.expressionThoughtful' },
  { value: 'serious', labelKey: 'detectFromImage.expressionSerious' },
];

const BODY_POSE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'standing', labelKey: 'detectFromImage.bodyPoseStanding' },
  { value: 'sitting', labelKey: 'detectFromImage.bodyPoseSitting' },
  { value: 'walking', labelKey: 'detectFromImage.bodyPoseWalking' },
  { value: 'running', labelKey: 'detectFromImage.bodyPoseRunning' },
  { value: 'leaning', labelKey: 'detectFromImage.bodyPoseLeaning' },
  { value: 'kneeling', labelKey: 'detectFromImage.bodyPoseKneeling' },
  { value: 'lying_down', labelKey: 'detectFromImage.bodyPoseLyingDown' },
  { value: 'squatting', labelKey: 'detectFromImage.bodyPoseSquatting' },
  { value: 'cross_legged', labelKey: 'detectFromImage.bodyPoseCrossLegged' },
  { value: 'hands_on_knees', labelKey: 'detectFromImage.bodyPoseHandsOnKnees' },
];

/** Target aspect ratio as width/height (e.g. 4/5 for 4:5 portrait). */
function getTargetAspectRatio(
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9' | 'custom',
  customWidth: string,
  customHeight: string
): number {
  if (aspectRatio === 'custom') {
    const w = Number(customWidth);
    const h = Number(customHeight);
    if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) return w / h;
    return 1;
  }
  const [a, b] = aspectRatio.split(':').map(Number);
  return Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : 1;
}

/**
 * Force image to target aspect ratio by COVER: scale to fill the frame, center-crop excess.
 * Hasil selalu mengisi penuh frame tanpa padding; bagian yang overflow dipotong.
 */
function fitDataUrlToAspectRatio(dataUrl: string, targetRatio: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const currentRatio = w / h;
      if (Math.abs(currentRatio - targetRatio) < 0.02) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement('canvas');
      // Output size with exact target ratio: crop width if image wider, crop height if image taller
      const outW = currentRatio >= targetRatio ? Math.round(h * targetRatio) : w;
      const outH = currentRatio >= targetRatio ? h : Math.round(w / targetRatio);
      const scale = Math.max(outW / w, outH / h);
      const srcW = Math.min(w, Math.round(outW / scale));
      const srcH = Math.min(h, Math.round(outH / scale));
      const srcX = Math.max(0, Math.round((w - srcW) / 2));
      const srcY = Math.max(0, Math.round((h - srcH) / 2));
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const HAND_GESTURE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'pointing_up', labelKey: 'detectFromImage.handGesturePointingUp' },
  { value: 'pointing_down', labelKey: 'detectFromImage.handGesturePointingDown' },
  { value: 'pointing_to_side', labelKey: 'detectFromImage.handGesturePointingToSide' },
  { value: 'waving', labelKey: 'detectFromImage.handGestureWaving' },
  { value: 'arms_crossed', labelKey: 'detectFromImage.handGestureArmsCrossed' },
  { value: 'hands_on_hips', labelKey: 'detectFromImage.handGestureHandsOnHips' },
  { value: 'thumbs_up', labelKey: 'detectFromImage.handGestureThumbsUp' },
  { value: 'open_palms', labelKey: 'detectFromImage.handGestureOpenPalms' },
  { value: 'holding_object', labelKey: 'detectFromImage.handGestureHoldingObject' },
  { value: 'hand_on_chin', labelKey: 'detectFromImage.handGestureHandOnChin' },
  { value: 'arms_relaxed', labelKey: 'detectFromImage.handGestureArmsRelaxed' },
];

const CAMERA_MOVEMENT_OPTIONS: { value: string; labelKey: string; descriptionKey: string }[] = [
  { value: 'static', labelKey: 'detectFromImage.cameraMovementStatic', descriptionKey: 'detectFromImage.cameraMovementStaticDesc' },
  { value: 'pan_left_right', labelKey: 'detectFromImage.cameraMovementPan', descriptionKey: 'detectFromImage.cameraMovementPanDesc' },
  { value: 'tilt_up_down', labelKey: 'detectFromImage.cameraMovementTilt', descriptionKey: 'detectFromImage.cameraMovementTiltDesc' },
  { value: 'zoom_in', labelKey: 'detectFromImage.cameraMovementZoomIn', descriptionKey: 'detectFromImage.cameraMovementZoomInDesc' },
  { value: 'zoom_out', labelKey: 'detectFromImage.cameraMovementZoomOut', descriptionKey: 'detectFromImage.cameraMovementZoomOutDesc' },
  { value: 'dolly_in', labelKey: 'detectFromImage.cameraMovementDollyIn', descriptionKey: 'detectFromImage.cameraMovementDollyInDesc' },
  { value: 'dolly_out', labelKey: 'detectFromImage.cameraMovementDollyOut', descriptionKey: 'detectFromImage.cameraMovementDollyOutDesc' },
  { value: 'tracking', labelKey: 'detectFromImage.cameraMovementTracking', descriptionKey: 'detectFromImage.cameraMovementTrackingDesc' },
  { value: 'crane', labelKey: 'detectFromImage.cameraMovementCrane', descriptionKey: 'detectFromImage.cameraMovementCraneDesc' },
  { value: 'rotation_360', labelKey: 'detectFromImage.cameraMovement360', descriptionKey: 'detectFromImage.cameraMovement360Desc' },
  { value: 'pov', labelKey: 'detectFromImage.cameraMovementPOV', descriptionKey: 'detectFromImage.cameraMovementPOVDesc' },
  { value: 'handheld', labelKey: 'detectFromImage.cameraMovementHandheld', descriptionKey: 'detectFromImage.cameraMovementHandheldDesc' },
  { value: 'over_shoulder', labelKey: 'detectFromImage.cameraMovementOverShoulder', descriptionKey: 'detectFromImage.cameraMovementOverShoulderDesc' },
  { value: 'rack_focus', labelKey: 'detectFromImage.cameraMovementRackFocus', descriptionKey: 'detectFromImage.cameraMovementRackFocusDesc' },
  { value: 'push_in_dramatic', labelKey: 'detectFromImage.cameraMovementPushIn', descriptionKey: 'detectFromImage.cameraMovementPushInDesc' },
];

/** Master negative prompt (bilingual) appended when copying Scene Analysis super prompt. */
const SCENE_ANALYSIS_MASTER_NEGATIVE_PROMPT =
  'DO NOT include: misspelled or garbled text; unreadable or corrupted text; jumbled letters or merged words; nonsensical character sequences; wrong symbols (e.g. ampersand, accented or foreign characters) replacing correct letters; partial or cut-off text; text that resembles correct words but with wrong spelling or character substitution; watermarks; foreign or unintended logos; any text not explicitly mentioned in the positive prompt; text artifacts; distorted or broken fonts; stretched or deformed glyphs; distorted or deformed faces; low quality or blurry areas; unnatural or extra fingers/hands; messy or inconsistent background.\n\n' +
  'Jangan sertakan: teks salah eja atau tidak terbaca; teks rusak atau terkorupsi; huruf acak atau kata yang menyatu; rangkaian karakter yang tidak bermakna; simbol salah (mis. ampersand, aksen atau karakter asing) menggantikan huruf yang benar; teks terpotong atau tidak lengkap; teks yang mirip kata benar tapi salah eja atau salah karakter; watermark; logo asing atau tidak dimaksudkan; teks yang tidak disebut dalam prompt positif; artefak teks; font rusak atau terdistorsi; glyph meregang atau cacat; wajah terdistorsi; kualitas rendah atau buram; tangan/jari aneh; background berantakan atau tidak konsisten.';

const MAX_CHARACTER_SLOTS = 5;
const MAX_LAYOUT_COMPOSITION_IMAGES = 7;
const MAX_CHARACTER_ACCESSORIES = 5;

export type CharacterStructuredRef = {
  head: File | null;
  clothes: (File | null)[];
  logo: File | null;
  foot: File | null;
  accessories: (File | null)[];
  headDescription: string;
  clothesDescriptions: string[];
  logoDescription: string;
  footDescription: string;
  accessoriesDescriptions: string[];
};

function emptyCharacterStructuredRef(): CharacterStructuredRef {
  return {
    head: null,
    clothes: [null, null],
    logo: null,
    foot: null,
    accessories: Array.from({ length: MAX_CHARACTER_ACCESSORIES }, () => null),
    headDescription: '',
    clothesDescriptions: ['', ''],
    logoDescription: '',
    footDescription: '',
    accessoriesDescriptions: Array.from({ length: MAX_CHARACTER_ACCESSORIES }, () => ''),
  };
}

function emptyCharacterSlot(): CharacterSlot {
  return { characterId: null, expression: null, bodyPose: null, handGesture: null };
}

function buildCombinedPrompt(data: {
  name?: string | null;
  age?: string | null;
  gender?: string | null;
  hair_description?: string | null;
  face_description?: string | null;
  clothing_description?: string | null;
  additional_details?: string | null;
}): string {
  const parts = [
    data.name,
    data.age,
    data.gender,
    data.hair_description,
    data.face_description,
    data.clothing_description,
    data.additional_details,
  ].filter((v) => v != null && String(v).trim() !== '' && String(v).trim() !== '—');
  return parts.join('\n');
}

type SceneAnalysisMasterData = {
  name: string | null;
  hair_description?: string | null;
  face_description?: string | null;
  clothing_description?: string | null;
  accessories?: string | null;
  additional_details?: string | null;
};

function buildSceneAnalysisSuperPrompt(params: {
  designReplace: Record<string, string>;
  designResult: DesignResult | null;
  characterSlots: CharacterSlot[];
  characterStructuredRefs: CharacterStructuredRef[];
  designCharacters: { id: string; name: string | null }[];
  sceneAnalysisCameraMovement: string;
  sceneAnalysisLanguage: string;
  sceneAnalysisCharacterNarasi: Record<number, string>;
  sceneAnalysisCharacterMasters: Record<string, SceneAnalysisMasterData>;
  getLabel: (key: string) => string;
  cameraMovementOptions: { value: string; labelKey: string }[];
  expressionOptions: { value: string; labelKey: string }[];
  bodyPoseOptions: { value: string; labelKey: string }[];
  handGestureOptions: { value: string; labelKey: string }[];
}): string {
  const sections: string[] = [];
  const g = (field: keyof DesignResult) => params.designReplace[field] ?? params.designResult?.[field] ?? '';
  const sceneParts: string[] = [];
  if (g('font')) sceneParts.push(`Font: ${g('font')}`);
  if (g('elements')) sceneParts.push(`Elements: ${g('elements')}`);
  if (g('layout_style_description')) sceneParts.push(`Composition: ${g('layout_style_description')}`);
  if (g('headline')) sceneParts.push(`Headline: ${g('headline')}`);
  if (g('sub_headline')) sceneParts.push(`Sub headline: ${g('sub_headline')}`);
  if (g('text')) sceneParts.push(`Text: ${g('text')}`);
  if (g('main_color')) sceneParts.push(`Main color: ${g('main_color')}`);
  if (g('other_colors')) sceneParts.push(`Other colors: ${g('other_colors')}`);
  if (sceneParts.length > 0) {
    sections.push('--- DESKRIPSI ADEGAN ---\n' + sceneParts.join('\n'));
  }
  const charSlots = params.characterSlots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.characterId != null && slot.characterId !== '');
  if (charSlots.length > 0) {
    const charLines: string[] = [];
    for (const { slot, index } of charSlots) {
      const master = params.sceneAnalysisCharacterMasters[slot.characterId!];
      const name = master?.name ?? params.designCharacters.find((c) => c.id === slot.characterId)?.name ?? slot.characterId ?? `Character ${index + 1}`;
      const refs = params.characterStructuredRefs[index];
      const parts: string[] = [`Karakter: ${name}`];
      if (slot.expression) {
        const opt = params.expressionOptions.find((o) => o.value === slot.expression);
        parts.push(`Ekspresi: ${opt ? params.getLabel(opt.labelKey) : slot.expression}`);
      }
      if (slot.bodyPose) {
        const opt = params.bodyPoseOptions.find((o) => o.value === slot.bodyPose);
        parts.push(`Pose: ${opt ? params.getLabel(opt.labelKey) : slot.bodyPose}`);
      }
      if (slot.handGesture) {
        const opt = params.handGestureOptions.find((o) => o.value === slot.handGesture);
        parts.push(`Hand gesture: ${opt ? params.getLabel(opt.labelKey) : slot.handGesture}`);
      }
      if (master?.hair_description) parts.push(`Rambut: ${master.hair_description}`);
      if (master?.face_description) parts.push(`Wajah: ${master.face_description}`);
      if (master?.clothing_description) parts.push(`Pakaian: ${master.clothing_description}`);
      if (master?.accessories) parts.push(`Aksesoris: ${master.accessories}`);
      if (master?.additional_details) parts.push(`Detail: ${master.additional_details}`);
      if (refs) {
        if (refs.headDescription?.trim()) parts.push(`Instruksi head: ${refs.headDescription.trim()}`);
        refs.clothesDescriptions?.forEach((d, i) => { if (d?.trim()) parts.push(`Instruksi clothes ${i + 1}: ${d.trim()}`); });
        if (refs.logoDescription?.trim()) parts.push(`Instruksi logo: ${refs.logoDescription.trim()}`);
        if (refs.footDescription?.trim()) parts.push(`Instruksi foot: ${refs.footDescription.trim()}`);
        refs.accessoriesDescriptions?.forEach((d, i) => { if (d?.trim()) parts.push(`Instruksi aksesoris ${i + 1}: ${d.trim()}`); });
      }
      charLines.push(parts.join('\n'));
    }
    sections.push('--- KARAKTER ---\n' + charLines.join('\n\n'));
  }
  const camOpt = params.cameraMovementOptions.find((o) => o.value === params.sceneAnalysisCameraMovement);
  sections.push('--- KAMERA ---\n' + (camOpt ? params.getLabel(camOpt.labelKey) : params.sceneAnalysisCameraMovement || '—'));
  const narasiLines = charSlots
    .map(({ slot, index }) => {
      const master = params.sceneAnalysisCharacterMasters[slot.characterId!];
      const name = master?.name ?? params.designCharacters.find((c) => c.id === slot.characterId)?.name ?? slot.characterId ?? `Character ${index + 1}`;
      return { name, text: params.sceneAnalysisCharacterNarasi[index] };
    })
    .filter(({ text }) => text != null && String(text).trim() !== '');
  if (narasiLines.length > 0) {
    sections.push('--- NARASI (dialog per karakter) ---\n' + narasiLines.map(({ name, text }) => `${name}: ${String(text).trim()}`).join('\n'));
  }
  sections.push('--- BAHASA ---\n' + (params.sceneAnalysisLanguage === 'en' ? 'English' : 'Indonesia'));
  return sections.join('\n\n');
}

export const DetectFromImageSection: React.FC = () => {
  const { organizationId } = useCurrentOrg();
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const mainPasteLockRef = useRef(false);
  const [mode, setMode] = useState<'scene' | 'character' | 'design'>('scene');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [artisticDescription, setArtisticDescription] = useState('');
  const [characterResult, setCharacterResult] = useState<CharacterResult | null>(null);
  const [designResult, setDesignResult] = useState<DesignResult | null>(null);
  const [designCharacters, setDesignCharacters] = useState<{ id: string; name: string | null }[]>([]);
  const [designObjects, setDesignObjects] = useState<{ id: string; name: string | null }[]>([]);
  const [designBrands, setDesignBrands] = useState<{
    id: string;
    brand_name: string | null;
    primary_color_hex: string | null;
    secondary_color_hex: string | null;
    accent_color_hex: string | null;
    text_color_hex: string | null;
  }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [characterSlots, setCharacterSlots] = useState<CharacterSlot[]>(() => [emptyCharacterSlot()]);
  const [characterStructuredRefs, setCharacterStructuredRefs] = useState<CharacterStructuredRef[]>(() => [
    emptyCharacterStructuredRef(),
  ]);
  const [activeCharacterRef, setActiveCharacterRef] = useState<{
    slotIndex: number;
    category: 'head' | 'clothes' | 'logo' | 'foot' | 'accessories';
    subIndex: number;
  } | null>(null);
  const [designReplace, setDesignReplace] = useState<Record<string, string>>({});
  const [designCompanyLogos, setDesignCompanyLogos] = useState<{ id: string; brand_name: string | null; logo_path: string | null }[]>([]);
  const [selectedCompanyLogoId, setSelectedCompanyLogoId] = useState<string | null>(null);
  const [designImageAspectRatio, setDesignImageAspectRatio] = useState<'1:1' | '4:5' | '9:16' | '16:9' | 'custom'>('1:1');
  const [customSizeWidth, setCustomSizeWidth] = useState<string>('');
  const [customSizeHeight, setCustomSizeHeight] = useState<string>('');
  const [customSizeUnit, setCustomSizeUnit] = useState<'px' | 'in' | 'mm' | 'cm'>('px');
  const [brandComboboxOpen, setBrandComboboxOpen] = useState(false);
  const [companyLogoComboboxOpen, setCompanyLogoComboboxOpen] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [layoutCompositionSlots, setLayoutCompositionSlots] = useState<(File | null)[]>(() =>
    Array.from({ length: MAX_LAYOUT_COMPOSITION_IMAGES }, () => null)
  );
  const [activeCompositionSlotIndex, setActiveCompositionSlotIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layoutCompositionInputRef = useRef<HTMLInputElement>(null);
  const characterStructuredInputRef = useRef<HTMLInputElement>(null);
  const uploadClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compositionSlotClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const characterStructuredClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Import to Scene Analysis */
  const [sceneAnalysisImported, setSceneAnalysisImported] = useState(false);
  const [sceneAnalysisLanguage, setSceneAnalysisLanguage] = useState<string>('id');
  const [sceneAnalysisCameraMovement, setSceneAnalysisCameraMovement] = useState<string>('static');
  const [sceneAnalysisCharacterNarasi, setSceneAnalysisCharacterNarasi] = useState<Record<number, string>>({});
  type SceneAnalysisCharacterMaster = {
    id: string;
    name: string | null;
    reference_image_path: string | null;
    reference_image_url?: string | null;
    hair_description?: string | null;
    face_description?: string | null;
    clothing_description?: string | null;
    accessories?: string | null;
    additional_details?: string | null;
  };
  const [sceneAnalysisCharacterMasters, setSceneAnalysisCharacterMasters] = useState<Record<string, SceneAnalysisCharacterMaster>>({});
  const [sceneAnalysisGeneratedNegativePrompt, setSceneAnalysisGeneratedNegativePrompt] = useState<string | null>(null);
  const [sceneAnalysisNegativePromptLoading, setSceneAnalysisNegativePromptLoading] = useState(false);
  const [sceneAnalysisNegativePromptError, setSceneAnalysisNegativePromptError] = useState<string | null>(null);
  const hasAutoGeneratedNegativePromptRef = useRef(false);
  const [sceneAnalysisImageDescriptionPrompt, setSceneAnalysisImageDescriptionPrompt] = useState<string | null>(null);
  const [sceneAnalysisImageDescriptionLoading, setSceneAnalysisImageDescriptionLoading] = useState(false);
  const [sceneAnalysisImageDescriptionError, setSceneAnalysisImageDescriptionError] = useState<string | null>(null);
  const hasAutoGeneratedImageDescriptionRef = useRef(false);

  const readClipboardAsFile = useCallback((): Promise<File | null> => {
    if (typeof navigator?.clipboard?.read !== 'function') return Promise.resolve(null);
    return navigator.clipboard.read().then((items) => {
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          return item.getType(type).then((blob) => new File([blob], 'pasted.png', { type }));
        }
      }
      return null;
    }).catch(() => null);
  }, []);

  const replacePreviewUrl = useCallback((next: string | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = next;
    setPreviewUrl(next);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const [layoutCompositionUrls, setLayoutCompositionUrls] = useState<(string | null)[]>(() =>
    Array.from({ length: MAX_LAYOUT_COMPOSITION_IMAGES }, () => null)
  );
  const layoutCompositionUrlsPrevRef = useRef<(string | null)[]>([]);
  useEffect(() => {
    const urls = layoutCompositionSlots.map((f) => (f ? URL.createObjectURL(f) : null));
    const toRevoke = layoutCompositionUrlsPrevRef.current;
    layoutCompositionUrlsPrevRef.current = urls;
    setLayoutCompositionUrls(urls);
    return () => {
      toRevoke.forEach((u) => { if (u) URL.revokeObjectURL(u); });
    };
  }, [layoutCompositionSlots]);

  type CharacterStructuredUrlsItem = { head: string | null; clothes: (string | null)[]; logo: string | null; foot: string | null; accessories: (string | null)[] };
  const [characterStructuredUrls, setCharacterStructuredUrls] = useState<CharacterStructuredUrlsItem[]>(() => [
    { head: null, clothes: [null, null], logo: null, foot: null, accessories: Array.from({ length: MAX_CHARACTER_ACCESSORIES }, () => null) },
  ]);
  const characterStructuredUrlsRef = useRef<CharacterStructuredUrlsItem[]>([]);
  useEffect(() => {
    const toRevoke = characterStructuredUrlsRef.current;
    const next = characterStructuredRefs.map((ref) => {
      const head = ref.head ? URL.createObjectURL(ref.head) : null;
      const clothes = ref.clothes.map((f) => (f ? URL.createObjectURL(f) : null));
      const logo = ref.logo ? URL.createObjectURL(ref.logo) : null;
      const foot = ref.foot ? URL.createObjectURL(ref.foot) : null;
      const accessories = ref.accessories.map((f) => (f ? URL.createObjectURL(f) : null));
      return { head, clothes, logo, foot, accessories };
    });
    characterStructuredUrlsRef.current = next;
    setCharacterStructuredUrls(next);
    return () => {
      toRevoke.forEach((item) => {
        if (item.head) URL.revokeObjectURL(item.head);
        item.clothes.forEach((u) => { if (u) URL.revokeObjectURL(u); });
        if (item.logo) URL.revokeObjectURL(item.logo);
        if (item.foot) URL.revokeObjectURL(item.foot);
        item.accessories.forEach((u) => { if (u) URL.revokeObjectURL(u); });
      });
    };
  }, [characterStructuredRefs]);

  const fetchDesignAssets = useCallback(async () => {
    if (!organizationId) return;
    try {
      const [charRes, objRes, brandRes, logoRes] = await Promise.all([
        supabase
          .from('digital_asset_characters')
          .select('id, name')
          .eq('organization_id', organizationId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('digital_asset_objects')
          .select('id, name')
          .eq('organization_id', organizationId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('digital_asset_brand_colors')
          .select('id, brand_name, primary_color_hex, secondary_color_hex, accent_color_hex, text_color_hex')
          .eq('organization_id', organizationId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('digital_asset_company_logos')
          .select('id, brand_name, logo_path')
          .eq('organization_id', organizationId)
          .order('updated_at', { ascending: false }),
      ]);
      if (charRes.error) throw charRes.error;
      if (objRes.error) throw objRes.error;
      if (brandRes.error) throw brandRes.error;
      if (logoRes.error) throw logoRes.error;
      setDesignCharacters((charRes.data as { id: string; name: string | null }[]) || []);
      setDesignObjects((objRes.data as { id: string; name: string | null }[]) || []);
      setDesignBrands(
        (brandRes.data as {
          id: string;
          brand_name: string | null;
          primary_color_hex: string | null;
          secondary_color_hex: string | null;
          accent_color_hex: string | null;
          text_color_hex: string | null;
        }[]) || []
      );
      setDesignCompanyLogos(
        (logoRes.data as { id: string; brand_name: string | null; logo_path: string | null }[]) || []
      );
    } catch (err) {
      console.error(err);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId && mode === 'design') {
      fetchDesignAssets();
    }
  }, [organizationId, mode, fetchDesignAssets]);

  const setFile = useCallback(
    (file: File | null) => {
      // Swap preview in one update — avoid null flash between revoke and new URL
      replacePreviewUrl(file ? URL.createObjectURL(file) : null);
      setSelectedFile(file);
      setArtisticDescription('');
      setCharacterResult(null);
      setDesignResult(null);
      setCharacterSlots([emptyCharacterSlot()]);
      setCharacterStructuredRefs([emptyCharacterStructuredRef()]);
      setSelectedProductId(null);
      setSelectedBrandId(null);
      setSelectedCompanyLogoId(null);
      setDesignReplace({});
      setGeneratedImageUrl(null);
      setLayoutCompositionSlots(Array.from({ length: MAX_LAYOUT_COMPOSITION_IMAGES }, () => null));
      setSceneAnalysisImported(false);
      setSceneAnalysisCharacterMasters({});
      setSceneAnalysisCharacterNarasi({});
    },
    [replacePreviewUrl]
  );

  const applyMainPastedFile = useCallback(
    (file: File) => {
      // Document + React onPaste can both fire for one Ctrl+V
      if (mainPasteLockRef.current) return;
      mainPasteLockRef.current = true;
      setFile(file);
      queueMicrotask(() => {
        mainPasteLockRef.current = false;
      });
    },
    [setFile]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const file = getImageFileFromClipboardData(e.clipboardData);
      if (file) {
        e.preventDefault();
        e.stopPropagation();
        applyMainPastedFile(file);
      }
    },
    [applyMainPastedFile]
  );

  const handleSlotPaste = useCallback((i: number) => (e: React.ClipboardEvent) => {
    e.stopPropagation();
    const file = getImageFileFromClipboardData(e.clipboardData);
    if (!file) return;
    e.preventDefault();
    setLayoutCompositionSlots((prev) => {
      const next = [...prev];
      next[i] = file;
      return next;
    });
  }, []);

  const handleSlotDrop = useCallback((i: number) => (e: React.DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const list = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setLayoutCompositionSlots((prev) => {
      const next = [...prev];
      next[i] = list[0];
      return next;
    });
  }, []);

  const handleSlotClick = useCallback((i: number) => () => {
    if (compositionSlotClickTimeoutRef.current) clearTimeout(compositionSlotClickTimeoutRef.current);
    compositionSlotClickTimeoutRef.current = setTimeout(() => {
      compositionSlotClickTimeoutRef.current = null;
      readClipboardAsFile().then((file) => {
        if (file) setLayoutCompositionSlots((prev) => { const next = [...prev]; next[i] = file; return next; });
      });
    }, CLICK_VS_DBLCLICK_MS);
  }, [readClipboardAsFile]);

  const handleSlotDoubleClick = useCallback((i: number) => () => {
    if (compositionSlotClickTimeoutRef.current) {
      clearTimeout(compositionSlotClickTimeoutRef.current);
      compositionSlotClickTimeoutRef.current = null;
    }
    setActiveCompositionSlotIndex(i);
    layoutCompositionInputRef.current?.click();
  }, []);

  const handleCompositionFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length && activeCompositionSlotIndex !== null) {
      setLayoutCompositionSlots((prev) => {
        const next = [...prev];
        next[activeCompositionSlotIndex] = files[0];
        return next;
      });
      setActiveCompositionSlotIndex(null);
    }
  }, [activeCompositionSlotIndex]);

  const removeLayoutCompositionSlot = useCallback((i: number) => {
    setLayoutCompositionSlots((prev) => {
      const next = [...prev.slice(0, i), ...prev.slice(i + 1)];
      return [...next, null].slice(0, MAX_LAYOUT_COMPOSITION_IMAGES);
    });
  }, []);

  const setCharacterStructuredRefFile = useCallback(
    (slotIndex: number, category: 'head' | 'clothes' | 'logo' | 'foot' | 'accessories', subIndex: number, file: File | null) => {
      setCharacterStructuredRefs((prev) => {
        const next = prev.map((ref, i) => {
          if (i !== slotIndex) return ref;
          const nextRef = { ...ref };
          if (category === 'head') nextRef.head = file;
          else if (category === 'clothes') {
            nextRef.clothes = [...nextRef.clothes];
            nextRef.clothes[subIndex] = file;
          } else if (category === 'logo') nextRef.logo = file;
          else if (category === 'foot') nextRef.foot = file;
          else {
            nextRef.accessories = [...nextRef.accessories];
            nextRef.accessories[subIndex] = file;
          }
          return nextRef;
        });
        return next;
      });
    },
    []
  );

  const handleCharacterStructuredClick = useCallback(
    (slotIndex: number, category: 'head' | 'clothes' | 'logo' | 'foot' | 'accessories', subIndex: number) => () => {
      if (characterStructuredClickTimeoutRef.current) clearTimeout(characterStructuredClickTimeoutRef.current);
      characterStructuredClickTimeoutRef.current = setTimeout(() => {
        characterStructuredClickTimeoutRef.current = null;
        readClipboardAsFile().then((file) => {
          if (file) setCharacterStructuredRefFile(slotIndex, category, subIndex, file);
        });
      }, CLICK_VS_DBLCLICK_MS);
    },
    [readClipboardAsFile, setCharacterStructuredRefFile]
  );

  const handleCharacterStructuredDoubleClick = useCallback(
    (slotIndex: number, category: 'head' | 'clothes' | 'logo' | 'foot' | 'accessories', subIndex: number) => () => {
      if (characterStructuredClickTimeoutRef.current) {
        clearTimeout(characterStructuredClickTimeoutRef.current);
        characterStructuredClickTimeoutRef.current = null;
      }
      setActiveCharacterRef({ slotIndex, category, subIndex });
      characterStructuredInputRef.current?.click();
    },
    []
  );

  const handleCharacterStructuredPaste = useCallback(
    (slotIndex: number, category: 'head' | 'clothes' | 'logo' | 'foot' | 'accessories', subIndex: number) =>
      (e: React.ClipboardEvent) => {
        const file = getImageFileFromClipboardData(e.clipboardData);
        if (file) {
          e.preventDefault();
          setCharacterStructuredRefFile(slotIndex, category, subIndex, file);
        }
      },
    [setCharacterStructuredRefFile]
  );

  const handleCharacterStructuredDrop = useCallback(
    (slotIndex: number, category: 'head' | 'clothes' | 'logo' | 'foot' | 'accessories', subIndex: number) =>
      (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (file?.type.startsWith('image/')) setCharacterStructuredRefFile(slotIndex, category, subIndex, file);
      },
    [setCharacterStructuredRefFile]
  );

  const handleCharacterStructuredFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length && activeCharacterRef) {
      const { slotIndex, category, subIndex } = activeCharacterRef;
      setCharacterStructuredRefFile(slotIndex, category, subIndex, files[0]);
      setActiveCharacterRef(null);
    }
  }, [activeCharacterRef, setCharacterStructuredRefFile]);

  const removeCharacterStructuredRef = useCallback(
    (slotIndex: number, category: 'head' | 'clothes' | 'logo' | 'foot' | 'accessories', subIndex: number) => {
      setCharacterStructuredRefFile(slotIndex, category, subIndex, null);
    },
    [setCharacterStructuredRefFile]
  );

  const setCharacterStructuredRefDescription = useCallback(
    (slotIndex: number, category: 'head' | 'clothes' | 'logo' | 'foot' | 'accessories', subIndex: number, value: string) => {
      setCharacterStructuredRefs((prev) => {
        return prev.map((ref, i) => {
          if (i !== slotIndex) return ref;
          const nextRef = { ...ref };
          if (category === 'head') nextRef.headDescription = value;
          else if (category === 'clothes') {
            nextRef.clothesDescriptions = [...nextRef.clothesDescriptions];
            nextRef.clothesDescriptions[subIndex] = value;
          } else if (category === 'logo') nextRef.logoDescription = value;
          else if (category === 'foot') nextRef.footDescription = value;
          else {
            nextRef.accessoriesDescriptions = [...nextRef.accessoriesDescriptions];
            nextRef.accessoriesDescriptions[subIndex] = value;
          }
          return nextRef;
        });
      });
    },
    []
  );

  /* Paste image (Ctrl+V) tanpa perlu klik area upload dulu */
  useEffect(() => {
    const onDocumentPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.isContentEditable ||
          target.closest('[data-clipboard-image-slot]'))
      ) {
        return;
      }
      const file = getImageFileFromClipboardData(e.clipboardData);
      if (file) {
        e.preventDefault();
        applyMainPastedFile(file);
      }
    };
    document.addEventListener('paste', onDocumentPaste);
    return () => document.removeEventListener('paste', onDocumentPaste);
  }, [applyMainPastedFile]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file?.type.startsWith('image/')) setFile(file);
    },
    [setFile]
  );

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const getBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.replace(/^data:image\/\w+;base64,/, ''));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });

  const getCompressedImageBase64 = (file: File, maxSize = 1024, quality = 0.8): Promise<{ base64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        let width = w;
        let height = h;
        if (w > maxSize || h > maxSize) {
          if (w >= h) {
            width = maxSize;
            height = Math.round((h * maxSize) / w);
          } else {
            height = maxSize;
            width = Math.round((w * maxSize) / h);
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(img.src);
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        URL.revokeObjectURL(img.src);
        resolve({ base64, mimeType });
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image'));
      };
      img.src = URL.createObjectURL(file);
    });

  const handleStartAnalysis = async () => {
    if (!selectedFile || !organizationId) {
      toast.error(t('detectFromImage.errorNoImage', 'Select or paste an image first.'));
      return;
    }
    setIsAnalyzing(true);
    setArtisticDescription('');
    setCharacterResult(null);
    setDesignResult(null);
    setCharacterSlots([emptyCharacterSlot()]);
    setCharacterStructuredRefs([emptyCharacterStructuredRef()]);
    setSelectedProductId(null);
    setDesignReplace({});
    setGeneratedImageUrl(null);
    try {
      const base64 = await getBase64(selectedFile);
      const apiType = mode === 'scene' ? 'scene' : mode === 'character' ? 'character' : 'design';
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error(
          t(
            'detectFromImage.errorSession',
            'Please sign in again to use image detection (session expired).',
          ),
        );
        return;
      }
      const { data, error } = await supabase.functions.invoke('detect-digital-asset-image', {
        body: { imageBase64: base64, type: apiType },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      // Prefer server error message when present (e.g. 500 with JSON body)
      const serverMessage = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : '';
      if (serverMessage) {
        const msg = serverMessage;
        if (msg.includes('limit') || msg.includes('429')) {
          toast.error(t('detectFromImage.errorLimit', 'Daily limit reached. Try again tomorrow.'));
        } else if (msg.includes('config') || msg.includes('Script AI')) {
          toast.error(t('detectFromImage.errorConfig', 'Script AI config not found. Configure at Settings > Script AI Generator.'));
        } else if (
          msg.includes('Unauthorized') ||
          msg.includes('Invalid or expired session') ||
          msg.includes('sign in again')
        ) {
          toast.error(
            t(
              'detectFromImage.errorSession',
              'Please sign in again to use image detection (session expired).',
            ),
          );
        } else if (msg.includes('high demand') || msg.includes('try again later') || msg.includes('UNAVAILABLE')) {
          toast.error(t('detectFromImage.errorModelBusy', 'Model is busy. Please try again in a moment.'));
        } else {
          toast.error(msg);
        }
        return;
      }
      if (error) throw error;
      if (apiType === 'scene') {
        setArtisticDescription((data?.description as string) ?? '');
      } else if (apiType === 'character') {
        setCharacterResult((data as CharacterResult) ?? null);
      } else {
        setGeneratedImageUrl(null);
        setSelectedBrandId(null);
        setSelectedCompanyLogoId(null);
        setDesignResult((data as DesignResult) ?? null);
        if (data && typeof data === 'object') {
          const d = data as DesignResult;
        setDesignReplace({
          headline: d.headline ?? '',
          sub_headline: d.sub_headline ?? '',
          main_color: d.main_color ?? '',
          other_colors: d.other_colors ?? '',
          text: d.text ?? '',
          elements: d.elements ?? '',
          font: d.font ?? '',
          layout_style_description: d.layout_style_description ?? '',
        });
        }
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      const is429 =
        msg.includes('429') ||
        msg.includes('Too Many Requests') ||
        (typeof err === 'object' && err != null && (err as { context?: { status?: number } }).context?.status === 429);
      const is503OrBusy =
        msg.includes('503') ||
        msg.includes('high demand') ||
        msg.includes('try again later') ||
        (typeof err === 'object' && err != null && (err as { context?: { status?: number } }).context?.status === 503);
      const is401 =
        msg.includes('401') ||
        (typeof err === 'object' &&
          err != null &&
          (err as { context?: { status?: number } }).context?.status === 401);
      const isEdgeFunctionError = msg.includes('Edge Function') || msg.includes('FunctionsFetchError');
      if (is429) {
        toast.error(t('detectFromImage.errorLimit', 'Daily limit reached. Try again tomorrow.'));
      } else if (is503OrBusy) {
        toast.error(t('detectFromImage.errorModelBusy', 'Model is busy. Please try again in a moment.'));
      } else if (is401) {
        toast.error(
          t(
            'detectFromImage.errorSession',
            'Please sign in again to use image detection (session expired).',
          ),
        );
      } else if (isEdgeFunctionError) {
        toast.error(t('detectFromImage.errorService', 'Detection service error. Check Settings > Script AI Generator (API key & config) or try again later.'));
      } else {
        toast.error(msg || t('digitalAssets.detectError', 'Image detection failed.'));
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyDescription = () => {
    if (!artisticDescription) return;
    navigator.clipboard.writeText(artisticDescription);
    toast.success(t('detectFromImage.successCopy', 'Description copied to clipboard.'));
  };

  const buildDesignCopyText = (): string => {
    if (!designResult) return '';
    const lines: string[] = [];
    const getValue = (field: keyof DesignResult): string => {
      const v = designReplace[field] ?? designResult[field];
      return (v != null ? String(v).trim() : '') ?? '';
    };
    const selectedBrand = selectedBrandId ? designBrands.find((b) => b.id === selectedBrandId) : null;
    const add = (label: string, value: string) => {
      if (value !== '') lines.push(`${label}: ${value}`);
    };
    add(t('detectFromImage.headline', 'Headline'), getValue('headline'));
    add(t('detectFromImage.subHeadline', 'Sub headline'), getValue('sub_headline'));

    if (selectedBrand != null) {
      /* Saat brand dipilih: kirim 4 warna dengan peran jelas agar AI pakai semua (termasuk accent) */
      const primary = (selectedBrand.primary_color_hex ?? '').trim();
      const secondary = (selectedBrand.secondary_color_hex ?? '').trim();
      const accent = (selectedBrand.accent_color_hex ?? '').trim();
      const textColor = (selectedBrand.text_color_hex ?? '').trim();
      if (primary) lines.push('Primary color (main background/dominant): ' + primary);
      if (secondary) lines.push('Secondary color: ' + secondary);
      if (accent) lines.push('Accent color (use for buttons, highlights, call-to-action, icons, and accent elements): ' + accent);
      if (textColor) lines.push('Text color: ' + textColor);
      if (primary || secondary || accent || textColor) {
        lines.push('');
        lines.push('Use ALL of the above brand colors in the design. Apply accent color visibly for buttons, highlights, or key visual elements.');
      }
    } else {
      const mainColorValue = getValue('main_color');
      const otherColorsValue = getValue('other_colors');
      add(t('detectFromImage.mainColor', 'Main color'), mainColorValue);
      add(t('detectFromImage.otherColors', 'Other colors'), otherColorsValue);
    }

    add(t('detectFromImage.text', 'Text'), getValue('text'));
    add(t('detectFromImage.elements', 'Elements'), getValue('elements'));
    add(t('detectFromImage.font', 'Font'), getValue('font'));
    const layoutStyleVal = getValue('layout_style_description');
    if (layoutStyleVal !== '') {
      lines.push('');
      lines.push(t('detectFromImage.layoutStyle', 'Layout style'));
      lines.push(layoutStyleVal);
    }
    if (designResult.character_in_design?.trim()) {
      lines.push('');
      add(t('detectFromImage.characterInDesign', 'Character in design'), designResult.character_in_design);
    }
    if (designResult.product_in_design?.trim()) {
      lines.push('');
      add(t('detectFromImage.productInDesign', 'Product in design'), designResult.product_in_design);
    }
    if (selectedProductId) {
      const name = designObjects.find((o) => o.id === selectedProductId)?.name ?? selectedProductId;
      lines.push('');
      lines.push(`${t('detectFromImage.replaceProductWith', 'Replace product with')}: ${name ?? ''}`);
    }
    const slotsWithCharacter = characterSlots.filter((s) => s.characterId != null && s.characterId !== '');
    if (slotsWithCharacter.length > 0) {
      lines.push('');
      const getExprLabel = (v: string | null) => (v && v !== CHAR_AI ? EXPRESSION_OPTIONS.find((o) => o.value === v)?.labelKey ?? v : null);
      const getPoseLabel = (v: string | null) => (v && v !== CHAR_AI ? BODY_POSE_OPTIONS.find((o) => o.value === v)?.labelKey ?? v : null);
      const getGestureLabel = (v: string | null) => (v && v !== CHAR_AI ? HAND_GESTURE_OPTIONS.find((o) => o.value === v)?.labelKey ?? v : null);
      slotsWithCharacter.forEach((slot, idx) => {
        const name = designCharacters.find((c) => c.id === slot.characterId)?.name ?? slot.characterId ?? '';
        const n = idx + 1;
        const parts: string[] = [`Character ${n}: ${name}`];
        const exprL = getExprLabel(slot.expression);
        if (exprL) parts.push(`Expression: ${t(exprL)}`);
        const poseL = getPoseLabel(slot.bodyPose);
        if (poseL) parts.push(`Body pose: ${t(poseL)}`);
        const gestL = getGestureLabel(slot.handGesture);
        if (gestL) parts.push(`Hand gesture: ${t(gestL)}`);
        lines.push(parts.join(', ') + '.');
      });
      lines.push('');
      lines.push(t('detectFromImage.gestureUnspecifiedInstruction', 'Untuk karakter yang tidak ada instruksi gesture, pilih pose yang natural dan sesuai adegan.'));
    }
    return lines.join('\n');
  };

  const handleCopyDesign = () => {
    const text = buildDesignCopyText();
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(t('detectFromImage.promptCopied', 'Copied'));
  };

  const handleImportToSceneAnalysis = useCallback(async () => {
    if (!generatedImageUrl) return;
    const slotsWithCharacter = characterSlots.filter((s) => s.characterId != null && s.characterId !== '');
    if (slotsWithCharacter.length === 0) {
      toast.error(t('detectFromImage.sceneAnalysisErrorNoCharacter'));
      return;
    }
    const masters: Record<string, SceneAnalysisCharacterMaster> = {};
    for (const slot of slotsWithCharacter) {
      const characterId = slot.characterId!;
      const { data: row, error } = await supabase
        .from('digital_asset_characters')
        .select('id, name, reference_image_path, hair_description, face_description, clothing_description, accessories, additional_details')
        .eq('id', characterId)
        .single();
      if (error || !row) {
        toast.error(t('detectFromImage.sceneAnalysisErrorNoCharacter'));
        return;
      }
      const refPath = (row as { reference_image_path?: string | null }).reference_image_path;
      if (!refPath || String(refPath).trim() === '') {
        toast.error(t('detectFromImage.sceneAnalysisErrorNoCharacter'));
        return;
      }
      let signedUrl: string | null = null;
      try {
        const { data: signedData } = await supabase.storage
          .from('digital-asset-character-images')
          .createSignedUrl(refPath, 60 * 60 * 24);
        signedUrl = signedData?.signedUrl ?? null;
      } catch {
        // keep signedUrl null; panel can still show name/refs
      }
      masters[characterId] = {
        id: (row as { id: string }).id,
        name: (row as { name: string | null }).name ?? null,
        reference_image_path: refPath,
        reference_image_url: signedUrl,
        hair_description: (row as { hair_description?: string | null }).hair_description ?? null,
        face_description: (row as { face_description?: string | null }).face_description ?? null,
        clothing_description: (row as { clothing_description?: string | null }).clothing_description ?? null,
        accessories: (row as { accessories?: string | null }).accessories ?? null,
        additional_details: (row as { additional_details?: string | null }).additional_details ?? null,
      };
    }
    setSceneAnalysisCharacterMasters(masters);
    setSceneAnalysisImported(true);
    setMode('scene');
  }, [generatedImageUrl, characterSlots, t]);

  const selectedBrandForDisplay = selectedBrandId ? designBrands.find((b) => b.id === selectedBrandId) : null;
  const displayMainColor = selectedBrandForDisplay
    ? (selectedBrandForDisplay.primary_color_hex ?? designReplace['main_color'] ?? '')
    : (designReplace['main_color'] ?? '');
  const displayOtherColors = selectedBrandForDisplay
    ? [selectedBrandForDisplay.secondary_color_hex, selectedBrandForDisplay.accent_color_hex, selectedBrandForDisplay.text_color_hex]
        .filter((s) => s != null && String(s).trim() !== '')
        .map((s) => String(s).trim())
        .join('; ')
    : (designReplace['other_colors'] ?? '');

  const handleGenerateDesignImage = async () => {
    const characterReferences: { imageBase64: string; mimeType: string }[] = [];
    const characterPoseReferences: Array<{
      characterId: string;
      poseKey: string;
      label: string;
      imageBase64: string;
      mimeType: string;
      isPrimary: boolean;
    }> = [];
    type CharacterRow = {
      slotIndex: number;
      id: string;
      name: string | null;
      reference_image_path: string | null;
      hair_description: string | null;
      face_description: string | null;
      clothing_description: string | null;
      accessories: string | null;
      additional_details: string | null;
    };
    const characterRows: CharacterRow[] = [];

    for (let slotIndex = 0; slotIndex < characterSlots.length; slotIndex++) {
      const slot = characterSlots[slotIndex];
      if (!slot.characterId || slot.characterId === '') continue;
      const characterId = slot.characterId;
      const { data: characterRow, error: charError } = await supabase
        .from('digital_asset_characters')
        .select('id, name, reference_image_path, hair_description, face_description, clothing_description, accessories, additional_details')
        .eq('id', characterId)
        .single();
      if (charError || !characterRow) {
        toast.error(t('digitalAssets.detectError', 'Image generation failed.'));
        return;
      }
      const row = characterRow as {
        id: string;
        name: string | null;
        reference_image_path: string | null;
        hair_description?: string | null;
        face_description?: string | null;
        clothing_description?: string | null;
        accessories?: string | null;
        additional_details?: string | null;
      };
      characterRows.push({
        slotIndex,
        id: row.id,
        name: row.name,
        reference_image_path: row.reference_image_path,
        hair_description: row.hair_description ?? null,
        face_description: row.face_description ?? null,
        clothing_description: row.clothing_description ?? null,
        accessories: row.accessories ?? null,
        additional_details: row.additional_details ?? null,
      });
    }

    if (characterRows.length > 0) {
      try {
        const { loadPoseReferencesForCharacters } = await import(
          '../lib/loadCharacterPoseReferences'
        );
        const { refs, summary } = await loadPoseReferencesForCharacters(
          characterRows.map((r) => r.id),
          { t },
        );
        if (refs.length === 0) {
          toast.error(
            t(
              'detectFromImage.errorCharacterNoReferencePhoto',
              'Selected character has no reference photo. Add one in Digital Assets > Character.',
            ),
          );
          return;
        }
        for (const ref of refs) {
          characterPoseReferences.push(ref);
          characterReferences.push({ imageBase64: ref.imageBase64, mimeType: ref.mimeType });
        }
        const truncated = summary.some((s) => s.included < s.totalAvailable);
        if (truncated) {
          const included = summary.reduce((n, s) => n + s.included, 0);
          const total = summary.reduce((n, s) => n + s.totalAvailable, 0);
          toast.message(
            t(
              'detectFromImage.poseRefsTruncated',
              'Sending {{included}} of {{total}} pose photo(s) (payload limit).',
              { included, total },
            ),
          );
        }
      } catch (err) {
        console.error(err);
        toast.error(
          t('detectFromImage.errorCharacterReferenceLoadFailed', 'Failed to load character reference photo.'),
        );
        return;
      }
    }

    let companyLogoBase64: string | undefined;
    let companyLogoMimeType: string | undefined;
    if (selectedCompanyLogoId) {
      const logoEntry = designCompanyLogos.find((l) => l.id === selectedCompanyLogoId);
      if (!logoEntry) {
        toast.error(t('detectFromImage.errorCompanyLogoLoadFailed', 'Failed to load company logo.'));
        return;
      }
      if (!logoEntry.logo_path || String(logoEntry.logo_path).trim() === '') {
        toast.error(
          t(
            'detectFromImage.errorCompanyLogoNoFile',
            'Selected company logo has no image. Upload a logo in Digital Assets > Company Logo.'
          )
        );
        return;
      }
      try {
          const { data: signedData, error: signedError } = await supabase.storage
            .from('digital-asset-company-logos')
            .createSignedUrl(logoEntry.logo_path, 60 * 60 * 24, {
              transform: { width: 512, height: 512, resize: "contain", quality: 80 },
            });
          if (signedError || !signedData?.signedUrl) {
            toast.error(t('detectFromImage.errorCompanyLogoLoadFailed', 'Failed to load company logo.'));
            return;
          }
          const res = await fetch(signedData.signedUrl);
          if (!res.ok) {
            toast.error(t('detectFromImage.errorCompanyLogoLoadFailed', 'Failed to load company logo.'));
            return;
          }
          const blob = await res.blob();
          const mime = blob.type?.startsWith('image/') ? blob.type : 'image/png';
          const file = new File([blob], 'company-logo.png', { type: mime });
          const { base64, mimeType } = await getCompressedImageBase64(file, 512, 0.8);
          companyLogoBase64 = base64;
          companyLogoMimeType = mimeType;
        } catch (err) {
          console.error(err);
          toast.error(t('detectFromImage.errorCompanyLogoLoadFailed', 'Failed to load company logo.'));
          return;
        }
    }

    let prompt = buildDesignCopyText();
    if (!prompt.trim()) {
      toast.error(t('detectFromImage.errorEmptyPrompt', 'Add at least one "Replace to..." value or select character/product to generate from.'));
      return;
    }
    const shouldSendReference =
      selectedFile != null && designResult != null && characterReferences.length === 0;
    if (shouldSendReference) {
      const referenceInstruction =
        'The attached image is the reference design. Generate a new image that keeps the same layout, style, and composition. Apply only the following text and color changes. Do not reproduce the reference exactly; create a new image in the same style.\n\n';
      prompt = referenceInstruction + prompt;
    }
    if (characterReferences.length > 0) {
      const textOnlyInstruction =
        'Generate an image according to the design description below. ';
      if (!shouldSendReference) prompt = textOnlyInstruction + prompt;
    }
    setIsGeneratingImage(true);
    try {
      type StructuredRefEntry = {
        head?: { imageBase64: string; mimeType: string; description?: string };
        clothes?: Array<{ imageBase64: string; mimeType: string; description?: string }>;
        logo?: { imageBase64: string; mimeType: string; description?: string };
        foot?: { imageBase64: string; mimeType: string; description?: string };
        accessories?: Array<{ imageBase64: string; mimeType: string; description?: string }>;
      };
      const characterStructuredReferences: StructuredRefEntry[] = [];
      const characterTextParts: Array<{
        faceHair?: string;
        clothing?: string;
        foot?: string;
        accessories?: string;
      }> = [];

      let totalRefImages = (shouldSendReference && selectedFile ? 1 : 0) + characterReferences.length
        + layoutCompositionSlots.filter((f): f is File => f != null).length
        + (companyLogoBase64 ? 1 : 0);
      for (const refs of characterStructuredRefs) {
        if (refs?.head) totalRefImages += 1;
        totalRefImages += refs?.clothes?.filter(Boolean).length ?? 0;
        if (refs?.logo) totalRefImages += 1;
        if (refs?.foot) totalRefImages += 1;
        totalRefImages += refs?.accessories?.filter(Boolean).length ?? 0;
      }
      // Keep total request body under ~1MB (Supabase Edge Function limit) to avoid FunctionsFetchError
      const compSize = totalRefImages > 8 ? 448 : totalRefImages > 5 ? 512 : totalRefImages > 2 ? 640 : 1024;
      const compQuality = totalRefImages > 8 ? 0.55 : totalRefImages > 5 ? 0.6 : totalRefImages > 2 ? 0.7 : 0.8;

      for (const row of characterRows) {
        const refs = characterStructuredRefs[row.slotIndex];
        const entry: StructuredRefEntry = {};
        if (refs?.head) {
          const { base64, mimeType } = await getCompressedImageBase64(refs.head, compSize, compQuality);
          const desc = refs.headDescription?.trim();
          entry.head = { imageBase64: base64, mimeType, ...(desc ? { description: desc } : {}) };
        }
        if (refs?.clothes?.length) {
          entry.clothes = [];
          for (let i = 0; i < refs.clothes.length; i++) {
            const f = refs.clothes[i];
            if (!f) continue;
            const { base64, mimeType } = await getCompressedImageBase64(f, compSize, compQuality);
            const desc = refs.clothesDescriptions?.[i]?.trim();
            entry.clothes.push({ imageBase64: base64, mimeType, ...(desc ? { description: desc } : {}) });
          }
        }
        if (refs?.logo) {
          const { base64, mimeType } = await getCompressedImageBase64(refs.logo, compSize, compQuality);
          const desc = refs.logoDescription?.trim();
          entry.logo = { imageBase64: base64, mimeType, ...(desc ? { description: desc } : {}) };
        }
        if (refs?.foot) {
          const { base64, mimeType } = await getCompressedImageBase64(refs.foot, compSize, compQuality);
          const desc = refs.footDescription?.trim();
          entry.foot = { imageBase64: base64, mimeType, ...(desc ? { description: desc } : {}) };
        }
        if (refs?.accessories?.length) {
          entry.accessories = [];
          for (let i = 0; i < refs.accessories.length; i++) {
            const f = refs.accessories[i];
            if (!f) continue;
            const { base64, mimeType } = await getCompressedImageBase64(f, compSize, compQuality);
            const desc = refs.accessoriesDescriptions?.[i]?.trim();
            entry.accessories.push({ imageBase64: base64, mimeType, ...(desc ? { description: desc } : {}) });
          }
        }
        characterStructuredReferences.push(entry);

        const hasClothesImages = Boolean(refs?.clothes?.some((f) => f != null));
        const hasFootImage = refs?.foot != null;
        const hasAccessoriesImages = Boolean(refs?.accessories?.some((f) => f != null));
        const faceHairParts = [row.hair_description, row.face_description].filter((s) => s != null && String(s).trim() !== '');
        characterTextParts.push({
          faceHair: faceHairParts.length > 0 ? faceHairParts.join(' ') : undefined,
          clothing: hasClothesImages ? undefined : (row.clothing_description?.trim() || undefined),
          foot: hasFootImage ? undefined : (row.additional_details?.trim() || undefined),
          accessories: hasAccessoriesImages ? undefined : (row.accessories?.trim() || undefined),
        });
      }

      const body: {
        prompt: string;
        aspectRatio: string;
        customWidth?: number;
        customHeight?: number;
        customUnit?: string;
        referenceImageBase64?: string;
        referenceImageMimeType?: string;
        characterReferences?: { imageBase64: string; mimeType: string }[];
        characterPoseReferences?: Array<{
          characterId: string;
          poseKey: string;
          label: string;
          imageBase64: string;
          mimeType: string;
          isPrimary?: boolean;
        }>;
        characterStructuredReferences?: Array<{
          head?: { imageBase64: string; mimeType: string; description?: string };
          clothes?: Array<{ imageBase64: string; mimeType: string; description?: string }>;
          logo?: { imageBase64: string; mimeType: string; description?: string };
          foot?: { imageBase64: string; mimeType: string; description?: string };
          accessories?: Array<{ imageBase64: string; mimeType: string; description?: string }>;
        }>;
        characterTextParts?: Array<{ faceHair?: string; clothing?: string; foot?: string; accessories?: string }>;
        companyLogoBase64?: string;
        companyLogoMimeType?: string;
        compositionReferences?: { imageBase64: string; mimeType: string }[];
        elementsText?: string;
        layoutStyleText?: string;
        headline?: string;
        sub_headline?: string;
        text?: string;
      } = {
        prompt,
        aspectRatio: designImageAspectRatio,
      };
      const headlineVal = String(designReplace['headline'] ?? designResult?.headline ?? '').trim();
      const subHeadlineVal = String(designReplace['sub_headline'] ?? designResult?.sub_headline ?? '').trim();
      const textVal = String(designReplace['text'] ?? designResult?.text ?? '').trim();
      if (headlineVal) body.headline = headlineVal;
      if (subHeadlineVal) body.sub_headline = subHeadlineVal;
      if (textVal) body.text = textVal;
      if (designImageAspectRatio === 'custom') {
        const w = Number(customSizeWidth);
        const h = Number(customSizeHeight);
        if (Number.isFinite(w) && w >= 1 && w <= 99999 && Number.isFinite(h) && h >= 1 && h <= 99999) {
          body.customWidth = w;
          body.customHeight = h;
          body.customUnit = customSizeUnit;
        }
      }
      const elementsVal = (designReplace['elements'] ?? '').trim();
      const layoutStyleVal = (designReplace['layout_style_description'] ?? '').trim();
      if (elementsVal) body.elementsText = elementsVal;
      if (layoutStyleVal) body.layoutStyleText = layoutStyleVal;
      if (shouldSendReference && selectedFile) {
        const { base64: referenceBase64, mimeType: referenceMimeType } = await getCompressedImageBase64(
          selectedFile,
          compSize,
          compQuality
        );
        body.referenceImageBase64 = referenceBase64;
        body.referenceImageMimeType = referenceMimeType;
      }
      if (characterReferences.length > 0) {
        body.characterReferences = characterReferences;
      }
      if (characterPoseReferences.length > 0) {
        body.characterPoseReferences = characterPoseReferences;
      }
      if (characterStructuredReferences.length > 0) {
        body.characterStructuredReferences = characterStructuredReferences;
      }
      if (characterTextParts.length > 0) {
        body.characterTextParts = characterTextParts;
      }
      if (companyLogoBase64 && companyLogoMimeType) {
        body.companyLogoBase64 = companyLogoBase64;
        body.companyLogoMimeType = companyLogoMimeType;
      }
      const filledSlots = layoutCompositionSlots.filter((f): f is File => f != null);
      if (filledSlots.length > 0) {
        const compositionReferences: { imageBase64: string; mimeType: string }[] = [];
        for (const file of filledSlots) {
          const { base64: imageBase64, mimeType } = await getCompressedImageBase64(file, compSize, compQuality);
          compositionReferences.push({ imageBase64, mimeType });
        }
        body.compositionReferences = compositionReferences;
      }

      const PAYLOAD_LIMIT_BYTES = 900_000;
      const estimateBodySize = (b: typeof body): number => {
        let n = (b.prompt?.length ?? 0) + (b.elementsText?.length ?? 0) + (b.layoutStyleText?.length ?? 0) + 5000;
        if (b.referenceImageBase64) n += b.referenceImageBase64.length;
        for (const r of b.characterReferences ?? []) n += (r.imageBase64?.length ?? 0);
        for (const r of b.characterPoseReferences ?? []) n += (r.imageBase64?.length ?? 0);
        for (const s of b.characterStructuredReferences ?? []) {
          if (s.head?.imageBase64) n += s.head.imageBase64.length;
          for (const c of s.clothes ?? []) n += (c.imageBase64?.length ?? 0);
          if (s.logo?.imageBase64) n += s.logo.imageBase64.length;
          if (s.foot?.imageBase64) n += s.foot.imageBase64.length;
          for (const a of s.accessories ?? []) n += (a.imageBase64?.length ?? 0);
        }
        if (b.companyLogoBase64) n += b.companyLogoBase64.length;
        for (const c of b.compositionReferences ?? []) n += (c.imageBase64?.length ?? 0);
        return n;
      };
      const estimatedSize = estimateBodySize(body);
      if (estimatedSize > PAYLOAD_LIMIT_BYTES) {
        toast.error(
          t(
            'detectFromImage.errorPayloadTooLarge',
            'Too many or too large reference images. Remove some images or use smaller files to stay under the request limit.'
          )
        );
        return;
      }

      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      const designSession = refreshed.session ?? (await supabase.auth.getSession()).data.session;
      if (refreshErr || !designSession?.access_token) {
        toast.error(
          t(
            'detectFromImage.errorSession',
            'Please sign in again to use image detection (session expired).',
          ),
        );
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-design-image', {
        body,
        headers: { Authorization: `Bearer ${designSession.access_token}` },
        // Perpanjang timeout agar request sampai ke Gemini (generate image bisa 60–120 detik)
        timeout: 180000, // 3 menit (default client sering 60s)
      });
      if (data?.error) {
        const msg = String(data.error);
        if (msg.includes('limit') || msg.includes('429')) {
          toast.error(t('detectFromImage.errorLimit', 'Daily limit reached. Try again tomorrow.'));
        } else if (msg.includes('config') || msg.includes('Script AI')) {
          toast.error(t('detectFromImage.errorConfig', 'Script AI config not found. Configure at Settings > Script AI Generator.'));
        } else {
          toast.error(msg);
        }
        return;
      }
      if (error) throw error;
      const base64 = data?.imageBase64;
      const mimeType = data?.mimeType ?? 'image/png';
      if (!base64) {
        toast.error(t('digitalAssets.detectError', 'Image generation failed.'));
        return;
      }
      const dataUrl = `data:${mimeType};base64,${base64}`;
      const targetRatio = getTargetAspectRatio(designImageAspectRatio, customSizeWidth, customSizeHeight);
      const fittedUrl = await fitDataUrlToAspectRatio(dataUrl, targetRatio);
      setGeneratedImageUrl(fittedUrl);
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof Error ? err.message : t('digitalAssets.detectError', 'Image generation failed.');
      const is429 =
        (typeof msg === 'string' && (msg.includes('429') || msg.includes('Too Many Requests'))) ||
        (err != null && typeof err === 'object' && (err as { context?: { status?: number } }).context?.status === 429);
      if (is429) {
        toast.error(t('detectFromImage.errorLimit', 'Daily limit reached. Try again tomorrow.'));
      } else {
        const isEdgeFunctionFetchError =
          (err != null && typeof err === 'object' && (err as { name?: string }).name === 'FunctionsFetchError') ||
          (typeof msg === 'string' &&
            (msg.includes('Failed to send a request') ||
              msg.includes('FunctionsFetchError') ||
              msg.includes('Edge Function') ||
              msg.includes('fetch')));
        if (isEdgeFunctionFetchError) {
          toast.error(
            t(
              'detectFromImage.errorRequestTooLarge',
              'Request failed (timeout or payload too large). Use fewer or smaller reference images and try again.'
            )
          );
        } else {
          toast.error(msg);
        }
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownloadGeneratedImage = () => {
    if (!generatedImageUrl) return;
    const ext = generatedImageUrl.startsWith('data:image/jpeg') || generatedImageUrl.startsWith('data:image/jpg') ? 'jpg' : 'png';
    const filename = `design-generated-${Date.now()}.${ext}`;
    const a = document.createElement('a');
    a.href = generatedImageUrl;
    a.download = filename;
    a.click();
  };

  const generateSceneNegativePrompt = useCallback(async () => {
    if (!generatedImageUrl) return;
    const imageBase64 = generatedImageUrl.includes('base64,') ? generatedImageUrl.split('base64,')[1]?.trim() ?? generatedImageUrl : generatedImageUrl;
    const baseSP = buildSceneAnalysisSuperPrompt({
      designReplace,
      designResult,
      characterSlots,
      characterStructuredRefs,
      designCharacters,
      sceneAnalysisCameraMovement,
      sceneAnalysisLanguage,
      sceneAnalysisCharacterNarasi,
      sceneAnalysisCharacterMasters,
      getLabel: (key) => t(key),
      cameraMovementOptions: CAMERA_MOVEMENT_OPTIONS,
      expressionOptions: EXPRESSION_OPTIONS,
      bodyPoseOptions: BODY_POSE_OPTIONS,
      handGestureOptions: HAND_GESTURE_OPTIONS,
    });
    const superPromptText = sceneAnalysisImageDescriptionPrompt
      ? `--- DESKRIPSI DARI GAMBAR ---\n${sceneAnalysisImageDescriptionPrompt}\n\n${baseSP}`
      : baseSP;
    const narrationText = Object.entries(sceneAnalysisCharacterNarasi)
      .filter(([, v]) => v?.trim())
      .map(([, v]) => v)
      .join(' | ');
    setSceneAnalysisNegativePromptLoading(true);
    setSceneAnalysisNegativePromptError(null);
    try {
      const cameraMovementLabel = CAMERA_MOVEMENT_OPTIONS.find((o) => o.value === sceneAnalysisCameraMovement)?.value ?? sceneAnalysisCameraMovement;
      const { data: data2, error: error2 } = await supabase.functions.invoke('generate-scene-negative-prompt', {
        body: {
          imageBase64,
          superPrompt: superPromptText,
          language: sceneAnalysisLanguage === 'id' ? 'Indonesian' : 'English',
          cameraMovement: cameraMovementLabel,
          narration: narrationText,
        },
        timeout: 120000, // 2 menit agar request ke Gemini sempat selesai
      });
      if (data2?.error) {
        const msg = String(data2.error);
        if (msg.includes('limit') || msg.includes('429')) {
          toast.error(t('detectFromImage.errorLimit', 'Daily limit reached. Try again tomorrow.'));
        } else if (msg.includes('config') || msg.includes('Script AI')) {
          toast.error(t('detectFromImage.errorConfig', 'Script AI config not found. Configure at Settings > Script AI Generator.'));
        } else {
          toast.error(msg);
        }
        setSceneAnalysisNegativePromptError(msg);
        return;
      }
      if (error2) {
        let serverMsg: string | null = null;
        const ctx = (error2 as { context?: unknown }).context;
        if (ctx && typeof ctx === 'object' && ctx instanceof Response) {
          try {
            const body = await ctx.clone().json() as { error?: string };
            if (body?.error) serverMsg = body.error;
          } catch {
            // ignore
          }
        }
        const msg = serverMsg ?? (error2 instanceof Error ? error2.message : t('detectFromImage.errorGenerateNegativePrompt', 'Failed to generate negative prompt.'));
        setSceneAnalysisNegativePromptError(msg);
        toast.error(msg);
        return;
      }
      const negativePrompt = data2?.negativePrompt;
      if (typeof negativePrompt === 'string' && negativePrompt.trim()) {
        setSceneAnalysisGeneratedNegativePrompt(negativePrompt.trim());
      } else {
        setSceneAnalysisNegativePromptError(t('detectFromImage.errorNoNegativePrompt', 'No negative prompt generated.'));
      }
    } catch (err) {
      console.error(err);
      let msg = err instanceof Error ? err.message : t('detectFromImage.errorGenerateNegativePrompt', 'Failed to generate negative prompt.');
      const ctx = (err as { context?: unknown }).context;
      if (ctx && typeof ctx === 'object' && ctx instanceof Response) {
        try {
          const body = await (ctx as Response).clone().json() as { error?: string };
          if (body?.error) msg = body.error;
        } catch {
          // keep msg
        }
      }
      const is429 = typeof msg === 'string' && (msg.includes('429') || msg.includes('Too Many Requests'));
      const displayMsg = is429 ? t('detectFromImage.errorLimit', 'Daily limit reached. Try again tomorrow.') : msg;
      setSceneAnalysisNegativePromptError(displayMsg);
      toast.error(displayMsg);
    } finally {
      setSceneAnalysisNegativePromptLoading(false);
    }
  }, [
    generatedImageUrl,
    sceneAnalysisImageDescriptionPrompt,
    designReplace,
    designResult,
    characterSlots,
    characterStructuredRefs,
    designCharacters,
    sceneAnalysisCameraMovement,
    sceneAnalysisLanguage,
    sceneAnalysisCharacterNarasi,
    sceneAnalysisCharacterMasters,
    t,
  ]);

  const generateSceneImageDescription = useCallback(async () => {
    if (!generatedImageUrl) return;
    const imageBase64 = generatedImageUrl.includes('base64,') ? generatedImageUrl.split('base64,')[1]?.trim() ?? generatedImageUrl : generatedImageUrl;
    let imageBase64Second = '';
    try {
      const secondFile = layoutCompositionSlots[0] ?? selectedFile ?? null;
      if (secondFile instanceof File) {
        imageBase64Second = await getBase64(secondFile);
      }
    } catch {
      // omit second image
    }
    setSceneAnalysisImageDescriptionLoading(true);
    setSceneAnalysisImageDescriptionError(null);
    try {
      const body: { imageBase64: string; imageBase64Second?: string } = { imageBase64 };
      if (imageBase64Second.length >= 100) body.imageBase64Second = imageBase64Second;
      const { data, error } = await supabase.functions.invoke('generate-scene-image-description', {
        body,
        timeout: 120000,
      });
      if (data?.error) {
        const msg = String(data.error);
        if (msg.includes('limit') || msg.includes('429')) {
          toast.error(t('detectFromImage.errorLimit', 'Daily limit reached. Try again tomorrow.'));
        } else if (msg.includes('config') || msg.includes('Script AI')) {
          toast.error(t('detectFromImage.errorConfig', 'Script AI config not found. Configure at Settings > Script AI Generator.'));
        } else {
          toast.error(msg);
        }
        setSceneAnalysisImageDescriptionError(msg);
        return;
      }
      if (error) {
        let serverMsg: string | null = null;
        const ctx = (error as { context?: unknown }).context;
        if (ctx && typeof ctx === 'object' && ctx instanceof Response) {
          try {
            const resBody = await ctx.clone().json() as { error?: string };
            if (resBody?.error) serverMsg = resBody.error;
          } catch {
            // ignore
          }
        }
        const msg = serverMsg ?? (error instanceof Error ? error.message : t('detectFromImage.sceneAnalysisImageDescriptionError', 'Failed to generate image description.'));
        setSceneAnalysisImageDescriptionError(msg);
        toast.error(msg);
        return;
      }
      const prompt = data?.imageDescriptionPrompt;
      if (typeof prompt === 'string' && prompt.trim()) {
        setSceneAnalysisImageDescriptionPrompt(prompt.trim());
      } else {
        setSceneAnalysisImageDescriptionError(t('detectFromImage.sceneAnalysisImageDescriptionError', 'Failed to generate image description.'));
      }
    } catch (err) {
      console.error(err);
      let msg = err instanceof Error ? err.message : t('detectFromImage.sceneAnalysisImageDescriptionError', 'Failed to generate image description.');
      const ctx = (err as { context?: unknown }).context;
      if (ctx && typeof ctx === 'object' && ctx instanceof Response) {
        try {
          const resBody = await (ctx as Response).clone().json() as { error?: string };
          if (resBody?.error) msg = resBody.error;
        } catch {
          // keep msg
        }
      }
      const is429 = typeof msg === 'string' && (msg.includes('429') || msg.includes('Too Many Requests'));
      const displayMsg = is429 ? t('detectFromImage.errorLimit', 'Daily limit reached. Try again tomorrow.') : msg;
      setSceneAnalysisImageDescriptionError(displayMsg);
      toast.error(displayMsg);
    } finally {
      setSceneAnalysisImageDescriptionLoading(false);
    }
  }, [generatedImageUrl, layoutCompositionSlots, selectedFile, getBase64, t]);

  useEffect(() => {
    if (mode !== 'scene' || !sceneAnalysisImported || !generatedImageUrl || hasAutoGeneratedImageDescriptionRef.current) return;
    hasAutoGeneratedImageDescriptionRef.current = true;
    generateSceneImageDescription();
  }, [mode, sceneAnalysisImported, generatedImageUrl, generateSceneImageDescription]);

  useEffect(() => {
    if (mode !== 'scene' || !sceneAnalysisImported || !generatedImageUrl || hasAutoGeneratedNegativePromptRef.current) return;
    hasAutoGeneratedNegativePromptRef.current = true;
    generateSceneNegativePrompt();
  }, [mode, sceneAnalysisImported, generatedImageUrl, generateSceneNegativePrompt]);

  const handleSaveToCharacterFromScene = async () => {
    if (!organizationId || !artisticDescription) return;
    try {
      const { error } = await supabase.from('digital_asset_characters').insert({
        organization_id: organizationId,
        name: t('detectFromImage.defaultNameFromScene', 'From scene'),
        additional_details: artisticDescription,
        age: null,
        nationality: null,
        gender: null,
        hair_description: null,
        face_description: null,
        accessories: null,
        body_shape: null,
        height: null,
      });
      if (error) throw error;
      toast.success(t('detectFromImage.successSaveCharacter', 'Saved to Character successfully.'));
    } catch (err) {
      console.error(err);
      toast.error(t('digitalAssets.saveError', 'Failed to save.'));
    }
  };

  const handleSaveToObject = async () => {
    if (!organizationId || !artisticDescription) return;
    try {
      const { error } = await supabase.from('digital_asset_objects').insert({
        organization_id: organizationId,
        name: t('detectFromImage.defaultNameFromScene', 'From scene'),
        description: artisticDescription,
      });
      if (error) throw error;
      toast.success(t('detectFromImage.successSaveObject', 'Saved to Object successfully.'));
    } catch (err) {
      console.error(err);
      toast.error(t('digitalAssets.saveError', 'Failed to save.'));
    }
  };

  const handleSaveCharacterFromExtraction = async () => {
    if (!organizationId || !characterResult) return;
    const combinedPromptString = buildCombinedPrompt({
      name: characterResult.name?.trim().toLowerCase() === 'unknown' ? null : characterResult.name,
      age: characterResult.age,
      gender: characterResult.gender,
      hair_description: characterResult.hair_description,
      face_description: characterResult.face_description,
      clothing_description: characterResult.clothing_description,
      additional_details: characterResult.additional_details,
    });
    const payload = {
      organization_id: organizationId,
      name: (characterResult.name?.trim().toLowerCase() === 'unknown' ? null : characterResult.name) ?? null,
      age: characterResult.age ?? null,
      nationality: characterResult.nationality ?? null,
      gender: characterResult.gender ?? null,
      hair_description: characterResult.hair_description ?? null,
      face_description: characterResult.face_description ?? null,
      clothing_description: characterResult.clothing_description ?? null,
      accessories: characterResult.accessories ?? null,
      body_shape: characterResult.body_shape ?? null,
      height: characterResult.height ?? null,
      additional_details: characterResult.additional_details ?? null,
      combined_prompt: combinedPromptString || null,
    };
    try {
      const { data: inserted, error: insertError } = await supabase
        .from('digital_asset_characters')
        .insert(payload)
        .select('id')
        .single();
      if (insertError) throw insertError;
      const characterId = inserted?.id;
      if (!characterId) throw new Error('No id returned');

      if (selectedFile) {
        const imageId = crypto.randomUUID();
        const ext = selectedFile.name?.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '.jpg';
        const path = `${organizationId}/${characterId}/${imageId}${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('digital-asset-character-images')
          .upload(
            path,
            selectedFile,
            storageUploadOptions({ upsert: true, contentType: selectedFile.type || "image/jpeg" }),
          );
        if (uploadError) {
          console.error(uploadError);
          if (organizationId) {
            void queryClient.invalidateQueries({ queryKey: digitalAssetCharactersKey(organizationId) });
          }
          toast.success(t('detectFromImage.successSaveCharacter', 'Saved to Character successfully.'));
          toast.error(t('detectFromImage.imageUploadFailed', 'Character saved but image upload failed.'));
          return;
        }
        const { error: imageRowError } = await supabase.from('digital_asset_character_images').insert({
          id: imageId,
          organization_id: organizationId,
          character_id: characterId,
          storage_path: path,
          pose_key: 'front_closeup',
          label_custom: null,
          sort_order: 0,
          is_primary: true,
        });
        if (imageRowError) {
          console.error(imageRowError);
          if (organizationId) {
            void queryClient.invalidateQueries({ queryKey: digitalAssetCharactersKey(organizationId) });
          }
          toast.success(t('detectFromImage.successSaveCharacter', 'Saved to Character successfully.'));
          toast.error(t('detectFromImage.imageUploadFailed', 'Character saved but image upload failed.'));
          return;
        }
        const { error: updateError } = await supabase
          .from('digital_asset_characters')
          .update({ reference_image_path: path })
          .eq('id', characterId);
        if (updateError) {
          console.error(updateError);
          if (organizationId) {
            void queryClient.invalidateQueries({ queryKey: digitalAssetCharactersKey(organizationId) });
          }
          toast.success(t('detectFromImage.successSaveCharacter', 'Saved to Character successfully.'));
          toast.error(t('detectFromImage.imageUploadFailed', 'Character saved but image upload failed.'));
          return;
        }
      }
      if (organizationId) {
        void queryClient.invalidateQueries({ queryKey: digitalAssetCharactersKey(organizationId) });
        void queryClient.invalidateQueries({
          queryKey: ['digital_asset_character_images', organizationId],
        });
      }
      toast.success(t('detectFromImage.successSaveCharacter', 'Saved to Character successfully.'));
    } catch (err) {
      console.error(err);
      toast.error(t('digitalAssets.saveError', 'Failed to save.'));
    }
  };

  return (
    <div className="space-y-4 bg-white text-gray-900 border border-gray-200 rounded-lg p-4">
      {/* Tips - full width */}
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 flex items-start gap-2">
        <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">{t('detectFromImage.tipsTitle', 'Two analysis modes')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('detectFromImage.tipsBody', 'Scene Analysis: one long artistic description. Character Extraction: structured data (name, age, gender, hair, face, clothing, detail).')}</p>
        </div>
      </div>

      {/* Two columns: Upload (left) | Result (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Upload Image + Mode + Start Analysis */}
        <div className="space-y-4">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
                e.target.value = '';
              }}
            />
            <div
              role="button"
              tabIndex={0}
              data-clipboard-image-slot
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              onClick={() => {
                if (uploadClickTimeoutRef.current) clearTimeout(uploadClickTimeoutRef.current);
                uploadClickTimeoutRef.current = setTimeout(() => {
                  uploadClickTimeoutRef.current = null;
                  readClipboardAsFile().then((file) => { if (file) setFile(file); });
                }, CLICK_VS_DBLCLICK_MS);
              }}
              onDoubleClick={() => {
                if (uploadClickTimeoutRef.current) {
                  clearTimeout(uploadClickTimeoutRef.current);
                  uploadClickTimeoutRef.current = null;
                }
                fileInputRef.current?.click();
              }}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-sm text-gray-600 hover:border-primary/40 hover:bg-gray-50 transition-colors cursor-pointer min-h-[200px] flex flex-col items-center justify-center"
            >
              {previewUrl ? (
                <div className="space-y-2 w-full flex-1 flex flex-col min-h-0">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    decoding="async"
                    className="w-full max-h-[320px] min-h-[200px] mx-auto rounded object-contain flex-1"
                  />
                  <p className="font-medium text-gray-900 truncate px-2 text-sm">{selectedFile?.name}</p>
                  <p className="text-xs">{t('detectFromImage.pasteOrDrop', 'Paste image here (Ctrl+V) or click to change file')}</p>
                </div>
              ) : (
                <>
                  <ImageIcon className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                  <p>{t('detectFromImage.pasteOrDrop', 'Paste image here (Ctrl+V) or click Choose File')}</p>
                  <p className="text-xs mt-1 text-gray-500">{t('detectFromImage.singleClickPasteDoubleClickFile', 'Single click to paste from clipboard, double-click to choose file.')}</p>
                  <p className="text-xs mt-1 text-gray-500">{t('detectFromImage.pasteWorksAnywhere', 'Ctrl+V works from anywhere on this page — no need to click here first.')}</p>
                  <p className="text-xs mt-1 text-gray-500">{t('detectFromImage.noFileChosen', 'No file chosen')}</p>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border-2 border-primary/25 bg-white shadow-md overflow-hidden">
            <div className="px-4 py-3 border-b-2 border-primary/20 bg-primary/5">
              <h4 className="text-sm font-semibold text-foreground">{t('detectFromImage.modeTitle', 'Select Analysis Mode')}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{t('detectFromImage.modeTitleHint', 'Pilih mode lalu klik Start Analysis.')}</p>
            </div>
            <div className="p-4 space-y-4 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('character')}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                    mode === 'character'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-primary/35 hover:bg-slate-50'
                  }`}
                >
                  <User className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{t('detectFromImage.modeCharacter', 'Character Extraction')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('design')}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                    mode === 'design'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-primary/35 hover:bg-slate-50'
                  }`}
                >
                  <Layout className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{t('detectFromImage.modeDesign', 'Design Extraction')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('scene')}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                    mode === 'scene'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-primary/35 hover:bg-slate-50'
                  }`}
                >
                  <Box className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{t('detectFromImage.modeScene', 'Scene Analysis')}</span>
                </button>
              </div>
              <Button
                type="button"
                onClick={handleStartAnalysis}
                disabled={!selectedFile || isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <span className="animate-pulse">{t('digitalAssets.detecting', 'Detecting...')}</span>
                ) : (
                  t('detectFromImage.startAnalysis', 'Start Analysis')
                )}
              </Button>
            </div>
          </div>

          {designResult && (
            <>
              {/* Section: Teks & Headline */}
              <div className="rounded-xl border-2 border-slate-300 bg-white shadow-md overflow-hidden">
                <div className="px-4 py-3 border-b-2 border-slate-300 bg-slate-100">
                  <h5 className="text-sm font-semibold text-slate-800">{t('detectFromImage.textContentSection', 'Teks & Headline')}</h5>
                  <p className="text-xs text-slate-600 mt-0.5">{t('detectFromImage.textContentSectionHint', 'Edit teks di bawah untuk hasil generate gambar.')}</p>
                </div>
                <div className="p-4 space-y-5 bg-white">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{t('detectFromImage.headline', 'Headline')}</label>
                    <div className="text-xs text-gray-500 bg-slate-100 rounded-md px-3 py-2 border border-slate-200">
                      <span className="line-clamp-1" title={designResult.headline ?? ''}>{designResult.headline ?? '—'}</span>
                    </div>
                    <input
                      value={designReplace['headline'] ?? ''}
                      onChange={(e) => setDesignReplace((prev) => ({ ...prev, headline: e.target.value }))}
                      placeholder={t('detectFromImage.replaceWithPlaceholder', 'Ganti dengan...')}
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{t('detectFromImage.subHeadline', 'Sub headline')}</label>
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2 border border-gray-100 max-h-12 overflow-y-auto">
                      <span className="line-clamp-2" title={designResult.sub_headline ?? ''}>{designResult.sub_headline ?? '—'}</span>
                    </div>
                    <textarea
                      value={designReplace['sub_headline'] ?? ''}
                      onChange={(e) => setDesignReplace((prev) => ({ ...prev, sub_headline: e.target.value }))}
                      placeholder={t('detectFromImage.replaceWithPlaceholder', 'Ganti dengan...')}
                      rows={2}
                      className="w-full min-h-[72px] rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{t('detectFromImage.text', 'Text')}</label>
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2 border border-gray-100 max-h-12 overflow-y-auto">
                      <span className="line-clamp-2" title={designResult.text ?? ''}>{designResult.text ?? '—'}</span>
                    </div>
                    <textarea
                      value={designReplace['text'] ?? ''}
                      onChange={(e) => setDesignReplace((prev) => ({ ...prev, text: e.target.value }))}
                      placeholder={t('detectFromImage.replaceWithPlaceholder', 'Ganti dengan...')}
                      rows={3}
                      className="w-full min-h-[80px] rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* Section: Warna & Brand */}
              <div className="rounded-xl border-2 border-slate-300 bg-white shadow-md overflow-hidden">
                <div className="px-4 py-3 border-b-2 border-slate-300 bg-slate-100">
                  <h5 className="text-sm font-semibold text-slate-800">{t('detectFromImage.colorsAndBrandSection', 'Warna & Brand')}</h5>
                  <p className="text-xs text-slate-600 mt-0.5">{t('detectFromImage.colorsAndBrandSectionHint', 'Pilih brand untuk pakai warna brand, atau isi manual Main color & Other colors.')}</p>
                </div>
                <div className="p-4 space-y-4 bg-white">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{t('detectFromImage.useBrand', 'Gunakan Brand')}</label>
                    <Popover open={brandComboboxOpen} onOpenChange={setBrandComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={brandComboboxOpen}
                          className="w-full justify-between text-sm text-gray-700 border-gray-200"
                        >
                          <span className="truncate">
                            {selectedBrandId
                              ? designBrands.find((b) => b.id === selectedBrandId)?.brand_name ?? selectedBrandId
                              : t('detectFromImage.noBrandSelected', 'No brand selected')}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-60 p-0" align="start">
                        <Command>
                          <CommandInput placeholder={t('detectFromImage.searchBrandPlaceholder', 'Search brand...')} className="h-8 text-xs" />
                          <CommandList>
                            <CommandEmpty>{t('digitalAssets.noBrandColors', 'No brand colors yet.')}</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__none__"
                                onSelect={() => {
                                  setSelectedBrandId(null);
                                  setBrandComboboxOpen(false);
                                }}
                              >
                                <span className="text-xs">{t('detectFromImage.noBrandOption', '— Tidak pilih —')}</span>
                              </CommandItem>
                              {designBrands.map((b) => (
                                <CommandItem
                                  key={b.id}
                                  value={b.brand_name ?? b.id}
                                  onSelect={() => {
                                    setSelectedBrandId(b.id);
                                    setBrandComboboxOpen(false);
                                  }}
                                >
                                  <span className="text-xs truncate">{b.brand_name ?? b.id}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {selectedBrandId && selectedBrandForDisplay ? (
                    <div className="space-y-2 pt-3 border-t-2 border-slate-200">
                      <p className="text-xs font-semibold text-gray-600">{t('detectFromImage.brandColorsFrom', 'Warna dari brand')}: {selectedBrandForDisplay.brand_name ?? '—'}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: 'primary_color_hex' as const, label: t('digitalAssets.brandColorPrimary', 'Primary Color') },
                          { key: 'secondary_color_hex' as const, label: t('digitalAssets.brandColorSecondary', 'Secondary Color') },
                          { key: 'accent_color_hex' as const, label: t('digitalAssets.brandColorAccent', 'Accent Color') },
                          { key: 'text_color_hex' as const, label: t('digitalAssets.brandColorText', 'Text Color') },
                        ].map(({ key, label }) => {
                          const hex = selectedBrandForDisplay[key] ?? '';
                          return (
                            <div key={key} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2">
                              <span className="flex-shrink-0 w-8 h-8 rounded-md border border-gray-200" style={{ backgroundColor: hex || '#e5e7eb' }} title={hex || ''} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-gray-700 truncate">{label}</p>
                                <p className="text-xs text-gray-500 font-mono truncate">{hex || '—'}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{t('detectFromImage.mainColor', 'Main color')}</label>
                        <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2 border border-gray-100 mb-1">
                          <span className="line-clamp-1" title={designResult.main_color ?? ''}>{designResult.main_color ?? '—'}</span>
                        </div>
                        <input
                          value={displayMainColor}
                          onChange={(e) => setDesignReplace((prev) => ({ ...prev, main_color: e.target.value }))}
                          placeholder={t('detectFromImage.replaceWithPlaceholder', 'Ganti dengan...')}
                          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{t('detectFromImage.otherColors', 'Other colors')}</label>
                        <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2 border border-gray-100 mb-1">
                          <span className="line-clamp-1" title={designResult.other_colors ?? ''}>{designResult.other_colors ?? '—'}</span>
                        </div>
                        <input
                          value={displayOtherColors}
                          onChange={(e) => setDesignReplace((prev) => ({ ...prev, other_colors: e.target.value }))}
                          placeholder={t('detectFromImage.replaceWithPlaceholder', 'Ganti dengan...')}
                          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5 pt-3 border-t-2 border-slate-200">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{t('detectFromImage.useCompanyLogo', 'Use Company Logo')}</label>
                    <Popover open={companyLogoComboboxOpen} onOpenChange={setCompanyLogoComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={companyLogoComboboxOpen}
                          className="w-full justify-between text-sm text-gray-700 border-gray-200"
                        >
                          <span className="truncate">
                            {selectedCompanyLogoId
                              ? designCompanyLogos.find((l) => l.id === selectedCompanyLogoId)?.brand_name ?? selectedCompanyLogoId
                              : t('detectFromImage.noCompanyLogoSelected', 'No company logo selected')}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-60 p-0" align="start">
                        <Command>
                          <CommandInput placeholder={t('detectFromImage.searchCompanyLogoPlaceholder', 'Search company logo...')} className="h-8 text-xs" />
                          <CommandList>
                            <CommandEmpty>{t('digitalAssets.noCompanyLogos', 'No company logos yet.')}</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__none__"
                                onSelect={() => {
                                  setSelectedCompanyLogoId(null);
                                  setCompanyLogoComboboxOpen(false);
                                }}
                              >
                                <span className="text-xs">{t('detectFromImage.noCompanyLogoOption', '— Tidak pilih —')}</span>
                              </CommandItem>
                              {designCompanyLogos.map((l) => (
                                <CommandItem
                                  key={l.id}
                                  value={l.brand_name ?? l.id}
                                  onSelect={() => {
                                    setSelectedCompanyLogoId(l.id);
                                    setCompanyLogoComboboxOpen(false);
                                  }}
                                >
                                  <span className="text-xs truncate">{l.brand_name ?? l.id}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-slate-500">{t('detectFromImage.companyLogoWhiteBackgroundHint', 'Logo akan selalu ditampilkan dengan alas warna putih di hasil generate.')}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right column: Description / Character Result */}
        <div className="min-h-[280px] flex flex-col">
          {mode === 'scene' && sceneAnalysisImported ? (
            <div className="border-2 border-slate-300 rounded-xl p-4 space-y-4 flex-1 flex flex-col overflow-auto bg-slate-50/50">
              <h4 className="text-sm font-semibold text-slate-800 pb-2 border-b-2 border-slate-300">{t('detectFromImage.modeScene', 'Scene Analysis')}</h4>
              {/* Referensi gambar */}
              {generatedImageUrl && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-600">{t('detectFromImage.sceneAnalysisGeneratedImageLabel')}</p>
                  <img src={generatedImageUrl} alt="Design result" className="w-full max-w-full rounded-md border border-gray-200 object-contain bg-white max-h-48" />
                </div>
              )}
              {layoutCompositionUrls.some((u) => u != null) && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-600">{t('detectFromImage.layoutStyle', 'Composition')}</p>
                  <div className="flex flex-wrap gap-2">
                    {layoutCompositionUrls.map((url, i) =>
                      url ? (
                        <div key={i} className="flex flex-col items-center">
                          <span className="text-[10px] text-slate-500">{t('detectFromImage.sceneAnalysisCompositionImageLabel', 'Gambar {n}', { n: i + 1 }).replace('{n}', String(i + 1))}</span>
                          <img src={url} alt="" className="w-16 h-16 rounded border border-gray-200 object-cover" />
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}
              {/* Bahasa & Pergerakan kamera */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t('detectFromImage.sceneAnalysisLanguage')}</label>
                  <Select value={sceneAnalysisLanguage} onValueChange={setSceneAnalysisLanguage}>
                    <SelectTrigger className="w-full h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id">{t('detectFromImage.sceneAnalysisLanguageId')}</SelectItem>
                      <SelectItem value="en">{t('detectFromImage.sceneAnalysisLanguageEn')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t('detectFromImage.sceneAnalysisCameraMovement')}</label>
                  <Select value={sceneAnalysisCameraMovement} onValueChange={setSceneAnalysisCameraMovement}>
                    <SelectTrigger
                      className="w-full h-10 text-sm"
                      title={
                        CAMERA_MOVEMENT_OPTIONS.find((o) => o.value === sceneAnalysisCameraMovement)
                          ? t(CAMERA_MOVEMENT_OPTIONS.find((o) => o.value === sceneAnalysisCameraMovement)!.descriptionKey)
                          : undefined
                      }
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMERA_MOVEMENT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Per karakter: nama, foto, narasi */}
              {characterSlots
                .map((slot, index) => ({ slot, index }))
                .filter(({ slot }) => slot.characterId != null && slot.characterId !== '')
                .map(({ slot, index }) => {
                  const master = sceneAnalysisCharacterMasters[slot.characterId!];
                  const name = master?.name ?? designCharacters.find((c) => c.id === slot.characterId)?.name ?? slot.characterId ?? `Character ${index + 1}`;
                  const photoUrl = master?.reference_image_url ?? characterStructuredUrls[index]?.head ?? null;
                  return (
                    <div key={index} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        {photoUrl ? <img src={photoUrl} alt="" className="w-10 h-10 rounded object-cover border border-gray-200" /> : <User className="h-10 w-10 text-slate-300" />}
                        <span className="font-medium text-sm text-slate-800">{name}</span>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{t('detectFromImage.sceneAnalysisNarasiPlaceholder')}</label>
                        <textarea
                          placeholder={t('detectFromImage.sceneAnalysisNarasiPlaceholder')}
                          value={sceneAnalysisCharacterNarasi[index] ?? ''}
                          onChange={(e) => setSceneAnalysisCharacterNarasi((prev) => ({ ...prev, [index]: e.target.value }))}
                          rows={2}
                          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-500 resize-y"
                        />
                      </div>
                    </div>
                  );
                })}
              {/* Super prompt */}
              <div className="space-y-2 pt-2 border-t-2 border-slate-300">
                <label className="block text-xs font-semibold text-slate-700">{t('detectFromImage.sceneAnalysisSuperPrompt')}</label>
                {sceneAnalysisImageDescriptionError && (
                  <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{sceneAnalysisImageDescriptionError}</p>
                )}
                {(() => {
                  const baseSuperPrompt = buildSceneAnalysisSuperPrompt({
                    designReplace,
                    designResult,
                    characterSlots,
                    characterStructuredRefs,
                    designCharacters,
                    sceneAnalysisCameraMovement,
                    sceneAnalysisLanguage,
                    sceneAnalysisCharacterNarasi,
                    sceneAnalysisCharacterMasters,
                    getLabel: (key) => t(key),
                    cameraMovementOptions: CAMERA_MOVEMENT_OPTIONS,
                    expressionOptions: EXPRESSION_OPTIONS,
                    bodyPoseOptions: BODY_POSE_OPTIONS,
                    handGestureOptions: HAND_GESTURE_OPTIONS,
                  });
                  const effectiveSuperPrompt = sceneAnalysisImageDescriptionPrompt
                    ? `--- DESKRIPSI DARI GAMBAR ---\n${sceneAnalysisImageDescriptionPrompt}\n\n${baseSuperPrompt}`
                    : baseSuperPrompt;
                  const textareaValue = sceneAnalysisImageDescriptionLoading && !sceneAnalysisImageDescriptionPrompt
                    ? `${t('detectFromImage.sceneAnalysisImageDescriptionPlaceholder')}\n\n${baseSuperPrompt}`
                    : effectiveSuperPrompt;
                  return (
                    <>
                      <textarea
                        readOnly
                        value={textareaValue}
                        className="w-full min-h-[180px] rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 font-mono"
                        rows={12}
                      />
                    </>
                  );
                })()}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-slate-600">{t('detectFromImage.sceneAnalysisNegativePromptSection')}</label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-slate-600"
                      disabled={sceneAnalysisNegativePromptLoading}
                      onClick={() => generateSceneNegativePrompt()}
                    >
                      {sceneAnalysisNegativePromptLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      )}
                      {sceneAnalysisNegativePromptLoading ? t('detectFromImage.generating', 'Generating…') : t('detectFromImage.regenerateNegativePrompt', 'Regenerate')}
                    </Button>
                  </div>
                  {sceneAnalysisNegativePromptError && (
                    <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{sceneAnalysisNegativePromptError}</p>
                  )}
                  <pre className="w-full rounded-md border border-gray-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 font-mono whitespace-pre-wrap max-h-[140px] overflow-y-auto">
                    {sceneAnalysisNegativePromptLoading && !sceneAnalysisGeneratedNegativePrompt
                      ? t('detectFromImage.negativePromptPlaceholder', 'Reading image, super prompt, language, camera movement, and narration to generate the best negative prompt…')
                      : (sceneAnalysisGeneratedNegativePrompt ?? SCENE_ANALYSIS_MASTER_NEGATIVE_PROMPT)}
                  </pre>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-gray-300"
                  onClick={() => {
                    const baseSP = buildSceneAnalysisSuperPrompt({
                      designReplace,
                      designResult,
                      characterSlots,
                      characterStructuredRefs,
                      designCharacters,
                      sceneAnalysisCameraMovement,
                      sceneAnalysisLanguage,
                      sceneAnalysisCharacterNarasi,
                      sceneAnalysisCharacterMasters,
                      getLabel: (key) => t(key),
                      cameraMovementOptions: CAMERA_MOVEMENT_OPTIONS,
                      expressionOptions: EXPRESSION_OPTIONS,
                      bodyPoseOptions: BODY_POSE_OPTIONS,
                      handGestureOptions: HAND_GESTURE_OPTIONS,
                    });
                    const positiveText = sceneAnalysisImageDescriptionPrompt
                      ? `--- DESKRIPSI DARI GAMBAR ---\n${sceneAnalysisImageDescriptionPrompt}\n\n${baseSP}`
                      : baseSP;
                    const negativeText = sceneAnalysisGeneratedNegativePrompt ?? SCENE_ANALYSIS_MASTER_NEGATIVE_PROMPT;
                    const combinedText = positiveText + '\n\n--- NEGATIVE PROMPT ---\n' + negativeText;
                    navigator.clipboard.writeText(combinedText);
                    toast.success(t('detectFromImage.promptCopied', 'Copied'));
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {t('detectFromImage.copyDesign', 'Salin')}
                </Button>
              </div>
            </div>
          ) : artisticDescription ? (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 flex-1 flex flex-col">
              <h4 className="text-sm font-semibold text-gray-900">{t('detectFromImage.resultArtistic', 'Artistic Description Result')}</h4>
              <textarea
                readOnly
                value={artisticDescription}
                className="w-full min-h-[180px] flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900"
                rows={8}
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={handleCopyDescription} className="border-gray-300">
                  <Copy className="h-4 w-4 mr-2" />
                  {t('detectFromImage.copyDescription', 'Copy Description')}
                </Button>
                <Button type="button" size="sm" onClick={handleSaveToCharacterFromScene}>
                  <User className="h-4 w-4 mr-2" />
                  {t('detectFromImage.saveToCharacter', 'Save to Character')}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleSaveToObject} className="border-gray-300">
                  <Box className="h-4 w-4 mr-2" />
                  {t('detectFromImage.saveToObject', 'Save to Object')}
                </Button>
              </div>
            </div>
          ) : characterResult ? (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 flex-1 flex flex-col">
              <h4 className="text-sm font-semibold text-gray-900">{t('detectFromImage.resultCharacter', 'Character Data Result')}</h4>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm flex-1">
                <div>
                  <dt className="text-gray-500 font-medium">{t('detectFromImage.characterName', 'Name (Suggestion)')}</dt>
                  <dd className="text-gray-900">{characterResult.name && characterResult.name.trim().toLowerCase() !== 'unknown' ? characterResult.name : '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">{t('detectFromImage.age', 'Age')}</dt>
                  <dd className="text-gray-900">{characterResult.age ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">{t('detectFromImage.gender', 'Gender')}</dt>
                  <dd className="text-gray-900">{characterResult.gender ?? '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500 font-medium">{t('detectFromImage.hair', 'Hair')}</dt>
                  <dd className="text-gray-900">{characterResult.hair_description ?? '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500 font-medium">{t('detectFromImage.face', 'Face')}</dt>
                  <dd className="text-gray-900">{characterResult.face_description ?? '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500 font-medium">{t('detectFromImage.clothing', 'Clothing')}</dt>
                  <dd className="text-gray-900">{characterResult.clothing_description ?? '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500 font-medium">{t('detectFromImage.detail', 'Detail')}</dt>
                  <dd className="text-gray-900">{characterResult.additional_details ?? '—'}</dd>
                </div>
              </dl>
              {/* Prompt gabungan (versi 2) */}
              {(() => {
                const combinedPrompt = buildCombinedPrompt({
                  name: characterResult.name && characterResult.name.trim().toLowerCase() !== 'unknown' ? characterResult.name : null,
                  age: characterResult.age,
                  gender: characterResult.gender,
                  hair_description: characterResult.hair_description,
                  face_description: characterResult.face_description,
                  clothing_description: characterResult.clothing_description,
                  additional_details: characterResult.additional_details,
                });
                return combinedPrompt ? (
                  <div className="space-y-2 pt-4 border-t-2 border-slate-300">
                    <h4 className="text-sm font-semibold text-gray-900">{t('detectFromImage.combinedPromptTitle', 'Combined prompt')}</h4>
                    <textarea
                      readOnly
                      value={combinedPrompt}
                      className="w-full min-h-[100px] rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900"
                      rows={6}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-gray-300"
                      onClick={() => {
                        navigator.clipboard.writeText(combinedPrompt);
                        toast.success(t('detectFromImage.promptCopied', 'Copied'));
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      {t('detectFromImage.copyPrompt', 'Copy prompt')}
                    </Button>
                  </div>
                ) : null;
              })()}
              <Button type="button" size="sm" onClick={handleSaveCharacterFromExtraction} className="mt-2">
                <User className="h-4 w-4 mr-2" />
                {t('detectFromImage.saveToCharacter', 'Save to Character')}
              </Button>
            </div>
          ) : designResult ? (
            <div className="border-2 border-slate-300 rounded-xl p-4 space-y-4 flex-1 flex flex-col overflow-auto bg-slate-50/50">
              <h4 className="text-sm font-semibold text-slate-800 pb-2 border-b-2 border-slate-300">{t('detectFromImage.resultDesign', 'Design Extraction Result')}</h4>

              {/* Section: Font, Elements & Composition — urutan: Font → Elements → Composition */}
              <div className="rounded-xl border-2 border-slate-300 bg-white shadow-md overflow-hidden">
                <div className="px-4 py-3 border-b-2 border-slate-300 bg-slate-100">
                  <h5 className="text-sm font-semibold text-slate-800">{t('detectFromImage.fontElementsLayoutSection', 'Font, Elements & Composition')}</h5>
                  <p className="text-xs text-slate-600 mt-0.5">{t('detectFromImage.fontElementsLayoutSectionHint', 'Edit font, elemen, dan komposisi untuk hasil generate.')}</p>
                </div>
                <div className="p-4 space-y-5 bg-white">
                  {/* 1. Font */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{t('detectFromImage.font', 'Font')}</label>
                    <div className="text-xs text-gray-500 bg-slate-100 rounded-md px-3 py-2 border border-slate-200">
                      <span className="line-clamp-2" title={designResult.font ?? ''}>{designResult.font ?? '—'}</span>
                    </div>
                    <input
                      value={designReplace['font'] ?? ''}
                      onChange={(e) => setDesignReplace((prev) => ({ ...prev, font: e.target.value }))}
                      placeholder={t('detectFromImage.replaceWithPlaceholder', 'Ganti dengan...')}
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  {/* 2. Elements */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{t('detectFromImage.elements', 'Elements')}</label>
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2 border border-gray-100 max-h-16 overflow-y-auto">
                      <span className="line-clamp-3" title={designResult.elements ?? ''}>{designResult.elements ?? '—'}</span>
                    </div>
                    <textarea
                      value={designReplace['elements'] ?? ''}
                      onChange={(e) => setDesignReplace((prev) => ({ ...prev, elements: e.target.value }))}
                      placeholder={t('detectFromImage.replaceWithPlaceholder', 'Ganti dengan...')}
                      rows={3}
                      className="w-full min-h-[80px] rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                    />
                  </div>
                  {/* 3. Composition (editable like Elements) — defines composition for single frame/image */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{t('detectFromImage.layoutStyle', 'Composition')}</label>
                    <p className="text-xs text-gray-500">{t('detectFromImage.compositionSectionHint', 'Everything in this section defines the composition to be created in a single frame/image.')}</p>
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2 border border-gray-100 max-h-16 overflow-y-auto">
                      <span className="line-clamp-3" title={designResult.layout_style_description ?? ''}>{designResult.layout_style_description ?? '—'}</span>
                    </div>
                    {/* Composition & style references: 7 numbered slots */}
                    <input
                      ref={layoutCompositionInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCompositionFileInputChange}
                    />
                    <div className="flex flex-row gap-2 items-start flex-wrap">
                      {Array.from({ length: MAX_LAYOUT_COMPOSITION_IMAGES }, (_, i) => (
                        <div key={i} className="flex-shrink-0 w-[72px] space-y-1">
                          <label className="block text-xs font-medium text-gray-700 truncate text-center">
                            {t('detectFromImage.layoutCompositionSlotLabel', 'Gambar ke-{n}', { n: i + 1 }).replace('{n}', String(i + 1))}
                          </label>
                          {layoutCompositionSlots[i] == null ? (
                            <div
                              data-layout-composition-zone
                              data-clipboard-image-slot
                              role="button"
                              tabIndex={0}
                              onPaste={handleSlotPaste(i)}
                              onDrop={handleSlotDrop(i)}
                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                              onClick={handleSlotClick(i)}
                              onDoubleClick={handleSlotDoubleClick(i)}
                              className="min-h-[56px] rounded-md border-2 border-dashed border-gray-300 bg-gray-50/50 hover:border-primary/40 hover:bg-gray-50 flex items-center justify-center p-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                              title={t('detectFromImage.layoutCompositionSlotHint', 'Paste (Ctrl+V) atau klik/drop') + ' — ' + t('detectFromImage.singleClickPasteDoubleClickFileShort', 'Klik sekali = paste, dua kali = pilih file')}
                            >
                              <span className="text-[10px] text-gray-500 text-center leading-tight">
                                {t('detectFromImage.layoutCompositionSlotHintShort', 'Paste/klik')}
                              </span>
                            </div>
                          ) : (
                            <div className="relative inline-block">
                              <img
                                src={layoutCompositionUrls[i] ?? ''}
                                alt=""
                                className="w-12 h-12 object-cover rounded border border-gray-200"
                              />
                              <button
                                type="button"
                                aria-label={t('detectFromImage.removeReference', 'Remove')}
                                onClick={() => removeLayoutCompositionSlot(i)}
                                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <textarea
                      value={designReplace['layout_style_description'] ?? ''}
                      onChange={(e) => setDesignReplace((prev) => ({ ...prev, layout_style_description: e.target.value }))}
                      placeholder={t('detectFromImage.replaceWithPlaceholder', 'Ganti dengan...')}
                      rows={3}
                      className="w-full min-h-[80px] rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 mt-4 border-t-2 border-slate-300">
                <p className="text-sm font-semibold text-slate-800">{t('detectFromImage.replaceCharacterWith', 'Replace character with')}</p>
                <input
                  ref={characterStructuredInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCharacterStructuredFileInputChange}
                />
                {characterSlots.map((slot, index) => (
                  <div key={index} className="rounded-lg border-2 border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {t('detectFromImage.characterSlotTitle', 'Character {n}', { n: index + 1 }).replace('{n}', String(index + 1))}
                      </span>
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setCharacterSlots((prev) => prev.filter((_, i) => i !== index));
                            setCharacterStructuredRefs((prev) => prev.filter((_, i) => i !== index));
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="ml-1 text-xs">{t('detectFromImage.removeCharacter', 'Hapus')}</span>
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-1">{t('detectFromImage.characterLabel', 'Character')}</label>
                        <Select
                          value={slot.characterId ?? SELECT_NONE}
                          onValueChange={(v) =>
                            setCharacterSlots((prev) =>
                              prev.map((s, i) => (i === index ? { ...s, characterId: v === SELECT_NONE ? null : v } : s))
                            )
                          }
                        >
                          <SelectTrigger className="h-10 w-full min-w-0 text-sm">
                            <SelectValue placeholder={t('detectFromImage.noCharacterSelected', '— Tidak pilih —')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SELECT_NONE}>{t('detectFromImage.noCharacterSelected', '— Tidak pilih —')}</SelectItem>
                            {designCharacters.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name ?? c.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-1">{t('detectFromImage.expression', 'Expression')}</label>
                        <Select
                          value={slot.expression ?? CHAR_AI}
                          onValueChange={(v) =>
                            setCharacterSlots((prev) =>
                              prev.map((s, i) => (i === index ? { ...s, expression: v === CHAR_AI ? null : v } : s))
                            )
                          }
                        >
                          <SelectTrigger className="h-10 w-full min-w-0 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={CHAR_AI}>{t('detectFromImage.expressionLetAiChoose', '— Biarkan AI pilih —')}</SelectItem>
                            {EXPRESSION_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {t(opt.labelKey)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-1">{t('detectFromImage.bodyPose', 'Body pose')}</label>
                        <Select
                          value={slot.bodyPose ?? CHAR_AI}
                          onValueChange={(v) =>
                            setCharacterSlots((prev) =>
                              prev.map((s, i) => (i === index ? { ...s, bodyPose: v === CHAR_AI ? null : v } : s))
                            )
                          }
                        >
                          <SelectTrigger className="h-10 w-full min-w-0 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={CHAR_AI}>{t('detectFromImage.gestureLetAiChoose', '— Biarkan AI pilih —')}</SelectItem>
                            {BODY_POSE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {t(opt.labelKey)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-gray-600 mb-1">{t('detectFromImage.handGesture', 'Hand gesture')}</label>
                        <Select
                          value={slot.handGesture ?? CHAR_AI}
                          onValueChange={(v) =>
                            setCharacterSlots((prev) =>
                              prev.map((s, i) => (i === index ? { ...s, handGesture: v === CHAR_AI ? null : v } : s))
                            )
                          }
                        >
                          <SelectTrigger className="h-10 w-full min-w-0 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={CHAR_AI}>{t('detectFromImage.gestureLetAiChoose', '— Biarkan AI pilih —')}</SelectItem>
                            {HAND_GESTURE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {t(opt.labelKey)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {/* Structured reference uploads: Head, Clothes, Logo, Foot, Accessories — vertical layout with instruction per slot */}
                    <div className="pt-3 border-t border-slate-200 mt-3">
                      <p className="text-xs font-medium text-slate-600 mb-2">{t('detectFromImage.characterStructuredRefsTitle', 'Referensi (opsional)')}</p>
                      <div className="flex flex-col gap-3">
                        {(() => {
                          const refs = characterStructuredRefs[index];
                          const urls = characterStructuredUrls[index];
                          if (!refs || !urls) return null;
                          const placeholderKey = (cat: 'head' | 'clothes' | 'logo' | 'foot' | 'accessories') => {
                            if (cat === 'head') return 'detectFromImage.refInstructionHeadPlaceholder';
                            if (cat === 'clothes') return 'detectFromImage.refInstructionClothesPlaceholder';
                            if (cat === 'logo') return 'detectFromImage.refInstructionLogoPlaceholder';
                            if (cat === 'foot') return 'detectFromImage.refInstructionFootPlaceholder';
                            return 'detectFromImage.refInstructionAccessoriesPlaceholder';
                          };
                          const getDescription = (cat: 'head' | 'clothes' | 'logo' | 'foot' | 'accessories', sub: number) => {
                            if (cat === 'head') return refs.headDescription ?? '';
                            if (cat === 'clothes') return refs.clothesDescriptions?.[sub] ?? '';
                            if (cat === 'logo') return refs.logoDescription ?? '';
                            if (cat === 'foot') return refs.footDescription ?? '';
                            return refs.accessoriesDescriptions?.[sub] ?? '';
                          };
                          const renderRow = (
                            cat: 'head' | 'clothes' | 'logo' | 'foot' | 'accessories',
                            sub: number,
                            label: string,
                            file: File | null,
                            url: string | null
                          ) => {
                            const isEmpty = !file && !url;
                            const boxHeight = 56;
                            return (
                              <div key={`${cat}-${sub}`} className="space-y-1">
                                <label className="block text-xs font-medium text-gray-700 truncate">{label}</label>
                                <div className="flex gap-2 items-stretch" style={{ minHeight: boxHeight }}>
                                  <div className="flex-shrink-0 w-[72px] flex items-center justify-center rounded-md overflow-hidden" style={{ height: boxHeight }}>
                                    {isEmpty ? (
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        data-clipboard-image-slot
                                        onPaste={handleCharacterStructuredPaste(index, cat, sub)}
                                        onDrop={handleCharacterStructuredDrop(index, cat, sub)}
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onClick={handleCharacterStructuredClick(index, cat, sub)}
                                        onDoubleClick={handleCharacterStructuredDoubleClick(index, cat, sub)}
                                        className="w-full h-full min-h-[56px] rounded-md border-2 border-dashed border-gray-300 bg-gray-50/50 hover:border-primary/40 hover:bg-gray-50 flex items-center justify-center p-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        title={t('detectFromImage.layoutCompositionSlotHint', 'Paste (Ctrl+V) atau klik/drop') + ' — ' + t('detectFromImage.singleClickPasteDoubleClickFileShort', 'Klik sekali = paste, dua kali = pilih file')}
                                      >
                                        <span className="text-[10px] text-gray-500 text-center leading-tight">
                                          {t('detectFromImage.layoutCompositionSlotHintShort', 'Paste/klik')}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="relative w-full h-full flex items-center justify-center bg-gray-100 rounded border border-gray-200">
                                        <img
                                          src={url ?? ''}
                                          alt=""
                                          className="max-w-full max-h-full w-12 h-12 object-cover rounded border border-gray-200"
                                        />
                                        <button
                                          type="button"
                                          aria-label={t('detectFromImage.removeReference', 'Remove')}
                                          onClick={() => removeCharacterStructuredRef(index, cat, sub)}
                                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <textarea
                                    placeholder={t(placeholderKey(cat))}
                                    value={getDescription(cat, sub)}
                                    onChange={(e) => setCharacterStructuredRefDescription(index, cat, sub, e.target.value)}
                                    className="flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-500 resize-y w-full focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    style={{ minHeight: boxHeight, height: boxHeight }}
                                  />
                                </div>
                              </div>
                            );
                          };
                          return (
                            <>
                              {renderRow('head', 0, t('detectFromImage.characterRefHead', 'Head'), refs.head, urls.head)}
                              {refs.clothes.map((f, i) => renderRow('clothes', i, t('detectFromImage.characterRefClothesN', 'Clothes {n}', { n: i + 1 }).replace('{n}', String(i + 1)), f, urls.clothes[i] ?? null))}
                              {renderRow('logo', 0, t('detectFromImage.characterRefLogo', 'Logo'), refs.logo, urls.logo)}
                              {renderRow('foot', 0, t('detectFromImage.characterRefFoot', 'Foot'), refs.foot, urls.foot)}
                              {refs.accessories.map((f, i) => renderRow('accessories', i, t('detectFromImage.characterRefAccessoriesN', 'Accessories {n}', { n: i + 1 }).replace('{n}', String(i + 1)), f, urls.accessories[i] ?? null))}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
                {characterSlots.length < MAX_CHARACTER_SLOTS && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                    onClick={() => {
                      setCharacterSlots((prev) => [...prev, emptyCharacterSlot()]);
                      setCharacterStructuredRefs((prev) => [...prev, emptyCharacterStructuredRef()]);
                    }}
                  >
                    <User className="h-4 w-4 mr-2" />
                    {t('detectFromImage.addCharacter', 'Tambah karakter')}
                  </Button>
                )}
                <p className="text-sm font-semibold text-gray-900 mt-2">{t('detectFromImage.replaceProductWith', 'Replace product with')}</p>
                <Select
                  value={selectedProductId ?? SELECT_NONE}
                  onValueChange={(v) => setSelectedProductId(v === SELECT_NONE ? null : v)}
                >
                  <SelectTrigger className="h-10 w-full text-sm">
                    <SelectValue placeholder={t('detectFromImage.noProductSelected', '— Tidak pilih —')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE}>{t('detectFromImage.noProductSelected', '— Tidak pilih —')}</SelectItem>
                    {designObjects.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name ?? o.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 pt-4 border-t-2 border-slate-300">
                <p className="text-sm font-semibold text-gray-900">{t('detectFromImage.aspectRatio', 'Aspect ratio')}</p>
                <Select
                  value={designImageAspectRatio}
                  onValueChange={(v) => setDesignImageAspectRatio(v as '1:1' | '4:5' | '9:16' | '16:9' | 'custom')}
                >
                  <SelectTrigger className="h-10 w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">{t('detectFromImage.aspectRatioSquare', 'Square (1:1)')}</SelectItem>
                    <SelectItem value="4:5">{t('detectFromImage.aspectRatio4_5', '4:5')}</SelectItem>
                    <SelectItem value="9:16">{t('detectFromImage.aspectRatioPortrait', 'Portrait (9:16)')}</SelectItem>
                    <SelectItem value="16:9">{t('detectFromImage.aspectRatioLandscape', 'Landscape (16:9)')}</SelectItem>
                    <SelectItem value="custom">{t('detectFromImage.aspectRatioCustom', 'Custom')}</SelectItem>
                  </SelectContent>
                </Select>
                {designImageAspectRatio === 'custom' && (
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t('detectFromImage.customSizeWidth', 'Lebar')}</label>
                      <input
                        type="number"
                        min={1}
                        max={99999}
                        value={customSizeWidth}
                        onChange={(e) => setCustomSizeWidth(e.target.value)}
                        placeholder="1080"
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t('detectFromImage.customSizeHeight', 'Tinggi')}</label>
                      <input
                        type="number"
                        min={1}
                        max={99999}
                        value={customSizeHeight}
                        onChange={(e) => setCustomSizeHeight(e.target.value)}
                        placeholder="1920"
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t('detectFromImage.customSizeUnit', 'Unit')}</label>
                      <Select value={customSizeUnit} onValueChange={(v) => setCustomSizeUnit(v as 'px' | 'in' | 'mm' | 'cm')}>
                        <SelectTrigger className="h-9 w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="px">{t('detectFromImage.customSizeUnitPx', 'px')}</SelectItem>
                          <SelectItem value="in">{t('detectFromImage.customSizeUnitIn', 'inci')}</SelectItem>
                          <SelectItem value="mm">{t('detectFromImage.customSizeUnitMm', 'mm')}</SelectItem>
                          <SelectItem value="cm">{t('detectFromImage.customSizeUnitCm', 'cm')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {designImageAspectRatio === 'custom' && (() => {
                  const w = Number(customSizeWidth);
                  const h = Number(customSizeHeight);
                  const valid = Number.isFinite(w) && w >= 1 && w <= 99999 && Number.isFinite(h) && h >= 1 && h <= 99999;
                  if (!valid) return null;
                  const isLandscape = w > h;
                  const isPortrait = h > w;
                  const isSquare = w === h;
                  const Icon = isLandscape ? RectangleHorizontal : isPortrait ? RectangleVertical : Square;
                  const labelKey = isLandscape ? 'detectFromImage.orientationLandscape' : isPortrait ? 'detectFromImage.orientationPortrait' : 'detectFromImage.orientationSquare';
                  return (
                    <div className="flex items-center gap-2 pt-1.5 text-sm text-gray-600">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span>{t(labelKey, isLandscape ? 'Landscape' : isPortrait ? 'Portrait' : 'Square')}</span>
                    </div>
                  );
                })()}
                <Button
                  type="button"
                  size="sm"
                  onClick={handleGenerateDesignImage}
                  disabled={
                    isGeneratingImage ||
                    !buildDesignCopyText().trim() ||
                    (designImageAspectRatio === 'custom' &&
                      (!customSizeWidth.trim() ||
                        !customSizeHeight.trim() ||
                        !(Number(customSizeWidth) >= 1 && Number(customSizeWidth) <= 99999) ||
                        !(Number(customSizeHeight) >= 1 && Number(customSizeHeight) <= 99999)))
                  }
                  className="disabled:opacity-50"
                >
                  {isGeneratingImage ? t('detectFromImage.generatingImage', 'Generating...') : t('detectFromImage.generateImage', 'Generate image')}
                </Button>
              </div>
              {generatedImageUrl && (
                <div className="space-y-2 pt-4 border-t-2 border-slate-300">
                  <img src={generatedImageUrl} alt="Generated design" className="w-full max-w-full rounded-md border border-gray-200 object-contain bg-gray-50" />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleDownloadGeneratedImage} className="border-gray-300">
                      <Download className="h-4 w-4 mr-2" />
                      {t('detectFromImage.downloadImage', 'Download')}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleCopyDesign} className="border-gray-300">
                      <Copy className="h-4 w-4 mr-2" />
                      {t('detectFromImage.copyDesign', 'Salin')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleImportToSceneAnalysis}
                      disabled={!characterSlots.some((s) => s.characterId != null && s.characterId !== '')}
                      className="disabled:opacity-50"
                    >
                      <Box className="h-4 w-4 mr-2" />
                      {t('detectFromImage.importToSceneAnalysis', 'Import to Scene Analysis')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 flex-1 flex flex-col items-center justify-center text-center text-gray-500 bg-gray-50/50 min-h-[280px]">
              <p className="text-sm">{t('detectFromImage.resultArtistic', 'Artistic Description Result')}</p>
              <p className="text-xs mt-1">{t('detectFromImage.resultPlaceholder', 'Artistic description or character extraction result will appear here after you run analysis.')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
