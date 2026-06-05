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

type ConversionFormValues = {
  conversion_type: string;
  conversion_value: number;
};

export const ConversionTrackingModal = ({
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
  const [saving, setSaving] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summary, setSummary] = useState({ count: 0, value: 0 });

  const form = useForm<ConversionFormValues>({
    defaultValues: { conversion_type: "purchase", conversion_value: 0 },
  });

  useEffect(() => {
    if (!open || !post?.id) return;

    let cancelled = false;
    setLoadingSummary(true);
    form.reset({ conversion_type: "purchase", conversion_value: 0 });

    (async () => {
      const { data, error } = await supabase
        .from("kol_conversions")
        .select("conversion_value")
        .eq("content_post_id", post.id);

      if (cancelled) return;

      if (error) {
        console.error("Failed to load conversions:", error);
        setSummary({ count: 0, value: 0 });
      } else {
        const rows = data || [];
        setSummary({
          count: rows.length,
          value: rows.reduce(
            (sum, row) => sum + Number(row.conversion_value || 0),
            0,
          ),
        });
      }
      setLoadingSummary(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, post?.id, form]);

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Conversion</DialogTitle>
        </DialogHeader>

        {loadingSummary ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-brand-blue" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Saat ini: <strong>{summary.count}</strong> konversi · Total nilai{" "}
            <strong>Rp {Math.round(summary.value).toLocaleString("id-ID")}</strong>
          </p>
        )}

        <Form {...form}>
          <form
            id="conversion-form"
            onSubmit={form.handleSubmit(async (values) => {
              if (!values.conversion_type.trim()) {
                toast({
                  title: "Type wajib diisi",
                  variant: "destructive",
                });
                return;
              }

              setSaving(true);
              try {
                const { error } = await supabase.from("kol_conversions").insert({
                  content_post_id: post.id,
                  kol_profile_id: post.kol_profile_id,
                  organization_id: post.organization_id,
                  conversion_type: values.conversion_type.trim(),
                  conversion_value: values.conversion_value,
                });
                if (error) throw error;

                await onSaved();
                onOpenChange(false);
                toast({
                  title: "Conversion recorded",
                  description: `${values.conversion_type} · Rp ${Math.round(values.conversion_value).toLocaleString("id-ID")}`,
                });
              } catch (err: unknown) {
                const message =
                  err instanceof Error ? err.message : "Gagal menyimpan konversi";
                toast({
                  title: "Record gagal",
                  description: message,
                  variant: "destructive",
                });
              } finally {
                setSaving(false);
              }
            })}
            className="space-y-3"
          >
            <FormField
              control={form.control}
              name="conversion_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="purchase, signup, lead..." />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="conversion_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value (Rp)</FormLabel>
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
                  <p className="text-xs text-muted-foreground">
                    Threshold konversi dihitung dari <strong>jumlah baris</strong>, bukan
                    total nilai Rp.
                  </p>
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="conversion-form"
            disabled={saving || loadingSummary}
            className="bg-brand-blue text-white hover:bg-brand-blue/90"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
