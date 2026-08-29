export type PosTableGroup = {
  id: string;
  organization_id: string;
  outlet_id: string;
  name: string;
  is_active: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  /** Physical tables in group — 0 until Table Map / pos_tables exists. */
  table_count: number;
};

export type PosTableGroupSavePayload = {
  name: string;
  is_active: boolean;
};
