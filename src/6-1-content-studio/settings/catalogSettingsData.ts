export interface IndustryTemplate {
  code: string;
  label: string;
  description: string | null;
  position: number;
}

export interface MenuFieldDef {
  id?: string;
  field_key: string;
  label: string;
  position: number;
}

export interface TagDef {
  id?: string;
  key: string;
  label: string;
  applies_to: string;
  value_type: "bool" | "text";
  position: number;
}

export interface SceneKindDef {
  id?: string;
  key: string;
  label: string;
  position: number;
}

export interface CatalogSettings {
  industry_template_code: string | null;
  applied_at: string | null;
  templates: IndustryTemplate[];
  menu_field_defs: MenuFieldDef[];
  tag_defs: TagDef[];
  scene_kind_defs: SceneKindDef[];
}
