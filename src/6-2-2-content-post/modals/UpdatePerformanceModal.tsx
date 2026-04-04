import { useForm } from "react-hook-form";
import { supabase } from "@/shared/lib/supabaseClient";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";

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
  const form = useForm({
    defaultValues: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0 },
  });

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Update Performance</DialogTitle></DialogHeader>
        <Form {...form}>
          <form
            id="update-performance-form"
            onSubmit={form.handleSubmit(async (values) => {
              await supabase.from("kol_performance_metrics").upsert({
                content_post_id: post.id,
                kol_profile_id: post.kol_profile_id,
                organization_id: post.organization_id,
                ...values,
              });
              await onSaved();
              onOpenChange(false);
            })}
            className="grid grid-cols-2 gap-3"
          >
            {["views", "likes", "comments", "shares", "saves", "reach"].map((key) => (
              <FormField
                key={key}
                control={form.control}
                name={key as any}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="capitalize">{key}</FormLabel>
                    <FormControl><Input type="number" value={field.value} onChange={(e) => field.onChange(Number(e.target.value || 0))} /></FormControl>
                  </FormItem>
                )}
              />
            ))}
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="update-performance-form" className="bg-brand-blue text-white hover:bg-brand-blue/90">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
