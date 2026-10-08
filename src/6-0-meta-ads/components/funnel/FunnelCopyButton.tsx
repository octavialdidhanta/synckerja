import { useState, type RefObject } from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { copyElementAsPng } from "@/meta-ads/metrics/copyElementAsPng";
import { cn } from "@/shared/lib/utils";

export function FunnelCopyButton({
  targetRef,
  disabled,
  className,
}: {
  targetRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useAppTranslation();
  const [copying, setCopying] = useState(false);
  const label = t("digitalMarketing.metaAds.funnelCopyImage", "Copy image");

  const copy = () => {
    const node = targetRef.current;
    if (!node || copying) return;
    setCopying(true);
    void copyElementAsPng(node)
      .then(() => {
        toast.success(
          t("digitalMarketing.metaAds.funnelCopyImageDone", "Image copied. Paste it into WhatsApp."),
        );
      })
      .catch(() => {
        toast.error(t("digitalMarketing.metaAds.funnelCopyImageFailed", "Could not copy the image."));
      })
      .finally(() => setCopying(false));
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-copy-exclude=""
      aria-label={label}
      title={label}
      className={cn("h-7 w-7 shrink-0 bg-white p-0", className)}
      disabled={disabled || copying}
      onClick={copy}
    >
      {copying ? <Loader2 className="h-3.5 w-3.5 animate-spin will-change-transform" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}
