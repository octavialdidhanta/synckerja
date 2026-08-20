import { useRef } from "react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { BundleDraft } from "../types";

export type BundleInformationSectionProps = {
  draft: BundleDraft;
  photoSrc: string | null;
  onChange: (patch: Partial<BundleDraft>) => void;
  onFileChange: (file: File | null) => void;
};

export function BundleInformationSection({
  draft,
  photoSrc,
  onChange,
  onFileChange,
}: BundleInformationSectionProps) {
  const { t } = useAppTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h3 className="text-base font-semibold">
        {t("defaultPrices.bundles.infoSection", "Bundle Information")}
      </h3>
      <div className="flex items-center gap-4">
        <Label className="w-40 shrink-0 text-sm text-muted-foreground">
          {t("defaultPrices.bundles.photoLabel", "Image for POS (Optional)")}
        </Label>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          className="h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const next = e.dataTransfer.files?.[0];
            if (next) onFileChange(next);
          }}
          aria-label={t("defaultPrices.bundles.photoLabel", "Image for POS (Optional)")}
        >
          {photoSrc ? (
            <img src={photoSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="block h-full w-full bg-muted" />
          )}
        </button>
      </div>
      <div className="flex items-center gap-4">
        <Label htmlFor="bundle-name" className="w-40 shrink-0 text-sm text-muted-foreground">
          {t("defaultPrices.bundles.nameLabel", "Bundle Name")}
        </Label>
        <Input
          id="bundle-name"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("defaultPrices.bundles.namePlaceholder", "Write bundle name...")}
          className="flex-1"
        />
      </div>
    </section>
  );
}
