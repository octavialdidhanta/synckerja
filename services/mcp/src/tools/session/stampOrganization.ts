export function stampOrganization(
  body: unknown,
  ctx: { organizationId: string; companyName: string },
): unknown {
  const mark = {
    organization_id: ctx.organizationId,
    organization_name: ctx.companyName,
  };
  if (Array.isArray(body)) return { ...mark, items: body };
  if (body && typeof body === "object") return { ...(body as Record<string, unknown>), ...mark };
  return { ...mark, result: body };
}
