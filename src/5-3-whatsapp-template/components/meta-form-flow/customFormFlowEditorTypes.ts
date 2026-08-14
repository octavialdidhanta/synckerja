import type { CustomFormField, CustomFormFieldInputType } from "@/5-3-whatsapp-template/utils/buildCustomFormFlowJson";
import { toFlowApiName } from "@/5-3-whatsapp-template/utils/buildCustomFormFlowJson";

export type LocalFormField = CustomFormField & { localKey: string };

export function newLocalFieldKey(): string {
  return `lf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function slugFieldNameFromLabel(label: string, index: number): string {
  const base = toFlowApiName(label).replace(/^_|_$/g, "") || `field_${index + 1}`;
  return base.length > 64 ? base.slice(0, 64) : base;
}

export function defaultLocalFields(): LocalFormField[] {
  return [
    {
      localKey: newLocalFieldKey(),
      name: "nama",
      label: "Nama",
      instructions: "",
      inputType: "text",
      required: true,
    },
  ];
}

export function inputPreviewProps(inputType: CustomFormFieldInputType): { type: string; placeholder: string } {
  switch (inputType) {
    case "email":
      return { type: "email", placeholder: "email@contoh.com" };
    case "number":
      return { type: "text", placeholder: "0" };
    case "phone":
      return { type: "tel", placeholder: "+62…" };
    case "text":
    default:
      return { type: "text", placeholder: "…" };
  }
}
