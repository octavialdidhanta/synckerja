import { tiktokShopCorsHeaders, tiktokShopJson } from "../tiktokShopAuth.ts";

export const stockManagementCorsHeaders = tiktokShopCorsHeaders;

export function stockManagementJson(body: object, status: number): Response {
  return tiktokShopJson(body, status);
}

export {
  getUserFromBearer,
  requireActiveOrg,
  requireOrgAdmin,
} from "../tiktokShopAuth.ts";
