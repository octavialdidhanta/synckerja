import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
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
import { cn } from "@/shared/lib/utils";
import { supabase } from "@/shared/lib/supabaseClient";
import { CONNECT_WHATSAPP_PATH } from "@/5-3-whatsapp/constants/omnichannelIntegrationPaths";
import {
  META_CAPI_CUSTOM_EVENT_VALUE,
  META_CAPI_DEFAULT_EVENT_NAME,
  META_CAPI_STANDARD_EVENTS,
} from "@/meta-ads/constants/metaCapiStandardEvents";
import { resolveMetaCapiEventNameForEdit, resolveMetaCapiEventNameForSave } from "@/meta-ads/lib/resolveMetaCapiEventName";
import {
  clearOfflineConversionOAuthStart,
  isSharedOfflineConversionPath,
  shouldConsumeOfflineConversionOAuthResult,
} from "@/5-3-dashboard/omnichannel-settings/lib/offlineConversionOAuthResult";
import { useMetaAdsRoasColorThreshold } from "@/meta-ads/hooks/useMetaAdsRoasColorThreshold";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import type { MetaAdsOAuthReturnPath } from "@/meta-ads/settings/metaAdsSettingsPaths";

function ThresholdSaveField({
  id,
  value,
  onChange,
  onSave,
  saving,
  disabled,
  step,
  ariaLabel,
  saveLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  disabled: boolean;
  step: string;
  ariaLabel: string;
  saveLabel: string;
}) {
  return (
    <div className="flex w-full min-w-[10.5rem]">
      <Input
        id={id}
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSave();
          }
        }}
        className="h-9 min-w-0 flex-1 rounded-r-none border-r-0 px-2.5 text-sm tabular-nums shadow-none focus-visible:z-10 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-[4.25rem] shrink-0 rounded-l-none px-0 shadow-none"
        disabled={disabled || saving}
        onClick={onSave}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveLabel}
      </Button>
    </div>
  );
}

export type MetaAdsSettingsPanelProps = {
  organizationId: string | null | undefined;
  enabled?: boolean;
  oauthReturnPath: MetaAdsOAuthReturnPath;
  className?: string;
  contentClassName?: string;
};

export function MetaAdsSettingsPanel({
  organizationId,
  enabled = true,
  oauthReturnPath,
  className,
  contentClassName,
}: MetaAdsSettingsPanelProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    data,
    isPending,
    startOAuth,
    disconnect,
    updateConnection,
    upsertAccount,
    deleteAccount,
    setDefaultAccount,
    testConnection,
    listAccessibleAdAccounts,
    listPixels,
    syncAccessibleAccounts,
  } = useMetaAdsSettings(organizationId, { enabled: Boolean(organizationId) && enabled });
  const {
    threshold: roasThreshold,
    costPerPurchaseThreshold,
    purchaseRoasColorEnabled,
    costPerPurchaseColorEnabled,
    atcToPurchaseThreshold,
    atcToPurchaseColorEnabled,
    aovThreshold,
    aovColorEnabled,
    viewToAtcThreshold,
    viewToAtcColorEnabled,
    ctrThreshold,
    ctrColorEnabled,
    cpmThreshold,
    cpmColorEnabled,
    saveThreshold,
    saveCostPerPurchaseThreshold,
    saveAtcToPurchaseThreshold,
    saveAovThreshold,
    saveViewToAtcThreshold,
    saveCtrThreshold,
    saveCpmThreshold,
    savePurchaseRoasColorEnabled,
    saveCostPerPurchaseColorEnabled,
    saveAtcToPurchaseColorEnabled,
    saveAovColorEnabled,
    saveViewToAtcColorEnabled,
    saveCtrColorEnabled,
    saveCpmColorEnabled,
    isLoading: colorSettingsLoading,
  } = useMetaAdsRoasColorThreshold(enabled ? organizationId : null);
  const [roasInput, setRoasInput] = useState(String(roasThreshold));
  const [costInput, setCostInput] = useState(String(costPerPurchaseThreshold));
  const [atcInput, setAtcInput] = useState(String(atcToPurchaseThreshold));
  const [aovInput, setAovInput] = useState(String(aovThreshold));
  const [viewAtcInput, setViewAtcInput] = useState(String(viewToAtcThreshold));
  const [ctrInput, setCtrInput] = useState(String(ctrThreshold));
  const [cpmInput, setCpmInput] = useState(String(cpmThreshold));

  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [accountAdId, setAccountAdId] = useState("");
  const [accountPixelId, setAccountPixelId] = useState("");
  const [accountEventSelect, setAccountEventSelect] = useState<string>(META_CAPI_DEFAULT_EVENT_NAME);
  const [accountEventCustom, setAccountEventCustom] = useState("");
  const [accountIsDefault, setAccountIsDefault] = useState(false);
  const [pickerAccounts, setPickerAccounts] = useState<Array<{ account_id: string; name: string }>>([]);
  const [pickerPixels, setPickerPixels] = useState<Array<{ id: string; name: string }>>([]);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);

  useEffect(() => {
    setRoasInput(String(roasThreshold));
  }, [organizationId, roasThreshold]);

  useEffect(() => {
    setCostInput(String(costPerPurchaseThreshold));
  }, [organizationId, costPerPurchaseThreshold]);

  useEffect(() => {
    setAtcInput(String(atcToPurchaseThreshold));
  }, [organizationId, atcToPurchaseThreshold]);

  useEffect(() => {
    setAovInput(String(aovThreshold));
  }, [organizationId, aovThreshold]);

  useEffect(() => {
    setViewAtcInput(String(viewToAtcThreshold));
  }, [organizationId, viewToAtcThreshold]);

  useEffect(() => {
    setCtrInput(String(ctrThreshold));
  }, [organizationId, ctrThreshold]);

  useEffect(() => {
    setCpmInput(String(cpmThreshold));
  }, [organizationId, cpmThreshold]);

  const persistRoasThreshold = () => {
    const parsed = Number(roasInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(
        t("omnichannel.settings.metaAds.roasThresholdInvalid", "Enter a number greater than 0."),
      );
      setRoasInput(String(roasThreshold));
      return;
    }
    saveThreshold.mutate(parsed, {
      onSuccess: () => {
        toast.success(t("omnichannel.settings.metaAds.roasThresholdSaved", "Threshold saved."));
      },
      onError: (error) => toast.error((error as Error).message),
    });
  };

  const persistCostThreshold = () => {
    const parsed = Number(costInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(
        t("omnichannel.settings.metaAds.roasThresholdInvalid", "Enter a number greater than 0."),
      );
      setCostInput(String(costPerPurchaseThreshold));
      return;
    }
    saveCostPerPurchaseThreshold.mutate(parsed, {
      onSuccess: () => {
        toast.success(t("omnichannel.settings.metaAds.costThresholdSaved", "Threshold saved."));
      },
      onError: (error) => toast.error((error as Error).message),
    });
  };

  const persistAtcThreshold = () => {
    const parsed = Number(atcInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(
        t("omnichannel.settings.metaAds.roasThresholdInvalid", "Enter a number greater than 0."),
      );
      setAtcInput(String(atcToPurchaseThreshold));
      return;
    }
    saveAtcToPurchaseThreshold.mutate(parsed, {
      onSuccess: () => {
        toast.success(t("omnichannel.settings.metaAds.atcThresholdSaved", "Threshold saved."));
      },
      onError: (error) => toast.error((error as Error).message),
    });
  };

  const persistAovThreshold = () => {
    const parsed = Number(aovInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(
        t("omnichannel.settings.metaAds.roasThresholdInvalid", "Enter a number greater than 0."),
      );
      setAovInput(String(aovThreshold));
      return;
    }
    saveAovThreshold.mutate(parsed, {
      onSuccess: () => {
        toast.success(t("omnichannel.settings.metaAds.aovThresholdSaved", "Threshold saved."));
      },
      onError: (error) => toast.error((error as Error).message),
    });
  };

  const persistViewAtcThreshold = () => {
    const parsed = Number(viewAtcInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(
        t("omnichannel.settings.metaAds.roasThresholdInvalid", "Enter a number greater than 0."),
      );
      setViewAtcInput(String(viewToAtcThreshold));
      return;
    }
    saveViewToAtcThreshold.mutate(parsed, {
      onSuccess: () => {
        toast.success(t("omnichannel.settings.metaAds.viewAtcThresholdSaved", "Threshold saved."));
      },
      onError: (error) => toast.error((error as Error).message),
    });
  };

  const persistCtrThreshold = () => {
    const parsed = Number(ctrInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(
        t("omnichannel.settings.metaAds.roasThresholdInvalid", "Enter a number greater than 0."),
      );
      setCtrInput(String(ctrThreshold));
      return;
    }
    saveCtrThreshold.mutate(parsed, {
      onSuccess: () => {
        toast.success(t("omnichannel.settings.metaAds.ctrThresholdSaved", "Threshold saved."));
      },
      onError: (error) => toast.error((error as Error).message),
    });
  };

  const persistCpmThreshold = () => {
    const parsed = Number(cpmInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(
        t("omnichannel.settings.metaAds.roasThresholdInvalid", "Enter a number greater than 0."),
      );
      setCpmInput(String(cpmThreshold));
      return;
    }
    saveCpmThreshold.mutate(parsed, {
      onSuccess: () => {
        toast.success(t("omnichannel.settings.metaAds.cpmThresholdSaved", "Threshold saved."));
      },
      onError: (error) => toast.error((error as Error).message),
    });
  };

  const saveLabel = t("omnichannel.settings.metaAds.roasThresholdSave", "Save");
  const colorRows = [
    {
      id: "meta-cpm-threshold",
      name: t("omnichannel.settings.metaAds.colorMetricCpm", "CPM"),
      hint: t(
        "omnichannel.settings.metaAds.cpmThresholdHint",
        "At or below this number the CPM column turns green. Above it, the column turns red. Darker means farther from this number. Use the same currency as the ad account.",
      ),
      ariaLabel: t("omnichannel.settings.metaAds.cpmThresholdTitle", "CPM color threshold"),
      toggleLabel: t("omnichannel.settings.metaAds.colorToggleCpm", "Color CPM"),
      value: cpmInput,
      onChange: setCpmInput,
      onSave: persistCpmThreshold,
      saving: saveCpmThreshold.isPending,
      step: "1",
      enabled: cpmColorEnabled,
      pending: saveCpmColorEnabled.isPending,
      onToggle: (checked: boolean) => {
        saveCpmColorEnabled.mutate(checked, {
          onError: (error) => toast.error((error as Error).message),
        });
      },
    },
    {
      id: "meta-ctr-threshold",
      name: t("omnichannel.settings.metaAds.colorMetricCtr", "CTR"),
      hint: t(
        "omnichannel.settings.metaAds.ctrThresholdHint",
        "Below this percent the CTR column turns red. At or above it, the column turns green. Darker means farther from this number.",
      ),
      ariaLabel: t("omnichannel.settings.metaAds.ctrThresholdTitle", "CTR color threshold"),
      toggleLabel: t("omnichannel.settings.metaAds.colorToggleCtr", "Color CTR"),
      value: ctrInput,
      onChange: setCtrInput,
      onSave: persistCtrThreshold,
      saving: saveCtrThreshold.isPending,
      step: "0.01",
      enabled: ctrColorEnabled,
      pending: saveCtrColorEnabled.isPending,
      onToggle: (checked: boolean) => {
        saveCtrColorEnabled.mutate(checked, {
          onError: (error) => toast.error((error as Error).message),
        });
      },
    },
    {
      id: "meta-view-atc-threshold",
      name: t("omnichannel.settings.metaAds.colorMetricViewAtc", "% View to ATC"),
      hint: t(
        "omnichannel.settings.metaAds.viewAtcThresholdHint",
        "Below this percent the % View to ATC column turns red. At or above it, the column turns green. Darker means farther from this number.",
      ),
      ariaLabel: t(
        "omnichannel.settings.metaAds.viewAtcThresholdTitle",
        "% View to ATC color threshold",
      ),
      toggleLabel: t("omnichannel.settings.metaAds.colorToggleViewAtc", "Color % View to ATC"),
      value: viewAtcInput,
      onChange: setViewAtcInput,
      onSave: persistViewAtcThreshold,
      saving: saveViewToAtcThreshold.isPending,
      step: "0.01",
      enabled: viewToAtcColorEnabled,
      pending: saveViewToAtcColorEnabled.isPending,
      onToggle: (checked: boolean) => {
        saveViewToAtcColorEnabled.mutate(checked, {
          onError: (error) => toast.error((error as Error).message),
        });
      },
    },
    {
      id: "meta-atc-threshold",
      name: t("omnichannel.settings.metaAds.colorMetricAtc", "% ATC to Purchase"),
      hint: t(
        "omnichannel.settings.metaAds.atcThresholdHint",
        "Below this percent the % ATC to Purchase column turns red. At or above it, the column turns green. Darker means farther from this number.",
      ),
      ariaLabel: t(
        "omnichannel.settings.metaAds.atcThresholdTitle",
        "% ATC to Purchase color threshold",
      ),
      toggleLabel: t("omnichannel.settings.metaAds.colorToggleAtc", "Color % ATC to Purchase"),
      value: atcInput,
      onChange: setAtcInput,
      onSave: persistAtcThreshold,
      saving: saveAtcToPurchaseThreshold.isPending,
      step: "0.01",
      enabled: atcToPurchaseColorEnabled,
      pending: saveAtcToPurchaseColorEnabled.isPending,
      onToggle: (checked: boolean) => {
        saveAtcToPurchaseColorEnabled.mutate(checked, {
          onError: (error) => toast.error((error as Error).message),
        });
      },
    },
    {
      id: "meta-aov-threshold",
      name: t("omnichannel.settings.metaAds.colorMetricAov", "AOV"),
      hint: t(
        "omnichannel.settings.metaAds.aovThresholdHint",
        "Below this number the AOV column turns red. At or above it, the column turns green. Darker means farther from this number. Use the same currency as the ad account.",
      ),
      ariaLabel: t("omnichannel.settings.metaAds.aovThresholdTitle", "AOV color threshold"),
      toggleLabel: t("omnichannel.settings.metaAds.colorToggleAov", "Color AOV"),
      value: aovInput,
      onChange: setAovInput,
      onSave: persistAovThreshold,
      saving: saveAovThreshold.isPending,
      step: "1",
      enabled: aovColorEnabled,
      pending: saveAovColorEnabled.isPending,
      onToggle: (checked: boolean) => {
        saveAovColorEnabled.mutate(checked, {
          onError: (error) => toast.error((error as Error).message),
        });
      },
    },
    {
      id: "meta-cost-threshold",
      name: t("omnichannel.settings.metaAds.colorMetricCost", "Cost/Purchase"),
      hint: t(
        "omnichannel.settings.metaAds.costThresholdHint",
        "At or below this number the Cost/Purchase column turns green. Above it, the column turns red. Darker means farther from this number. Use the same currency as the ad account.",
      ),
      ariaLabel: t(
        "omnichannel.settings.metaAds.costThresholdTitle",
        "Cost/Purchase color threshold",
      ),
      toggleLabel: t("omnichannel.settings.metaAds.colorToggleCost", "Color Cost/Purchase"),
      value: costInput,
      onChange: setCostInput,
      onSave: persistCostThreshold,
      saving: saveCostPerPurchaseThreshold.isPending,
      step: "1",
      enabled: costPerPurchaseColorEnabled,
      pending: saveCostPerPurchaseColorEnabled.isPending,
      onToggle: (checked: boolean) => {
        saveCostPerPurchaseColorEnabled.mutate(checked, {
          onError: (error) => toast.error((error as Error).message),
        });
      },
    },
    {
      id: "meta-roas-threshold",
      name: t("omnichannel.settings.metaAds.colorMetricRoas", "Purchase ROAS"),
      hint: t(
        "omnichannel.settings.metaAds.roasThresholdHint",
        "Below this number the Purchase ROAS column turns red. At or above it, the column turns green. Darker means farther from this number.",
      ),
      ariaLabel: t(
        "omnichannel.settings.metaAds.roasThresholdTitle",
        "Purchase ROAS color threshold",
      ),
      toggleLabel: t("omnichannel.settings.metaAds.colorToggleRoas", "Color Purchase ROAS"),
      value: roasInput,
      onChange: setRoasInput,
      onSave: persistRoasThreshold,
      saving: saveThreshold.isPending,
      step: "0.01",
      enabled: purchaseRoasColorEnabled,
      pending: savePurchaseRoasColorEnabled.isPending,
      onToggle: (checked: boolean) => {
        savePurchaseRoasColorEnabled.mutate(checked, {
          onError: (error) => toast.error((error as Error).message),
        });
      },
    },
  ];

  const oauthConnected = data?.oauthConnected ?? false;
  const connection = data?.connection;
  const accounts = data?.accounts ?? [];

  const { data: whatsAppAccountCount = 0 } = useQuery({
    queryKey: ["meta-ads-settings-wa-accounts", organizationId],
    queryFn: async () => {
      if (!organizationId) return 0;
      const { count, error } = await supabase
        .from("organization_whatsapp_accounts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: Boolean(organizationId) && enabled,
    staleTime: 60_000,
  });

  const hasWhatsAppConnected = whatsAppAccountCount > 0;
  const hasConfiguredPixel = accounts.some(
    (a) => a.pixel_id && String(a.pixel_id).replace(/\D/g, "") !== "" && String(a.pixel_id) !== "0",
  );
  const accountPendingDelete = accounts.find((a) => a.id === deleteAccountId) ?? null;

  const handleConfirmDeleteAccount = async () => {
    if (!deleteAccountId) return;
    try {
      await deleteAccount.mutateAsync(deleteAccountId);
      setDeleteAccountId(null);
      toast.success(t("omnichannel.settings.metaAds.accountDeleted", "Account removed"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  useEffect(() => {
    if (!shouldConsumeOfflineConversionOAuthResult(searchParams, "meta", pathname)) return;

    const connected = searchParams.get("connected");
    const oauthError = searchParams.get("oauth_error");
    if (connected === "1") {
      toast.success(t("omnichannel.settings.metaAds.connectedToast", "Meta Ads connected successfully."));
    }
    if (oauthError) {
      toast.error(t("omnichannel.settings.metaAds.oauthErrorToast", { message: oauthError, defaultValue: `Sign-in failed: ${oauthError}` }));
    }

    const next = new URLSearchParams(searchParams);
    next.delete("connected");
    next.delete("oauth_error");
    if (isSharedOfflineConversionPath(pathname)) next.set("platform", "meta");
    clearOfflineConversionOAuthStart();
    setSearchParams(next, { replace: true });
  }, [pathname, searchParams, setSearchParams, t]);

  const openAddAccount = () => {
    setEditAccountId(null);
    setAccountLabel("");
    setAccountAdId("");
    setAccountPixelId("");
    setAccountEventSelect(META_CAPI_DEFAULT_EVENT_NAME);
    setAccountEventCustom("");
    setAccountIsDefault(accounts.length === 0);
    setPickerAccounts([]);
    setPickerPixels([]);
    setAccountDialogOpen(true);
  };

  const openEditAccount = (id: string) => {
    const row = accounts.find((a) => a.id === id);
    if (!row) return;
    setEditAccountId(id);
    setAccountLabel(row.label);
    setAccountAdId(row.ad_account_id);
    setAccountPixelId(row.pixel_id);
    const eventFields = resolveMetaCapiEventNameForEdit(row.default_event_name);
    setAccountEventSelect(eventFields.selectValue);
    setAccountEventCustom(eventFields.customValue);
    setAccountIsDefault(row.is_default);
    setPickerAccounts([]);
    setPickerPixels([]);
    setAccountDialogOpen(true);
  };

  useEffect(() => {
    if (!accountDialogOpen || !accountAdId || !organizationId) return;
    let cancelled = false;
    void (async () => {
      try {
        const pixels = await listPixels.mutateAsync(accountAdId);
        if (cancelled) return;
        setPickerPixels(pixels);
        setAccountPixelId((prev) => {
          if (prev && prev !== "0") return prev;
          if (pixels.length >= 1) return pixels[0].id;
          return prev;
        });
      } catch {
        if (!cancelled) setPickerPixels([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // listPixels mutation identity is stable enough; ad id drives refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountDialogOpen, accountAdId, organizationId]);

  const handleLoadAccounts = async () => {
    try {
      const list = await listAccessibleAdAccounts.mutateAsync();
      setPickerAccounts(list.map((a) => ({ account_id: a.account_id, name: a.name || a.account_id })));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAccountPick = async (adAccountId: string) => {
    setAccountAdId(adAccountId);
    try {
      const pixels = await listPixels.mutateAsync(adAccountId);
      setPickerPixels(pixels);
      if (pixels.length === 1) setAccountPixelId(pixels[0].id);
    } catch {
      setPickerPixels([]);
    }
  };

  const handleSaveAccount = async () => {
    const resolved = resolveMetaCapiEventNameForSave(accountEventSelect, accountEventCustom);
    if (!resolved.ok) {
      toast.error(
        resolved.error === "custom_too_long"
          ? t(
              "omnichannel.settings.metaAds.eventNameCustomInvalid",
              "Event name is too long (max 64 characters).",
            )
          : t(
              "omnichannel.settings.metaAds.eventNameCustomRequired",
              "Enter a custom event name.",
            ),
      );
      return;
    }

    try {
      await upsertAccount.mutateAsync({
        id: editAccountId ?? undefined,
        label: accountLabel,
        ad_account_id: accountAdId,
        pixel_id: accountPixelId,
        default_event_name: resolved.eventName,
        is_default: accountIsDefault,
        is_active: true,
      });
      setAccountDialogOpen(false);
      toast.success(t("omnichannel.settings.metaAds.accountSaved", "Account saved"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (isPending) {
    return (
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>
        <div className={cn("flex-1 min-h-0 overflow-y-auto", contentClassName)}>
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>
      <div
        className={cn(
          "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:overflow-hidden",
          contentClassName,
        )}
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-6 lg:h-full lg:grid-cols-2 lg:items-stretch lg:[grid-template-rows:minmax(0,1fr)]">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-col gap-6 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:h-full">
        <div className="shrink-0 rounded-lg border border-slate-200 p-4 space-y-4">
          <h3 className="font-semibold text-slate-900">
            {t("omnichannel.settings.metaAds.connectionTitle", "Meta Ads connection")}
          </h3>
          {oauthConnected ? (
            <>
              <p className="text-sm text-slate-600">
                {t("omnichannel.settings.metaAds.connectedHint", "Facebook account connected. Token stored encrypted on the server.")}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("omnichannel.settings.metaAds.disconnectButton", "Disconnect")}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                {t("omnichannel.settings.metaAds.disconnectedHint", "Connect with Facebook to authorize Meta Ads reporting and conversions.")}
              </p>
              <Button
                type="button"
                onClick={() => startOAuth.mutate(oauthReturnPath)}
                disabled={startOAuth.isPending}
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white"
              >
                {startOAuth.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("omnichannel.settings.metaAds.connectButton", "Connect with Facebook")}
              </Button>
            </>
          )}

          {oauthConnected && (
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <div>
                <Label htmlFor="meta-uploads-enabled">
                  {t("omnichannel.settings.metaAds.uploadsEnabled", "Enable offline conversion uploads")}
                </Label>
                <p className="text-xs text-slate-500">
                  {t("omnichannel.settings.metaAds.uploadsEnabledHint", "When off, converted leads are not sent to Meta.")}
                </p>
              </div>
              <Switch
                id="meta-uploads-enabled"
                checked={connection?.is_active ?? false}
                onCheckedChange={(v) => updateConnection.mutate({ is_active: v })}
              />
            </div>
          )}

          {oauthConnected && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {t("omnichannel.settings.metaAds.ctwaTitle", "Click-to-WhatsApp conversions")}
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  {t(
                    "omnichannel.settings.metaAds.ctwaHint",
                    "When a customer opens WhatsApp from a Meta ad, Synckerja captures the click ID from the first message. On Converted, we send it to Meta using the same offline upload toggle above.",
                  )}
                </p>
              </div>
              <ul className="space-y-1.5 text-xs">
                <li className="flex items-center gap-2 text-slate-700">
                  {hasWhatsAppConnected ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  )}
                  {hasWhatsAppConnected
                    ? t("omnichannel.settings.metaAds.ctwaWhatsAppOk", "WhatsApp Business connected")
                    : t(
                        "omnichannel.settings.metaAds.ctwaWhatsAppMissing",
                        "Connect WhatsApp Business to receive CTWA messages",
                      )}
                </li>
                <li className="flex items-center gap-2 text-slate-700">
                  {hasConfiguredPixel ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  )}
                  {hasConfiguredPixel
                    ? t("omnichannel.settings.metaAds.ctwaPixelOk", "Meta Pixel configured on an ad account")
                    : t(
                        "omnichannel.settings.metaAds.ctwaPixelMissing",
                        "Add an ad account with a valid Pixel ID below",
                      )}
                </li>
              </ul>
              {!hasWhatsAppConnected && (
                <Link
                  to={CONNECT_WHATSAPP_PATH}
                  className="inline-flex text-xs font-medium text-[#1877F2] hover:underline"
                >
                  {t("omnichannel.settings.metaAds.ctwaOpenWhatsAppSettings", "Open Connect WhatsApp")}
                </Link>
              )}
            </div>
          )}

          {oauthConnected && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => testConnection.mutate(undefined)}
                disabled={testConnection.isPending}
              >
                {testConnection.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("omnichannel.settings.metaAds.testButton", "Test connection")}
              </Button>
              <span className="text-xs text-slate-500">
                {connection?.last_test_ok === true
                  ? t("omnichannel.settings.metaAds.lastTestOk", "Last test: OK")
                  : connection?.last_test_error
                    ? connection.last_test_error
                    : t("omnichannel.settings.metaAds.neverTested", "Not tested yet")}
              </span>
            </div>
          )}
        </div>

        {oauthConnected && (
          <div className="min-w-0 rounded-lg border border-slate-200 p-4">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">
                {t("omnichannel.settings.metaAds.accountsTitle", "Meta Ads accounts")}
              </h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const result = await syncAccessibleAccounts.mutateAsync();
                      const resolved =
                        (result as { pixelsResolved?: number })?.pixelsResolved ?? 0;
                      if (resolved > 0) {
                        toast.success(
                          t("omnichannel.settings.metaAds.pixelsAutoFilled", {
                            count: resolved,
                            defaultValue: `Filled Pixel ID for ${resolved} account(s) from Meta.`,
                          }),
                        );
                      }
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                  disabled={syncAccessibleAccounts.isPending}
                >
                  {syncAccessibleAccounts.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {t("omnichannel.settings.metaAds.syncFromMeta", "Sync from Meta")}
                </Button>
                <Button type="button" size="sm" onClick={openAddAccount}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("omnichannel.settings.metaAds.addAccount", "Add account")}
                </Button>
              </div>
            </div>

            {accounts.length === 0 ? (
              <p className="mt-3 shrink-0 text-sm text-slate-500">
                {t("omnichannel.settings.metaAds.noAccounts", "No ad accounts configured. Sync from Meta or add manually.")}
              </p>
            ) : (
              <div className="mt-3">
                <ul className="space-y-2 pr-1">
                  {accounts.map((acc) => (
                    <li
                      key={acc.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {acc.label}
                          {acc.is_default ? ` (${t("omnichannel.settings.metaAds.default", "default")})` : ""}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          act_{acc.ad_account_id} · Pixel {acc.pixel_id} · {acc.default_event_name}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {!acc.is_default && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setDefaultAccount.mutate(acc.id)}>
                            {t("omnichannel.settings.metaAds.setDefault", "Set default")}
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="sm" onClick={() => openEditAccount(acc.id)}>
                          {t("omnichannel.settings.metaAds.edit", "Edit")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => setDeleteAccountId(acc.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        </div>

        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:h-full">
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="font-semibold text-slate-900">
              {t("omnichannel.settings.metaAds.colorTableTitle", "Column colors")}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {t(
                "omnichannel.settings.metaAds.colorTableHint",
                "Turn a row on to color that column. Off leaves the column plain.",
              )}
            </p>
          </div>
          <Table className="table-fixed" containerClassName="overflow-x-auto">
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="px-4">
                  {t("omnichannel.settings.metaAds.colorTableMetric", "Metric")}
                </TableHead>
                <TableHead className="w-52 px-3">
                  {t("omnichannel.settings.metaAds.colorTableThreshold", "Threshold")}
                </TableHead>
                <TableHead className="w-20 px-3 text-center">
                  {t("omnichannel.settings.metaAds.colorTableColor", "Color")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colorRows.map((row, index) => (
                <TableRow
                  key={row.id}
                  className={
                    index === colorRows.length - 1
                      ? "border-0 hover:bg-transparent"
                      : "hover:bg-transparent"
                  }
                >
                  <TableCell className="px-4 py-3.5 align-middle">
                    <p className="font-medium text-slate-900">{row.name}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{row.hint}</p>
                  </TableCell>
                  <TableCell className="px-3 py-3.5 align-middle">
                    <ThresholdSaveField
                      id={row.id}
                      value={row.value}
                      onChange={row.onChange}
                      onSave={row.onSave}
                      saving={row.saving}
                      disabled={!organizationId}
                      step={row.step}
                      ariaLabel={row.ariaLabel}
                      saveLabel={saveLabel}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-3.5 align-middle">
                    <div className="flex justify-center">
                      <Switch
                        checked={row.enabled}
                        disabled={colorSettingsLoading || row.pending || !organizationId}
                        onCheckedChange={row.onToggle}
                        aria-label={row.toggleLabel}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="h-4" aria-hidden />
        </div>
        </div>
        </div>
      </div>

      <AlertDialog
        open={deleteAccountId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteAccountId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("omnichannel.settings.metaAds.deleteAccountTitle", "Delete account?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("omnichannel.settings.metaAds.deleteAccountBody", {
                name: accountPendingDelete?.label || accountPendingDelete?.ad_account_id || "—",
                defaultValue: `Remove "${accountPendingDelete?.label ?? "—"}" from this organization?`,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAccount.isPending}>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAccount.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDeleteAccount();
              }}
            >
              {deleteAccount.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("omnichannel.settings.metaAds.deleteAccountConfirm", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editAccountId
                ? t("omnichannel.settings.metaAds.editAccount", "Edit account")
                : t("omnichannel.settings.metaAds.addAccount", "Add account")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Button type="button" variant="outline" size="sm" onClick={handleLoadAccounts}>
              {t("omnichannel.settings.metaAds.loadAdAccounts", "Load ad accounts from Meta")}
            </Button>
            {pickerAccounts.length > 0 && (
              <Select onValueChange={handleAccountPick}>
                <SelectTrigger>
                  <SelectValue placeholder={t("omnichannel.settings.metaAds.pickAdAccount", "Pick ad account")} />
                </SelectTrigger>
                <SelectContent>
                  {pickerAccounts.map((a) => (
                    <SelectItem key={a.account_id} value={a.account_id}>
                      {a.name} ({a.account_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div>
              <Label>{t("omnichannel.settings.metaAds.adAccountId", "Ad account ID")}</Label>
              <Input value={accountAdId} onChange={(e) => setAccountAdId(e.target.value.replace(/\D/g, ""))} />
            </div>
            {pickerPixels.length > 0 && (
              <Select value={accountPixelId} onValueChange={setAccountPixelId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("omnichannel.settings.metaAds.pickPixel", "Pick pixel")} />
                </SelectTrigger>
                <SelectContent>
                  {pickerPixels.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div>
              <Label>{t("omnichannel.settings.metaAds.pixelId", "Pixel ID")}</Label>
              <Input value={accountPixelId} onChange={(e) => setAccountPixelId(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div>
              <Label>{t("omnichannel.settings.metaAds.eventName", "CAPI event name")}</Label>
              <Select value={accountEventSelect} onValueChange={setAccountEventSelect}>
                <SelectTrigger>
                  <SelectValue placeholder={t("omnichannel.settings.metaAds.eventName", "CAPI event name")} />
                </SelectTrigger>
                <SelectContent>
                  {META_CAPI_STANDARD_EVENTS.map((eventName) => (
                    <SelectItem key={eventName} value={eventName}>
                      {eventName}
                    </SelectItem>
                  ))}
                  <SelectItem value={META_CAPI_CUSTOM_EVENT_VALUE}>
                    {t("omnichannel.settings.metaAds.eventNameCustomOption", "Custom…")}
                  </SelectItem>
                </SelectContent>
              </Select>
              {accountEventSelect === META_CAPI_CUSTOM_EVENT_VALUE && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">
                    {t("omnichannel.settings.metaAds.eventNameCustom", "Custom event name")}
                  </Label>
                  <Input
                    value={accountEventCustom}
                    onChange={(e) => setAccountEventCustom(e.target.value)}
                    placeholder={t("omnichannel.settings.metaAds.eventNameCustom", "Custom event name")}
                  />
                </div>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t(
                  "omnichannel.settings.metaAds.eventNameHint",
                  "Use Purchase when Converted includes payment; Lead for qualified leads without payment.",
                )}
              </p>
            </div>
            <div>
              <Label>{t("omnichannel.settings.metaAds.label", "Label")}</Label>
              <Input value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={accountIsDefault} onCheckedChange={setAccountIsDefault} id="meta-default-acc" />
              <Label htmlFor="meta-default-acc">{t("omnichannel.settings.metaAds.defaultAccount", "Default account")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSaveAccount}>
              {t("omnichannel.settings.metaAds.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
