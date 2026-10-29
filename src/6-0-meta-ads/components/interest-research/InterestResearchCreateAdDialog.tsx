import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogFormScrollArea,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import {
  InterestResearchCampaignNameTemplate,
  campaignNameFromTemplate,
} from "./InterestResearchCampaignNameTemplate";
import {
  CAMPAIGN_ID_PLACEHOLDER,
  DEFAULT_PLACEMENT_DISPLAYS,
  emptyCampaignNameTemplate,
  formatLocationNameLabel,
  type CampaignNameTemplate,
} from "./campaignNameTemplate";
import {
  DEFAULT_INTEREST_RESEARCH_FILTERS,
  useMetaAdsCampaignOptions,
  useMetaAdsCreateAdDraft,
  useMetaAdsCreateSavedAudience,
  type InterestResearchFilters,
  type InterestResearchObjective,
  type MetaTargetingItem,
} from "@/meta-ads/hooks/useMetaAdsTargeting";
import { useMetaAdsNameTemplates } from "@/meta-ads/hooks/useMetaAdsNameTemplates";

const OBJECTIVES: Array<{ value: InterestResearchObjective; label: string }> = [
  { value: "awareness", label: "Awareness" },
  { value: "traffic", label: "Traffic" },
  { value: "engagement", label: "Engagement" },
  { value: "leads", label: "Leads" },
  { value: "app_promotion", label: "App promotion" },
  { value: "conversions", label: "Sales" },
];

const STEPS = [
  { id: 0, label: "Obj" },
  { id: 1, label: "Campaign" },
  { id: 2, label: "Ad set" },
] as const;

const LAST_STEP = STEPS.length - 1;

const NO_FOCUS_RING =
  "shadow-none outline-none ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0";

const CONVERSION_LOCATIONS: Array<{ value: string; label: string; destinationType: string }> = [
  { value: "WEBSITE", label: "Website", destinationType: "WEBSITE" },
  { value: "WEBSITE_AND_APP", label: "Website and app", destinationType: "APPLINKS_AUTOMATIC" },
  { value: "WEBSITE_AND_CALLS", label: "Website and calls", destinationType: "WEBSITE" },
  { value: "INSTAGRAM_LIVE", label: "Instagram live video", destinationType: "INSTAGRAM_LIVE" },
  { value: "APP", label: "App", destinationType: "APP" },
  { value: "MESSENGER", label: "Message destinations", destinationType: "MESSENGER" },
  { value: "PHONE_CALL", label: "Calls", destinationType: "PHONE_CALL" },
];

const PERFORMANCE_GOALS: Array<{ value: string; label: string; locations: string[] }> = [
  { value: "OFFSITE_CONVERSIONS", label: "Maximise number of conversions", locations: ["WEBSITE", "WEBSITE_AND_APP", "WEBSITE_AND_CALLS"] },
  { value: "VALUE", label: "Maximise value of conversions", locations: ["WEBSITE", "WEBSITE_AND_APP"] },
  { value: "LANDING_PAGE_VIEWS", label: "Maximise number of landing page views", locations: ["WEBSITE", "WEBSITE_AND_APP", "WEBSITE_AND_CALLS"] },
  { value: "LINK_CLICKS", label: "Maximise number of link clicks", locations: ["WEBSITE", "WEBSITE_AND_APP", "WEBSITE_AND_CALLS", "APP"] },
  { value: "REACH", label: "Maximise daily unique reach", locations: ["WEBSITE", "WEBSITE_AND_APP", "WEBSITE_AND_CALLS", "APP", "MESSENGER", "PHONE_CALL", "INSTAGRAM_LIVE"] },
  { value: "IMPRESSIONS", label: "Maximise number of impressions", locations: ["WEBSITE", "WEBSITE_AND_APP", "WEBSITE_AND_CALLS", "APP", "MESSENGER", "PHONE_CALL", "INSTAGRAM_LIVE"] },
  { value: "APP_INSTALLS", label: "Maximise number of app installs", locations: ["APP", "WEBSITE_AND_APP"] },
  { value: "CONVERSATIONS", label: "Maximise number of conversations", locations: ["MESSENGER"] },
  { value: "QUALITY_CALL", label: "Maximise number of calls", locations: ["PHONE_CALL", "WEBSITE_AND_CALLS"] },
];

const ATTRIBUTION_MODELS: Array<{ value: string; label: string }> = [
  { value: "standard", label: "Standard" },
  { value: "incremental", label: "Incremental" },
  { value: "custom", label: "Custom" },
];

function goalsForLocation(location: string) {
  return PERFORMANCE_GOALS.filter((goal) => goal.locations.includes(location));
}

function defaultGoalForLocation(location: string) {
  if (location === "MESSENGER") return "CONVERSATIONS";
  return goalsForLocation(location)[0]?.value ?? "REACH";
}

function graphDestinationType(args: {
  conversionLocation: string;
  messageDestMode: "automatic" | "manual";
  messageApps: { messenger: boolean; instagram: boolean; whatsapp: boolean };
}): string {
  const mapped =
    CONVERSION_LOCATIONS.find((row) => row.value === args.conversionLocation)?.destinationType ?? "WEBSITE";
  if (args.conversionLocation !== "MESSENGER") return mapped;
  if (args.messageDestMode === "automatic") {
    return "MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP";
  }
  const { messenger, instagram, whatsapp } = args.messageApps;
  const key = `${messenger ? "M" : ""}${instagram ? "I" : ""}${whatsapp ? "W" : ""}`;
  if (key === "M") return "MESSENGER";
  if (key === "I") return "INSTAGRAM_DIRECT";
  if (key === "W") return "WHATSAPP";
  if (key === "MI") return "MESSAGING_INSTAGRAM_DIRECT_MESSENGER";
  if (key === "MW") return "MESSAGING_MESSENGER_WHATSAPP";
  return "MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP";
}

function graphObjectiveToFilter(raw: string): InterestResearchObjective {
  const o = String(raw ?? "").toUpperCase();
  if (o.includes("TRAFFIC") || o === "LINK_CLICKS") return "traffic";
  if (o.includes("ENGAGEMENT")) return "engagement";
  if (o.includes("LEAD")) return "leads";
  if (o.includes("APP")) return "app_promotion";
  if (o.includes("SALES") || o.includes("CONVERSION")) return "conversions";
  return "awareness";
}

function campaignObjectiveLabel(raw: string): string {
  const mapped = graphObjectiveToFilter(raw);
  return OBJECTIVES.find((item) => item.value === mapped)?.label ?? raw;
}

function formatCreateCampaignError(err: unknown): string {
  let raw = err instanceof Error ? err.message : "Create campaign failed";
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error.trim()) raw = parsed.error;
    } catch {
      /* keep raw */
    }
  }
  return raw.replace(/^\(#\d+\)\s*/, "").trim() || "Create campaign failed";
}

type BudgetLevel = "CAMPAIGN" | "ADSET";
type BudgetPeriod = "DAILY" | "LIFETIME";
type BidStrategy =
  | "LOWEST_COST_WITHOUT_CAP"
  | "COST_CAP"
  | "LOWEST_COST_WITH_MIN_ROAS"
  | "LOWEST_COST_WITH_BID_CAP";

const BID_STRATEGIES: Array<{ value: BidStrategy; label: string; hint: string }> = [
  {
    value: "LOWEST_COST_WITHOUT_CAP",
    label: "Highest volume",
    hint: "Get the most results for your budget.",
  },
  {
    value: "COST_CAP",
    label: "Cost per result goal",
    hint: "Aim for a certain cost per result while maximising the volume of results.",
  },
  {
    value: "LOWEST_COST_WITH_MIN_ROAS",
    label: "ROAS goal",
    hint: "Aim for a certain return on ad spend with flexibility to match your goals.",
  },
  {
    value: "LOWEST_COST_WITH_BID_CAP",
    label: "Bid cap",
    hint: "Set a maximum bid in each auction.",
  },
];

function formatRp(amount: number, currency: string): string {
  const n = Math.max(0, Math.round(amount));
  const grouped = n.toLocaleString("en-US");
  if (currency === "IDR") return `Rp${grouped}`;
  return `${currency} ${grouped}`;
}

type InterestResearchCreateAdDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  adAccountId: string;
  filters: InterestResearchFilters;
  items: MetaTargetingItem[];
  listId?: string | null;
  listName?: string | null;
  lastCampaignId?: string | null;
  suggestedDailyBudget?: number | null;
};

export function InterestResearchCreateAdDialog({
  open,
  onOpenChange,
  organizationId,
  adAccountId,
  filters,
  items,
  listId = null,
  listName = null,
  lastCampaignId = null,
  suggestedDailyBudget = null,
}: InterestResearchCreateAdDialogProps) {
  const { t } = useTranslation();
  const createDraft = useMetaAdsCreateAdDraft();
  const pushList = useMetaAdsCreateSavedAudience();
  const campaignsQuery = useMetaAdsCampaignOptions(organizationId, adAccountId, open);
  const nameTemplatesQuery = useMetaAdsNameTemplates(organizationId, open);
  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const [step, setStep] = useState(0);
  const [campaignMode, setCampaignMode] = useState<"new" | "existing">("new");
  const [buyingType, setBuyingType] = useState<"AUCTION" | "RESERVED">("AUCTION");
  const [objective, setObjective] = useState<InterestResearchObjective>(filters.objective);
  const [existingCampaignId, setExistingCampaignId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [nameTemplate, setNameTemplate] = useState<CampaignNameTemplate>(emptyCampaignNameTemplate);
  const [useNameTemplate, setUseNameTemplate] = useState(false);
  const [adsetName, setAdsetName] = useState("");
  const [adsetNameTemplate, setAdsetNameTemplate] = useState<CampaignNameTemplate>(emptyCampaignNameTemplate);
  const [useAdsetNameTemplate, setUseAdsetNameTemplate] = useState(false);
  const [conversionLocation, setConversionLocation] = useState("WEBSITE");
  const [performanceGoal, setPerformanceGoal] = useState("OFFSITE_CONVERSIONS");
  const [attributionModel, setAttributionModel] = useState("standard");
  const [messageDestMode, setMessageDestMode] = useState<"automatic" | "manual">("automatic");
  const [messageApps, setMessageApps] = useState({ messenger: true, instagram: false, whatsapp: false });
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>("CAMPAIGN");
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>("DAILY");
  const [bidStrategy, setBidStrategy] = useState<BidStrategy>("LOWEST_COST_WITHOUT_CAP");
  const [bidAmount, setBidAmount] = useState("");
  const [roasGoal, setRoasGoal] = useState("1");
  const [dailyBudget, setDailyBudget] = useState("");
  const currency = (filters.currency || "IDR").toUpperCase();
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lockNotice, setLockNotice] = useState(false);
  const [createdAdsUrl, setCreatedAdsUrl] = useState("");
  const pending = createDraft.isPending || pushList.isPending;

  const selectedCampaign = useMemo(
    () => campaigns.find((row) => row.id === existingCampaignId) ?? null,
    [campaigns, existingCampaignId],
  );
  const existingUsesCampaignBudget = Boolean(selectedCampaign?.uses_campaign_budget);
  const effectiveBudgetLevel: BudgetLevel =
    campaignMode === "existing"
      ? existingUsesCampaignBudget
        ? "CAMPAIGN"
        : "ADSET"
      : budgetLevel;
  const nameCtx = useMemo(
    () => ({
      objective,
      objectiveLabel: OBJECTIVES.find((row) => row.value === objective)?.label ?? objective,
      cbo: effectiveBudgetLevel === "CAMPAIGN",
      campaignId: CAMPAIGN_ID_PLACEHOLDER,
      conversionLocation,
      conversionLocationLabel:
        CONVERSION_LOCATIONS.find((row) => row.value === conversionLocation)?.label ?? conversionLocation,
      locationLabel: formatLocationNameLabel(filters.locations ?? [], filters.countryCode || ""),
      interestLabel: listName?.trim() || "",
      placement: filters.placement,
      placementLabel: DEFAULT_PLACEMENT_DISPLAYS[filters.placement] ?? filters.placement,
    }),
    [
      objective,
      effectiveBudgetLevel,
      conversionLocation,
      filters.locations,
      filters.countryCode,
      filters.placement,
      listName,
    ],
  );

  useEffect(() => {
    if (!open || campaignMode !== "new" || !useNameTemplate || nameTemplate.tokens.length === 0) return;
    setCampaignName(campaignNameFromTemplate(nameTemplate, nameCtx));
  }, [open, campaignMode, useNameTemplate, nameTemplate, nameCtx]);

  useEffect(() => {
    if (!open || !useAdsetNameTemplate || adsetNameTemplate.tokens.length === 0) return;
    setAdsetName(campaignNameFromTemplate(adsetNameTemplate, nameCtx));
  }, [open, useAdsetNameTemplate, adsetNameTemplate, nameCtx]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setObjective(filters.objective || "conversions");
    setBuyingType("AUCTION");
    setBudgetLevel("CAMPAIGN");
    setBudgetPeriod("DAILY");
    setBidStrategy("LOWEST_COST_WITHOUT_CAP");
    setBidAmount("");
    setRoasGoal("1");
    const defaultText = listName?.trim() ? `Synckerja ${listName.trim()}` : "";
    setCampaignName(defaultText);
    setAdsetName(listName?.trim() || "");
    setConversionLocation("WEBSITE");
    setPerformanceGoal("OFFSITE_CONVERSIONS");
    setAttributionModel("standard");
    setMessageDestMode("automatic");
    setMessageApps({ messenger: true, instagram: false, whatsapp: false });
    const suggested = Number(suggestedDailyBudget);
    const fromFilters = Number(filters.dailyBudget);
    setDailyBudget(
      Number.isFinite(suggested) && suggested > 0
        ? String(Math.round(suggested))
        : Number.isFinite(fromFilters) && fromFilters > 0
          ? String(Math.round(fromFilters))
          : "200000",
    );
    setCampaignPickerOpen(false);
    setSubmitError(null);
    setLockNotice(false);
    setCreatedAdsUrl("");
    setCampaignMode("new");
    setExistingCampaignId(String(lastCampaignId ?? "").trim());
  }, [open, filters.objective, filters.dailyBudget, listName, lastCampaignId, suggestedDailyBudget]);

  const templatesHydratedForOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      templatesHydratedForOpen.current = false;
      return;
    }
    if (!nameTemplatesQuery.isSuccess || templatesHydratedForOpen.current) return;
    templatesHydratedForOpen.current = true;
    const saved = nameTemplatesQuery.data;
    setNameTemplate(saved.campaignTemplate);
    setUseNameTemplate(saved.useCampaignTemplate);
    setAdsetNameTemplate(saved.adsetTemplate);
    setUseAdsetNameTemplate(saved.useAdsetTemplate);
  }, [open, nameTemplatesQuery.isSuccess, nameTemplatesQuery.data]);

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistNameTemplates = (
    patch: Partial<{
      campaignTemplate: CampaignNameTemplate;
      adsetTemplate: CampaignNameTemplate;
      useCampaignTemplate: boolean;
      useAdsetTemplate: boolean;
    }>,
    immediate = false,
  ) => {
    if (!organizationId || !nameTemplatesQuery.isSuccess) return;
    const next = {
      campaignTemplate: patch.campaignTemplate ?? nameTemplate,
      adsetTemplate: patch.adsetTemplate ?? adsetNameTemplate,
      useCampaignTemplate: patch.useCampaignTemplate ?? useNameTemplate,
      useAdsetTemplate: patch.useAdsetTemplate ?? useAdsetNameTemplate,
    };
    if (persistTimer.current) clearTimeout(persistTimer.current);
    const run = () => {
      persistTimer.current = null;
      void nameTemplatesQuery.save.mutateAsync(next).catch(() => {
        toast.error("Couldn't save naming template");
      });
    };
    if (immediate) run();
    else persistTimer.current = setTimeout(run, 400);
  };

  useEffect(() => {
    if (!open || campaignMode !== "existing" || !campaigns.length) return;
    if (existingCampaignId && campaigns.some((row) => row.id === existingCampaignId)) return;
    const remembered = String(lastCampaignId ?? "").trim();
    const fallback = campaigns.find((row) => row.id === remembered) ?? campaigns[0];
    if (fallback) setExistingCampaignId(fallback.id);
  }, [open, campaignMode, campaigns, existingCampaignId, lastCampaignId]);

  const canContinue = () => {
    if (step === 0 && campaignMode === "existing" && !existingCampaignId) return false;
    if (step === 1) {
      if (campaignMode === "existing" && effectiveBudgetLevel === "CAMPAIGN") return true;
      const n = Number(dailyBudget);
      if (!Number.isFinite(n) || n <= 0) return false;
      if (bidStrategy === "COST_CAP" || bidStrategy === "LOWEST_COST_WITH_BID_CAP") {
        const bid = Number(bidAmount);
        if (!Number.isFinite(bid) || bid <= 0) return false;
      }
      if (bidStrategy === "LOWEST_COST_WITH_MIN_ROAS") {
        const roas = Number(roasGoal);
        if (!Number.isFinite(roas) || roas <= 0) return false;
      }
    }
    return true;
  };

  const submit = async () => {
    if (!listId && !items.length) {
      toast.error(t("digitalMarketing.metaAds.interestSelectFirst", "Select at least one interest"));
      return;
    }
    if (campaignMode === "existing" && !existingCampaignId) {
      toast.error(t("digitalMarketing.metaAds.interestChooseCampaign", "Choose an existing campaign"));
      return;
    }
    const resolvedObjective =
      campaignMode === "existing" && selectedCampaign
        ? graphObjectiveToFilter(selectedCampaign.objective)
        : objective;
    const setupFilters: InterestResearchFilters = {
      ...(filters ?? DEFAULT_INTEREST_RESEARCH_FILTERS),
      objective: resolvedObjective,
    };
    const needsBudget = !(campaignMode === "existing" && effectiveBudgetLevel === "CAMPAIGN");
    const budget = Number(dailyBudget);
    if (needsBudget && (!Number.isFinite(budget) || budget <= 0)) {
      toast.error(t("digitalMarketing.metaAds.interestBudgetRequired", "Enter a daily budget"));
      return;
    }
    const attachId = campaignMode === "existing" ? existingCampaignId : undefined;
    if (
      conversionLocation === "MESSENGER" &&
      messageDestMode === "manual" &&
      !messageApps.messenger &&
      !messageApps.instagram &&
      !messageApps.whatsapp
    ) {
      toast.error(
        t("digitalMarketing.metaAds.interestPickMessageApp", "Choose at least one message destination"),
      );
      return;
    }
    const destinationType = graphDestinationType({
      conversionLocation,
      messageDestMode,
      messageApps,
    });
    const resolvedCampaignName =
      campaignMode === "new" && useNameTemplate && nameTemplate.tokens.length > 0
        ? campaignNameFromTemplate(nameTemplate, nameCtx).trim()
        : campaignName.trim();
    setSubmitError(null);
    try {
      let adsManagerUrl = "";
      const draftFields = {
        campaignName: resolvedCampaignName || undefined,
        adsetName:
          (useAdsetNameTemplate && adsetNameTemplate.tokens.length > 0
            ? campaignNameFromTemplate(adsetNameTemplate, nameCtx)
            : adsetName
          ).trim() || undefined,
        dailyBudget: needsBudget && budgetPeriod === "DAILY" ? budget : undefined,
        lifetimeBudget: needsBudget && budgetPeriod === "LIFETIME" ? budget : undefined,
        campaignId: attachId,
        buyingType,
        budgetLevel: effectiveBudgetLevel,
        bidStrategy,
        bidAmount:
          bidStrategy === "COST_CAP" || bidStrategy === "LOWEST_COST_WITH_BID_CAP"
            ? Number(bidAmount)
            : undefined,
        roasAverageFloor:
          bidStrategy === "LOWEST_COST_WITH_MIN_ROAS"
            ? Math.round(Number(roasGoal) * 10000)
            : undefined,
        destinationType,
        optimizationGoal: performanceGoal,
        attributionModel,
      };
      if (listId) {
        const res = await pushList.mutateAsync({
          organizationId,
          adAccountId,
          listId,
          filters: setupFilters,
          createNew: true,
          ...draftFields,
        });
        adsManagerUrl = res.ads_manager_url;
      } else {
        const res = await createDraft.mutateAsync({
          organizationId,
          adAccountId,
          filters: setupFilters,
          items: items.map((i) => ({ id: i.id, name: i.name, type: i.type, path: i.path })),
          ...draftFields,
        });
        adsManagerUrl = res.ads_manager_url ?? "";
      }
      setCreatedAdsUrl(adsManagerUrl);
      setLockNotice(true);
      if (adsManagerUrl) window.open(adsManagerUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setSubmitError(formatCreateCampaignError(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="ir-create-ad-dialog !flex h-[min(720px,85vh)] max-h-[min(720px,85vh)] w-full !flex-col gap-3 overflow-hidden sm:max-w-2xl"
        onFocusCapture={(event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          target.style.setProperty("box-shadow", "none", "important");
          target.style.setProperty("outline", "none", "important");
        }}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{t("digitalMarketing.metaAds.interestCreateAdsTitle", "Create draft campaign")}</DialogTitle>
        </DialogHeader>
        <div className="mb-0 flex w-full min-w-0 flex-shrink-0 items-center text-xs">
          {STEPS.map((item, index) => (
            <Fragment key={item.id}>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]",
                    step === index
                      ? "border-sky-600 bg-sky-600 text-white"
                      : step > index
                        ? "border-sky-200 bg-sky-50 text-sky-800"
                        : "border-muted-foreground/30 text-muted-foreground",
                  )}
                  onClick={() => {
                    if (index < step) setStep(index);
                  }}
                >
                  {index + 1}
                </button>
                <span
                  className={cn(
                    "whitespace-nowrap",
                    step === index ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t(`digitalMarketing.metaAds.interestCreateStep.${item.label.toLowerCase()}`, item.label)}
                </span>
              </div>
              {index < STEPS.length - 1 ? (
                <span className="mx-3 h-px min-w-4 flex-1 bg-border" aria-hidden />
              ) : null}
            </Fragment>
          ))}
        </div>

        <DialogFormScrollArea className="space-y-4 py-1">
          {step === 0 ? (
            <>
              <div className="flex rounded-md border p-0.5 text-sm">
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded px-2 py-1.5",
                    campaignMode === "new" ? "bg-sky-50 font-medium text-sky-900" : "text-muted-foreground",
                  )}
                  onClick={() => setCampaignMode("new")}
                >
                  {t("digitalMarketing.metaAds.interestCreateNewCampaign", "Create new campaign")}
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded px-2 py-1.5",
                    campaignMode === "existing" ? "bg-sky-50 font-medium text-sky-900" : "text-muted-foreground",
                  )}
                  onClick={() => setCampaignMode("existing")}
                >
                  {t("digitalMarketing.metaAds.interestNewAdSet", "New ad set")}
                </button>
              </div>

              {campaignMode === "new" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>{t("digitalMarketing.metaAds.interestBuyingType", "Buying type")}</Label>
                    <Select
                      value={buyingType}
                      onValueChange={(v) => setBuyingType(v === "RESERVED" ? "RESERVED" : "AUCTION")}
                    >
                      <SelectTrigger className={NO_FOCUS_RING}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[80]">
                        <SelectItem value="AUCTION">
                          {t("digitalMarketing.metaAds.interestBuyingAuction", "Auction")}
                        </SelectItem>
                        <SelectItem value="RESERVED">
                          {t("digitalMarketing.metaAds.interestBuyingReserved", "Reach and frequency")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("digitalMarketing.metaAds.interestFilterObjective", "Campaign objective")}</Label>
                    <RadioGroup
                      value={objective}
                      onValueChange={(v) => setObjective(v as InterestResearchObjective)}
                      className="gap-1"
                    >
                      {OBJECTIVES.map((opt) => (
                        <label
                          key={opt.value}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <RadioGroupItem value={opt.value} />
                          <span>{t(`digitalMarketing.metaAds.interestObjective.${opt.value}`, opt.label)}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label>{t("digitalMarketing.metaAds.interestExistingCampaign", "Campaign")}</Label>
                  {campaignsQuery.isFetching ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("digitalMarketing.metaAds.interestLoadingCampaigns", "Loading campaigns…")}
                    </p>
                  ) : campaigns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "digitalMarketing.metaAds.interestNoCampaigns",
                        "No active or paused campaigns in this ad account.",
                      )}
                    </p>
                  ) : (
                    <Popover modal open={campaignPickerOpen} onOpenChange={setCampaignPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={campaignPickerOpen}
                          className={cn("h-auto min-h-10 w-full justify-between py-2 font-normal", NO_FOCUS_RING)}
                        >
                          <span className={cn("truncate text-left", !selectedCampaign && "text-muted-foreground")}>
                            {selectedCampaign
                              ? selectedCampaign.name
                              : t("digitalMarketing.metaAds.interestChooseCampaign", "Choose a campaign")}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="z-[80] w-[var(--radix-popover-trigger-width)] p-0"
                        align="start"
                        side="bottom"
                        sideOffset={6}
                        collisionPadding={12}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <Command>
                          <CommandInput
                            placeholder={t("digitalMarketing.metaAds.interestSearchCampaign", "Search campaign")}
                          />
                          <CommandList className="scrollbar-hide max-h-64 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <CommandEmpty>
                              {t("digitalMarketing.metaAds.interestNoCampaigns", "No active or paused campaigns in this ad account.")}
                            </CommandEmpty>
                            <CommandGroup>
                              {campaigns.map((row) => (
                                <CommandItem
                                  key={row.id}
                                  value={`${row.name} ${row.id} ${row.objective} ${row.buying_type}`}
                                  onSelect={() => {
                                    setExistingCampaignId(row.id);
                                    setCampaignPickerOpen(false);
                                  }}
                                  className="items-start gap-2"
                                >
                                  <Check
                                    className={cn(
                                      "mt-0.5 h-4 w-4 shrink-0",
                                      row.id === existingCampaignId ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">{row.name}</span>
                                    <span className="block text-[11px] text-muted-foreground">
                                      {campaignObjectiveLabel(row.objective)} ·{" "}
                                      {row.buying_type === "RESERVED" ? "Reach and frequency" : "Auction"}
                                    </span>
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                  {selectedCampaign ? (
                    <p className="text-[11px] text-muted-foreground">
                      {selectedCampaign.effective_status} · {campaignObjectiveLabel(selectedCampaign.objective)} ·{" "}
                      {selectedCampaign.buying_type === "RESERVED" ? "Reach and frequency" : "Auction"}
                    </p>
                  ) : null}
                </div>
              )}
            </>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
              {campaignMode === "new" ? (
                <InterestResearchCampaignNameTemplate
                  template={nameTemplate}
                  onChange={setNameTemplate}
                  ctx={nameCtx}
                  campaignName={campaignName}
                  onCampaignNameChange={setCampaignName}
                  useTemplate={useNameTemplate}
                  onUseTemplateChange={setUseNameTemplate}
                  onPersist={(template, enabled, immediate) =>
                    persistNameTemplates(
                      { campaignTemplate: template, useCampaignTemplate: enabled },
                      immediate,
                    )
                  }
                />
              ) : null}

              {campaignMode === "existing" ? (
                <div className="rounded-md border px-3 py-2.5 text-sm">
                  <p className="text-sm font-medium">
                    {t("digitalMarketing.metaAds.interestBudgetStrategy", "Budget strategy")}
                  </p>
                  <p className="mt-1 font-medium">
                    {effectiveBudgetLevel === "CAMPAIGN"
                      ? t("digitalMarketing.metaAds.interestCampaignBudget", "Campaign budget")
                      : t("digitalMarketing.metaAds.interestAdsetBudget", "Ad set budget")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {effectiveBudgetLevel === "CAMPAIGN"
                      ? t(
                          "digitalMarketing.metaAds.interestCampaignBudgetLocked",
                          "This campaign already uses a campaign budget. The new ad set will share it.",
                        )
                      : t(
                          "digitalMarketing.metaAds.interestAdsetBudgetLocked",
                          "This campaign uses ad set budgets. Set a daily budget for the new ad set.",
                        )}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-sky-200 bg-sky-50/50 px-3 py-2.5">
                  <p className="mb-2 text-sm font-medium">
                    {t("digitalMarketing.metaAds.interestBudgetStrategy", "Budget strategy")}
                  </p>
                  <RadioGroup
                    value={budgetLevel}
                    onValueChange={(v) => setBudgetLevel(v === "CAMPAIGN" ? "CAMPAIGN" : "ADSET")}
                    className="gap-3"
                  >
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <RadioGroupItem value="CAMPAIGN" className="mt-0.5" />
                      <span>
                        <span className="block font-medium">
                          {t("digitalMarketing.metaAds.interestCampaignBudget", "Campaign budget")}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t(
                            "digitalMarketing.metaAds.interestCampaignBudgetHint",
                            "Automatically distribute your budget to the best opportunities across your campaign. Also known as Advantage+ campaign budget.",
                          )}
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <RadioGroupItem value="ADSET" className="mt-0.5" />
                      <span>
                        <span className="block font-medium">
                          {t("digitalMarketing.metaAds.interestAdsetBudget", "Ad set budget")}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t(
                            "digitalMarketing.metaAds.interestAdsetBudgetHint",
                            "Set different bid strategies or budget schedules for each ad set.",
                          )}
                        </span>
                      </span>
                    </label>
                  </RadioGroup>
                </div>
              )}

              {!(campaignMode === "existing" && effectiveBudgetLevel === "CAMPAIGN") ? (
                <>
                  <div className="flex overflow-hidden rounded-md border">
                    <Select
                      value={budgetPeriod}
                      onValueChange={(v) => setBudgetPeriod(v === "LIFETIME" ? "LIFETIME" : "DAILY")}
                    >
                      <SelectTrigger className={cn("h-10 w-[158px] rounded-none border-0 border-r", NO_FOCUS_RING)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom" className="z-[80]">
                        <SelectItem value="DAILY">Daily budget</SelectItem>
                        <SelectItem value="LIFETIME">Lifetime budget</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      id="ir-budget"
                      inputMode="numeric"
                      value={dailyBudget}
                      onChange={(e) => setDailyBudget(e.target.value.replace(/[^\d]/g, ""))}
                      className={cn("h-10 flex-1 rounded-none border-0", NO_FOCUS_RING)}
                    />
                    <span className="flex items-center px-3 text-xs text-muted-foreground">{currency}</span>
                  </div>
                  {(() => {
                    const amount = Number(dailyBudget);
                    if (!Number.isFinite(amount) || amount <= 0) return null;
                    if (budgetPeriod === "LIFETIME") {
                      return (
                        <p className="text-xs text-muted-foreground">
                          We'll spend around {formatRp(amount, currency)} over the lifetime of this campaign.
                        </p>
                      );
                    }
                    const dailyMax = Math.round(amount * 1.75);
                    const weeklyMax = amount * 7;
                    return (
                      <p className="text-xs text-muted-foreground">
                        We'll spend around {formatRp(amount, currency)} per day. Your maximum daily spend is{" "}
                        <span className="font-medium text-foreground">{formatRp(dailyMax, currency)}</span> and
                        your maximum weekly spend is{" "}
                        <span className="font-medium text-foreground">{formatRp(weeklyMax, currency)}</span>.
                      </p>
                    );
                  })()}

                  <div className="space-y-1.5">
                    <Label>
                      {effectiveBudgetLevel === "CAMPAIGN"
                        ? "Campaign bid strategy"
                        : "Ad set bid strategy"}
                    </Label>
                    <Select
                      value={bidStrategy}
                      onValueChange={(v) => setBidStrategy(v as BidStrategy)}
                    >
                      <SelectTrigger className={cn("h-10 w-full justify-between text-left [&>span]:min-w-0 [&>span]:flex-1 [&>span]:text-left", NO_FOCUS_RING)}>
                        <SelectValue placeholder="Highest volume" />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom" align="start" className="z-[80]">
                        {BID_STRATEGIES.map((row) => (
                          <SelectItem
                            key={row.value}
                            value={row.value}
                            indicatorSide="right"
                            className="text-left"
                          >
                            {row.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-left text-xs text-muted-foreground">
                      {BID_STRATEGIES.find((row) => row.value === bidStrategy)?.hint}
                    </p>
                  </div>
                  {bidStrategy === "COST_CAP" || bidStrategy === "LOWEST_COST_WITH_BID_CAP" ? (
                    <div className="flex overflow-hidden rounded-md border">
                      <Input
                        inputMode="numeric"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value.replace(/[^\d]/g, ""))}
                        placeholder={bidStrategy === "COST_CAP" ? "Cost per result" : "Bid cap"}
                        className={cn("h-10 flex-1 rounded-none border-0", NO_FOCUS_RING)}
                      />
                      <span className="flex items-center px-3 text-xs text-muted-foreground">{currency}</span>
                    </div>
                  ) : null}
                  {bidStrategy === "LOWEST_COST_WITH_MIN_ROAS" ? (
                    <div className="space-y-1.5">
                      <Label>ROAS goal</Label>
                      <Input
                        inputMode="decimal"
                        value={roasGoal}
                        onChange={(e) => setRoasGoal(e.target.value.replace(/[^\d.]/g, ""))}
                        placeholder="1.5"
                        className={NO_FOCUS_RING}
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <InterestResearchCampaignNameTemplate
                title={t("digitalMarketing.metaAds.interestAdsetName", "Ad set name")}
                fieldId="ir-adset-name"
                entityPlural="ad sets"
                fieldGroup="adset"
                template={adsetNameTemplate}
                onChange={setAdsetNameTemplate}
                ctx={nameCtx}
                campaignName={adsetName}
                onCampaignNameChange={setAdsetName}
                useTemplate={useAdsetNameTemplate}
                onUseTemplateChange={setUseAdsetNameTemplate}
                onPersist={(template, enabled, immediate) =>
                  persistNameTemplates(
                    { adsetTemplate: template, useAdsetTemplate: enabled },
                    immediate,
                  )
                }
              />
              <div className="space-y-1.5">
                <Label>{t("digitalMarketing.metaAds.interestConversionLocation", "Conversion location")}</Label>
                <Select
                  value={conversionLocation}
                  onValueChange={(v) => {
                    setConversionLocation(v);
                    if (v === "MESSENGER") {
                      setMessageDestMode("automatic");
                      setMessageApps({ messenger: true, instagram: false, whatsapp: false });
                    }
                    const nextGoals = goalsForLocation(v);
                    if (!nextGoals.some((goal) => goal.value === performanceGoal)) {
                      setPerformanceGoal(defaultGoalForLocation(v));
                    }
                  }}
                >
                  <SelectTrigger className={NO_FOCUS_RING}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[80]">
                    {CONVERSION_LOCATIONS.map((row) => (
                      <SelectItem key={row.value} value={row.value}>
                        {row.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {conversionLocation === "MESSENGER" ? (
                <div className="space-y-2">
                  <Label>{t("digitalMarketing.metaAds.interestMessageDestinations", "Message destinations")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "digitalMarketing.metaAds.interestMessageDestinationsHint",
                      "Ads Manager will lock these after the ad set is created. Pick them here.",
                    )}
                  </p>
                  <RadioGroup
                    value={messageDestMode}
                    onValueChange={(v) => setMessageDestMode(v === "manual" ? "manual" : "automatic")}
                    className="gap-2"
                  >
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5 text-sm",
                        messageDestMode === "automatic" ? "border-sky-500 bg-sky-50/60" : "hover:bg-muted",
                      )}
                    >
                      <RadioGroupItem value="automatic" className="mt-0.5" />
                      <span>
                        <span className="block font-medium">
                          {t("digitalMarketing.metaAds.interestMessageDestAutomatic", "Automatic destination")}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t(
                            "digitalMarketing.metaAds.interestMessageDestAutomaticHint",
                            "Send people to Messenger, Instagram, or WhatsApp where they engage most.",
                          )}
                        </span>
                      </span>
                    </label>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5 text-sm",
                        messageDestMode === "manual" ? "border-sky-500 bg-sky-50/60" : "hover:bg-muted",
                      )}
                    >
                      <RadioGroupItem value="manual" className="mt-0.5" />
                      <span>
                        <span className="block font-medium">
                          {t("digitalMarketing.metaAds.interestMessageDestManual", "Manual destination")}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t(
                            "digitalMarketing.metaAds.interestMessageDestManualHint",
                            "Only send people to the messaging apps you choose.",
                          )}
                        </span>
                      </span>
                    </label>
                  </RadioGroup>
                  {messageDestMode === "manual" ? (
                    <div className="space-y-2 rounded-md border px-3 py-2.5">
                      {(
                        [
                          ["messenger", "Messenger"],
                          ["instagram", "Instagram"],
                          ["whatsapp", "WhatsApp"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                          <Checkbox
                            checked={messageApps[key]}
                            onCheckedChange={(checked) =>
                              setMessageApps((prev) => ({ ...prev, [key]: checked === true }))
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label>{t("digitalMarketing.metaAds.interestPerformanceGoal", "Performance goal")}</Label>
                <Select value={performanceGoal} onValueChange={setPerformanceGoal}>
                  <SelectTrigger className={NO_FOCUS_RING}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[80] max-h-72">
                    {goalsForLocation(conversionLocation).map((row) => (
                      <SelectItem key={row.value} value={row.value}>
                        {row.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("digitalMarketing.metaAds.interestAttributionModel", "Attribution model")}</Label>
                <Select value={attributionModel} onValueChange={setAttributionModel}>
                  <SelectTrigger className={NO_FOCUS_RING}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[80]">
                    {ATTRIBUTION_MODELS.map((row) => (
                      <SelectItem key={row.value} value={row.value}>
                        {row.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </DialogFormScrollArea>
        {submitError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {submitError}
          </p>
        ) : null}
        {lockNotice ? (
          <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
            {t(
              "digitalMarketing.metaAds.interestDraftCreatedPaused",
              "Created as a paused draft (campaign + ad set). Finish the ad creative in Ads Manager — Graph cannot save an empty Ads Manager draft.",
            )}
          </p>
        ) : null}
        <DialogFooter className="flex-shrink-0">
          {step === 0 ? (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              {t("common.back", "Back")}
            </Button>
          )}
          {lockNotice ? (
            <>
              {createdAdsUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open(createdAdsUrl, "_blank", "noopener,noreferrer")}
                >
                  {t("digitalMarketing.metaAds.interestOpenAdsManager", "Open Ads Manager")}
                </Button>
              ) : null}
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t("common.done", "Done")}
              </Button>
            </>
          ) : step < LAST_STEP ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canContinue()}>
              {t("common.continue", "Continue")}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={pending}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("digitalMarketing.metaAds.interestCreateAdsSubmit", "Create draft campaign")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
