import { useForm } from "react-hook-form";
import { supabase } from "@/shared/lib/supabaseClient";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";

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
  const form = useForm({ defaultValues: { conversion_type: "purchase", conversion_value: 0 } });
  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Record Conversion</DialogTitle></DialogHeader>
        <Form {...form}>
          <form
            id="conversion-form"
            onSubmit={form.handleSubmit(async (values) => {
              await supabase.from("kol_conversions").insert({
                content_post_id: post.id,
                kol_profile_id: post.kol_profile_id,
                organization_id: post.organization_id,
                conversion_type: values.conversion_type,
                conversion_value: values.conversion_value,
              });
              await onSaved();
              onOpenChange(false);
            })}
            className="space-y-3"
          >
            <FormField control={form.control} name="conversion_type" render={({ field }) => (
              <FormItem><FormLabel>Type</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="conversion_value" render={({ field }) => (
              <FormItem><FormLabel>Value</FormLabel><FormControl><Input type="number" value={field.value} onChange={(e) => field.onChange(Number(e.target.value || 0))} /></FormControl></FormItem>
            )} />
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="conversion-form" className="bg-brand-blue text-white hover:bg-brand-blue/90">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
