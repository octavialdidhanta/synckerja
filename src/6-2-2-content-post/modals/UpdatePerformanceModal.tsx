import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/use-toast";
import { Loader2 } from "lucide-react";

type PerformanceFormValues = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
};

function computeEngagementFields(values: PerformanceFormValues) {
  const impressions = values.views > 0 ? values.views : values.reach;
  const interactions = values.likes + values.comments + values.shares;
  const engagement_rate =
    impressions > 0
      ? Math.round((interactions / impressions) * 10000) / 100
      : 0;
  return { impressions, engagement_rate };
}

export const UpdatePerformanceModal = ({
  open,
  onOpenChange,
  post,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: any;
  onSaved: () => Promise<void>;
}) => {
  const { toast } = useToast();
  const [metricId, setMetricId] = useState<string | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<PerformanceFormValues>({
    defaultValues: {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      reach: 0,
    },
  });

  useEffect(() => {
    if (!open || !post?.id) return;

    let cancelled = false;
    setLoadingMetrics(true);

    (async () => {
      const { data, error } = await supabase
        .from("kol_performance_metrics")
        .select("id, views, likes, comments, shares, saves, reach")
        .eq("content_post_id", post.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Failed to load performance metrics:", error);
        setMetricId(null);
        form.reset({
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          reach: 0,
        });
      } else if (data) {
        setMetricId(data.id);
        form.reset({
          views: Number(data.views || 0),
          likes: Number(data.likes || 0),
          comments: Number(data.comments || 0),
          shares: Number(data.shares || 0),
          saves: Number(data.saves || 0),
          reach: Number(data.reach || 0),
        });
      } else {
        setMetricId(null);
        form.reset({
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          reach: 0,
        });
      }
      setLoadingMetrics(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, post?.id, form]);

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Update Performance</DialogTitle>
        </DialogHeader>
        {loadingMetrics ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
          </div>
        ) : (
          <Form {...form}>
            <form
              id="update-performance-form"
              onSubmit={form.handleSubmit(async (values) => {
                setSaving(true);
                try {
                  const { impressions, engagement_rate } =
                    computeEngagementFields(values);
                  const payload = {
                    content_post_id: post.id,
                    kol_profile_id: post.kol_profile_id,
                    organization_id: post.organization_id,
                    views: values.views,
                    likes: values.likes,
                    comments: values.comments,
                    shares: values.shares,
                    saves: values.saves,
                    reach: values.reach,
                    impressions,
                    engagement_rate,
                    recorded_at: new Date().toISOString(),
                  };

                  if (metricId) {
                    const { error } = await supabase
                      .from("kol_performance_metrics")
                      .update(payload)
                      .eq("id", metricId);
                    if (error) throw error;
                  } else {
                    const { error } = await supabase
                      .from("kol_performance_metrics")
                      .insert(payload);
                    if (error) throw error;
                  }

                  await onSaved();
                  onOpenChange(false);
                  toast({
                    title: "Performance updated",
                    description: `Engagement rate: ${engagement_rate}%`,
                  });
                } catch (err: unknown) {
                  const message =
                    err instanceof Error ? err.message : "Gagal menyimpan metrics";
                  toast({
                    title: "Update gagal",
                    description: message,
                    variant: "destructive",
                  });
                } finally {
                  setSaving(false);
                }
              })}
              className="grid grid-cols-2 gap-3"
            >
              {(["views", "likes", "comments", "shares", "saves", "reach"] as const).map(
                (key) => (
                  <FormField
                    key={key}
                    control={form.control}
                    name={key}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="capitalize">{key}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value || 0))
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ),
              )}
              <p className="col-span-2 text-xs text-muted-foreground">
                Engagement rate dihitung otomatis dari (likes + comments + shares) /
                views (atau reach jika views 0).
              </p>
            </form>
          </Form>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="update-performance-form"
            disabled={loadingMetrics || saving}
            className="bg-brand-blue text-white hover:bg-brand-blue/90"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
