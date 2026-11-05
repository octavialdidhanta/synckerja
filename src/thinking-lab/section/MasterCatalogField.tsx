import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { LabCatalog } from "@/thinking-lab/master-thought/useLabCatalogs";

const NONE = "none";

export function MasterCatalogField({
  serviceId,
  services,
  pending,
  onSave,
}: {
  serviceId: string | null;
  services: LabCatalog[];
  pending: boolean;
  onSave: (serviceId: string | null) => void;
}) {
  const { t } = useAppTranslation();
  const [draft, setDraft] = useState(serviceId ?? "");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setDraft(serviceId ?? "");
    setEditing(false);
  }, [serviceId]);
  const savedName = services.find((item) => item.id === serviceId)?.name
    ?? (serviceId ? t("thinkingLab.catalog.saved", "Katalog tersimpan") : t("thinkingLab.catalog.none", "Belum ada katalog"));
  const choices = serviceId && !services.some((item) => item.id === serviceId)
    ? [{ id: serviceId, name: t("thinkingLab.catalog.saved", "Katalog tersimpan") }, ...services]
    : services;
  const dirty = (draft || null) !== (serviceId || null);
  const cancel = () => {
    setDraft(serviceId ?? "");
    setEditing(false);
  };
  if (!editing) {
    return (
      <div className="flex w-full items-center gap-2">
        <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-input bg-background px-3 text-sm text-foreground">
          <span className="truncate">{savedName}</span>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0" disabled={pending} onClick={() => setEditing(true)}>
          {t("thinkingLab.catalog.edit", "Edit")}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex w-full items-center gap-2">
      <Select value={draft || NONE} onValueChange={(value) => setDraft(value === NONE ? "" : value)} disabled={pending}>
        <SelectTrigger className="h-8 min-w-0 flex-1" aria-label={t("thinkingLab.catalog.label", "Katalog")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("thinkingLab.catalog.none", "Belum ada katalog")}</SelectItem>
          {choices.map((item) => (
            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" size="sm" className="shrink-0" disabled={pending || !dirty} onClick={() => onSave(draft || null)}>
        {t("thinkingLab.catalog.save", "Save")}
      </Button>
      <Button type="button" size="sm" variant="ghost" className="shrink-0" disabled={pending} onClick={cancel}>
        {t("thinkingLab.catalog.cancel", "Batal")}
      </Button>
    </div>
  );
}
