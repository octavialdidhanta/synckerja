import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { useWhatsAppAccounts } from "@/5-3-whatsapp/hooks/useWhatsAppAccounts";
import { FlowCanvas } from "@/5-3-automation-flow/components/editor/canvas/FlowCanvas";
import { NodeInspectorPanel } from "@/5-3-automation-flow/components/editor/panels/NodeInspectorPanel";
import { insertNodeBetween, insertNodeOnBranch } from "@/5-3-automation-flow/lib/graph/insertNodeBetween";
import {
  copyBlock,
  copyBlockAndBelow,
  deleteBlock,
  deleteBlocksBelow,
} from "@/5-3-automation-flow/lib/graph/graphBlockMutations";
import { prepareAutomationFlowGraph } from "@/5-3-automation-flow/lib/graph/prepareAutomationFlowGraph";
import { applySendMessagePatch } from "@/5-3-automation-flow/lib/graph/syncListBranchEdges";
import { mergeEndNodePatch } from "@/5-3-automation-flow/lib/graph/endNodeData";
import { parseAutomationFlowGraph } from "@/5-3-automation-flow/lib/graph/serializeGraph";
import { validateAutomationFlowGraph } from "@/5-3-automation-flow/lib/graph/validateGraph";
import {
  usePublishAutomationFlow,
  useSaveAutomationFlowGraph,
  useUpdateAutomationFlowMeta,
} from "@/5-3-automation-flow/hooks/useAutomationFlow";
import { useCanPublishAutomationFlow } from "@/5-3-automation-flow/hooks/useCanPublishAutomationFlow";
import { FLOW_BUILDER_LISTING_PATH } from "@/5-3-dashboard/omnichannel-settings/constants/flowBuilderPaths";
import type { AutomationFlowGraph, AutomationFlowNodeType } from "@/5-3-automation-flow/types/automationFlowGraph.types";
import type { AutomationFlowRecord } from "@/5-3-automation-flow/types/automationFlowRecord.types";

type AutomationFlowEditorShellProps = {
  flow: AutomationFlowRecord;
};

export function AutomationFlowEditorShell({ flow }: AutomationFlowEditorShellProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [graph, setGraph] = useState<AutomationFlowGraph>(() =>
    prepareAutomationFlowGraph(parseAutomationFlowGraph(flow.graph_json)),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("start-1");
  const [flowName, setFlowName] = useState(flow.name);
  const saveGraph = useSaveAutomationFlowGraph(flow.id);
  const publishFlow = usePublishAutomationFlow(flow.id);
  const updateMeta = useUpdateAutomationFlowMeta(flow.id);
  const { canPublish } = useCanPublishAutomationFlow();

  const {
    accounts: rawWhatsAppAccounts,
    isLoading: whatsAppAccountsLoading,
    error: whatsAppAccountsError,
  } = useWhatsAppAccounts();

  const whatsAppAccounts = useMemo(
    () =>
      rawWhatsAppAccounts
        .filter((a) => a.is_active !== false)
        .map((a) => ({
          phone_number_id: a.phone_number_id,
          display_name:
            a.whatsapp_business_name?.trim() ||
            a.display_phone_number?.trim() ||
            a.phone_number_id,
        })),
    [rawWhatsAppAccounts],
  );

  useEffect(() => {
    setGraph(prepareAutomationFlowGraph(parseAutomationFlowGraph(flow.graph_json)));
    setFlowName(flow.name);
    setSelectedNodeId("start-1");
  }, [flow.id, flow.graph_json, flow.name]);

  const validationIssues = useMemo(() => validateAutomationFlowGraph(graph), [graph]);

  const handleSave = useCallback(async () => {
    try {
      if (flowName.trim() !== flow.name) {
        await updateMeta.mutateAsync({ name: flowName.trim() });
      }
      await saveGraph.mutateAsync(graph);
      toast.success(t("omnichannel.automationFlow.editor.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("omnichannel.automationFlow.editor.saveFailed"));
    }
  }, [flow.name, flowName, graph, saveGraph, t, updateMeta]);

  const handlePublish = async () => {
    if (!canPublish) {
      toast.error(t("omnichannel.automationFlow.editor.publishForbidden"));
      return;
    }
    if (validationIssues.length > 0) {
      toast.error(t("omnichannel.automationFlow.editor.publishInvalid"));
      return;
    }
    try {
      await handleSave();
      await publishFlow.mutateAsync();
      toast.success(t("omnichannel.automationFlow.editor.published"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("omnichannel.automationFlow.editor.publishFailed"));
    }
  };

  const handleInsertBetween = useCallback(
    (sourceId: string, targetId: string, nodeType: AutomationFlowNodeType) => {
      let newNodeId = "";
      setGraph((prev) => {
        const result = insertNodeBetween(prev, sourceId, targetId, nodeType);
        newNodeId = result.newNodeId;
        return result.graph;
      });
      setSelectedNodeId(newNodeId);
    },
    [],
  );

  const handleInsertOnBranch = useCallback(
    (sourceId: string, sourceHandle: string, nodeType: AutomationFlowNodeType) => {
      let newNodeId = "";
      setGraph((prev) => {
        const result = insertNodeOnBranch(prev, sourceId, sourceHandle, nodeType);
        newNodeId = result.newNodeId;
        return result.graph;
      });
      setSelectedNodeId(newNodeId);
    },
    [],
  );

  const handleCopyBlock = useCallback(
    (nodeId: string) => {
      try {
        let newNodeId = "";
        setGraph((prev) => {
          const result = copyBlock(prev, nodeId);
          newNodeId = result.newNodeId;
          return result.graph;
        });
        setSelectedNodeId(newNodeId);
        toast.success(t("omnichannel.automationFlow.editor.blockMenu.copySuccess"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("omnichannel.automationFlow.editor.blockMenu.cannotDeleteStartEnd"),
        );
      }
    },
    [t],
  );

  const handleCopyBlockAndBelow = useCallback(
    (nodeId: string) => {
      try {
        let newRootNodeId = "";
        setGraph((prev) => {
          const result = copyBlockAndBelow(prev, nodeId);
          newRootNodeId = result.newRootNodeId;
          return result.graph;
        });
        setSelectedNodeId(newRootNodeId);
        toast.success(t("omnichannel.automationFlow.editor.blockMenu.copySuccess"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("omnichannel.automationFlow.editor.blockMenu.cannotDeleteStartEnd"),
        );
      }
    },
    [t],
  );

  const handleDeleteBlock = useCallback(
    (nodeId: string) => {
      try {
        setGraph((prev) => deleteBlock(prev, nodeId).graph);
        setSelectedNodeId(null);
        toast.success(t("omnichannel.automationFlow.editor.blockMenu.deleteSuccess"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("omnichannel.automationFlow.editor.blockMenu.cannotDeleteStartEnd"),
        );
      }
    },
    [t],
  );

  const handleDeleteBelow = useCallback(
    (nodeId: string) => {
      try {
        setGraph((prev) => deleteBlocksBelow(prev, nodeId).graph);
        setSelectedNodeId(nodeId);
        toast.success(t("omnichannel.automationFlow.editor.blockMenu.deleteSuccess"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("omnichannel.automationFlow.editor.blockMenu.nothingBelow"),
        );
      }
    },
    [t],
  );

  const handleUpdateNode = (nodeId: string, data: Record<string, unknown>) => {
    setGraph((prev) => {
      const node = prev.nodes.find((n) => n.id === nodeId);
      if (node?.type === "action_send_message") {
        return prepareAutomationFlowGraph(applySendMessagePatch(prev, nodeId, data));
      }
      if (node?.type === "end") {
        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: mergeEndNodePatch(n.data as Record<string, unknown>, data) as never }
              : n,
          ),
        };
      }
      return {
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, data: data as never } : n)),
      };
    });
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gray-100">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate(FLOW_BUILDER_LISTING_PATH)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <Input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="max-w-md border-none text-lg font-semibold shadow-none focus-visible:ring-0"
          />
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={flow.status === "active" ? "default" : "secondary"}>
              {flow.status}
            </Badge>
            <span className="text-xs text-muted-foreground">{t("omnichannel.automationFlow.editor.subtitle")}</span>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void handleSave()} disabled={saveGraph.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {t("omnichannel.automationFlow.editor.saveDraft")}
        </Button>
        <Button type="button" onClick={() => void handlePublish()} disabled={publishFlow.isPending}>
          {t("omnichannel.automationFlow.editor.publish")}
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-0">
        <div className="col-span-8 min-h-0 border-r border-border">
          <FlowCanvas
            graph={graph}
            selectedNodeId={selectedNodeId}
            onGraphChange={setGraph}
            onSelectNodeId={setSelectedNodeId}
            onInsertBetween={handleInsertBetween}
            onInsertOnBranch={handleInsertOnBranch}
            onCopyBlock={handleCopyBlock}
            onCopyBlockAndBelow={handleCopyBlockAndBelow}
            onDeleteBlock={handleDeleteBlock}
            onDeleteBelow={handleDeleteBelow}
            onUpdateNode={handleUpdateNode}
          />
        </div>
        <div className="col-span-4 min-h-0 overflow-y-auto bg-muted/20 p-4">
          <NodeInspectorPanel
            graph={graph}
            selectedNodeId={selectedNodeId}
            whatsAppAccounts={whatsAppAccounts}
            accountsLoading={whatsAppAccountsLoading}
            accountsError={whatsAppAccountsError}
            onUpdateNode={handleUpdateNode}
          />
        </div>
      </div>
    </div>
  );
}
