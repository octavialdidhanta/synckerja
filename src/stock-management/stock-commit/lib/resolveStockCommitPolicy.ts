import { supabase } from "@/shared/lib/supabaseClient";
import {
  DEFAULT_POS_OUTLET_STOCK_SETTINGS,
  type PosOutletStockSettings,
} from "../types/sessionStockCommit";
import {
  DEFAULT_STOCK_COMMIT_POINT,
  parseStockCommitPoint,
  type StockCommitPoint,
} from "../types/stockCommitPoint";

export async function fetchPosOutletStockSettings(args: {
  organizationId: string;
  outletId: string;
}): Promise<PosOutletStockSettings> {
  const { data, error } = await supabase
    .from("pos_outlet_stock_settings")
    .select("outlet_id, organization_id, stock_commit_point, created_at, updated_at")
    .eq("outlet_id", args.outletId)
    .eq("organization_id", args.organizationId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      outlet_id: args.outletId,
      organization_id: args.organizationId,
      stock_commit_point: DEFAULT_POS_OUTLET_STOCK_SETTINGS.stock_commit_point,
    };
  }

  return {
    outlet_id: data.outlet_id as string,
    organization_id: data.organization_id as string,
    stock_commit_point: parseStockCommitPoint(data.stock_commit_point as string),
    created_at: data.created_at as string | undefined,
    updated_at: data.updated_at as string | undefined,
  };
}

export async function resolveStockCommitPolicy(args: {
  organizationId: string;
  outletId: string;
}): Promise<StockCommitPoint> {
  const settings = await fetchPosOutletStockSettings(args);
  return settings.stock_commit_point ?? DEFAULT_STOCK_COMMIT_POINT;
}

export async function upsertPosOutletStockSettings(args: {
  organizationId: string;
  outletId: string;
  stockCommitPoint: StockCommitPoint;
}): Promise<void> {
  const { error } = await supabase.from("pos_outlet_stock_settings").upsert(
    {
      outlet_id: args.outletId,
      organization_id: args.organizationId,
      stock_commit_point: args.stockCommitPoint,
    },
    { onConflict: "outlet_id" },
  );
  if (error) throw error;
}
