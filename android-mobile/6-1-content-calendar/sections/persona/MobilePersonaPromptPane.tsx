import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { ScriptResult } from "@/6-1-script-generator/components/ScriptResult";
import {
  isTextAIConfigured,
  resolveTextAIProvider,
  textAIProviderLabel,
  type TextAIProvider,
} from "@/6-1-script-generator/utils/scriptAiTextProvider";
import type { ScriptAIConfigRow } from "@/6-1-script-generator/hooks/useScriptAIConfig";

interface MobilePersonaPromptPaneProps {
  prompt: string | null;
  aiConfig: ScriptAIConfigRow | null | undefined;
  scriptAiPending: boolean;
  aiConfigError: boolean;
  isGeneratingAI: boolean;
  isSwitchingTextProvider: boolean;
  onGenerateWithAI: (prompt: string) => Promise<boolean>;
  onSetTextAIProvider: (provider: TextAIProvider) => Promise<void>;
  onRefreshAiConfig: () => void;
}

export function MobilePersonaPromptPane({
  prompt,
  aiConfig,
  scriptAiPending,
  aiConfigError,
  isGeneratingAI,
  isSwitchingTextProvider,
  onGenerateWithAI,
  onSetTextAIProvider,
  onRefreshAiConfig,
}: MobilePersonaPromptPaneProps) {
  if (!prompt) {
    return (
      <div className="-mx-2 flex min-h-0 flex-1 flex-col border-y border-border bg-card px-3 py-6">
        <div className="flex min-h-[180px] flex-1 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">
            Prompt akan muncul di sini setelah Anda mengisi form dan klik &quot;Generate Script&quot;
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-y border-border bg-card px-3 pt-3 pb-2">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        {aiConfig ? (
          <div className="flex shrink-0 flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <span className="text-sm text-gray-700">
              Text AI Provider:{" "}
              <span className="font-medium">{textAIProviderLabel(resolveTextAIProvider(aiConfig))}</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {(["gemini", "groq", "fireworks"] as const).map((p) => {
                const selected = resolveTextAIProvider(aiConfig) === p;
                return (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    className="h-8 px-3"
                    disabled={isSwitchingTextProvider}
                    onClick={() => onSetTextAIProvider(p)}
                  >
                    {textAIProviderLabel(p)}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}

        {!isTextAIConfigured(aiConfig) ? (
          <div className="flex shrink-0 flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <span className="text-sm text-amber-800">
              {scriptAiPending && "Memuat konfigurasi AI..."}
              {!scriptAiPending && aiConfigError && "Gagal memuat konfigurasi. Coba refresh."}
              {!scriptAiPending && !aiConfigError && !aiConfig && (
                <>
                  Konfigurasi AI tidak ditemukan. Pastikan organisasi aktif benar. Lalu buka{" "}
                  <Link
                    to="/digital-marketing/social-media/settings"
                    className="font-medium text-amber-700 underline hover:text-amber-900"
                  >
                    Settings → Script AI Generator
                  </Link>
                  .
                </>
              )}
              {!scriptAiPending &&
                !aiConfigError &&
                aiConfig &&
                resolveTextAIProvider(aiConfig) === "gemini" &&
                !aiConfig.api_key_configured &&
                "API key Gemini belum dikonfigurasi di Settings (dibutuhkan jika provider Text AI = Gemini)."}
            </span>
            {!scriptAiPending ? (
              <button
                type="button"
                onClick={onRefreshAiConfig}
                className="self-start text-sm font-medium text-amber-700 underline hover:text-amber-900"
              >
                Refresh konfigurasi
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ScriptResult
            script={prompt}
            layout="mobile"
            onGenerateWithAI={async (value) => {
              await onGenerateWithAI(value);
            }}
            isGeneratingAI={isGeneratingAI}
            isAIConfigured={isTextAIConfigured(aiConfig)}
          />
        </div>
      </div>
    </div>
  );
}
