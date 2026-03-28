import { toast } from "@/shared/hooks/use-toast";

export function showErrorToast(opts: { title: string; message: string }) {
  toast({
    title: opts.title,
    description: opts.message,
    variant: "destructive",
  });
}

export function showSuccessToast(opts: { title: string; message: string }) {
  toast({
    title: opts.title,
    description: opts.message,
  });
}
