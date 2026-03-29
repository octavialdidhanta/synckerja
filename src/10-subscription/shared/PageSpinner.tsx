import { Loader2 } from "lucide-react";

export function PageSpinner() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
    </div>
  );
}
