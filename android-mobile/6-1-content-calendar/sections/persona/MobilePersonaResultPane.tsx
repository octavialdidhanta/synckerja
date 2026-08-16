import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { AIScriptResult } from "@/6-1-script-generator/components/AIScriptResult";
import type { ScriptGeneratorFormDataForPlan } from "@/6-1-script-generator/hooks/useScriptGeneratorSession";

interface MobilePersonaResultPaneProps {
  script: string | null;
  formDataForPlan: ScriptGeneratorFormDataForPlan | null;
  onScriptChange: (script: string) => void;
}

export function MobilePersonaResultPane({
  script,
  formDataForPlan,
  onScriptChange,
}: MobilePersonaResultPaneProps) {
  const { t } = useAppTranslation();

  if (!script) {
    return (
      <div className="-mx-2 flex min-h-0 flex-1 flex-col overflow-y-auto border-y border-border bg-card px-3 py-6">
        <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">
            {t(
              "scriptGenerator.aiEmptyState",
              'Hasil script dari AI akan muncul di sini setelah Anda QC prompt dan klik "Generate dengan AI"',
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-2 flex min-h-0 flex-1 flex-col overflow-y-auto border-b border-border bg-card px-3 pt-0 pb-6">
      <AIScriptResult script={script} formDataForPlan={formDataForPlan} onScriptChange={onScriptChange} />
    </div>
  );
}
