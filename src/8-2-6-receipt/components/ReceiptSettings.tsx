import { useEffect, useMemo, useState } from "react";
import { Home } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCompanyProfile } from "@/2-8-dashboard/hooks/useCompanyProfile";
import { useCatalogCheckoutSettings } from "@/8-2-1-default-prices/checkout";
import {
  filterGratuitiesForOutletAndSalesType,
  filterTaxesForOutlet,
} from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import { useCatalogGratuities } from "@/8-2-1-default-prices/gratuity/hooks/useCatalogGratuities";
import { useCatalogSalesTypes } from "@/8-2-1-default-prices/sales-types/hooks/useCatalogSalesTypes";
import { useCatalogTaxes } from "@/8-2-1-default-prices/taxes/hooks/useCatalogTaxes";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { OUTLETS_LIST_PATH } from "@/8-2-2-outlets/layout/OutletsHeaderAndTab";
import { defaultPosOutletId } from "@/8-2-2-outlets/lib/assignedOutlets";
import { cn } from "@/shared/lib/utils";
import { useOutletReceiptSettings } from "../hooks/useOutletReceiptSettings";
import { emptyToNull, nationalPhoneFromStored, storedPhoneFromNational } from "../lib/formatReceiptPhone";
import { canSaveReceiptSettings } from "../lib/canSaveReceiptSettings";
import { isSharingIncomplete } from "../lib/resolveReceiptDisplay";
import { signOutletReceiptLogo } from "../lib/receiptLogoStorage";
import type { ReceiptDraft } from "../types";
import { ReceiptCustomizationForm } from "./ReceiptCustomizationForm";
import { ReceiptPreview } from "./ReceiptPreview";
import { ReceiptSharingSettings } from "./ReceiptSharingSettings";

type ReceiptInnerTab = "customization" | "sharing";

function draftFromSources(args: {
  outletName: string;
  businessName: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string | null;
  footerNotes: string;
  shareViaEmail: boolean;
  shareViaSms: boolean;
  websiteUrl: string;
  twitterUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  whatsappUrl: string;
}): ReceiptDraft {
  return {
    outletName: args.outletName,
    businessName: args.businessName,
    city: args.city,
    province: args.province,
    postalCode: args.postalCode,
    phoneNational: nationalPhoneFromStored(args.phone),
    footerNotes: args.footerNotes,
    shareViaEmail: args.shareViaEmail,
    shareViaSms: args.shareViaSms,
    websiteUrl: args.websiteUrl,
    twitterUrl: args.twitterUrl,
    facebookUrl: args.facebookUrl,
    instagramUrl: args.instagramUrl,
    tiktokUrl: args.tiktokUrl,
    whatsappUrl: args.whatsappUrl,
  };
}

export function ReceiptSettings() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { selectedOutletId, setSelectedOutletId } = useSelectedPosOutlet();
  const { rows: outlets } = usePosOutlets();
  const { data: company } = useCompanyProfile();
  const checkout = useCatalogCheckoutSettings();
  const { rows: taxes } = useCatalogTaxes();
  const { rows: gratuities } = useCatalogGratuities();
  const { rows: salesTypes } = useCatalogSalesTypes();
  const receipt = useOutletReceiptSettings(selectedOutletId || null);
  const outlet = outlets.find((row) => row.id === selectedOutletId) ?? null;

  const previewSalesType = useMemo(
    () =>
      salesTypes
        .filter((row) => row.is_active && selectedOutletId && row.outlet_ids.includes(selectedOutletId))
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))[0] ?? null,
    [salesTypes, selectedOutletId],
  );

  const outletTaxes = useMemo(
    () => filterTaxesForOutlet(taxes.filter((row) => row.is_active), selectedOutletId || null),
    [taxes, selectedOutletId],
  );

  const outletGratuities = useMemo(
    () =>
      filterGratuitiesForOutletAndSalesType(
        gratuities.filter((row) => row.is_active),
        selectedOutletId || null,
        previewSalesType?.gratuity_ids ?? [],
      ),
    [gratuities, previewSalesType, selectedOutletId],
  );

  const [tab, setTab] = useState<ReceiptInnerTab>("customization");
  const [draft, setDraft] = useState<ReceiptDraft>(() =>
    draftFromSources({
      outletName: "",
      businessName: "",
      city: "",
      province: "",
      postalCode: "",
      phone: null,
      footerNotes: "",
      shareViaEmail: false,
      shareViaSms: false,
      websiteUrl: "",
      twitterUrl: "",
      facebookUrl: "",
      instagramUrl: "",
      tiktokUrl: "",
      whatsappUrl: "",
    }),
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [signedLogoUrl, setSignedLogoUrl] = useState<string | null>(null);
  const [pendingOutletId, setPendingOutletId] = useState<string | null>(null);

  useEffect(() => {
    if (!outlet) return;
    setDraft(
      draftFromSources({
        outletName: outlet.name,
        businessName: String(company?.company_name ?? ""),
        city: outlet.city ?? "",
        province: outlet.province ?? "",
        postalCode: outlet.postal_code ?? "",
        phone: outlet.phone,
        footerNotes: receipt.settings?.footer_notes ?? "",
        shareViaEmail: receipt.settings?.share_via_email ?? false,
        shareViaSms: receipt.settings?.share_via_sms ?? false,
        websiteUrl: receipt.settings?.website_url ?? "",
        twitterUrl: receipt.settings?.twitter_url ?? "",
        facebookUrl: receipt.settings?.facebook_url ?? "",
        instagramUrl: receipt.settings?.instagram_url ?? "",
        tiktokUrl: receipt.settings?.tiktok_url ?? "",
        whatsappUrl: receipt.settings?.whatsapp_url ?? "",
      }),
    );
    setLogoFile(null);
    setRemoveLogo(false);
  }, [company?.company_name, outlet, receipt.settings]);

  useEffect(() => {
    let cancelled = false;
    const path = removeLogo ? null : receipt.settings?.logo_storage_path;
    void signOutletReceiptLogo(path).then((url) => {
      if (!cancelled) setSignedLogoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [receipt.settings?.logo_storage_path, removeLogo, selectedOutletId]);

  const localLogoUrl = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : null), [logoFile]);
  useEffect(() => {
    return () => {
      if (localLogoUrl) URL.revokeObjectURL(localLogoUrl);
    };
  }, [localLogoUrl]);

  const baseline = useMemo(() => {
    if (!outlet) return null;
    return JSON.stringify(
      draftFromSources({
        outletName: outlet.name,
        businessName: String(company?.company_name ?? ""),
        city: outlet.city ?? "",
        province: outlet.province ?? "",
        postalCode: outlet.postal_code ?? "",
        phone: outlet.phone,
        footerNotes: receipt.settings?.footer_notes ?? "",
        shareViaEmail: receipt.settings?.share_via_email ?? false,
        shareViaSms: receipt.settings?.share_via_sms ?? false,
        websiteUrl: receipt.settings?.website_url ?? "",
        twitterUrl: receipt.settings?.twitter_url ?? "",
        facebookUrl: receipt.settings?.facebook_url ?? "",
        instagramUrl: receipt.settings?.instagram_url ?? "",
        tiktokUrl: receipt.settings?.tiktok_url ?? "",
        whatsappUrl: receipt.settings?.whatsapp_url ?? "",
      }),
    );
  }, [company?.company_name, outlet, receipt.settings]);

  const isDirty = Boolean(logoFile || removeLogo || (baseline && JSON.stringify(draft) !== baseline));
  const hasOutletLogo = Boolean(logoFile || (!removeLogo && receipt.settings?.logo_storage_path));
  const formLogoUrl = localLogoUrl ?? (removeLogo ? null : signedLogoUrl);
  const previewLogoUrl = formLogoUrl ?? (company?.logo_url as string | null) ?? null;
  const sharingIncomplete = isSharingIncomplete(draft);
  const busy = receipt.isSaving || receipt.isLoading;
  const canSave = canSaveReceiptSettings({
    busy,
    isDirty,
    outletName: draft.outletName,
    businessName: draft.businessName,
  });
  const hasOutlets = outlets.length > 0;

  useEffect(() => {
    if (selectedOutletId || !hasOutlets) return;
    const fallbackOutletId = defaultPosOutletId(outlets);
    if (fallbackOutletId) setSelectedOutletId(fallbackOutletId);
  }, [hasOutlets, outlets, selectedOutletId, setSelectedOutletId]);

  const applyOutletChange = (id: string) => {
    setSelectedOutletId(id);
    setPendingOutletId(null);
  };

  const handleOutletChange = (id: string) => {
    if (id === selectedOutletId) return;
    if (isDirty) {
      setPendingOutletId(id);
      return;
    }
    applyOutletChange(id);
  };

  const handleSave = async () => {
    if (!selectedOutletId) return;
    try {
      await receipt.save({
        identity: {
          name: draft.outletName,
          city: emptyToNull(draft.city),
          province: emptyToNull(draft.province),
          postal_code: emptyToNull(draft.postalCode),
          phone: storedPhoneFromNational(draft.phoneNational),
        },
        businessName: draft.businessName,
        settings: {
          footer_notes: emptyToNull(draft.footerNotes),
          share_via_email: draft.shareViaEmail,
          share_via_sms: draft.shareViaSms,
          website_url: emptyToNull(draft.websiteUrl),
          twitter_url: emptyToNull(draft.twitterUrl),
          facebook_url: emptyToNull(draft.facebookUrl),
          instagram_url: emptyToNull(draft.instagramUrl),
          tiktok_url: emptyToNull(draft.tiktokUrl),
          whatsapp_url: emptyToNull(draft.whatsappUrl),
          logo_storage_path: removeLogo ? null : receipt.settings?.logo_storage_path ?? null,
        },
        logoFile,
        removeLogo,
      });
      setLogoFile(null);
      setRemoveLogo(false);
      toast({ title: t("receiptSettings.saved", "Receipt settings saved.") });
    } catch {
      toast({
        title: t("receiptSettings.saveFailed", "Failed to save receipt settings."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-lg font-semibold text-gray-900">{t("receiptSettings.heading", "Receipt")}</h2>

      {!hasOutlets ? (
        <div className="mt-4 rounded-md border border-dashed border-gray-300 bg-muted/30 p-6 text-sm text-muted-foreground">
          <p>{t("receiptSettings.noOutlets", "Create an outlet first to customize receipt settings.")}</p>
          <Button type="button" variant="link" className="mt-2 h-auto px-0" asChild>
            <Link to={OUTLETS_LIST_PATH}>{t("receiptSettings.goToOutlets", "Go to Outlet settings")}</Link>
          </Button>
        </div>
      ) : !selectedOutletId ? (
        <div className="mt-4 text-sm text-muted-foreground" aria-busy="true">
          {t("receiptSettings.preparingOutlet", "Preparing outlet selection…")}
        </div>
      ) : (
        <>
      <div className="mt-2 flex gap-4 border-b">
        <button
          type="button"
          className={cn(
            "relative pb-2 text-sm",
            tab === "customization" ? "font-medium text-blue-600" : "text-muted-foreground",
          )}
          onClick={() => setTab("customization")}
        >
          {t("receiptSettings.tab.customization", "Customization")}
          {tab === "customization" ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-blue-600" /> : null}
        </button>
        <button
          type="button"
          className={cn(
            "relative pb-2 text-sm",
            tab === "sharing" ? "font-medium text-blue-600" : "text-muted-foreground",
          )}
          onClick={() => setTab("sharing")}
        >
          <span className="inline-flex items-center gap-1.5">
            {t("receiptSettings.tab.sharing", "Sharing Settings")}
            {sharingIncomplete ? <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden /> : null}
          </span>
          {tab === "sharing" ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-blue-600" /> : null}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Home className="h-4 w-4 text-muted-foreground" aria-hidden />
        <OutletFilterSelect value={selectedOutletId} onChange={handleOutletChange} disabled={busy} />
      </div>

      {receipt.isError ? (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {receipt.error instanceof Error
            ? receipt.error.message
            : t("receiptSettings.loadFailed", "Failed to load receipt settings.")}
        </div>
      ) : null}

      <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-12 lg:items-stretch">
        <div className="flex min-h-0 min-w-0 flex-col lg:col-span-5">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {tab === "customization" ? (
              <ReceiptCustomizationForm
                draft={draft}
                logoPreviewUrl={formLogoUrl}
                disabled={busy}
                onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
                onLogoFile={(file) => {
                  setLogoFile(file);
                  setRemoveLogo(!file);
                }}
              />
            ) : (
              <ReceiptSharingSettings
                draft={draft}
                disabled={busy}
                onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
              />
            )}
          </div>
          <div className="mt-4 flex justify-end border-t pt-3">
            <Button type="button" onClick={() => void handleSave()} disabled={!canSave}>
              {t("common.save", "Save")}
            </Button>
          </div>
        </div>
        <div className="flex min-h-[560px] min-w-0 flex-1 flex-col lg:col-span-7 lg:min-h-0">
          <ReceiptPreview
            draft={draft}
            hasOutletLogo={hasOutletLogo}
            logoUrl={previewLogoUrl}
            checkout={checkout.settings}
            outletTaxes={outletTaxes}
            outletGratuities={outletGratuities}
          />
        </div>
      </div>

      <AlertDialog open={Boolean(pendingOutletId)} onOpenChange={(open) => !open && setPendingOutletId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("receiptSettings.unsavedTitle", "Unsaved changes")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("receiptSettings.unsavedBody", "Switching outlets will discard unsaved receipt changes.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingOutletId && applyOutletChange(pendingOutletId)}>
              {t("receiptSettings.discard", "Discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </>
      )}
    </div>
  );
}
