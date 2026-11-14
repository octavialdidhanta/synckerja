import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  catalogContext,
  sameCatalogLink,
  type LabCatalog,
  type MasterCatalogLink,
} from "@/thinking-lab/master-thought/catalog";
import { MasterCatalogPicker } from "@/thinking-lab/section/MasterCatalogPicker";

export function MasterCatalogField({
  value,
  catalogs,
  pending,
  onSave,
}: {
  value: MasterCatalogLink;
  catalogs: LabCatalog[];
  pending: boolean;
  onSave: (value: MasterCatalogLink) => void;
}) {
  const { t } = useAppTranslation();
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);
  const context = catalogContext(value, catalogs);
  const summary = context
    ? [context.category, ...context.subCategories, ...context.features].join(" · ")
    : value.serviceId
      ? t("thinkingLab.catalog.saved", "Katalog tersimpan")
      : t("thinkingLab.catalog.none", "Belum ada katalog");
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };
  if (!editing) {
    return (
      <div className="flex w-full items-center gap-2">
        <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-input bg-background px-3 text-sm text-foreground">
          <span className="truncate">{summary}</span>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0" disabled={pending} onClick={() => setEditing(true)}>
          {t("thinkingLab.catalog.edit", "Edit")}
        </Button>
      </div>
    );
  }
  return (
    <div className="w-full space-y-2">
      <MasterCatalogPicker value={draft} catalogs={catalogs} disabled={pending} onChange={setDraft} />
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={cancel}>
          {t("thinkingLab.catalog.cancel", "Batal")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending || !draft.serviceId || sameCatalogLink(draft, value)}
          onClick={() => onSave(draft)}
        >
          {t("thinkingLab.catalog.save", "Save")}
        </Button>
      </div>
    </div>
  );
}
