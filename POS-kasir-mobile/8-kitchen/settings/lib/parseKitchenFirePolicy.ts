import {
  DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
  parseKitchenFireBySalesType,
} from "../../lib/kitchenFirePolicy";

export { parseKitchenFireBySalesType };

export function parseKitchenFirePolicyFromRow(raw: unknown) {
  return parseKitchenFireBySalesType(raw ?? DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE);
}
