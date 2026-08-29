export type PosOutlet = {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  phone: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
};

export type PosOutletSave = {
  id?: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  phone: string | null;
  is_active: boolean;
};

export type OutletDraft = {
  id?: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  phone: string;
  is_active: boolean;
  is_default: boolean;
};

export function emptyOutletDraft(): OutletDraft {
  return {
    name: "",
    address: "",
    city: "",
    province: "",
    postal_code: "",
    phone: "",
    is_active: true,
    is_default: false,
  };
}

export function draftFromOutlet(row: PosOutlet): OutletDraft {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? "",
    city: row.city ?? "",
    province: row.province ?? "",
    postal_code: row.postal_code ?? "",
    phone: row.phone ?? "",
    is_active: row.is_active,
    is_default: row.is_default,
  };
}

export function isOutletDraftValid(draft: OutletDraft): boolean {
  return draft.name.trim().length > 0 && draft.phone.trim().length > 0;
}

export function formatOutletPhone(phone: string | null): string {
  const value = (phone ?? "").trim();
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 12)}...`;
}

export function formatOutletCityLine(row: Pick<PosOutlet, "city" | "province">): string {
  return [row.city, row.province].map((part) => part?.trim()).filter(Boolean).join(", ");
}
