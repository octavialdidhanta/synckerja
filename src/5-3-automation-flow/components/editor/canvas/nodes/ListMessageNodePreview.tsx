import { List } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SEND_MESSAGE_BODY_HEIGHT_PX } from "@/5-3-automation-flow/components/editor/canvas/nodes/canvasNodeDimensions";

type ListMessageNodePreviewProps = {
  body: string;
  listButtonText: string;
};

export function ListMessageNodePreview({ body, listButtonText }: ListMessageNodePreviewProps) {
  const { t } = useTranslation();
  const messagePreview = body.trim();

  return (
    <div role="presentation" className="overflow-hidden rounded-md border border-border bg-white">
      <div
        className="scrollbar-hide overflow-y-auto whitespace-pre-wrap px-3 py-2 text-xs leading-relaxed text-muted-foreground [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ height: SEND_MESSAGE_BODY_HEIGHT_PX }}
      >
        {messagePreview || t("omnichannel.automationFlow.editor.sendMessage.configureHint", "Configure message")}
      </div>
      <div className="flex h-9 items-center justify-center gap-1.5 border-t border-border bg-muted/20 px-3">
        <List className="h-3.5 w-3.5 shrink-0 text-blue-600" />
        <span className="text-center text-xs font-medium text-blue-700">
          {listButtonText.trim() || t("omnichannel.automationFlow.editor.listButtonTextPlaceholder")}
        </span>
      </div>
    </div>
  );
}
