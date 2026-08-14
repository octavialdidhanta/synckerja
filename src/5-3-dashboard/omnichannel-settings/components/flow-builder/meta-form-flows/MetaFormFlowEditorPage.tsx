import { useTranslation } from "react-i18next";
import { useWhatsAppFlowDetail } from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/useWhatsAppFlowDetail";
import { MetaFormFlowEditorShell } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/meta-form-flows/MetaFormFlowEditorShell";
import { MetaFormFlowEditorSkeleton } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/meta-form-flows/MetaFormFlowEditorSkeleton";

type MetaFormFlowEditorPageProps = {
  flowId: string;
};

export function MetaFormFlowEditorPage({ flowId }: MetaFormFlowEditorPageProps) {
  const { t } = useTranslation();
  const { data, isPending, isError, error } = useWhatsAppFlowDetail(flowId);

  if (isPending) {
    return <MetaFormFlowEditorSkeleton />;
  }

  if (isError || !data?.flow?.id) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {error instanceof Error ? error.message : t("omnichannel.settings.flowBuilder.listing.loadFailed")}
      </div>
    );
  }

  return <MetaFormFlowEditorShell flow={data.flow} initialFlowJson={data.flow_json} />;
}
