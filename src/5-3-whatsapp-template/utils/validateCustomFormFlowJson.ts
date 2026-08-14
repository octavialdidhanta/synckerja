import type { CustomFormField, CustomFormModel } from "./buildCustomFormFlowJson";

export type CustomFormValidationError = { field?: string; message: string };

export function validateCustomFormModel(model: CustomFormModel): CustomFormValidationError[] {
  const errors: CustomFormValidationError[] = [];
  const title = model.screenTitle?.trim() ?? "";
  if (!title) {
    errors.push({ field: "screenTitle", message: "Screen title is required" });
  } else if (title.length > 60) {
    errors.push({ field: "screenTitle", message: "Screen title max 60 characters" });
  }

  if (!Array.isArray(model.fields) || model.fields.length === 0) {
    errors.push({ message: "At least one field is required" });
    return errors;
  }

  const names = new Set<string>();
  model.fields.forEach((field: CustomFormField, index) => {
    const prefix = `fields[${index}]`;
    const label = field.label?.trim() ?? "";
    const name = field.name?.trim() ?? "";
    if (!label) {
      errors.push({ field: `${prefix}.label`, message: "Label is required" });
    } else if (label.length > 20) {
      errors.push({ field: `${prefix}.label`, message: "Label max 20 characters" });
    }
    if (!name) {
      errors.push({ field: `${prefix}.name`, message: "Field name is required" });
    } else if (!/^[a-z][a-z0-9_]{0,63}$/.test(name)) {
      errors.push({
        field: `${prefix}.name`,
        message: "Field name must be snake_case starting with a letter",
      });
    } else if (names.has(name)) {
      errors.push({ field: `${prefix}.name`, message: "Field name must be unique" });
    } else {
      names.add(name);
    }
    const instructions = field.instructions?.trim() ?? "";
    if (instructions.length > 80) {
      errors.push({ field: `${prefix}.instructions`, message: "Instructions max 80 characters" });
    }
  });

  return errors;
}
