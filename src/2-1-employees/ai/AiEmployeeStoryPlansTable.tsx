import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { CanvaStoryNote, type CanvaStoryRun } from "@/canva/CanvaStoryNote";
import { CANVA_STORY_RUNS_KEY, useCanvaStoryRuns } from "@/canva/useCanvaStoryRuns";
import { Button } from "@/shared/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { AiEmployeeStoryPublishDialog, type StoryPublishTarget } from "./AiEmployeeStoryPublishDialog";
import { AiEmployeeStoryReviewDialog, type StoryReviewTarget } from "./AiEmployeeStoryReviewDialog";
import { jakartaMonth, shiftMonth } from "./runLog";
import { useSopRunning } from "./runningSop";
import { parseStoryPlans, STORY_PLANS_KEY, type StoryPlanRow } from "./storyPlans";

function useStoryPlans(employeeId: string, month: string, pollWhileBusy: boolean) {
  return useQuery({
    queryKey: [STORY_PLANS_KEY, employeeId, month],
    refetchOnWindowFocus: false,
    refetchInterval: pollWhileBusy ? 5_000 : false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ai_employee_story_plans", {
        p_employee_id: employeeId,
        p_month: `${month}-01`,
      });
      if (error) throw error;
      return parseStoryPlans(data);
    },
  });
}

function formatPostDate(value: string | null, dateLocale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function DriveCanvaCell({
  row,
  live,
  busy,
  onStart,
  onRefresh,
  onReview,
  onPublish,
}: {
  row: StoryPlanRow;
  live: CanvaStoryRun | null;
  busy: boolean;
  onStart: () => void;
  onRefresh: () => void;
  onReview: () => void;
  onPublish: () => void;
}) {
  const { t } = useAppTranslation();
  const drive = row.googleDriveLink.trim();
  const run: CanvaStoryRun | null = live ?? (row.canva
    ? {
      social_media_plan_id: row.id,
      status: row.canva.status,
      design_url: row.canva.design_url,
      error: row.canva.error,
      images_ready: row.canva.images_ready,
      refresh_requested: row.canva.refresh_requested,
      export_path: row.canva.export_path,
    }
    : null);
  const working = run?.status === "queued" || run?.status === "running"
    || (run?.refresh_requested === true && run.images_ready !== true);
  const canOpen = Boolean(run?.design_url?.startsWith("https://"));
  const canRefresh = run?.status === "succeeded" && Boolean(run.design_url);
  const canStart = !run || run.status === "failed";
  const canReview = run?.status === "succeeded";
  const canPublish = row.productionApproved || row.productionStatus === "Approved";
  const reviewHint = canPublish
    ? t("aiEmployee.story.prodApproved", "Approved")
    : row.productionStatus === "Request Revision"
      ? t("aiEmployee.story.prodRevision", "Request Revision")
      : row.productionStatus === "Need Review" || run?.images_ready
        ? t("aiEmployee.story.prodNeedReview", "Need Review")
        : "";

  return (
    <div className="flex min-w-[9rem] flex-col gap-1 text-xs">
      {drive ? (
        <a
          href={drive}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          Drive
        </a>
      ) : (
        <span className="text-muted-foreground">Drive —</span>
      )}
      <CanvaStoryNote run={run} />
      <div className="flex flex-wrap gap-1">
        {canReview ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={onReview}
            title={reviewHint || undefined}
          >
            {t("aiEmployee.story.review", "Review")}
            {reviewHint ? ` · ${reviewHint}` : ""}
          </Button>
        ) : null}
        {canPublish ? (
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={onPublish}
          >
            {t("aiEmployee.story.publish", "Publish")}
          </Button>
        ) : null}
        {canOpen ? (
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px]" asChild>
            <a href={run!.design_url!} target="_blank" rel="noreferrer">
              {t("aiEmployee.story.openCanva", "Buka di Canva")}
            </a>
          </Button>
        ) : null}
        {canRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={busy || working}
            onClick={onRefresh}
          >
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden /> : null}
            {t("aiEmployee.story.refreshCanva", "Perbarui dari Canva")}
          </Button>
        ) : null}
        {canStart ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={busy || working}
            onClick={onStart}
          >
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden /> : null}
            {t("aiEmployee.story.startCanva", "Buat di Canva")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function AiEmployeeStoryPlansTable({ employeeId }: { employeeId: string }) {
  const { t, dateLocale } = useAppTranslation();
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => jakartaMonth());
  const sop4Running = useSopRunning(employeeId, "SOP4");
  const query = useStoryPlans(employeeId, month, sop4Running);
  const rows = query.data?.rows ?? [];
  const planIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const canvaQuery = useCanvaStoryRuns(planIds);
  const canvaByPlan = useMemo(() => {
    const map = new Map<string, CanvaStoryRun>();
    for (const row of canvaQuery.data ?? []) map.set(row.social_media_plan_id, row);
    return map;
  }, [canvaQuery.data]);
  const thisMonth = jakartaMonth();
  const [actionPlanId, setActionPlanId] = useState<string | null>(null);
  const [reviewPlan, setReviewPlan] = useState<StoryReviewTarget | null>(null);
  const [publishPlan, setPublishPlan] = useState<StoryPublishTarget | null>(null);

  const toPublishTarget = (row: StoryPlanRow): StoryPublishTarget => {
    const live = canvaByPlan.get(row.id);
    return {
      id: row.id,
      briefPreview: row.briefPreview,
      designUrl: live?.design_url ?? row.canva?.design_url ?? null,
      exportPath: live?.export_path ?? row.canva?.export_path ?? null,
      postDate: row.postDate,
      productionApproved: row.productionApproved || row.productionStatus === "Approved",
    };
  };

  const openReview = (row: StoryPlanRow) => {
    const live = canvaByPlan.get(row.id);
    setReviewPlan({
      id: row.id,
      briefPreview: row.briefPreview,
      designUrl: live?.design_url ?? row.canva?.design_url ?? null,
      exportPath: live?.export_path ?? row.canva?.export_path ?? null,
      postDate: row.postDate,
      productionStatus: row.productionStatus,
      productionApproved: row.productionApproved,
    });
  };

  const openPublishFromReview = (approved: StoryReviewTarget) => {
    setPublishPlan({
      id: approved.id,
      briefPreview: approved.briefPreview,
      designUrl: approved.designUrl,
      exportPath: approved.exportPath,
      postDate: approved.postDate,
      productionApproved: true,
    });
  };

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [STORY_PLANS_KEY] }),
      queryClient.invalidateQueries({ queryKey: [CANVA_STORY_RUNS_KEY] }),
    ]);
  };

  const startMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.rpc("canva_story_start", { p_plan_id: planId });
      if (error) throw error;
    },
    onMutate: (planId) => setActionPlanId(planId),
    onSuccess: async () => {
      toast({ title: t("aiEmployee.story.canvaQueued", "Canva Story antre") });
      await invalidate();
    },
    onError: (error) => {
      const raw = error instanceof Error ? error.message.toLowerCase() : "";
      toast({
        title: t("aiEmployee.story.canvaStartFailed", "Canva Story gagal dimulai"),
        description: raw.includes("canva_not_connected")
          ? t("aiEmployee.story.canvaNotConnected", "Hubungkan Canva di pengaturan organisasi.")
          : raw.includes("too_soon")
            ? t("aiEmployee.story.canvaTooSoon", "Canva masih berjalan. Tunggu sebentar.")
            : undefined,
        variant: "destructive",
      });
    },
    onSettled: () => setActionPlanId(null),
  });

  const refreshMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.rpc("canva_story_refresh", { p_plan_id: planId });
      if (error) throw error;
    },
    onMutate: (planId) => setActionPlanId(planId),
    onSuccess: async () => {
      toast({ title: t("aiEmployee.story.canvaRefreshQueued", "Memperbarui dari Canva") });
      await invalidate();
    },
    onError: () => {
      toast({
        title: t("aiEmployee.story.canvaRefreshFailed", "Gagal memperbarui Canva Story"),
        variant: "destructive",
      });
    },
    onSettled: () => setActionPlanId(null),
  });

  const monthLabel = useMemo(() => {
    const [year, value] = month.split("-").map(Number);
    return new Date(Date.UTC(year, value - 1, 15)).toLocaleDateString(dateLocale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }, [month, dateLocale]);

  const changeMonth = (step: number) => {
    setMonth((value) => shiftMonth(value, step));
  };

  return (
    <section className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {t("aiEmployee.story.plansTitle", "Plan Story")}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label={t("aiEmployee.log.prevMonth", "Bulan sebelumnya")}
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[9rem] text-center text-sm capitalize">{monthLabel}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label={t("aiEmployee.log.nextMonth", "Bulan berikutnya")}
            disabled={month >= thisMonth}
            onClick={() => changeMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {query.isFetching || canvaQuery.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
        </div>
      </div>

      {query.isError ? (
        <p className="text-sm text-destructive">
          {t("aiEmployee.story.plansLoadFailed", "Gagal memuat plan Story.")}
        </p>
      ) : rows.length === 0 && !query.isLoading ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("aiEmployee.story.plansEmpty", "Belum ada plan Story di bulan ini.")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "aiEmployee.story.plansEmptyHint",
              "Isi brief Design Story, lalu Generate sekarang.",
            )}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">{t("aiEmployee.story.colPostDate", "Post date")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("aiEmployee.story.colPic", "PIC")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("aiEmployee.story.colType", "Content Type")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("aiEmployee.story.colCategory", "Category")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("aiEmployee.story.colPillar", "Pillar")}</TableHead>
                <TableHead>{t("aiEmployee.story.colBrief", "Brief")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("aiEmployee.story.colDriveCanva", "Drive/Canva")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading && rows.length === 0 ? (
                Array.from({ length: 4 }, (_, index) => (
                  <TableRow key={`story-plans-skel-${index}`} aria-hidden>
                    <TableCell><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-16 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-14 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-24 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-28 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-40 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-28 animate-pulse rounded bg-muted" /></TableCell>
                  </TableRow>
                ))
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatPostDate(row.postDate, dateLocale)}
                    </TableCell>
                    <TableCell className="max-w-[8rem] truncate text-sm" title={row.picName || undefined}>
                      {row.picName || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{row.contentTypeName || "Story"}</TableCell>
                    <TableCell className="max-w-[10rem] truncate text-sm" title={row.serviceName || undefined}>
                      {row.serviceName || "—"}
                    </TableCell>
                    <TableCell className="max-w-[10rem] truncate text-sm" title={row.pillarName || undefined}>
                      {row.pillarName || "—"}
                    </TableCell>
                    <TableCell className="max-w-[18rem] truncate text-sm" title={row.briefPreview || undefined}>
                      {row.briefPreview || "—"}
                    </TableCell>
                    <TableCell>
                      <DriveCanvaCell
                        row={row}
                        live={canvaByPlan.get(row.id) ?? null}
                        busy={actionPlanId === row.id}
                        onStart={() => startMutation.mutate(row.id)}
                        onRefresh={() => refreshMutation.mutate(row.id)}
                        onReview={() => openReview(row)}
                        onPublish={() => setPublishPlan(toPublishTarget(row))}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AiEmployeeStoryReviewDialog
        open={Boolean(reviewPlan)}
        plan={reviewPlan}
        onClose={() => setReviewPlan(null)}
        onChanged={() => { void invalidate(); }}
        onApprovedForPublish={openPublishFromReview}
      />

      {organizationId ? (
        <AiEmployeeStoryPublishDialog
          open={Boolean(publishPlan)}
          plan={publishPlan}
          organizationId={organizationId}
          employeeId={employeeId}
          onClose={() => setPublishPlan(null)}
        />
      ) : null}
    </section>
  );
}
