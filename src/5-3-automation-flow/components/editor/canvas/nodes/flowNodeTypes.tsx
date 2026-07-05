import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { Play, GitBranch, Clock, MessageCircle, UserCog, Globe, AlertTriangle, UserPlus, Zap, Flag, CornerUpLeft } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { CANVAS_NODE_HEIGHT, CANVAS_NODE_WIDTH } from "@/5-3-automation-flow/components/editor/canvas/nodes/canvasNodeDimensions";
import { FlowNodeHeader } from "@/5-3-automation-flow/components/editor/canvas/nodes/FlowNodeHeader";
import { ListMessageNodePreview } from "@/5-3-automation-flow/components/editor/canvas/nodes/ListMessageNodePreview";
import { MessageBodyPreview } from "@/5-3-automation-flow/components/editor/canvas/nodes/MessageBodyPreview";
import { QuickReplyNodePreview } from "@/5-3-automation-flow/components/editor/canvas/nodes/QuickReplyNodePreview";
import {
  getInteractiveBranchHandles,
  isInteractiveBranching,
  LIST_BRANCH_OTHER_HANDLE,
  normalizeSendMessageData,
} from "@/5-3-automation-flow/lib/graph/sendMessageData";
import { normalizeEndNodeData } from "@/5-3-automation-flow/lib/graph/endNodeData";
import type { AutomationFlowEndMode, AutomationFlowNodeType } from "@/5-3-automation-flow/types/automationFlowGraph.types";

const NODE_META: Record<
  Exclude<AutomationFlowNodeType, "start" | "action_send_message">,
  { labelKey: string; icon: typeof Play; className: string }
> = {
  condition: { labelKey: "omnichannel.automationFlow.editor.nodeType.condition", icon: GitBranch, className: "border-amber-500" },
  action_wait_reply: { labelKey: "omnichannel.automationFlow.editor.nodeType.action_wait_reply", icon: MessageCircle, className: "border-violet-500" },
  action_update_contact: { labelKey: "omnichannel.automationFlow.editor.nodeType.action_update_contact", icon: UserCog, className: "border-teal-500" },
  action_assign_to: { labelKey: "omnichannel.automationFlow.editor.nodeType.action_assign_to", icon: UserPlus, className: "border-indigo-500" },
  action_http_request: { labelKey: "omnichannel.automationFlow.editor.nodeType.action_http_request", icon: Globe, className: "border-slate-500" },
  time_delay: { labelKey: "omnichannel.automationFlow.editor.nodeType.time_delay", icon: Clock, className: "border-orange-500" },
  end: { labelKey: "omnichannel.automationFlow.editor.nodeType.end", icon: Flag, className: "border-gray-400" },
};

type BlockMenuData = {
  hasStepsBelow?: boolean;
  onCopyBlock?: (nodeId: string) => void;
  onCopyBlockAndBelow?: (nodeId: string) => void;
  onDeleteBlock?: (nodeId: string) => void;
  onDeleteBelow?: (nodeId: string) => void;
  onNodeActivate?: (nodeId: string) => void;
};

function activateNodeBody(
  event: React.MouseEvent,
  nodeId: string,
  onNodeActivate?: (nodeId: string) => void,
) {
  event.stopPropagation();
  onNodeActivate?.(nodeId);
}

function getBlockMenuProps(id: string, data: Record<string, unknown>) {
  const d = data as BlockMenuData;
  return {
    nodeId: id,
    hasStepsBelow: Boolean(d.hasStepsBelow),
    onCopyBlock: d.onCopyBlock,
    onCopyBlockAndBelow: d.onCopyBlockAndBelow,
    onDeleteBlock: d.onDeleteBlock,
    onDeleteBelow: d.onDeleteBelow,
  };
}

function StartPointNode({ id, data, selected }: NodeProps) {
  const phoneNumberIds = (data as { phoneNumberIds?: string[] }).phoneNumberIds ?? [];
  const hasWarning = phoneNumberIds.length === 0;
  const onNodeActivate = (data as { onNodeActivate?: (nodeId: string) => void }).onNodeActivate;

  return (
    <div className="relative" style={{ width: CANVAS_NODE_WIDTH }}>
      {hasWarning ? (
        <div className="absolute -left-6 top-2 text-red-500" title="Configuration required">
          <AlertTriangle className="h-4 w-4 fill-red-500 text-white" aria-hidden />
        </div>
      ) : null}
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-blue-700/20 bg-white shadow-md",
          selected && "ring-2 ring-primary ring-offset-2",
        )}
        style={{ width: CANVAS_NODE_WIDTH, height: CANVAS_NODE_HEIGHT.start }}
      >
        <div className="flex items-center gap-2 bg-blue-600 px-3 py-2 text-white">
          <Play className="h-4 w-4 shrink-0 fill-white" />
          <span className="text-sm font-semibold">Start point</span>
        </div>
        <div
          role="button"
          tabIndex={0}
          className="cursor-pointer bg-muted/30 px-3 py-3 text-xs leading-relaxed text-muted-foreground hover:bg-muted/50"
          onClick={(event) => activateNodeBody(event, id, onNodeActivate)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onNodeActivate?.(id);
            }
          }}
        >
          Triggered by <span className="font-semibold text-foreground">Incoming messages</span> via{" "}
          <span className="font-semibold text-foreground">Whatsapp</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !border-blue-600 !bg-white" />
    </div>
  );
}

function SendMessageNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const sendData = normalizeSendMessageData(data as Record<string, unknown>);
  const branching = isInteractiveBranching(sendData);
  const branchHandles = branching ? getInteractiveBranchHandles(sendData) : [];
  const onNodeActivate = (data as { onNodeActivate?: (nodeId: string) => void }).onNodeActivate;
  const menuProps = getBlockMenuProps(id, data as Record<string, unknown>);
  const actionNumber = Number((data as { actionNumber?: number }).actionNumber ?? 1);

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-lg border-2 border-blue-500 bg-white shadow-sm",
        selected && "ring-2 ring-primary ring-offset-2",
      )}
      style={{ width: CANVAS_NODE_WIDTH, height: CANVAS_NODE_HEIGHT.action_send_message }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-muted-foreground" />
      <FlowNodeHeader
        {...menuProps}
        title={t("omnichannel.automationFlow.editor.canvas.actionLabel", {
          number: actionNumber,
          defaultValue: "Action {{number}}",
        })}
        icon={<Zap className="h-4 w-4 shrink-0 fill-white text-white" />}
      />
      <div
        role="button"
        tabIndex={0}
        className="flex min-h-0 flex-1 cursor-pointer flex-col hover:bg-muted/30"
        onClick={(event) => activateNodeBody(event, id, onNodeActivate)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onNodeActivate?.(id);
          }
        }}
      >
        <div className="flex-shrink-0 border-b border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">
            {t("omnichannel.automationFlow.editor.canvas.sendMessageType", "Send Message")}
          </span>{" "}
          {t("omnichannel.automationFlow.editor.canvas.via", "via")}{" "}
          <span className="font-semibold text-foreground">
            {t("omnichannel.automationFlow.editor.incomingChannel", "Incoming channel")}
          </span>
        </div>
        <div className="min-h-0 flex-1 px-3 py-2">
          {sendData.buttonType === "list_message" ? (
            <ListMessageNodePreview
              body={sendData.body}
              listButtonText={sendData.listButtonText ?? ""}
            />
          ) : sendData.buttonType === "quick_reply" ? (
            <QuickReplyNodePreview body={sendData.body} options={sendData.listOptions ?? []} />
          ) : (
            <MessageBodyPreview body={sendData.body} />
          )}
        </div>
      </div>

      {branching ? (
        <>
          {branchHandles.map((handleId) => (
            <Handle
              key={handleId}
              id={handleId}
              type="source"
              position={Position.Bottom}
              style={{ left: "50%" }}
              className="!h-2 !w-2 !bg-blue-600"
            />
          ))}
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-muted-foreground" />
      )}
    </div>
  );
}

function EndFlowNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const meta = NODE_META.end;
  const endData = normalizeEndNodeData(data as Record<string, unknown>);
  const mode = endData.mode ?? "flow_end";
  const jumpTargetLabel = String((data as { jumpTargetLabel?: string }).jumpTargetLabel ?? "").trim();
  const onNodeActivate = (data as { onNodeActivate?: (nodeId: string) => void }).onNodeActivate;
  const onEndPatch = (data as { onEndPatch?: (nodeId: string, patch: Record<string, unknown>) => void }).onEndPatch;

  const setMode = (nextMode: AutomationFlowEndMode, event: React.MouseEvent) => {
    event.stopPropagation();
    onNodeActivate?.(id);
    onEndPatch?.(id, { mode: nextMode });
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border-2 bg-white shadow-sm",
        meta.className,
        selected && "ring-2 ring-primary ring-offset-2",
      )}
      style={{ width: CANVAS_NODE_WIDTH, height: CANVAS_NODE_HEIGHT.end }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-muted-foreground" />
      <div className="flex shrink-0 border-b border-gray-600">
        <button
          type="button"
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold text-white transition-colors",
            mode === "flow_end" ? "bg-gray-700" : "bg-gray-500/80 hover:bg-gray-600",
          )}
          onClick={(event) => setMode("flow_end", event)}
        >
          <Flag className="h-3.5 w-3.5 shrink-0" />
          {t("omnichannel.automationFlow.editor.endMode.flowEnd", "Flow end")}
        </button>
        <div className="w-px shrink-0 bg-gray-600" aria-hidden />
        <button
          type="button"
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold text-white transition-colors",
            mode === "jump_to" ? "bg-gray-700" : "bg-gray-500/80 hover:bg-gray-600",
          )}
          onClick={(event) => setMode("jump_to", event)}
        >
          <CornerUpLeft className="h-3.5 w-3.5 shrink-0" />
          {t("omnichannel.automationFlow.editor.endMode.jumpTo", "Jump to")}
        </button>
      </div>
      <div
        role="button"
        tabIndex={0}
        className="flex min-h-0 flex-1 cursor-pointer items-start px-3 py-2.5 text-xs leading-relaxed text-muted-foreground hover:bg-muted/30"
        onClick={(event) => activateNodeBody(event, id, onNodeActivate)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onNodeActivate?.(id);
          }
        }}
      >
        {mode === "jump_to" ? (
          jumpTargetLabel ? (
            <span>
              {t("omnichannel.automationFlow.editor.endMode.targetPreview", "Jump to")}{" "}
              <span className="font-semibold text-foreground">{jumpTargetLabel}</span>
            </span>
          ) : (
            t(
              "omnichannel.automationFlow.editor.endMode.jumpToHint",
              "The flow can jump to another node if available, otherwise it will end here",
            )
          )
        ) : (
          t(
            "omnichannel.automationFlow.editor.endMode.flowEndHint",
            "The flow will end when it reaches this node",
          )
        )}
      </div>
    </div>
  );
}

function BaseFlowNode({
  id,
  data,
  type,
  selected,
}: NodeProps & { type: Exclude<AutomationFlowNodeType, "start" | "action_send_message" | "end"> }) {
  const { t } = useTranslation();
  const meta = NODE_META[type];
  const Icon = meta.icon;
  const subtitle = String((data as { subtitle?: string }).subtitle ?? "");
  const onNodeActivate = (data as { onNodeActivate?: (nodeId: string) => void }).onNodeActivate;
  const menuProps = getBlockMenuProps(id, data as Record<string, unknown>);

  return (
    <div
      className={cn(
        "min-w-[220px] overflow-hidden rounded-lg border-2 bg-white shadow-sm",
        meta.className,
        selected && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-muted-foreground" />
      <FlowNodeHeader
        {...menuProps}
        title={t(meta.labelKey)}
        icon={<Icon className="h-4 w-4 shrink-0 text-white" />}
      />
      {subtitle ? (
        <div className="bg-muted/20 px-3 py-2">
          <div
            role="button"
            tabIndex={0}
            className="cursor-pointer rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60"
            onClick={(event) => activateNodeBody(event, id, onNodeActivate)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onNodeActivate?.(id);
              }
            }}
          >
            {subtitle}
          </div>
        </div>
      ) : null}
      {type === "condition" ? (
        <>
          <Handle id="yes" type="source" position={Position.Bottom} style={{ left: "30%" }} className="!h-2 !w-2 !bg-emerald-600" />
          <Handle id="no" type="source" position={Position.Bottom} style={{ left: "70%" }} className="!h-2 !w-2 !bg-red-500" />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-muted-foreground" />
      )}
    </div>
  );
}

export const flowNodeTypes = {
  start: memo((props: NodeProps) => <StartPointNode {...props} />),
  condition: memo((props: NodeProps) => <BaseFlowNode {...props} type="condition" />),
  action_send_message: memo((props: NodeProps) => <SendMessageNode {...props} />),
  action_wait_reply: memo((props: NodeProps) => <BaseFlowNode {...props} type="action_wait_reply" />),
  action_update_contact: memo((props: NodeProps) => <BaseFlowNode {...props} type="action_update_contact" />),
  action_assign_to: memo((props: NodeProps) => <BaseFlowNode {...props} type="action_assign_to" />),
  action_http_request: memo((props: NodeProps) => <BaseFlowNode {...props} type="action_http_request" />),
  time_delay: memo((props: NodeProps) => <BaseFlowNode {...props} type="time_delay" />),
  end: memo((props: NodeProps) => <EndFlowNode {...props} />),
};

export function nodeSubtitle(type: AutomationFlowNodeType, data: Record<string, unknown>): string {
  if (type === "action_send_message") {
    const sendData = normalizeSendMessageData(data);
    if (sendData.buttonType === "list_message") {
      const count = sendData.listOptions?.length ?? 0;
      const branch = sendData.buttonAsBranch ? " · Branching" : "";
      return count ? `List · ${count} option(s)${branch}` : "Configure list message";
    }
    if (sendData.buttonType === "quick_reply") {
      const count = sendData.listOptions?.length ?? 0;
      const branch = sendData.buttonAsBranch ? " · Branching" : "";
      return count ? `Quick reply · ${count} button(s)${branch}` : "Configure quick reply";
    }
    const body = String(data.body ?? "").trim();
    return body ? body.slice(0, 40) : "Configure message";
  }
  if (type === "time_delay") {
    const duration = data.duration;
    const unit = data.unit ?? "minutes";
    return duration ? `${duration} ${unit}` : "Set delay";
  }
  if (type === "condition") {
    const rules = (data.rules as unknown[]) ?? [];
    return rules.length ? `${rules.length} rule(s)` : "Add rules";
  }
  if (type === "start") {
    const ids = (data.phoneNumberIds as string[]) ?? [];
    return ids.length ? `${ids.length} account(s)` : "Select WhatsApp account";
  }
  if (type === "action_wait_reply") return "Capture customer reply";
  if (type === "action_update_contact") return "Update lead fields";
  if (type === "action_assign_to") {
    const mode = String(data.assignMode ?? "specific_user");
    if (mode === "unassigned") return "Unassigned";
    if (mode === "specific_team") return "Specific team";
    return "Specific user";
  }
  if (type === "action_http_request") {
    const url = String(data.url ?? "").trim();
    return url || "External webhook";
  }
  return "";
}

export type BranchEdgeLabelParts = {
  prefix: string;
  highlight?: string;
};

export function getBranchEdgeLabelParts(
  sourceHandle: string | null | undefined,
  sendNodeData: Record<string, unknown>,
): BranchEdgeLabelParts | null {
  if (!sourceHandle?.startsWith("option:")) return null;
  if (sourceHandle === LIST_BRANCH_OTHER_HANDLE) {
    return { prefix: "If answered ", highlight: "Other answers" };
  }
  const sendData = normalizeSendMessageData(sendNodeData);
  const optionId = sourceHandle.replace("option:", "");
  const option = sendData.listOptions?.find((opt) => opt.id === optionId);
  const optionTitle = option?.title?.trim();
  if (optionTitle) {
    return { prefix: "If answered ", highlight: optionTitle };
  }
  return { prefix: "If answered" };
}

export function getBranchEdgeLabel(
  sourceHandle: string | null | undefined,
  sendNodeData: Record<string, unknown>,
): string {
  const parts = getBranchEdgeLabelParts(sourceHandle, sendNodeData);
  if (!parts) return "";
  return parts.highlight ? `${parts.prefix}${parts.highlight}` : parts.prefix;
}
