
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
      toast({ title, description, variant });
    },
    [toast]
  );
}
