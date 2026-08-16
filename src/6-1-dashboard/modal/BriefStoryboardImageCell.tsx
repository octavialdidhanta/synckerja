import React, { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Images, Loader2, Upload, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/shared/lib/utils';
import type { BriefStoryboardImageWithUrl } from '@/6-1-dashboard/hook/useBriefStoryboardImages';
import { Button } from '@/shared/components/ui/button';
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

interface BriefStoryboardImageCellProps {
  rowIndex: number;
  images: BriefStoryboardImageWithUrl[];
  editable: boolean;
  disabled?: boolean;
  isUploading?: boolean;
  isDeleting?: boolean;
  onUploadFiles?: (rowIndex: number, files: File[]) => Promise<unknown>;
  onDeleteImage?: (imageId: string) => Promise<unknown>;
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
}) => {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapAtRef = useRef(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);

  useEffect(() => {
    if (activeIndex > images.length - 1) {
      setActiveIndex(Math.max(0, images.length - 1));
    }
  }, [activeIndex, images.length]);

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
    await onUploadFiles(rowIndex, files);
    setActiveIndex(images.length);
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
    if (!activeImage) {
      if (isMobile && canOpenPicker) {
        event.preventDefault();
        openFilePicker();
      }
      return;
    }
    if (images.length <= 1) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - bounds.left;
    if (singleClickTimerRef.current) {
      clearTimeout(singleClickTimerRef.current);
    }
    singleClickTimerRef.current = setTimeout(() => {
      if (clickX < bounds.width / 2) {
        setActiveIndex((prev) => Math.max(0, prev - 1));
      } else {
        setActiveIndex((prev) => Math.min(images.length - 1, prev + 1));
      }
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
        if (event.key === 'ArrowLeft' && images.length > 1) {
          event.preventDefault();
          setActiveIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (event.key === 'ArrowRight' && images.length > 1) {
          event.preventDefault();
          setActiveIndex((prev) => Math.min(images.length - 1, prev + 1));
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
        role={canInteract || images.length > 1 ? 'button' : undefined}
        tabIndex={-1}
        onClick={handleFrameClick}
        onDoubleClick={handleFrameDoubleClick}
        onPointerUp={handleFramePointerUp}
        className={cn(
          'relative w-full overflow-hidden rounded-md border border-gray-200 bg-white [touch-action:pan-x_pan-y]',
          canInteract && 'cursor-pointer',
          images.length > 1 && 'cursor-ew-resize',
          aspectVideo && 'aspect-video',
          !activeImage && !aspectVideo && 'flex min-h-[160px] items-center justify-center',
          !activeImage && aspectVideo && 'flex items-center justify-center',
        )}
      >
        {activeImage ? (
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

        {activeImage && onDeleteImage && editable ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void handleDelete(activeImage.id);
            }}
            disabled={disabled}
            title="Delete image"
            className="absolute right-1.5 top-1.5 z-[2] flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white shadow-sm transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {images.length > 1 ? (
          <>
            {activeIndex > 0 ? (
              <button
                type="button"
                title="Previous image"
                aria-label="Previous image"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex((prev) => Math.max(0, prev - 1));
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
            {activeIndex < images.length - 1 ? (
              <button
                type="button"
                title="Next image"
                aria-label="Next image"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex((prev) => Math.min(images.length - 1, prev + 1));
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
            <div className="pointer-events-none absolute inset-x-0 bottom-2 z-[1] flex items-center justify-center gap-1.5">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  title={`Image ${index + 1}`}
                  aria-label={`Show image ${index + 1}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (showThumbnails && index === activeIndex) {
                      setShowThumbnails(false);
                      return;
                    }
                    setActiveIndex(index);
                    setShowThumbnails(true);
                  }}
                  className={cn(
                    'pointer-events-auto h-1.5 w-1.5 rounded-full shadow-sm transition-all',
                    index === activeIndex ? 'w-3 bg-white' : 'bg-white/55 hover:bg-white/80',
                  )}
                />
              ))}
            </div>
          </>
        ) : null}

        {(isUploading || isDeleting) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        )}
      </div>

      {showThumbnails && images.length > 1 ? (
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
                setActiveIndex(index);
              }}
              className={cn(
                'h-12 w-12 shrink-0 overflow-hidden rounded border bg-white transition-shadow',
                index === activeIndex
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
        </div>
      ) : null}

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
