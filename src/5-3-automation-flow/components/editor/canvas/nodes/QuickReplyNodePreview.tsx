import { useTranslation } from "react-i18next";
import { SEND_MESSAGE_BODY_HEIGHT_PX } from "@/5-3-automation-flow/components/editor/canvas/nodes/canvasNodeDimensions";
import type { ListMessageOption } from "@/5-3-automation-flow/types/automationFlowGraph.types";

type QuickReplyNodePreviewProps = {
  body: string;
  options: ListMessageOption[];
};

export function QuickReplyNodePreview({ body, options }: QuickReplyNodePreviewProps) {
  const { t } = useTranslation();
  const messagePreview = body.trim();
  const visibleOptions = options.filter((opt) => opt.title.trim()).slice(0, 3);

  return (
    <div role="presentation" className="overflow-hidden rounded-md border border-border bg-white">
      <div
        className="scrollbar-hide overflow-y-auto whitespace-pre-wrap px-3 py-2 text-xs leading-relaxed text-muted-foreground [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ height: SEND_MESSAGE_BODY_HEIGHT_PX - 28 }}
      >
        {messagePreview || t("omnichannel.automationFlow.editor.sendMessage.configureHint", "Configure message")}
      </div>
      {visibleOptions.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-1 border-t border-border bg-muted/20 px-2 py-1.5">
          {visibleOptions.map((opt) => (
            <span
              key={opt.id}
              className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-medium text-blue-700"
            >
              {opt.title}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
