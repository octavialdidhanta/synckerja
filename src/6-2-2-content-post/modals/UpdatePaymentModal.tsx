import { useForm } from "react-hook-form";
import { supabase } from "@/shared/lib/supabaseClient";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";

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
  const form = useForm({
    values: {
      amount: Number(milestone?.amount || 0),
      status: String(milestone?.status || "pending"),
      invoice_file_path: String(milestone?.invoice_file_path || ""),
    },
  });
  if (!milestone) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Update Payment Milestone</DialogTitle></DialogHeader>
        <Form {...form}>
          <form
            id="payment-form"
            onSubmit={form.handleSubmit(async (values) => {
              await supabase
                .from("payment_milestones")
                .update({
                  amount: values.amount,
                  status: values.status,
                  invoice_file_path: values.invoice_file_path || null,
                  invoice_uploaded: Boolean(values.invoice_file_path),
                })
                .eq("id", milestone.id);
              await onSaved();
              onOpenChange(false);
            })}
            className="space-y-3"
          >
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" value={field.value} onChange={(e) => field.onChange(Number(e.target.value || 0))} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem><FormLabel>Status</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="invoice_file_path" render={({ field }) => (
              <FormItem><FormLabel>Invoice Path</FormLabel><FormControl><Input {...field} placeholder="storage path (optional)" /></FormControl></FormItem>
            )} />
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="payment-form" className="bg-brand-blue text-white hover:bg-brand-blue/90">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
