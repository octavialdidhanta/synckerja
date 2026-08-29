import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosOutlets } from "../hooks/usePosOutlets";
import type { PosOutlet } from "../types";
import { draftFromOutlet, emptyOutletDraft, isOutletDraftValid } from "../types";

export type OutletFormProps = {
  outlet: PosOutlet | null;
  onClose: () => void;
};

export function OutletForm({ outlet, onClose }: OutletFormProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { save, isSaving } = usePosOutlets();
  const [draft, setDraft] = useState(() => (outlet ? draftFromOutlet(outlet) : emptyOutletDraft()));

  useEffect(() => {
    setDraft(outlet ? draftFromOutlet(outlet) : emptyOutletDraft());
  }, [outlet]);

  const canSave = isOutletDraftValid(draft);
  const isEdit = Boolean(outlet);

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await save({
        id: draft.id,
        name: draft.name,
        address: draft.address,
        city: draft.city,
        province: draft.province,
        postal_code: draft.postal_code,
        phone: draft.phone,
        is_active: draft.is_active,
      });
      toast({ title: t("outlets.saved", "Outlet saved.") });
      onClose();
    } catch {
      toast({
        title: t("outlets.saveFailed", "Failed to save outlet."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? t("outlets.editTitle", "Edit Outlet") : t("outlets.createTitle", "Create Outlet")}
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("outlets.statusLabel", "Status:")}</span>
            <span className="font-medium">
              {draft.is_active ? t("outlets.statusActive", "Active") : t("outlets.statusInactive", "Inactive")}
            </span>
            <Switch checked={draft.is_active} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, is_active: checked }))} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!canSave || isSaving}>
            {isEdit ? t("common.save", "Save") : t("outlets.createAction", "Create Outlet")}
          </Button>
        </div>
      </div>

      <section className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="outlet-name">{t("outlets.nameLabel", "Outlet Name")}</Label>
          <Input
            id="outlet-name"
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={t("outlets.namePlaceholder", "Outlet name")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="outlet-address">{t("outlets.addressLabel", "Address")}</Label>
          <Textarea
            id="outlet-address"
            value={draft.address}
            onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))}
            placeholder={t("outlets.addressPlaceholder", "Full address")}
            rows={3}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="outlet-city">{t("outlets.cityLabel", "City")}</Label>
            <Input
              id="outlet-city"
              value={draft.city}
              onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="outlet-province">{t("outlets.provinceLabel", "Province")}</Label>
            <Input
              id="outlet-province"
              value={draft.province}
              onChange={(e) => setDraft((prev) => ({ ...prev, province: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="outlet-postal">{t("outlets.postalCodeLabel", "Postal Code")}</Label>
            <Input
              id="outlet-postal"
              value={draft.postal_code}
              onChange={(e) => setDraft((prev) => ({ ...prev, postal_code: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="outlet-phone">{t("outlets.phoneLabel", "Phone")}</Label>
          <Input
            id="outlet-phone"
            value={draft.phone}
            onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder={t("outlets.phonePlaceholder", "+62")}
          />
        </div>
      </section>
    </div>
  );
}
