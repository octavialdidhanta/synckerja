import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { BriefStoryboardImageWithUrl } from '@/6-1-dashboard/hook/useBriefStoryboardImages';

interface BriefStoryboardImageCellProps {
  rowIndex: number;
  images: BriefStoryboardImageWithUrl[];
  editable: boolean;
  disabled?: boolean;
  isUploading?: boolean;
  isDeleting?: boolean;
  onUploadFiles?: (rowIndex: number, files: File[]) => Promise<unknown>;
  onDeleteImage?: (imageId: string) => Promise<unknown>;
}

const acceptedMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];

function filterAcceptedFiles(fileList: FileList | File[]): File[] {
  return Array.from(fileList).filter((file) => acceptedMimeTypes.includes(file.type));
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
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    if (activeIndex > images.length - 1) {
      setActiveIndex(Math.max(0, images.length - 1));
    }
  }, [activeIndex, images.length]);

  useEffect(() => {
    return () => {
      if (singleClickTimerRef.current) {
        clearTimeout(singleClickTimerRef.current);
      }
    };
  }, []);

  const activeImage = images[activeIndex] ?? null;
  const canInteract = editable && !disabled;

  const handleFiles = async (files: File[]) => {
    if (!canInteract || !onUploadFiles || files.length === 0) return;
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
    if (!canInteract) return;
    inputRef.current?.click();
  };

  const handleFrameClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    // Single click only navigates carousel; file picker requires double-click.
    if (!activeImage || images.length <= 1) return;

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

  return (
    <div
      tabIndex={editable ? 0 : undefined}
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
        if (!canInteract) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openFilePicker();
        }
        if (event.key === 'ArrowLeft' && images.length > 1) {
          event.preventDefault();
          setActiveIndex((prev) => Math.max(0, prev - 1));
        }
        if (event.key === 'ArrowRight' && images.length > 1) {
          event.preventDefault();
          setActiveIndex((prev) => Math.min(images.length - 1, prev + 1));
        }
      }}
      className={cn(
        'group relative w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 p-2 outline-none transition-colors',
        canInteract && 'focus:ring-2 focus:ring-blue-500',
        isDragActive && 'border-blue-500 bg-blue-50',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
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
        className={cn(
          'relative w-full overflow-hidden rounded-md border border-gray-200 bg-white',
          canInteract && 'cursor-pointer',
          images.length > 1 && 'cursor-ew-resize',
          !activeImage && 'flex min-h-[160px] items-center justify-center',
        )}
      >
        {activeImage ? (
          <div className="max-h-[480px] w-full overflow-hidden">
            <img
              src={activeImage.publicUrl}
              alt={activeImage.file_name || `Storyboard image ${activeIndex + 1}`}
              className="block h-auto w-full object-cover object-center"
              loading="lazy"
              draggable={false}
            />
          </div>
        ) : (
          <div className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center text-sm text-gray-500">
            <ImagePlus className="h-6 w-6 text-gray-400" />
            <span>Double-click, paste, atau drag gambar ke sini</span>
            <span className="text-xs text-gray-400">PNG, JPG, WEBP sampai 5MB</span>
          </div>
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
            className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white shadow-sm transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {images.length > 1 ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1.5"
            aria-hidden
          >
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                title={`Image ${index + 1}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex(index);
                }}
                className={cn(
                  'pointer-events-auto h-1.5 w-1.5 rounded-full shadow-sm transition-all',
                  index === activeIndex ? 'w-3 bg-white' : 'bg-white/55 hover:bg-white/80',
                )}
              />
            ))}
          </div>
        ) : null}

        {(isUploading || isDeleting) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        )}
      </div>
    </div>
  );
};
