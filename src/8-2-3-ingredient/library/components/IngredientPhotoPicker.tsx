import { useRef } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

export type IngredientPhotoPickerProps = {
  photoSrc: string | null;
  initials: string;
  onFileChange: (file: File | null) => void;
  className?: string;
};

export function IngredientPhotoPicker({
  photoSrc,
  initials,
  onFileChange,
  className,
}: IngredientPhotoPickerProps) {
  const { t } = useAppTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className={cn(
          "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted text-lg font-medium uppercase text-muted-foreground hover:border-primary/60",
          className,
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const next = e.dataTransfer.files?.[0];
          if (next?.type.startsWith("image/")) onFileChange(next);
        }}
        aria-label={t("ingredient.library.photoUpload", "Upload ingredient photo")}
      >
        {photoSrc ? (
          <img src={photoSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          initials || "—"
        )}
      </button>
    </>
  );
}
