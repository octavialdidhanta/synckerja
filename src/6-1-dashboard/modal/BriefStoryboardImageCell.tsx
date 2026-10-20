import React, { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Clapperboard, ImagePlus, Images, Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/shared/lib/utils';
import type { BriefStoryboardImageWithUrl } from '@/6-1-dashboard/hook/useBriefStoryboardImages';
import { Button } from '@/shared/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { pickStoryboardNativePhoto } from '@/6-1-dashboard/lib/pickStoryboardImage';
import { useBriefVideo } from '@/6-1-dashboard/modal/briefVideoContext';
import { BriefDubbedVideo, BriefSeedanceVoiceButton, useBriefVoice } from '@/6-1-dashboard/modal/briefVoiceContext';

interface BriefStoryboardImageCellProps {
  rowIndex: number;
  images: BriefStoryboardImageWithUrl[];
  editable: boolean;
  disabled?: boolean;
  isUploading?: boolean;
  isDeleting?: boolean;
  onUploadFiles?: (rowIndex: number, files: File[], promptOverride?: string | null) => Promise<unknown>;
  onDeleteImage?: (imageId: string) => Promise<unknown>;
  activeImageId?: string | null;
  onActiveImageIdChange?: (imageId: string) => void;
  onEditPrompt?: () => void;
  /** 16:9 frame for Story Board cards */
  aspectVideo?: boolean;
  /** Explicit Upload button (Story Board discoverability) */
  showUploadButton?: boolean;
  uploadButtonLabel?: string;
}

const acceptedMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];

function normalizeImageMime(file: File): string {
  const type = String(file.type || '').toLowerCase();
  if (type === 'image/jpg' || type === 'image/pjpeg') return 'image/jpeg';
  if (acceptedMimeTypes.includes(type)) return type;
  const name = String(file.name || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return type;
}

function filterAcceptedFiles(fileList: FileList | File[]): File[] {
  return Array.from(fileList).flatMap((file) => {
    const mime = normalizeImageMime(file);
    if (!acceptedMimeTypes.includes(mime)) return [];
    if (file.type === mime) return [file];
    return [new File([file], file.name || `storyboard.${mime.split('/')[1] || 'jpg'}`, { type: mime })];
  });
}

export const BriefStoryboardImageCell: React.FC<BriefStoryboardImageCellProps> = ({
  rowIndex,
  images,
  editable,
  disabled = false,
  isUploading = false,
  isDeleting = false,
  onUploadFiles,
  onDeleteImage,
  aspectVideo = false,
  showUploadButton = false,
  uploadButtonLabel = 'Upload',
  activeImageId = null,
  onActiveImageIdChange,
  onEditPrompt,
}) => {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const briefVideo = useBriefVideo();
  const briefVoice = useBriefVoice();
  const videoStatus = briefVideo?.statusFor(rowIndex) ?? { phase: 'idle' as const, url: null, error: null };
  const readyVideos = briefVideo?.readyVideos(rowIndex) ?? [];
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapAtRef = useRef(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [localIndex, setLocalIndex] = useState(0);
  const controlled = Boolean(onActiveImageIdChange);
  const foundIndex = images.findIndex((image) => image.id === activeImageId);
  const activeIndex = controlled ? (foundIndex >= 0 ? foundIndex : 0) : localIndex;
  const setActiveIndex = (value: number | ((prev: number) => number)) => {
    const next = typeof value === 'function' ? value(activeIndex) : value;
    const clamped = Math.max(0, Math.min(next, Math.max(0, images.length - 1)));
    if (!controlled) {
      setLocalIndex(clamped);
      return;
    }
    const image = images[clamped];
    if (image) onActiveImageIdChange?.(image.id);
  };
  const [isDragActive, setIsDragActive] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [videoSlide, setVideoSlide] = useState<number | null>(null);
  const followedImageId = controlled ? (activeImageId ?? '') : '';
  const [followedImage, setFollowedImage] = useState(followedImageId);
  if (controlled && followedImageId !== followedImage) {
    setFollowedImage(followedImageId);
    setVideoSlide(null);
  }
  const slideCount = images.length + readyVideos.length;
  const imagePos = images.length === 0 ? 0 : Math.max(0, Math.min(activeIndex, images.length - 1));
  const slideIndex = videoSlide != null && videoSlide >= images.length && videoSlide < slideCount ? videoSlide : imagePos;
  const activeVideo = slideIndex >= images.length ? readyVideos[slideIndex - images.length] ?? null : null;
  const activeVoiceUrl = activeVideo ? briefVoice?.seedanceClip(activeVideo.id)?.url ?? null : null;
  const knownReadyCount = useRef<number | null>(null);
  useEffect(() => {
    if (knownReadyCount.current == null) {
      knownReadyCount.current = readyVideos.length;
      return;
    }
    if (readyVideos.length > knownReadyCount.current) {
      setVideoSlide(images.length + readyVideos.length - 1);
    }
    knownReadyCount.current = readyVideos.length;
  }, [images.length, readyVideos.length]);
  const selectSlide = (index: number) => {
    const next = Math.max(0, Math.min(index, Math.max(0, slideCount - 1)));
    if (next >= images.length) {
      setVideoSlide(next);
      return;
    }
    setVideoSlide(null);
    setActiveIndex(next);
  };

  useEffect(() => {
    if (controlled) return;
    if (localIndex > images.length - 1) {
      setLocalIndex(Math.max(0, images.length - 1));
    }
  }, [controlled, localIndex, images.length]);

  useEffect(() => {
    if (images.length <= 1) setShowThumbnails(false);
  }, [images.length]);

  useEffect(() => {
    images.forEach((image) => {
      const preload = new Image();
      preload.decoding = 'async';
      preload.src = image.publicUrl;
    });
  }, [images]);

  useEffect(() => {
    return () => {
      if (singleClickTimerRef.current) {
        clearTimeout(singleClickTimerRef.current);
      }
    };
  }, []);

  const activeImage = images[activeIndex] ?? null;
  const canInteract = editable && !disabled;
  const canOpenPicker = Boolean(onUploadFiles) && !disabled && !isUploading;

  const handleFiles = async (files: File[]) => {
    if (!canOpenPicker || !onUploadFiles || files.length === 0) return;
    const inserted = await onUploadFiles(rowIndex, files);
    const created = Array.isArray(inserted) ? (inserted as Array<{ id?: string }>) : [];
    const lastId = created.map((item) => item?.id).filter((id): id is string => Boolean(id)).at(-1);
    if (lastId && onActiveImageIdChange) onActiveImageIdChange(lastId);
    else setLocalIndex(images.length);
  };

  const handlePaste: React.ClipboardEventHandler<HTMLDivElement> = async (event) => {
    if (!canInteract) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    const files = Array.from(items)
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    const accepted = filterAcceptedFiles(files);
    if (accepted.length === 0) return;
    event.preventDefault();
    await handleFiles(accepted);
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = async (event) => {
    if (!canInteract) return;
    event.preventDefault();
    setIsDragActive(false);
    const accepted = filterAcceptedFiles(event.dataTransfer.files);
    if (accepted.length === 0) return;
    await handleFiles(accepted);
  };

  const handleDelete = async (imageId: string) => {
    if (!onDeleteImage || disabled) return;
    await onDeleteImage(imageId);
  };

  const openFilePicker = () => {
    if (!canOpenPicker) return;
    if (isMobile) {
      setSourceOpen(true);
      return;
    }
    inputRef.current?.click();
  };

  const pickFromCamera = async () => {
    setSourceOpen(false);
    if (!canOpenPicker) return;
    if (Capacitor.isNativePlatform()) {
      try {
        const files = filterAcceptedFiles(await pickStoryboardNativePhoto('camera'));
        if (files.length === 0) {
          toast.error(t('briefDialog.storyboard.imageFormats', 'PNG, JPG, WEBP sampai 5MB'));
          return;
        }
        await handleFiles(files);
      } catch {
        // User cancelled the camera.
      }
      return;
    }
    cameraInputRef.current?.click();
  };

  const pickFromGallery = async () => {
    setSourceOpen(false);
    if (!canOpenPicker) return;
    if (Capacitor.isNativePlatform()) {
      try {
        const files = filterAcceptedFiles(await pickStoryboardNativePhoto('gallery'));
        if (files.length === 0) {
          toast.error(t('briefDialog.storyboard.imageFormats', 'PNG, JPG, WEBP sampai 5MB'));
          return;
        }
        await handleFiles(files);
      } catch {
        // User cancelled the gallery.
      }
      return;
    }
    inputRef.current?.click();
  };

  const handleFrameClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!activeImage && !activeVideo) {
      if (isMobile && canOpenPicker) {
        event.preventDefault();
        openFilePicker();
      }
      return;
    }
    if (activeVideo || slideCount <= 1) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - bounds.left;
    if (singleClickTimerRef.current) {
      clearTimeout(singleClickTimerRef.current);
    }
    singleClickTimerRef.current = setTimeout(() => {
      if (clickX < bounds.width / 2) selectSlide(slideIndex - 1);
      else selectSlide(slideIndex + 1);
      singleClickTimerRef.current = null;
    }, 250);
  };

  const handleFrameDoubleClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    if (singleClickTimerRef.current) {
      clearTimeout(singleClickTimerRef.current);
      singleClickTimerRef.current = null;
    }
    openFilePicker();
  };

  const handleFramePointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!canOpenPicker) return;
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    const now = Date.now();
    if (now - lastTapAtRef.current < 350) {
      event.preventDefault();
      lastTapAtRef.current = 0;
      if (singleClickTimerRef.current) {
        clearTimeout(singleClickTimerRef.current);
        singleClickTimerRef.current = null;
      }
      openFilePicker();
      return;
    }
    lastTapAtRef.current = now;
  };

  return (
    <div
      tabIndex={editable || images.length > 1 ? 0 : undefined}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragEnter={(event) => {
        if (!canInteract) return;
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragOver={(event) => {
        if (!canInteract) return;
        event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!canInteract) return;
        event.preventDefault();
        setIsDragActive(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' && slideCount > 1) {
          event.preventDefault();
          selectSlide(slideIndex - 1);
          return;
        }
        if (event.key === 'ArrowRight' && slideCount > 1) {
          event.preventDefault();
          selectSlide(slideIndex + 1);
          return;
        }
        if (!canInteract) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openFilePicker();
        }
      }}
      className={cn(
        'group relative w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 p-2 outline-none transition-colors [touch-action:pan-x_pan-y]',
        (canInteract || images.length > 1) && 'focus:ring-2 focus:ring-blue-500',
        isDragActive && 'border-blue-500 bg-blue-50',
      )}
    >
      <input
        id={`brief-storyboard-image-${rowIndex}`}
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        onChange={async (event) => {
          const accepted = filterAcceptedFiles(event.target.files || []);
          await handleFiles(accepted);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={async (event) => {
          const accepted = filterAcceptedFiles(event.target.files || []);
          await handleFiles(accepted);
          event.currentTarget.value = '';
        }}
      />

      <div
        role={canInteract || slideCount > 1 ? 'button' : undefined}
        tabIndex={-1}
        onClick={handleFrameClick}
        onDoubleClick={handleFrameDoubleClick}
        onPointerUp={handleFramePointerUp}
        className={cn(
          'relative w-full overflow-hidden rounded-md border border-gray-200 bg-white [touch-action:pan-x_pan-y]',
          canInteract && 'cursor-pointer',
          slideCount > 1 && 'cursor-ew-resize',
          aspectVideo && 'aspect-video',
          !activeImage && !aspectVideo && 'flex min-h-[160px] items-center justify-center',
          !activeImage && aspectVideo && 'flex items-center justify-center',
        )}
      >
        {activeVideo ? (
          <BriefDubbedVideo
            videoUrl={activeVideo.url}
            voiceUrl={activeVoiceUrl}
            videoName={`video-${rowIndex + 1}.mp4`}
            framed
          />
        ) : activeImage ? (
          <div className={cn('w-full bg-gray-100', aspectVideo ? 'absolute inset-0 overflow-hidden' : '')}>
            <img
              src={activeImage.publicUrl}
              alt={activeImage.file_name || `Storyboard image ${activeIndex + 1}`}
              className={cn(
                'pointer-events-none block w-full select-none object-contain object-center',
                aspectVideo ? 'h-full' : 'h-auto',
              )}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              draggable={false}
            />
            {images.map((image, index) =>
              index === activeIndex ? null : (
                <img
                  key={image.id}
                  src={image.publicUrl}
                  alt=""
                  className="hidden"
                  decoding="async"
                />
              ),
            )}
          </div>
        ) : (
          (() => {
            const emptyClassName = cn(
              'flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-sm text-gray-500',
              aspectVideo ? 'py-3' : 'min-h-[160px] px-4 py-6',
              isMobile && canOpenPicker && 'cursor-pointer',
            );
            const emptyBody = (
              <>
                <ImagePlus className={cn('text-gray-400', aspectVideo ? 'h-5 w-5' : 'h-6 w-6')} />
                <span className={cn(aspectVideo && 'text-xs leading-snug')}>
                  {isMobile
                    ? t(
                        'briefDialog.storyboard.imageHintMobile',
                        'Ketuk untuk ambil foto atau pilih dari galeri',
                      )
                    : t(
                        'briefDialog.storyboard.imageHintDesktop',
                        'Double-click, paste, atau drag gambar ke sini',
                      )}
                </span>
                <span className="text-xs text-gray-400">
                  {t('briefDialog.storyboard.imageFormats', 'PNG, JPG, WEBP sampai 5MB')}
                </span>
              </>
            );
            return <div className={emptyClassName}>{emptyBody}</div>;
          })()
        )}

        {images.length > 0 && briefVideo?.enabled ? (
          <button
            type="button"
            title={t('videoAi.cell.generate', 'Generate video')}
            aria-label={t('videoAi.cell.generate', 'Generate video')}
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              briefVideo?.openShot(rowIndex, activeImage?.id);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            className="absolute left-1.5 top-1.5 z-[2] flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white shadow-sm transition-colors hover:bg-black/75"
          >
            <Clapperboard className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {onEditPrompt ? (
          <button
            type="button"
            title={t('briefDialog.imagePrompt.edit', 'Edit image prompt')}
            aria-label={t('briefDialog.imagePrompt.edit', 'Edit image prompt')}
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onEditPrompt();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            className={cn(
              'absolute top-1.5 z-[2] flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white shadow-sm transition-colors hover:bg-black/75',
              images.length > 0 && briefVideo?.enabled ? 'left-9' : 'left-1.5',
            )}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {activeImage && !activeVideo && onDeleteImage ? (
          <button
            type="button"
            title={t('briefDialog.storyboard.deleteImage', 'Hapus gambar')}
            aria-label={t('briefDialog.storyboard.deleteImage', 'Hapus gambar')}
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              setConfirmDeleteId(activeImage.id);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            disabled={disabled}
            className={cn(
              'absolute top-1.5 z-[2] flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white shadow-sm transition-colors hover:bg-red-600 disabled:opacity-50',
              (images.length > 0 && briefVideo?.enabled ? 1 : 0) + (onEditPrompt ? 1 : 0) === 0
                ? 'left-1.5'
                : (images.length > 0 && briefVideo?.enabled ? 1 : 0) + (onEditPrompt ? 1 : 0) === 1
                  ? 'left-9'
                  : 'left-[4.125rem]',
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {slideCount > 1 ? (
          <>
            {slideIndex > 0 ? (
              <button
                type="button"
                title="Previous image"
                aria-label="Previous image"
                onClick={(event) => {
                  event.stopPropagation();
                  selectSlide(slideIndex - 1);
                }}
                className={cn(
                  'absolute left-1.5 top-1/2 z-[1] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full',
                  'bg-black/45 text-white shadow-sm transition-opacity hover:bg-black/65',
                  'opacity-80 group-hover:opacity-100',
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
            {slideIndex < slideCount - 1 ? (
              <button
                type="button"
                title="Next image"
                aria-label="Next image"
                onClick={(event) => {
                  event.stopPropagation();
                  selectSlide(slideIndex + 1);
                }}
                className={cn(
                  'absolute right-1.5 top-1/2 z-[1] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full',
                  'bg-black/45 text-white shadow-sm transition-opacity hover:bg-black/65',
                  'opacity-80 group-hover:opacity-100',
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : null}
            {!activeVideo ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 z-[1] flex items-center justify-center gap-1.5">
              {Array.from({ length: slideCount }, (_, index) => {
                const videoOffset = index - images.length;
                const versionLabel = videoOffset >= 0
                  ? (readyVideos.length > 1
                    ? t('videoAi.cell.videoNumber', 'Video {{index}}', { index: videoOffset + 1 })
                    : t('videoAi.cell.video', 'Video'))
                  : index <= 0
                    ? t('briefDialog.version.original', 'Original')
                    : t('briefDialog.version.numbered', 'V.{{index}}', { index });
                return (
                  <button
                    key={videoOffset >= 0 ? readyVideos[videoOffset]?.id ?? `video-${index}` : images[index]?.id ?? index}
                    type="button"
                    title={versionLabel}
                    aria-label={versionLabel}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (videoOffset < 0 && showThumbnails && index === slideIndex) {
                        setShowThumbnails(false);
                        return;
                      }
                      selectSlide(index);
                      if (videoOffset < 0) setShowThumbnails(true);
                    }}
                    className={cn(
                      'pointer-events-auto h-1.5 w-1.5 rounded-full shadow-sm transition-all',
                      index === slideIndex ? 'w-3 bg-white' : 'bg-white/55 hover:bg-white/80',
                    )}
                  />
                );
              })}
              <span className="pointer-events-none shrink-0 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                {slideIndex <= 0
                  ? t('briefDialog.version.original', 'Original')
                  : t('briefDialog.version.numbered', 'V.{{index}}', { index: slideIndex })}
              </span>
            </div>
            ) : null}
          </>
        ) : null}

        {(isUploading || isDeleting) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        )}
      </div>

      {(showThumbnails || activeVideo) && images.length + readyVideos.length > 1 ? (
        <div
          className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              title={image.file_name || `Image ${index + 1}`}
              onClick={(event) => {
                event.stopPropagation();
                selectSlide(index);
              }}
              className={cn(
                'h-12 w-12 shrink-0 overflow-hidden rounded border bg-white transition-shadow',
                index === slideIndex && !activeVideo
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <img
                src={image.publicUrl}
                alt={image.file_name || `Thumbnail ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
                draggable={false}
              />
            </button>
          ))}
          {readyVideos.map((video, offset) => {
            const index = images.length + offset;
            const label = readyVideos.length > 1
              ? t('videoAi.cell.videoNumber', 'Video {{index}}', { index: offset + 1 })
              : t('videoAi.cell.video', 'Video');
            return (
              <button
                key={video.id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={activeVideo?.id === video.id}
                onClick={(event) => {
                  event.stopPropagation();
                  selectSlide(index);
                }}
                className={cn(
                  'relative h-12 w-12 shrink-0 overflow-hidden rounded border bg-black transition-shadow',
                  activeVideo?.id === video.id
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <video
                  src={`${video.url}#t=0.1`}
                  muted
                  playsInline
                  preload="metadata"
                  className="pointer-events-none h-full w-full object-cover"
                />
                <span className="pointer-events-none absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white">
                  <Clapperboard className="h-2.5 w-2.5" />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {videoStatus.phase === 'working' ? (
        <p className="mt-1 text-xs font-medium text-gray-600">{t('videoAi.cell.making', 'Membuat video…')}</p>
      ) : null}
      {videoStatus.error ? (
        <p className="mt-1 text-xs text-red-600">{videoStatus.error}</p>
      ) : null}
      <BriefSeedanceVoiceButton rowIndex={rowIndex} scope="shot" />

      {showUploadButton && canInteract ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-7 w-full gap-1 text-xs"
          onClick={(event) => {
            event.stopPropagation();
            openFilePicker();
          }}
          disabled={disabled}
        >
          <Upload className="h-3.5 w-3.5" />
          {uploadButtonLabel}
        </Button>
      ) : null}

      <AlertDialog open={Boolean(confirmDeleteId)} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <AlertDialogContent className="z-[1000005] rounded-none" overlayClassName="z-[1000004]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('briefDialog.storyboard.deleteImageTitle', 'Hapus gambar ini?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('briefDialog.storyboard.deleteImageBody', 'Gambar ini akan dihapus dari shot. Prompt yang menempel pada gambar ini ikut terhapus.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">{t('common.cancel', 'Batal')}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                const imageId = confirmDeleteId;
                setConfirmDeleteId(null);
                if (imageId) void handleDelete(imageId);
              }}
            >
              {t('briefDialog.storyboard.deleteImageConfirm', 'Hapus')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isMobile ? (
        <Drawer shouldScaleBackground={false} open={sourceOpen} onOpenChange={setSourceOpen}>
          <DrawerContent
            className="z-[1000003] px-0 pb-4"
            overlayClassName="z-[1000002]"
          >
            <DrawerHeader className="px-4 pb-2 text-left">
              <DrawerTitle className="text-base">
                {t('briefDialog.storyboard.imageSourceTitle', 'Tambah gambar')}
              </DrawerTitle>
            </DrawerHeader>
            <div className="flex flex-col gap-1 px-3 pb-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm hover:bg-muted"
                onClick={() => void pickFromCamera()}
              >
                <Camera className="h-4 w-4 shrink-0 text-muted-foreground" />
                {t('briefDialog.storyboard.imageSourceCamera', 'Ambil dari kamera')}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm hover:bg-muted"
                onClick={() => void pickFromGallery()}
              >
                <Images className="h-4 w-4 shrink-0 text-muted-foreground" />
                {t('briefDialog.storyboard.imageSourceGallery', 'Pilih dari galeri')}
              </button>
            </div>
          </DrawerContent>
        </Drawer>
      ) : null}
    </div>
  );
};
