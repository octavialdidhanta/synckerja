import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/mobile-app/components/ui/button";
import { Input } from "@/mobile-app/components/ui/input";
import { Label } from "@/mobile-app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/mobile-app/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/mobile-app/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { formatDate } from "@/shared/utils/dateFormatter";
import { dedupeMasterRowsByNamePreferOrg } from "@/6-1-script-generator/utils/dedupeMasterRowsByNamePreferOrg";
import {
  titleFromVideoFileName,
  useCreateSharePublishPlan,
} from "../hooks/useCreateSharePublishPlan";
import type { ShareableSocialMediaPlan } from "../lib/buildSharePlanQuery";

type MasterRow = { id: string; name: string; organization_id?: string | null };
type SubServiceRow = MasterRow & { service_id: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null | undefined;
  postDate: string;
  defaultTitle?: string | null;
  currentEmployeeId?: string | null;
  currentEmployeeName?: string | null;
  isOwner: boolean;
  onCreated: (plan: ShareableSocialMediaPlan) => void;
};

export function SharePublishCreatePlanSheet({
  open,
  onOpenChange,
  organizationId,
  postDate,
  defaultTitle,
  currentEmployeeId,
  currentEmployeeName,
  isOwner,
  onCreated,
}: Props) {
  const { t } = useAppTranslation();
  const { createPlan, busy, resolveDefaultReelTypeId } = useCreateSharePublishPlan();

  const [title, setTitle] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [subServiceId, setSubServiceId] = useState("");
  const [contentPillarId, setContentPillarId] = useState("");
  const [contentTypeId, setContentTypeId] = useState("");
  const [services, setServices] = useState<MasterRow[]>([]);
  const [subServices, setSubServices] = useState<SubServiceRow[]>([]);
  const [contentPillars, setContentPillars] = useState<MasterRow[]>([]);
  const [contentTypes, setContentTypes] = useState<MasterRow[]>([]);
  const [masterLoading, setMasterLoading] = useState(false);

  const prefilledTitle = useMemo(
    () => (defaultTitle?.trim() ? titleFromVideoFileName(defaultTitle) : ""),
    [defaultTitle],
  );

  const filteredSubServices = useMemo(
    () => subServices.filter((row) => row.service_id === serviceId),
    [subServices, serviceId],
  );

  useEffect(() => {
    if (!open) return;
    setTitle(prefilledTitle);
    setServiceId("");
    setSubServiceId("");
    setContentPillarId("");
    setContentTypeId("");
  }, [open, prefilledTitle, postDate]);

  useEffect(() => {
    if (!open || !organizationId) return;
    let cancelled = false;

    const load = async () => {
      setMasterLoading(true);
      try {
        const [svcRes, subRes, pillarRes, ctRes, reelId] = await Promise.all([
          supabase
            .from("services")
            .select("id, name, organization_id")
            .or(`organization_id.eq.${organizationId},organization_id.is.null`)
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("sub_services")
            .select("id, name, service_id, organization_id")
            .or(`organization_id.eq.${organizationId},organization_id.is.null`)
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("content_pillars")
            .select("id, name, organization_id")
            .or(`organization_id.eq.${organizationId},organization_id.is.null`)
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("content_types")
            .select("id, name, organization_id")
            .or(`organization_id.eq.${organizationId},organization_id.is.null`)
            .eq("is_active", true)
            .order("name"),
          resolveDefaultReelTypeId(organizationId),
        ]);
        if (cancelled) return;
        if (svcRes.error) throw svcRes.error;
        if (subRes.error) throw subRes.error;
        if (pillarRes.error) throw pillarRes.error;
        if (ctRes.error) throw ctRes.error;

        const nextServices = (svcRes.data ?? []) as MasterRow[];
        const nextSubs = (subRes.data ?? []) as SubServiceRow[];
        const nextPillars = dedupeMasterRowsByNamePreferOrg(
          (pillarRes.data ?? []) as MasterRow[],
          organizationId,
        );
        const nextTypes = (ctRes.data ?? []) as MasterRow[];

        setServices(nextServices);
        setSubServices(nextSubs);
        setContentPillars(nextPillars);
        setContentTypes(nextTypes);

        const defaultServiceId = nextServices[0]?.id || "";
        setServiceId((prev) => prev || defaultServiceId);

        setContentPillarId((prev) => prev || nextPillars[0]?.id || "");

        setContentTypeId((prev) => {
          if (prev) return prev;
          if (reelId && nextTypes.some((row) => row.id === reelId)) return reelId;
          const reelRow = nextTypes.find(
            (row) => row.name.trim().toLowerCase() === "reel",
          );
          return reelRow?.id || nextTypes[0]?.id || "";
        });
      } catch {
        if (cancelled) return;
        toast.error(
          t(
            "share.publish.create.errors.loadMaster",
            "Could not load services or content types. Try again.",
          ),
        );
      } finally {
        if (!cancelled) setMasterLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId, resolveDefaultReelTypeId, t]);

  // Keep sub service valid for the selected service; default to first match.
  useEffect(() => {
    if (!serviceId) {
      setSubServiceId("");
      return;
    }
    const matches = subServices.filter((row) => row.service_id === serviceId);
    setSubServiceId((prev) => {
      if (prev && matches.some((row) => row.id === prev)) return prev;
      return matches[0]?.id || "";
    });
  }, [serviceId, subServices]);

  const handleServiceChange = (nextServiceId: string) => {
    setServiceId(nextServiceId);
    const matches = subServices.filter((row) => row.service_id === nextServiceId);
    setSubServiceId(matches[0]?.id || "");
  };

  const handleSubmit = async () => {
    if (!organizationId) {
      toast.error(
        t("share.publish.create.errors.orgRequired", "Organization is required"),
      );
      return;
    }
    try {
      const plan = await createPlan({
        organizationId,
        title,
        serviceId,
        subServiceId,
        contentPillarId,
        contentTypeId,
        picId: currentEmployeeId ?? null,
        postDate,
        isOwner,
      });
      toast.success(
        t("share.publish.create.toasts.created", "Content plan created"),
      );
      onOpenChange(false);
      onCreated(plan);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        msg.startsWith("share.")
          ? t(msg, msg)
          : msg ||
              t("share.publish.create.errors.createFailed", "Failed to create plan"),
      );
    }
  };

  const canSubmit =
    Boolean(organizationId) &&
    Boolean(title.trim()) &&
    Boolean(serviceId) &&
    Boolean(subServiceId) &&
    Boolean(contentPillarId) &&
    Boolean(contentTypeId) &&
    !busy &&
    !masterLoading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] overflow-y-auto rounded-t-2xl px-4 pb-6 pt-5"
      >
        <SheetHeader className="text-left">
          <SheetTitle>
            {t("share.publish.create.title", "Create new plan")}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="share-create-title">
              {t("share.publish.fields.title", "Title")}
            </Label>
            <Input
              id="share-create-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(
                "share.publish.create.titlePlaceholder",
                "Plan title",
              )}
              disabled={busy}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("share.publish.fields.postDate", "Planned upload date")}</Label>
            <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
              {formatDate(postDate)}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("share.publish.fields.service", "Service")}</Label>
            <Select
              value={serviceId || undefined}
              onValueChange={handleServiceChange}
              disabled={busy || masterLoading || services.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "share.publish.create.servicePlaceholder",
                    "Select service",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {services.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("share.publish.fields.subService", "Sub service")}</Label>
            <Select
              value={subServiceId || undefined}
              onValueChange={setSubServiceId}
              disabled={
                busy || masterLoading || !serviceId || filteredSubServices.length === 0
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "share.publish.create.subServicePlaceholder",
                    "Select sub service",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {filteredSubServices.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("share.publish.fields.contentPillar", "Content pillar")}</Label>
            <Select
              value={contentPillarId || undefined}
              onValueChange={setContentPillarId}
              disabled={busy || masterLoading || contentPillars.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "share.publish.create.contentPillarPlaceholder",
                    "Select content pillar",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {contentPillars.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("share.publish.fields.contentType", "Content type")}</Label>
            <Select
              value={contentTypeId || undefined}
              onValueChange={setContentTypeId}
              disabled={busy || masterLoading || contentTypes.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "share.publish.create.contentTypePlaceholder",
                    "Select content type",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {contentTypes.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("share.publish.fields.brief", "Brief")}</Label>
            <div className="rounded-md border border-dashed border-border/70 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
              {t(
                "share.publish.create.briefHint",
                "Brief will use your title as storyline plus an empty Timing | Visual | VO storyboard table (same as desktop). Edit later in Brief on desktop.",
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("share.publish.create.pic", "PIC")}</Label>
            <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {currentEmployeeName?.trim() ||
                t("share.publish.create.picFallback", "Current user")}
            </div>
          </div>
        </div>

        <SheetFooter className="mt-5 gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {busy || masterLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("share.publish.create.submit", "Create plan")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t("share.publish.create.cancel", "Cancel")}
          </Button>
        </SheetFooter>
        <div className="h-6 shrink-0 safe-area-bottom" aria-hidden />
      </SheetContent>
    </Sheet>
  );
}
