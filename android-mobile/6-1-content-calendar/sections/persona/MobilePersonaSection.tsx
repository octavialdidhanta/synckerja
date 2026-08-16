import { useCallback, useState } from "react";
import { useScriptGeneratorSession } from "@/6-1-script-generator/hooks/useScriptGeneratorSession";
import type { ScriptGeneratorRequest } from "@/6-1-script-generator/services/scriptGeneratorService";
import {
  MobilePersonaSectionNav,
  type MobilePersonaPane,
} from "@/mobile/6-1-content-calendar/sections/persona/MobilePersonaSectionNav";
import { MobilePersonaFormPane } from "@/mobile/6-1-content-calendar/sections/persona/MobilePersonaFormPane";
import { MobilePersonaPromptPane } from "@/mobile/6-1-content-calendar/sections/persona/MobilePersonaPromptPane";
import { MobilePersonaResultPane } from "@/mobile/6-1-content-calendar/sections/persona/MobilePersonaResultPane";

export function MobilePersonaSection() {
  const [activePane, setActivePane] = useState<MobilePersonaPane>("form");
  const {
    handleGenerate: generatePrompt,
    handleGenerateWithAI: generateWithAI,
    isGenerating,
    generatedPrompt,
    aiConfig,
    scriptAiPending,
    aiConfigError,
    isGeneratingAI,
    isSwitchingTextProvider,
    handleSetTextAIProvider,
    refetchAiConfig,
    aiGeneratedScript,
    lastFormDataForPlan,
    setAiGeneratedScript,
  } = useScriptGeneratorSession();

  const handleGenerate = useCallback(
    async (data: ScriptGeneratorRequest) => {
      const ok = await generatePrompt(data);
      if (ok) setActivePane("prompt");
      return ok;
    },
    [generatePrompt],
  );

  const handleGenerateWithAI = useCallback(
    async (prompt: string) => {
      const ok = await generateWithAI(prompt);
      if (ok) setActivePane("result");
      return ok;
    },
    [generateWithAI],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <MobilePersonaSectionNav activePane={activePane} onPaneChange={setActivePane} />
      {activePane === "form" ? (
        <MobilePersonaFormPane isGenerating={isGenerating} onGenerate={handleGenerate} />
      ) : activePane === "prompt" ? (
        <MobilePersonaPromptPane
          prompt={generatedPrompt}
          aiConfig={aiConfig}
          scriptAiPending={scriptAiPending}
          aiConfigError={aiConfigError}
          isGeneratingAI={isGeneratingAI}
          isSwitchingTextProvider={isSwitchingTextProvider}
          onGenerateWithAI={handleGenerateWithAI}
          onSetTextAIProvider={handleSetTextAIProvider}
          onRefreshAiConfig={() => {
            void refetchAiConfig();
          }}
        />
      ) : (
        <MobilePersonaResultPane
          script={aiGeneratedScript}
          formDataForPlan={lastFormDataForPlan}
          onScriptChange={(script) => setAiGeneratedScript(script)}
        />
      )}
    </div>
  );
}

export function MobilePersonaSectionPulse() {
  return (
    <div className="space-y-1">
      <div className="-mx-2 border-y border-border bg-card px-2 py-2">
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-[5px] bg-muted/40" />
          ))}
        </div>
      </div>
      <div className="-mx-2 space-y-2 border-y border-border bg-card px-3 py-3">
        <div className="h-10 animate-pulse rounded-lg bg-muted/40" />
        <div className="h-10 animate-pulse rounded-lg bg-muted/40" />
        <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
        <div className="h-10 animate-pulse rounded-lg bg-muted/40" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-muted/50" />
      </div>
    </div>
  );
}
