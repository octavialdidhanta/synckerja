import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AutomationFlowEditorShell } from "@/5-3-automation-flow/components/editor/AutomationFlowEditorShell";
import { AutomationFlowEditorSkeleton } from "@/5-3-automation-flow/skeletons/AutomationFlowEditorSkeleton";
import { useAutomationFlow } from "@/5-3-automation-flow/hooks/useAutomationFlow";

export function AutomationFlowEditorPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const { t } = useTranslation();
  const { data: flow, isPending, isError, error } = useAutomationFlow(flowId);

  if (isPending) return <AutomationFlowEditorSkeleton />;
  if (isError || !flow) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : t("omnichannel.automationFlow.editor.loadFailed")}
      </div>
    );
  }

  return <AutomationFlowEditorShell flow={flow} />;
}

export default AutomationFlowEditorPage;
