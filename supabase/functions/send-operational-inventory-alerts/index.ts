/**
 * Daily inventory alerts email for orgs with inventory_alerts_enabled.
 * Invoked by pg_cron at 00:15 WIB.
 *
 * Auth: service role / secret key (Authorization Bearer or apikey header)
 */
/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isAuthorizedServiceCaller,
  resolveSupabaseAdminKey,
} from "../_shared/serviceRoleEdgeAuth.ts";
import { collectOperationalEmailRecipients } from "../_shared/operationalEmailRecipients.ts";
import {
  buildInventoryDigestEmailHtml,
  type InventoryAlertIngredientRow,
  type InventoryAlertMenuRow,
} from "../_shared/inventoryAlertEmailHtml.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type IngredientAlertRow = InventoryAlertIngredientRow;
type MenuAlertRow = InventoryAlertMenuRow;

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function todayWibLabel(now = new Date()): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
}

async function sendResend(args: {
  to: string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL")?.trim() ?? "";
  if (!resendKey || !fromEmail) {
    return { ok: false, error: "Missing RESEND_API_KEY or RESEND_FROM_EMAIL" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: args.to,
      subject: args.subject,
      html: args.html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text || "Resend request failed" };
  }
  return { ok: true };
}

async function buildDigestForOrg(
  admin: SupabaseClient,
  orgId: string,
): Promise<{ ingredients: IngredientAlertRow[]; menus: MenuAlertRow[] }> {
  const ingredients: IngredientAlertRow[] = [];
  const menus: MenuAlertRow[] = [];

  const { data: outlets } = await admin
    .from("pos_outlets")
    .select("id, name, is_active")
    .eq("organization_id", orgId)
    .eq("is_deleted", false);
  const outletNameById = new Map<string, string>();
  for (const o of outlets ?? []) {
    if ((o as { is_active?: boolean }).is_active === false) continue;
    outletNameById.set(String(o.id), String(o.name ?? "Outlet"));
  }
  const outletIds = [...outletNameById.keys()];
  if (outletIds.length === 0) return { ingredients, menus };

  const { data: ingredientRows } = await admin
    .from("catalog_ingredients")
    .select(
      "id, name, unit, track_inventory, catalog_ingredient_outlets(outlet_id, in_stock, alert_enabled, alert_at)",
    )
    .eq("organization_id", orgId)
    .eq("is_deleted", false)
    .eq("track_inventory", true);

  for (const row of ingredientRows ?? []) {
    const name = String((row as { name?: string }).name ?? "").trim() || "Ingredient";
    const unit = String((row as { unit?: string }).unit ?? "").trim() || "";
    const links =
      (
        row as {
          catalog_ingredient_outlets?: Array<{
            outlet_id: string;
            in_stock: number | string;
            alert_enabled?: boolean;
            alert_at?: number | string | null;
          }>;
        }
      ).catalog_ingredient_outlets ?? [];
    for (const link of links) {
      const outletId = String(link.outlet_id ?? "");
      if (!outletNameById.has(outletId)) continue;
      const inStock = Number(link.in_stock);
      const qty = Number.isFinite(inStock) && inStock >= 0 ? inStock : 0;
      const alertAtRaw = link.alert_at == null ? null : Number(link.alert_at);
      const alertAt =
        alertAtRaw != null && Number.isFinite(alertAtRaw) ? alertAtRaw : null;
      let status: "out" | "low" | null = null;
      if (qty <= 0) status = "out";
      else if (link.alert_enabled && alertAt != null && qty <= alertAt) status = "low";
      if (!status) continue;
      ingredients.push({
        outletName: outletNameById.get(outletId)!,
        name,
        status,
        inStock: qty,
        alertAt,
        unit,
      });
    }
  }

  // Recipe menus OOS per outlet
  const { data: recipes } = await admin
    .from("catalog_product_recipes")
    .select("product_id, catalog_product_recipe_lines(ingredient_id, quantity)")
    .eq("organization_id", orgId)
    .is("modifier_option_id", null);

  const productIds = [
    ...new Set(
      (recipes ?? [])
        .map((r) => String((r as { product_id?: string }).product_id ?? ""))
        .filter(Boolean),
    ),
  ];
  const productNameById = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: products } = await admin
      .from("catalog_products")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("id", productIds);
    for (const p of products ?? []) {
      productNameById.set(
        String(p.id),
        String((p as { name?: string }).name ?? "").trim() || String(p.id),
      );
    }
  }

  const stockByOutletIngredient = new Map<string, number>();
  const nameByIngredient = new Map<string, string>();
  const trackByIngredient = new Map<string, boolean>();
  for (const row of ingredientRows ?? []) {
    const id = String(row.id);
    trackByIngredient.set(id, true);
    nameByIngredient.set(id, String((row as { name?: string }).name ?? "").trim() || id);
    const links =
      (
        row as {
          catalog_ingredient_outlets?: Array<{
            outlet_id: string;
            in_stock: number | string;
          }>;
        }
      ).catalog_ingredient_outlets ?? [];
    for (const link of links) {
      const outletId = String(link.outlet_id ?? "");
      const qty = Number(link.in_stock);
      stockByOutletIngredient.set(
        `${outletId}:${id}`,
        Number.isFinite(qty) && qty >= 0 ? qty : 0,
      );
    }
  }

  // Also load names for ingredients that appear in recipes but weren't in tracked query (shouldn't happen)
  for (const outletId of outletIds) {
    for (const recipe of recipes ?? []) {
      const productId = String((recipe as { product_id?: string }).product_id ?? "");
      const productName = productNameById.get(productId) ?? productId;
      const lines =
        (
          recipe as {
            catalog_product_recipe_lines?: Array<{
              ingredient_id: string;
              quantity: number;
            }>;
          }
        ).catalog_product_recipe_lines ?? [];

      const blockers: string[] = [];
      let max = Number.POSITIVE_INFINITY;
      let hasTracked = false;
      for (const line of lines) {
        const ingredientId = String(line.ingredient_id ?? "");
        const needed = Number(line.quantity) || 0;
        if (!ingredientId || !(needed > 0)) continue;
        if (!trackByIngredient.get(ingredientId)) continue;
        hasTracked = true;
        const available = stockByOutletIngredient.get(`${outletId}:${ingredientId}`) ?? 0;
        const servings = Math.floor(available / needed);
        if (servings <= 0) {
          blockers.push(nameByIngredient.get(ingredientId) ?? ingredientId);
        }
        max = Math.min(max, servings);
      }
      if (!hasTracked || !Number.isFinite(max) || max > 0) continue;
      menus.push({
        outletName: outletNameById.get(outletId)!,
        productName,
        blockers: blockers.join(", ") || "—",
      });
    }
  }

  ingredients.sort((a, b) =>
    a.outletName === b.outletName
      ? a.name.localeCompare(b.name)
      : a.outletName.localeCompare(b.outletName),
  );
  menus.sort((a, b) =>
    a.outletName === b.outletName
      ? a.productName.localeCompare(b.productName)
      : a.outletName.localeCompare(b.outletName),
  );

  return { ingredients, menus };
}

export function isDigestEmpty(
  ingredients: IngredientAlertRow[],
  menus: MenuAlertRow[],
): boolean {
  return ingredients.length === 0 && menus.length === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = resolveSupabaseAdminKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }
  if (!isAuthorizedServiceCaller(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const dateLabel = todayWibLabel();

  const { data: settingsRows, error: settingsErr } = await admin
    .from("operational_email_notification_settings")
    .select("organization_id, inventory_alerts_enabled")
    .eq("inventory_alerts_enabled", true);

  if (settingsErr) {
    console.error(settingsErr);
    return json({ error: settingsErr.message }, 500);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const setting of settingsRows ?? []) {
    const orgId = String(setting.organization_id ?? "");
    if (!orgId) continue;

    try {
      const emails = await collectOperationalEmailRecipients(admin, orgId);
      if (emails.size === 0) {
        skipped += 1;
        continue;
      }

      const digest = await buildDigestForOrg(admin, orgId);
      if (isDigestEmpty(digest.ingredients, digest.menus)) {
        skipped += 1;
        continue;
      }

      const { data: org } = await admin
        .from("organizations")
        .select("id, company_name")
        .eq("id", orgId)
        .maybeSingle();
      const orgName = String(
        (org as { company_name?: string } | null)?.company_name ?? "Organization",
      );

      const html = buildInventoryDigestEmailHtml({
        orgName,
        dateLabel,
        ingredients: digest.ingredients,
        menus: digest.menus,
      });
      const subject = `[${orgName}] Inventory alerts — ${dateLabel}`;

      const result = await sendResend({
        to: [...emails],
        subject,
        html,
      });
      if (!result.ok) {
        failed += 1;
        errors.push(`${orgId}: ${result.error}`);
        continue;
      }
      sent += 1;
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${orgId}: ${msg}`);
      console.error("inventory alerts email failed", orgId, e);
    }
  }

  return json({
    ok: true,
    dateLabel,
    orgs: (settingsRows ?? []).length,
    sent,
    skipped,
    failed,
    errors: errors.slice(0, 20),
  });
});
