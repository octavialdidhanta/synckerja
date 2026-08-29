const POS_SELECTED_OUTLET_ID_KEY = "synckerja_pos_selected_outlet_id";
const POS_SELECTED_OUTLET_NAME_KEY = "synckerja_pos_selected_outlet_name";
const POS_SELECTED_OUTLET_ADDRESS_KEY = "synckerja_pos_selected_outlet_address";

export type PosSelectedOutlet = {
  id: string;
  name: string;
  address?: string | null;
};

export function stashPosSelectedOutlet(outlet: PosSelectedOutlet): void {
  try {
    sessionStorage.setItem(POS_SELECTED_OUTLET_ID_KEY, outlet.id);
    sessionStorage.setItem(POS_SELECTED_OUTLET_NAME_KEY, outlet.name);
    const address = outlet.address?.trim() || "";
    if (address) {
      sessionStorage.setItem(POS_SELECTED_OUTLET_ADDRESS_KEY, address);
    } else {
      sessionStorage.removeItem(POS_SELECTED_OUTLET_ADDRESS_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPosSelectedOutletId(): string | null {
  try {
    const id = sessionStorage.getItem(POS_SELECTED_OUTLET_ID_KEY)?.trim() ?? "";
    return id || null;
  } catch {
    return null;
  }
}

export function readPosSelectedOutlet(): PosSelectedOutlet | null {
  try {
    const id = sessionStorage.getItem(POS_SELECTED_OUTLET_ID_KEY)?.trim() ?? "";
    if (!id) return null;
    const name = sessionStorage.getItem(POS_SELECTED_OUTLET_NAME_KEY)?.trim() ?? "";
    const address = sessionStorage.getItem(POS_SELECTED_OUTLET_ADDRESS_KEY)?.trim() || null;
    return { id, name, address };
  } catch {
    return null;
  }
}

export function clearPosSelectedOutlet(): void {
  try {
    sessionStorage.removeItem(POS_SELECTED_OUTLET_ID_KEY);
    sessionStorage.removeItem(POS_SELECTED_OUTLET_NAME_KEY);
    sessionStorage.removeItem(POS_SELECTED_OUTLET_ADDRESS_KEY);
  } catch {
    /* ignore */
  }
}
