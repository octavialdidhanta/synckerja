import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

export function manualRejection(input: {
  admission: IndividualAdmission;
  relation?: string | null;
  reasons?: string[];
  note?: string | null;
}): string | null {
  if (input.admission === "GENERATE_VALID") return null;
  const reasons = [...(input.reasons ?? []), input.note ?? ""].map((row) => row.trim()).filter(Boolean);
  const relation = input.relation?.trim();
  const head = relation && relation !== "UNRESOLVED" ? relation : input.admission;
  return [head, ...reasons.filter((row) => row !== head)].join(" — ");
}

type ManualStatementFormProps = {
  label: string;
  submitLabel: string;
  initialValue?: string;
  pending?: boolean;
  rows?: number;
  placeholder?: string;
  hint?: string;
  onSubmit: (statement: string) => Promise<string | null>;
};

export function ManualStatementForm({
  label,
  submitLabel,
  initialValue = "",
  pending = false,
  rows = 4,
  placeholder,
  hint,
  onSubmit,
}: ManualStatementFormProps) {
  const { t } = useAppTranslation();
  const [value, setValue] = useState(initialValue);
  const [rejection, setRejection] = useState<string | null>(null);

  const onSave = async () => {
    const statement = value.trim();
    if (!statement || pending) return;
    setRejection(null);
    const reason = await onSubmit(statement);
    setRejection(reason);
    if (!reason && !initialValue) setValue("");
  };

  return (
    <div className="space-y-2">
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
        <Textarea
          value={value}
          rows={rows}
          placeholder={placeholder}
          disabled={pending}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      {rejection ? <p className="text-sm text-destructive">{rejection}</p> : null}
      <Button type="button" size="sm" onClick={() => void onSave()} disabled={pending || !value.trim()}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? t("thinkingLab.manual.saving", "Saving") : submitLabel}
      </Button>
    </div>
  );
}

type EditableStatementProps = {
  statement: string;
  lead?: string;
  enabled: boolean;
  pending?: boolean;
  compact?: boolean;
  buttonOnly?: boolean;
  onSave: (statement: string) => Promise<string | null>;
};

export function EditableStatement({
  statement,
  lead,
  enabled,
  pending = false,
  compact = false,
  buttonOnly = false,
  onSave,
}: EditableStatementProps) {
  const { t } = useAppTranslation();
  const [editing, setEditing] = useState(false);
  const body = (
    <p className="text-sm leading-snug text-foreground">
      {lead ? <span className="font-medium">{lead} </span> : null}
      {statement}
    </p>
  );
  if (!enabled) return buttonOnly ? null : body;
  if (!editing) {
    if (buttonOnly) {
      return (
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)} disabled={pending}>
          {t("thinkingLab.manual.edit", "Edit")}
        </Button>
      );
    }
    if (compact) {
      return (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">{body}</div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0 text-muted-foreground"
            aria-label={t("thinkingLab.manual.edit", "Edit")}
            onClick={() => setEditing(true)}
            disabled={pending}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {body}
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)} disabled={pending}>
          {t("thinkingLab.manual.edit", "Edit")}
        </Button>
      </div>
    );
  }
  return (
    <div className={buttonOnly ? "basis-full" : undefined}>
      <ManualStatementForm
        label={t("thinkingLab.manual.edit", "Edit")}
        submitLabel={t("thinkingLab.manual.save", "Save")}
        initialValue={statement}
        pending={pending}
        onSubmit={async (next) => {
          const reason = await onSave(next);
          if (!reason) setEditing(false);
          return reason;
        }}
      />
    </div>
  );
}
