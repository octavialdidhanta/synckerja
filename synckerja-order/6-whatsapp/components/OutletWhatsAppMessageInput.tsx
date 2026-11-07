import { useEffect, useState } from "react";
import { MapPin, MoreHorizontal, Pencil } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { isGoogleMapsUrl } from "@/synckerja-order/shared/lib/googleMapsLink";
import { expandGoogleMapsUrl } from "@/synckerja-order/shared/lib/resolveGoogleMapsLink";
import { ORDER_WHATSAPP_DEFAULT_TABLE_MESSAGE, ORDER_WHATSAPP_MESSAGE_MAX } from "../lib/orderWhatsApp";

type Props = {
  value: string;
  disabled?: boolean;
  onSave: (message: string) => Promise<void>;
  linkOrderingEnabled?: boolean;
  onLinkOrderingChange?: (enabled: boolean) => void;
  mapsUrl?: string;
  onSaveMapsUrl?: (url: string) => Promise<void>;
};

/** Row action: three-dot menu. Opening message is edited from the menu, not inline. */
export function OutletWhatsAppMessageInput({
  value,
  disabled,
  onSave,
  linkOrderingEnabled = false,
  onLinkOrderingChange,
  mapsUrl = "",
  onSaveMapsUrl,
}: Props) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(false);
  const [mapsDraft, setMapsDraft] = useState(mapsUrl);
  const [mapsSaving, setMapsSaving] = useState(false);
  const [mapsError, setMapsError] = useState<"save" | "invalid" | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft(value);
      setError(false);
    }
  }, [open, value]);

  useEffect(() => {
    if (!mapsOpen) {
      setMapsDraft(mapsUrl);
      setMapsError(null);
    }
  }, [mapsOpen, mapsUrl]);

  const commitMaps = async () => {
    let next = mapsDraft.trim();
    if (next && !isGoogleMapsUrl(next)) {
      setMapsError("invalid");
      return;
    }
    setMapsSaving(true);
    setMapsError(null);
    try {
      if (next) {
        const expanded = await expandGoogleMapsUrl(next);
        if (expanded) next = expanded;
      }
      if (next === mapsUrl.trim()) {
        setMapsOpen(false);
        return;
      }
      await onSaveMapsUrl?.(next);
      setMapsOpen(false);
    } catch {
      setMapsError("save");
    } finally {
      setMapsSaving(false);
    }
  };

  const commit = async () => {
    if (draft.trim() === value.trim()) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError(false);
    try {
      await onSave(draft);
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-600 hover:text-gray-900"
            aria-label={t("synckerjaOrder.outlets.action", "Action")}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="w-60">
          {onLinkOrderingChange ? (
            <>
              <DropdownMenuCheckboxItem
                checked={linkOrderingEnabled}
                onCheckedChange={(checked) => onLinkOrderingChange(checked === true)}
                onSelect={(event) => event.preventDefault()}
              >
                {t("synckerjaOrder.whatsapp.linkOrdering", "Ordering from link")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          {onSaveMapsUrl ? (
            <DropdownMenuItem className="cursor-pointer" onSelect={() => setMapsOpen(true)}>
              <MapPin className="mr-2 h-3.5 w-3.5" />
              {t("synckerjaOrder.outlets.mapsLink", "Google Maps link")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            disabled={disabled || saving}
            className="cursor-pointer"
            title={
              disabled
                ? t("synckerjaOrder.whatsapp.messageNeedsNumber", "Select a WhatsApp number first")
                : undefined
            }
            onSelect={() => setOpen(true)}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            {t("synckerjaOrder.whatsapp.editMessage", "Edit opening message")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mapsOpen} onOpenChange={(next) => !mapsSaving && setMapsOpen(next)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("synckerjaOrder.outlets.mapsLink", "Google Maps link")}</DialogTitle>
          </DialogHeader>
          <Input
            value={mapsDraft}
            maxLength={2000}
            disabled={mapsSaving}
            placeholder="https://www.google.com/maps/place/..."
            aria-label={t("synckerjaOrder.outlets.mapsLink", "Google Maps link")}
            onChange={(event) => {
              setMapsDraft(event.target.value);
              if (mapsError) setMapsError(null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            {t(
              "synckerjaOrder.outlets.mapsHint",
              "Paste the link from the Google Maps address bar. A short maps.app.goo.gl link still opens Maps, but does not show the map on the page.",
            )}
          </p>
          {mapsError === "invalid" ? (
            <p className="text-xs text-destructive">
              {t("synckerjaOrder.outlets.mapsInvalid", "Use a Google Maps link that starts with https.")}
            </p>
          ) : null}
          {mapsError === "save" ? (
            <p className="text-xs text-destructive">
              {t("synckerjaOrder.whatsapp.saveError", "Failed to save")}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={mapsSaving} onClick={() => setMapsOpen(false)}>
              {t("synckerjaOrder.whatsapp.cancelMessage", "Cancel")}
            </Button>
            <Button type="button" disabled={mapsSaving} onClick={() => void commitMaps()}>
              {mapsSaving
                ? t("synckerjaOrder.whatsapp.saving", "Saving…")
                : t("synckerjaOrder.whatsapp.saveMessage", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("synckerjaOrder.whatsapp.message", "Opening message")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={draft}
            maxLength={ORDER_WHATSAPP_MESSAGE_MAX}
            disabled={saving}
            rows={6}
            placeholder={ORDER_WHATSAPP_DEFAULT_TABLE_MESSAGE}
            aria-label={t("synckerjaOrder.whatsapp.message", "Opening message")}
            className="min-h-40 w-full resize-y text-sm leading-relaxed"
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(false);
            }}
          />
          {error ? (
            <p className="text-xs text-destructive">
              {t("synckerjaOrder.whatsapp.saveError", "Failed to save")}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
              {t("synckerjaOrder.whatsapp.cancelMessage", "Cancel")}
            </Button>
            <Button type="button" disabled={saving} onClick={() => void commit()}>
              {saving
                ? t("synckerjaOrder.whatsapp.saving", "Saving…")
                : t("synckerjaOrder.whatsapp.saveMessage", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
