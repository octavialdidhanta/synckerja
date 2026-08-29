export type InventoryAlertIngredientRow = {
  outletName: string;
  name: string;
  status: "out" | "low";
  inStock: number;
  alertAt: number | null;
  unit: string;
};

export type InventoryAlertMenuRow = {
  outletName: string;
  productName: string;
  blockers: string;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ingredientTable(rows: InventoryAlertIngredientRow[]): string {
  const body = rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.outletName)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.name)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.status === "out" ? "Out of stock" : "Low")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(String(r.inStock))} ${escapeHtml(r.unit)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${r.alertAt == null ? "—" : escapeHtml(String(r.alertAt))}</td>
        </tr>`,
    )
    .join("");
  return `
      <h2 style="font-size:16px;color:#0f172a;margin:24px 0 8px;">Ingredients</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f8fafc;text-align:left;">
            <th style="padding:8px 12px;">Outlet</th>
            <th style="padding:8px 12px;">Name</th>
            <th style="padding:8px 12px;">Status</th>
            <th style="padding:8px 12px;text-align:right;">In stock</th>
            <th style="padding:8px 12px;text-align:right;">Alert at</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>`;
}

function menuTable(rows: InventoryAlertMenuRow[]): string {
  const body = rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.outletName)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.productName)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.blockers)}</td>
        </tr>`,
    )
    .join("");
  return `
      <h2 style="font-size:16px;color:#0f172a;margin:24px 0 8px;">Menu (recipe) out of stock</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f8fafc;text-align:left;">
            <th style="padding:8px 12px;">Outlet</th>
            <th style="padding:8px 12px;">Product</th>
            <th style="padding:8px 12px;">Missing ingredients</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>`;
}

export function buildInventoryDigestEmailHtml(args: {
  orgName: string;
  dateLabel: string;
  ingredients: InventoryAlertIngredientRow[];
  menus: InventoryAlertMenuRow[];
}): string {
  const sections: string[] = [];
  if (args.ingredients.length > 0) sections.push(ingredientTable(args.ingredients));
  if (args.menus.length > 0) sections.push(menuTable(args.menus));

  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#334155;max-width:720px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 4px;">Inventory alerts</h1>
    <p style="margin:0 0 16px;color:#64748b;">${escapeHtml(args.orgName)} · ${escapeHtml(args.dateLabel)}</p>
    ${sections.join("")}
    <p style="margin-top:32px;font-size:12px;color:#94a3b8;">Sent by Synckerja · Inventory Alerts (daily recap)</p>
  </body></html>`;
}

export function buildInventoryInstantEmailHtml(args: {
  orgName: string;
  items: InventoryAlertIngredientRow[];
}): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#334155;max-width:720px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 4px;">Inventory alert</h1>
    <p style="margin:0 0 16px;color:#64748b;">${escapeHtml(args.orgName)} · stock just became low or out</p>
    ${ingredientTable(args.items)}
    <p style="margin-top:32px;font-size:12px;color:#94a3b8;">Sent by Synckerja · Inventory Alerts (instant)</p>
  </body></html>`;
}
