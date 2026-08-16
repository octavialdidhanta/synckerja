import { ScriptGeneratorForm } from "@/6-1-script-generator/components/ScriptGeneratorForm";
import type { ScriptGeneratorRequest } from "@/6-1-script-generator/services/scriptGeneratorService";

interface MobilePersonaFormPaneProps {
  isGenerating: boolean;
  onGenerate: (data: ScriptGeneratorRequest) => Promise<boolean>;
}

export function MobilePersonaFormPane({ isGenerating, onGenerate }: MobilePersonaFormPaneProps) {
  return (
    <div className="-mx-2 flex min-h-0 flex-1 flex-col overflow-y-auto border-y border-border bg-card px-3 py-3">
      <ScriptGeneratorForm
        onGenerate={async (data) => {
          await onGenerate(data);
        }}
        isGenerating={isGenerating}
        selectAsDrawer
      />
    </div>
  );
}
