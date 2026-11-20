export function corsHeaders(origin: string | null): HeadersInit {
  const allowed = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const list = allowed.split(",").map((s) => s.trim()).filter(Boolean);
  const o = origin?.trim() ?? "";

  if (list.length === 0) {
    return { "access-control-allow-origin": "*" };
  }

  if (o && list.includes(o)) {
    return {
      "access-control-allow-origin": o,
      "access-control-allow-credentials": "true",
      Vary: "Origin",
    };
  }

  return {};
}

export function corsPreflightHeaders(origin: string | null): HeadersInit {
  const h: Record<string, string> = {
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
  };
  const extra = corsHeaders(origin) as Record<string, string>;
  for (const [k, v] of Object.entries(extra)) {
    h[k] = v;
  }
  return h;
}

export function jsonResponse(
  data: unknown,
  init: ResponseInit = {},
  origin: string | null = null,
): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(corsHeaders(origin) as Record<string, string>),
      ...(init.headers ?? {}),
    },
  });
}
