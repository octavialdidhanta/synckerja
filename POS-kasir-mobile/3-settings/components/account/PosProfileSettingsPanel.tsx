import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import {
  draftFromOutlet,
  emptyOutletDraft,
  isOutletDraftValid,
  type OutletDraft,
} from "@/8-2-2-outlets/types";
import {
  POS_OUTLET_RECEIPT_SETTINGS_QUERY_KEY,
  useOutletReceiptSettings,
} from "@/8-2-6-receipt/hooks/useOutletReceiptSettings";
import {
  removeOutletReceiptLogo,
  signOutletReceiptLogo,
  uploadOutletReceiptLogo,
} from "@/8-2-6-receipt/lib/receiptLogoStorage";
import { EMPTY_RECEIPT_SETTINGS } from "@/8-2-6-receipt/types";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import {
  readPosSelectedOutletId,
  stashPosSelectedOutlet,
} from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { POS_SETTINGS_I18N } from "../../lib/posSettingsCopy";
import { PosProfileLogoField } from "./PosProfileLogoField";

export type PosOutletProfileSaved = {
  name: string;
  address: string;
};

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </span>
  );
}

function ViewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 px-4 py-3 last:border-b-0">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="whitespace-pre-wrap break-words text-sm text-slate-900">
        {value || "—"}
      </p>
    </div>
  );
}

/**
 * Account → Profil — view/edit the currently selected POS outlet (`pos_outlets` + receipt logo).
 * Defaults to read-only view; Save returns to view mode.
 */
export function PosProfileSettingsPanel({
  onOutletSaved,
}: {
  onOutletSaved?: (meta: PosOutletProfileSaved) => void;
} = {}) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const outletId = readPosSelectedOutletId();
  const { rows, isLoading, save, isSaving } = usePosOutlets();
  const receipt = useOutletReceiptSettings(outletId);

  const outlet = useMemo(
    () => (outletId ? rows.find((r) => r.id === outletId) ?? null : null),
    [outletId, rows],
  );

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<OutletDraft>(() =>
    outlet ? draftFromOutlet(outlet) : emptyOutletDraft(),
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [signedLogoUrl, setSignedLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    setDraft(outlet ? draftFromOutlet(outlet) : emptyOutletDraft());
    setLogoFile(null);
    setRemoveLogo(false);
    // Entering a different outlet resets to view mode.
    setEditing(false);
  }, [outlet?.id]);

  useEffect(() => {
    if (!outlet || editing) return;
    setDraft(draftFromOutlet(outlet));
  }, [outlet, editing]);

  useEffect(() => {
    let cancelled = false;
    const path = removeLogo ? null : receipt.settings?.logo_storage_path;
    void signOutletReceiptLogo(path).then((url) => {
      if (!cancelled) setSignedLogoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [receipt.settings?.logo_storage_path, removeLogo, outletId]);

  const localLogoUrl = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : null),
    [logoFile],
  );
  useEffect(() => {
    return () => {
      if (localLogoUrl) URL.revokeObjectURL(localLogoUrl);
    };
  }, [localLogoUrl]);

  const previewUrl = localLogoUrl ?? (removeLogo ? null : signedLogoUrl);
  const canRemoveLogo = Boolean(logoFile || (!removeLogo && receipt.settings?.logo_storage_path));
  const canSave = isOutletDraftValid(draft);
  const busy = isSaving || logoBusy;

  const persistLogo = async () => {
    if (!organizationId || !outletId) return;
    if (!logoFile && !removeLogo) return;

    const existing = receipt.settings;
    let logoPath = existing?.logo_storage_path ?? null;

    if (logoFile) {
      logoPath = await uploadOutletReceiptLogo({
        organizationId,
        outletId,
        file: logoFile,
      });
    } else if (removeLogo && logoPath) {
      await removeOutletReceiptLogo(logoPath);
      logoPath = null;
    }

    const row = {
      organization_id: organizationId,
      outlet_id: outletId,
      logo_storage_path: logoPath,
      footer_notes: existing?.footer_notes ?? EMPTY_RECEIPT_SETTINGS.footer_notes,
      share_via_email: existing?.share_via_email ?? EMPTY_RECEIPT_SETTINGS.share_via_email,
      share_via_sms: existing?.share_via_sms ?? EMPTY_RECEIPT_SETTINGS.share_via_sms,
      website_url: existing?.website_url ?? EMPTY_RECEIPT_SETTINGS.website_url,
      twitter_url: existing?.twitter_url ?? EMPTY_RECEIPT_SETTINGS.twitter_url,
      facebook_url: existing?.facebook_url ?? EMPTY_RECEIPT_SETTINGS.facebook_url,
      instagram_url: existing?.instagram_url ?? EMPTY_RECEIPT_SETTINGS.instagram_url,
      tiktok_url: existing?.tiktok_url ?? EMPTY_RECEIPT_SETTINGS.tiktok_url,
      whatsapp_url: existing?.whatsapp_url ?? EMPTY_RECEIPT_SETTINGS.whatsapp_url,
    };

    const { error } = await supabase
      .from("pos_outlet_receipt_settings")
      .upsert(row, { onConflict: "outlet_id", ignoreDuplicates: false });
    if (error) throw error;

    await queryClient.invalidateQueries({
      queryKey: [POS_OUTLET_RECEIPT_SETTINGS_QUERY_KEY, organizationId],
    });
  };

  const handleCancel = () => {
    if (outlet) setDraft(draftFromOutlet(outlet));
    setLogoFile(null);
    setRemoveLogo(false);
    setEditing(false);
  };

  const handleSave = async () => {
    if (!outletId || !outlet) return;
    if (!canSave) {
      toast({
        title: t(
          POS_SETTINGS_I18N.profileValidation,
          "Business name and phone are required.",
        ),
        variant: "destructive",
      });
      return;
    }

    try {
      setLogoBusy(true);
      await save({
        id: outletId,
        name: draft.name,
        address: draft.address,
        city: draft.city,
        province: draft.province,
        postal_code: draft.postal_code,
        phone: draft.phone,
        is_active: draft.is_active,
      });
      await persistLogo();
      const name = draft.name.trim();
      const address = draft.address.trim();
      stashPosSelectedOutlet({ id: outletId, name });
      setLogoFile(null);
      setRemoveLogo(false);
      setEditing(false);
      onOutletSaved?.({ name, address });
      toast({
        title: t(POS_SETTINGS_I18N.profileSaved, "Outlet profile saved."),
      });
    } catch {
      toast({
        title: t(
          POS_SETTINGS_I18N.profileSaveFailed,
          "Failed to save outlet profile.",
        ),
        variant: "destructive",
      });
    } finally {
      setLogoBusy(false);
    }
  };

  if (!outletId) {
    return (
      <div className="px-4 py-8 text-center text-sm text-slate-600">
        <p className="mb-3">
          {t(POS_SETTINGS_I18N.profileMissingOutlet, "Selected outlet was not found.")}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to={POS_AUTH_PATHS.selectOutlet}>
            {t(POS_SETTINGS_I18N.profileSelectOutlet, "Select outlet")}
          </Link>
        </Button>
      </div>
    );
  }

  if (isLoading && !outlet) {
    return (
      <div
        className="space-y-4 px-4 py-4"
        aria-busy
        aria-label={t(POS_SETTINGS_I18N.profileLoading, "Loading outlet profile…")}
      >
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-10 animate-pulse rounded-md bg-slate-200" />
        <div className="grid grid-cols-[1fr_auto] gap-4">
          <div className="h-24 animate-pulse rounded-md bg-slate-200" />
          <div className="h-28 w-28 animate-pulse rounded-md bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!outlet) {
    return (
      <div className="px-4 py-8 text-center text-sm text-slate-600">
        <p className="mb-3">
          {t(POS_SETTINGS_I18N.profileMissingOutlet, "Selected outlet was not found.")}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to={POS_AUTH_PATHS.selectOutlet}>
            {t(POS_SETTINGS_I18N.profileSelectOutlet, "Select outlet")}
          </Link>
        </Button>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="flex min-h-full flex-col px-4 py-4 pb-8">
        <div className="mb-4 flex justify-end">
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            {t(POS_SETTINGS_I18N.profileEdit, "Edit")}
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex items-start gap-4 border-b border-slate-100 px-4 py-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {t(POS_SETTINGS_I18N.profileBusinessName, "Business name")}
                </p>
                <p className="text-sm font-medium text-slate-900">{draft.name || "—"}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {t(POS_SETTINGS_I18N.profileAddress, "Address")}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-900">
                  {draft.address.trim() ||
                    t(POS_SETTINGS_I18N.profileEmptyAddress, "No address yet")}
                </p>
              </div>
            </div>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={draft.name || outlet.name}
                className="h-28 w-28 flex-shrink-0 rounded-md border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                {t(POS_SETTINGS_I18N.profileLogo, "Logo")}
              </div>
            )}
          </div>

          <ViewRow
            label={t(POS_SETTINGS_I18N.profileProvince, "Province")}
            value={draft.province}
          />
          <ViewRow label={t(POS_SETTINGS_I18N.profileCity, "City")} value={draft.city} />
          <ViewRow
            label={t(POS_SETTINGS_I18N.profilePostalCode, "Postal code")}
            value={draft.postal_code}
          />
          <ViewRow label={t(POS_SETTINGS_I18N.profilePhone, "Phone")} value={draft.phone} />
          <ViewRow
            label={t(POS_SETTINGS_I18N.profileStatus, "Status")}
            value={
              draft.is_active
                ? t(POS_SETTINGS_I18N.profileStatusActive, "Active")
                : t(POS_SETTINGS_I18N.profileStatusInactive, "Inactive")
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col px-4 py-4 pb-8">
      <div className="space-y-5">
        <div>
          <FieldLabel>
            {t(POS_SETTINGS_I18N.profileBusinessName, "Business name")}
          </FieldLabel>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            disabled={busy}
            className="h-11"
          />
        </div>

        <div className="grid grid-cols-[1fr_auto] items-start gap-4">
          <div>
            <FieldLabel>{t(POS_SETTINGS_I18N.profileAddress, "Address")}</FieldLabel>
            <Textarea
              value={draft.address}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, address: e.target.value }))
              }
              disabled={busy}
              rows={5}
              className="min-h-[7rem] resize-none whitespace-pre-wrap break-words"
            />
          </div>
          <PosProfileLogoField
            previewUrl={previewUrl}
            outletName={draft.name || outlet.name}
            disabled={busy}
            canRemove={canRemoveLogo}
            onFile={(file) => {
              setLogoFile(file);
              setRemoveLogo(false);
            }}
            onRemove={() => {
              setLogoFile(null);
              setRemoveLogo(true);
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel>
              {t(POS_SETTINGS_I18N.profileProvince, "Province")}
            </FieldLabel>
            <Input
              value={draft.province}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, province: e.target.value }))
              }
              disabled={busy}
              className="h-11"
            />
          </div>
          <div>
            <FieldLabel>{t(POS_SETTINGS_I18N.profileCity, "City")}</FieldLabel>
            <Input
              value={draft.city}
              onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))}
              disabled={busy}
              className="h-11"
            />
          </div>
          <div>
            <FieldLabel>
              {t(POS_SETTINGS_I18N.profilePostalCode, "Postal code")}
            </FieldLabel>
            <Input
              value={draft.postal_code}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, postal_code: e.target.value }))
              }
              disabled={busy}
              className="h-11"
            />
          </div>
        </div>

        <div>
          <FieldLabel>{t(POS_SETTINGS_I18N.profilePhone, "Phone")}</FieldLabel>
          <Input
            value={draft.phone}
            onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
            disabled={busy}
            className="h-11"
            inputMode="tel"
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {t(POS_SETTINGS_I18N.profileStatus, "Status")}
            </p>
            <p className="text-sm font-medium text-slate-900">
              {draft.is_active
                ? t(POS_SETTINGS_I18N.profileStatusActive, "Active")
                : t(POS_SETTINGS_I18N.profileStatusInactive, "Inactive")}
            </p>
          </div>
          <Switch
            checked={draft.is_active}
            onCheckedChange={(checked) =>
              setDraft((prev) => ({ ...prev, is_active: checked }))
            }
            disabled={busy}
          />
        </div>
      </div>

      <div className="mt-8 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="outline" onClick={handleCancel} disabled={busy}>
          {t(POS_SETTINGS_I18N.profileCancel, "Cancel")}
        </Button>
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave || busy}
          className="min-w-[7rem]"
        >
          {t(POS_SETTINGS_I18N.profileSave, "Save")}
        </Button>
      </div>
    </div>
  );
}
