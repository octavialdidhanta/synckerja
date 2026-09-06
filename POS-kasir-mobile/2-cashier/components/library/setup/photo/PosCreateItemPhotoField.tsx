import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, ImagePlus, Images, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_CASHIER_I18N } from "../../../../lib/posCashierCopy";
import { PosCreateItemPhotoCropSheet } from "./PosCreateItemPhotoCropSheet";
import {
  isAcceptedCreateItemPhoto,
  pickCreateItemNativePhoto,
  readFileAsObjectUrl,
} from "./pickCreateItemPhoto";

type Props = {
  file: File | null;
  disabled?: boolean;
  onChange: (file: File | null) => void;
};

/**
 * Compact square photo field for Create Item (phone + tablet).
 * Camera / gallery open a crop sheet so the saved image is always square.
 */
export function PosCreateItemPhotoField({ file, disabled, onChange }: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = readFileAsObjectUrl(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      if (cropUrl) URL.revokeObjectURL(cropUrl);
    };
  }, [cropUrl]);

  const beginCrop = (next: File) => {
    if (cropUrl) URL.revokeObjectURL(cropUrl);
    setCropUrl(readFileAsObjectUrl(next));
  };

  const rejectFormat = () => {
    toast({
      title: t(POS_CASHIER_I18N.setupPhotoFormat, "Use JPG, PNG, or WEBP."),
      variant: "destructive",
    });
  };

  const onFileChosen = (list: FileList | null) => {
    const next = list?.[0];
    if (!next) return;
    if (!isAcceptedCreateItemPhoto(next)) {
      rejectFormat();
      return;
    }
    beginCrop(next);
  };

  const pickCamera = async () => {
    if (disabled || picking) return;
    setPicking(true);
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          const native = await pickCreateItemNativePhoto("camera");
          if (!native) {
            rejectFormat();
            return;
          }
          beginCrop(native);
        } catch {
          // User cancelled native camera.
        }
        return;
      }
      cameraInputRef.current?.click();
    } finally {
      setPicking(false);
    }
  };

  const pickGallery = async () => {
    if (disabled || picking) return;
    setPicking(true);
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          const native = await pickCreateItemNativePhoto("gallery");
          if (!native) {
            rejectFormat();
            return;
          }
          beginCrop(native);
        } catch {
          // User cancelled gallery.
        }
        return;
      }
      galleryInputRef.current?.click();
    } finally {
      setPicking(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center gap-3 px-3 py-4">
        <div className="relative">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-500 ring-1 ring-slate-200/80">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-10 w-10 opacity-70" aria-hidden />
            )}
          </div>
          {previewUrl && !disabled ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200"
              aria-label={t(POS_CASHIER_I18N.setupPhotoRemove, "Remove photo")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex w-full max-w-xs items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 gap-1.5 border-slate-200 bg-white text-slate-700"
            disabled={disabled || picking}
            onClick={() => void pickCamera()}
          >
            <Camera className="h-3.5 w-3.5" aria-hidden />
            {t(POS_CASHIER_I18N.setupPhotoCamera, "Camera")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 gap-1.5 border-slate-200 bg-white text-slate-700"
            disabled={disabled || picking}
            onClick={() => void pickGallery()}
          >
            <Images className="h-3.5 w-3.5" aria-hidden />
            {t(POS_CASHIER_I18N.setupPhotoGallery, "Gallery")}
          </Button>
        </div>
      </div>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={(e) => {
          onFileChosen(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onFileChosen(e.target.files);
          e.target.value = "";
        }}
      />

      <PosCreateItemPhotoCropSheet
        open={Boolean(cropUrl)}
        imageUrl={cropUrl}
        busy={disabled}
        onCancel={() => {
          if (cropUrl) URL.revokeObjectURL(cropUrl);
          setCropUrl(null);
        }}
        onConfirm={(cropped) => {
          if (cropUrl) URL.revokeObjectURL(cropUrl);
          setCropUrl(null);
          onChange(cropped);
        }}
      />
    </>
  );
}
