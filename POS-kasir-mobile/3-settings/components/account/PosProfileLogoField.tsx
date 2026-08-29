import { ImagePlus, Trash2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_SETTINGS_I18N } from "../../lib/posSettingsCopy";

type Props = {
  previewUrl: string | null;
  outletName: string;
  disabled?: boolean;
  canRemove?: boolean;
  onFile: (file: File | null) => void;
  onRemove: () => void;
};

/**
 * Square logo picker for POS Profil (receipt logo for the active outlet).
 */
export function PosProfileLogoField({
  previewUrl,
  outletName,
  disabled,
  canRemove,
  onFile,
  onRemove,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex flex-col items-start gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {t(POS_SETTINGS_I18N.profileLogo, "Logo")}
      </span>
      <label
        className={cn(
          "relative flex h-28 w-28 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={outletName}
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            <ImagePlus className="mb-1 h-6 w-6 text-slate-400" aria-hidden />
            <span className="px-2 leading-tight">
              {t(POS_SETTINGS_I18N.profileLogo, "Logo")}
            </span>
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
      {canRemove ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {t(POS_SETTINGS_I18N.profileLogoRemove, "Remove logo")}
        </button>
      ) : null}
      <p className="max-w-[9rem] text-[10px] leading-snug text-slate-400">
        {t(
          POS_SETTINGS_I18N.profileLogoHint,
          "PNG, JPG, or WEBP. Used on this outlet’s receipts.",
        )}
      </p>
    </div>
  );
}
