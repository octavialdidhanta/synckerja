export type BriefFieldContent = {
  brief: string;
  concept: string;
  caption: string;
  link: string;
};

export type BriefChangedField = "storyboard" | "concept" | "caption" | "link";

function sameText(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? "").trim() === (right ?? "").trim();
}

/** Columns this edit changed. The snapshot is the text before the edit. */
export function changedBriefFields(before: BriefFieldContent, after: BriefFieldContent): BriefChangedField[] {
  const fields: BriefChangedField[] = [];
  if (!sameText(before.brief, after.brief)) fields.push("storyboard");
  if (!sameText(before.concept, after.concept)) fields.push("concept");
  if (!sameText(before.caption, after.caption)) fields.push("caption");
  if (!sameText(before.link, after.link)) fields.push("link");
  return fields;
}
