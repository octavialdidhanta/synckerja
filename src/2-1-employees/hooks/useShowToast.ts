
import { useToast } from "./use-toast";
import React from "react";

/**
 * Returns a showToast helper that can be used for success/error/info.
 */
export function useShowToast() {
  const { toast } = useToast();
  return React.useCallback(
    ({
      title,
      description,
      variant = "default",
    }: {
      title: string;
      description: React.ReactNode;
      variant?: "default" | "destructive" | "warning" | "info";
    }) => {
      // Toast UI has no "warning"/"info" style; they render as the default toast.
      toast({ title, description, variant: variant === "destructive" ? "destructive" : "default" });
    },
    [toast]
  );
}
