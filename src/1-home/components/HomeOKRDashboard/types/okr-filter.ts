// Types for OKR filtering system
export interface FilterCondition {
  field: string;
  operator: 'equals' | 'in' | 'not_in' | 'contains' | 'greater_than' | 'less_than' | 'is_empty';
  value: any;
}

export interface SavedFilter {
  id: string;
  organization_id: string;
  name: string;
  visibility: 'private' | 'public';
  filter_config: {
    conditions: FilterCondition[];
    logic: 'and' | 'or';
  };
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FilterOption {
  label: string;
  value: string;
  color?: string;
}

export interface FilterField {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'number' | 'text' | 'date';
  options?: FilterOption[];
}

export interface OkrFilterState {
  conditions: FilterCondition[];
  logic: 'and' | 'or';
}