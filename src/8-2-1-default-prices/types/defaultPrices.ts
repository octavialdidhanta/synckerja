export interface DefaultPriceRow {
  id: string;
  organization_id: string;
  service_id: string;
  sub_service_id: string | null;
  unit_price: number;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  service_name?: string;
  sub_service_name?: string;
}

export interface DefaultPriceCreate {
  organization_id: string;
  service_id: string;
  sub_service_id: string | null;
  unit_price: number;
  description?: string | null;
}

export interface DefaultPriceUpdate {
  unit_price?: number;
  description?: string | null;
}
