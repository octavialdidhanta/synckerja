import { useTranslation } from "react-i18next";
import { SEND_MESSAGE_BODY_HEIGHT_PX } from "@/5-3-automation-flow/components/editor/canvas/nodes/canvasNodeDimensions";

type MessageBodyPreviewProps = {
  body: string;
  className?: string;
};

export function MessageBodyPreview({ body, className }: MessageBodyPreviewProps) {
  const { t } = useTranslation();
  const preview = body.trim();

  return (
    <div
      className={
        className ??
        "scrollbar-hide overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-white px-3 py-2 text-xs leading-relaxed text-muted-foreground [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      }
      style={{ height: SEND_MESSAGE_BODY_HEIGHT_PX }}
    >
      {preview || t("omnichannel.automationFlow.editor.sendMessage.configureHint", "Configure message")}
    </div>
  );
}
