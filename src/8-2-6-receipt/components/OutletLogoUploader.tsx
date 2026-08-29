import { Upload } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

type OutletLogoUploaderProps = {
  previewUrl: string | null;
  outletName: string;
  disabled?: boolean;
  onFile: (file: File | null) => void;
};

export function OutletLogoUploader({ previewUrl, outletName, disabled, onFile }: OutletLogoUploaderProps) {
  const { t } = useAppTranslation();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <label
        className={cn(
          "flex h-28 w-28 shrink-0 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-center text-xs text-muted-foreground",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={outletName} className="h-full w-full rounded-md object-cover" />
        ) : (
          <>
            <Upload className="mb-1 h-5 w-5" aria-hidden />
            <span>{t("receiptSettings.logo.upload", "Upload outlet logo")}</span>
          </>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            onFile(file);
            event.target.value = "";
          }}
        />
      </label>
      <p className="max-w-xl text-xs leading-5 text-muted-foreground">
        {t(
          "receiptSettings.logo.hint",
          "If you choose not to upload anything, outlet logo will set to default to image uploaded in public profile page. Uploading image here will only affect selected outlet logo ({{outlet}}) and make the business name in receipt changed to Outlet Name.",
          { outlet: outletName || t("receiptSettings.outletFallback", "this outlet") },
        )}
      </p>
    </div>
  );
}
