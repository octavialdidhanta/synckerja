import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { WHATSAPP_FLOW_JSON_VERSION } from "@/5-3-whatsapp-template/utils/buildCustomFormFlowJson";
import { validateFlowJsonSyntax } from "@/5-3-whatsapp-template/utils/validateFlowJsonSyntax";

type MetaFormFlowJsonEditorProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
};

export function MetaFormFlowJsonEditor({ value, onChange, readOnly = false }: MetaFormFlowJsonEditorProps) {
  const { t } = useTranslation();
  const syntax = validateFlowJsonSyntax(value);
  const errorMessage = syntax.ok ? null : syntax.message;

  const handleFormat = () => {
    if (!syntax.ok) return;
    onChange(JSON.stringify(syntax.value, null, 2));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {t("omnichannel.settings.flowBuilder.formFlowsEditor.jsonVersionHint", {
            version: WHATSAPP_FLOW_JSON_VERSION,
          })}
        </p>
        {!readOnly ? (
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleFormat} disabled={!syntax.ok}>
            {t("omnichannel.settings.flowBuilder.formFlowsEditor.formatJson")}
          </Button>
        ) : null}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        className="min-h-[360px] flex-1 resize-y rounded-md border border-input bg-slate-950 px-3 py-2 font-mono text-xs leading-relaxed text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {errorMessage ? (
        <p className="text-xs text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}
