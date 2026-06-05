import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useToast } from "@/shared/components/ui/use-toast";
import { useState } from "react";

const MILESTONE_STATUSES = ["pending", "paid", "overdue", "cancelled"] as const;

export const UpdatePaymentModal = ({
  open,
  onOpenChange,
  milestone,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: any;
  onSaved: () => Promise<void>;
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const form = useForm({
    values: {
      amount: Number(milestone?.amount || 0),
      status: String(milestone?.status || "pending"),
      invoice_file_path: String(milestone?.invoice_file_path || ""),
    },
  });

  if (!milestone) return null;

  const milestoneLabel =
    milestone.milestone_name ||
    (milestone.milestone_order ? `Milestone ${milestone.milestone_order}` : "Milestone");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Payment Milestone</DialogTitle>
          <p className="text-sm text-muted-foreground">{milestoneLabel}</p>
        </DialogHeader>
        <Form {...form}>
          <form
            id="payment-form"
            onSubmit={form.handleSubmit(async (values) => {
              setSaving(true);
              try {
                const { error } = await supabase
                  .from("payment_milestones")
                  .update({
                    amount: values.amount,
                    status: values.status,
                    invoice_file_path: values.invoice_file_path || null,
                    invoice_uploaded: Boolean(values.invoice_file_path),
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", milestone.id);

                if (error) throw error;

                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ["kol-payment-terms"] }),
                  queryClient.invalidateQueries({ queryKey: ["kol-content-milestones"] }),
                  queryClient.invalidateQueries({ queryKey: ["payment-milestones"] }),
                  queryClient.invalidateQueries({ queryKey: ["campaign-performance-metrics"] }),
                  queryClient.invalidateQueries({ queryKey: ["kol-content-performance"] }),
                ]);
                await onSaved();
                onOpenChange(false);
                toast({
                  title: "Milestone updated",
                  description: `${milestoneLabel} → ${values.status}`,
                });
              } catch (err: unknown) {
                const message =
                  err instanceof Error ? err.message : "Gagal update milestone";
                toast({
                  title: "Update gagal",
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (Rp)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value || 0))}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MILESTONE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Set ke <strong>paid</strong> akan sinkron ke agreement (partial_paid / paid)
                    dan memperbarui actual_payout.
                  </p>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="invoice_file_path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Path</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="storage path (optional)" />
                  </FormControl>
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
            form="payment-form"
            disabled={saving}
            className="bg-brand-blue text-white hover:bg-brand-blue/90"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
