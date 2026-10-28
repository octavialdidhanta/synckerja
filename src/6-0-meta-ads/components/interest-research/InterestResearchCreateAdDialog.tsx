import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  useMetaAdsCreateAdDraft,
  type InterestResearchFilters,
  type MetaTargetingItem,
} from "@/meta-ads/hooks/useMetaAdsTargeting";

type InterestResearchCreateAdDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  adAccountId: string;
  filters: InterestResearchFilters;
  items: MetaTargetingItem[];
};

export function InterestResearchCreateAdDialog({
  open,
  onOpenChange,
  organizationId,
  adAccountId,
  filters,
  items,
}: InterestResearchCreateAdDialogProps) {
  const { t } = useTranslation();
  const createDraft = useMetaAdsCreateAdDraft();
  const [campaignName, setCampaignName] = useState("");
  const [adsetName, setAdsetName] = useState("");
  const [dailyBudget, setDailyBudget] = useState("50000");
  const [campaignId, setCampaignId] = useState("");

  const submit = async () => {
    if (!items.length) {
      toast.error(t("digitalMarketing.metaAds.interestSelectFirst", "Select at least one interest"));
      return;
    }
    try {
      const res = await createDraft.mutateAsync({
        organizationId,
        adAccountId,
        filters,
        items: items.map((i) => ({ id: i.id, name: i.name, type: i.type, path: i.path })),
        campaignName: campaignName.trim() || undefined,
        adsetName: adsetName.trim() || undefined,
        dailyBudget: Number(dailyBudget) || 50000,
        campaignId: campaignId.trim() || undefined,
      });
      toast.success(
        t(
          "digitalMarketing.metaAds.interestCreateAdOk",
          "Draft created (PAUSED). Campaign {{campaign}} · Ad set {{adset}}",
          { campaign: res.campaign_id, adset: res.adset_id },
        ),
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create Ad failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("digitalMarketing.metaAds.interestCreateAdTitle", "Create Ad draft")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "digitalMarketing.metaAds.interestCreateAdHint",
              "Creates a PAUSED campaign (optional) and ad set with selected targeting. Review in Ads Manager before publishing.",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-xs text-muted-foreground">
            {t("digitalMarketing.metaAds.interestCreateAdSelected", "{{count}} targeting options", {
              count: items.length,
            })}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="ir-campaign-id">
              {t("digitalMarketing.metaAds.interestExistingCampaign", "Existing campaign ID (optional)")}
            </Label>
            <Input
              id="ir-campaign-id"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              placeholder="1202…"
            />
          </div>
          {!campaignId.trim() ? (
            <div className="space-y-1.5">
              <Label htmlFor="ir-campaign-name">
                {t("digitalMarketing.metaAds.interestCampaignName", "New campaign name")}
              </Label>
              <Input
                id="ir-campaign-name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Synckerja Interest Research"
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="ir-adset-name">
              {t("digitalMarketing.metaAds.interestAdsetName", "Ad set name")}
            </Label>
            <Input
              id="ir-adset-name"
              value={adsetName}
              onChange={(e) => setAdsetName(e.target.value)}
              placeholder="Interest draft"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ir-budget">
              {t("digitalMarketing.metaAds.interestDailyBudget", "Daily budget (account currency minor units)")}
            </Label>
            <Input
              id="ir-budget"
              inputMode="numeric"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={createDraft.isPending}>
            {createDraft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("digitalMarketing.metaAds.interestCreateAdSubmit", "Create draft")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
