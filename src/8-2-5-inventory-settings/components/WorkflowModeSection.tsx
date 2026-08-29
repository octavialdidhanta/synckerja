import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import type { InventoryWorkflowMode } from "../types";

function WorkflowIllustration({ mode }: { mode: InventoryWorkflowMode }) {
  const steps =
    mode === "simple"
      ? ["create", "check"]
      : ["request", "approval", "fulfillment"];

  return (
    <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center gap-1.5">
          <div
            className={cn(
              "flex h-7 min-w-[52px] items-center justify-center rounded border px-1.5 capitalize",
              mode === "advanced" ? "border-blue-200 bg-blue-50/60" : "border-border bg-muted/30",
            )}
          >
            {step}
          </div>
          {index < steps.length - 1 ? <span aria-hidden>→</span> : null}
        </div>
      ))}
    </div>
  );
}

export function WorkflowModeCard(props: {
  id: string;
  value: InventoryWorkflowMode;
  selected: boolean;
  title: string;
  description: string;
  mode: InventoryWorkflowMode;
  disabled?: boolean;
}) {
  const { t } = useAppTranslation();

  return (
    <Label
      htmlFor={props.id}
      className={cn(
        "block cursor-pointer rounded-lg border p-4 transition-colors",
        props.selected ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/30" : "border-border hover:bg-muted/20",
        props.disabled && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <RadioGroupItem id={props.id} value={props.value} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{props.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{props.description}</p>
          <WorkflowIllustration mode={props.mode} />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {props.mode === "simple"
              ? t("settings.inventory.mode.simpleHint", "Stock updates immediately.")
              : t("settings.inventory.mode.advancedHint", "Multi-step workflow with role gates.")}
          </p>
        </div>
      </div>
    </Label>
  );
}

export function WorkflowModeSection(props: {
  title: string;
  description: string;
  learnMoreHref?: string;
  mode: InventoryWorkflowMode;
  onModeChange: (mode: InventoryWorkflowMode) => void;
  simpleTitle: string;
  simpleDescription: string;
  advancedTitle: string;
  advancedDescription: string;
  namePrefix: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const { t } = useAppTranslation();

  return (
    <section className="space-y-4 border-b border-border pb-8 last:border-b-0 last:pb-0">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{props.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{props.description}</p>
          <a
            href={props.learnMoreHref ?? "#"}
            className="mt-2 inline-block text-sm text-blue-600 hover:underline"
            onClick={(e) => {
              if (!props.learnMoreHref || props.learnMoreHref === "#") e.preventDefault();
            }}
          >
            {t("settings.inventory.learnMore", "Learn more")}
          </a>
        </div>

        <RadioGroup
          value={props.mode}
          onValueChange={(value) => props.onModeChange(value as InventoryWorkflowMode)}
          className="grid gap-3 sm:grid-cols-2"
          disabled={props.disabled}
        >
          <WorkflowModeCard
            id={`${props.namePrefix}-simple`}
            value="simple"
            selected={props.mode === "simple"}
            title={props.simpleTitle}
            description={props.simpleDescription}
            mode="simple"
            disabled={props.disabled}
          />
          <WorkflowModeCard
            id={`${props.namePrefix}-advanced`}
            value="advanced"
            selected={props.mode === "advanced"}
            title={props.advancedTitle}
            description={props.advancedDescription}
            mode="advanced"
            disabled={props.disabled}
          />
        </RadioGroup>
      </div>

      {props.mode === "advanced" ? props.children : null}
    </section>
  );
}
