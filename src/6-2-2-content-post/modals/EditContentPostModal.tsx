import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";

export const EditContentPostModal = ({
  open,
  onOpenChange,
  post,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: any;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) => {
  const form = useForm({
    values: {
      title: post?.title || "",
      caption: post?.caption || "",
      post_url: post?.post_url || "",
      status: post?.status || "draft",
    },
  });

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Content Post</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            id="edit-post-form"
            onSubmit={form.handleSubmit(async (values) => {
              await onSubmit(values);
              onOpenChange(false);
            })}
            className="space-y-3"
          >
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="caption" render={({ field }) => (
              <FormItem><FormLabel>Caption</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="post_url" render={({ field }) => (
              <FormItem><FormLabel>Post URL</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="edit-post-form" className="bg-brand-blue text-white hover:bg-brand-blue/90">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
