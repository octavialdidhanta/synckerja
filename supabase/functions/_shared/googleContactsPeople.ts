import { phoneSearchVariants } from "./googleContactsPhone.ts";

export type GoogleContactPerson = {
  resourceName?: string;
  etag?: string;
  names?: Array<{ givenName?: string; displayName?: string; unstructuredName?: string }>;
  phoneNumbers?: Array<{ value?: string }>;
  emailAddresses?: Array<{ value?: string }>;
  biographies?: Array<{ value?: string; contentType?: string }>;
  metadata?: {
    sources?: Array<{ type?: string; id?: string; etag?: string }>;
  };
};

async function peopleFetch(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  // Do not send Content-Type on GET — Google may return HTML 404 pages.
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, {
    ...init,
    method,
    headers,
  });
}

async function readJsonSafe(
  res: Response,
): Promise<{ ok: true; json: unknown } | { ok: false; status: number; snippet: string }> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, status: res.status, snippet: "(empty body)" };
  }
  if (trimmed.startsWith("<") || trimmed.startsWith("<!")) {
    return {
      ok: false,
      status: res.status,
      snippet: `html_response_${res.status}: ${trimmed.slice(0, 120)}`,
    };
  }
  try {
    return { ok: true, json: JSON.parse(trimmed) };
  } catch {
    return {
      ok: false,
      status: res.status,
      snippet: `non_json_${res.status}: ${trimmed.slice(0, 120)}`,
    };
  }
}

function contactSourceEtag(person: GoogleContactPerson | null | undefined): string | null {
  const sources = person?.metadata?.sources ?? [];
  const contact = sources.find((s) => String(s.type ?? "").toUpperCase() === "CONTACT");
  return contact?.etag?.trim() || person?.etag?.trim() || null;
}

export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const parsed = await readJsonSafe(res);
  if (!parsed.ok || !res.ok) return null;
  const json = parsed.json as { email?: string };
  return json.email?.trim() || null;
}

export async function searchContactsByQuery(
  accessToken: string,
  query: string,
): Promise<GoogleContactPerson | null> {
  const q = query.trim();
  if (!q) return null;

  const url =
    `https://people.googleapis.com/v1/people:searchContacts?` +
    new URLSearchParams({
      query: q,
      readMask: "names,emailAddresses,phoneNumbers,metadata",
      pageSize: "5",
    }).toString();

  const res = await peopleFetch(accessToken, url, { method: "GET" });
  const parsed = await readJsonSafe(res);
  if (!parsed.ok || !res.ok) {
    console.error("searchContacts:", parsed.ok ? res.status : parsed.snippet);
    return null;
  }
  const json = parsed.json as { results?: Array<{ person?: GoogleContactPerson }> };
  return json.results?.[0]?.person ?? null;
}

export async function searchOtherContactsByQuery(
  accessToken: string,
  query: string,
): Promise<GoogleContactPerson | null> {
  const q = query.trim();
  if (!q) return null;

  const url =
    `https://people.googleapis.com/v1/otherContacts:search?` +
    new URLSearchParams({
      query: q,
      readMask: "names,emailAddresses,phoneNumbers,metadata",
      pageSize: "5",
    }).toString();

  const res = await peopleFetch(accessToken, url, { method: "GET" });
  const parsed = await readJsonSafe(res);
  if (!parsed.ok || !res.ok) return null;
  const json = parsed.json as { results?: Array<{ person?: GoogleContactPerson }> };
  return json.results?.[0]?.person ?? null;
}

export async function findContactByPhoneOrEmail(
  accessToken: string,
  phoneE164: string | null,
  email: string | null,
): Promise<GoogleContactPerson | null> {
  if (phoneE164) {
    const variants = phoneSearchVariants(phoneE164).slice(0, 2);
    for (const variant of variants) {
      const hit = await searchContactsByQuery(accessToken, variant);
      if (hit?.resourceName) return hit;
    }
    const other = await searchOtherContactsByQuery(accessToken, phoneE164);
    if (other?.resourceName) return other;
  }
  if (email) {
    const hit = await searchContactsByQuery(accessToken, email);
    if (hit?.resourceName) return hit;
    const other = await searchOtherContactsByQuery(accessToken, email);
    if (other?.resourceName) return other;
  }
  return null;
}

export async function getContact(
  accessToken: string,
  resourceName: string,
): Promise<GoogleContactPerson | null> {
  const url =
    `https://people.googleapis.com/v1/${resourceName}?` +
    new URLSearchParams({
      personFields: "names,emailAddresses,phoneNumbers,biographies,metadata",
    }).toString();
  const res = await peopleFetch(accessToken, url, { method: "GET" });
  const parsed = await readJsonSafe(res);
  if (!parsed.ok || !res.ok) {
    console.error("getContact:", resourceName, parsed.ok ? res.status : parsed.snippet);
    return null;
  }
  return parsed.json as GoogleContactPerson;
}

export type UpsertContactInput = {
  name: string;
  phoneE164: string;
  email?: string | null;
  note?: string | null;
};

function buildPersonBody(
  input: UpsertContactInput,
  etag: string | null,
  sourceEtag: string | null,
): GoogleContactPerson {
  const body: GoogleContactPerson = {
    names: [{ givenName: input.name || input.phoneE164 }],
    phoneNumbers: [{ value: input.phoneE164 }],
  };
  if (etag) body.etag = etag;
  if (sourceEtag) {
    body.metadata = { sources: [{ type: "CONTACT", etag: sourceEtag }] };
  }
  if (input.email?.trim()) {
    body.emailAddresses = [{ value: input.email.trim() }];
  }
  if (input.note?.trim()) {
    body.biographies = [{ value: input.note.trim(), contentType: "TEXT_PLAIN" }];
  }
  return body;
}

export async function createContact(
  accessToken: string,
  input: UpsertContactInput,
): Promise<GoogleContactPerson> {
  // Minimal payload — biographies optional (some tenants reject biography write)
  const body: GoogleContactPerson = {
    names: [{ givenName: input.name || input.phoneE164 }],
    phoneNumbers: [{ value: input.phoneE164 }],
  };
  if (input.email?.trim()) {
    body.emailAddresses = [{ value: input.email.trim() }];
  }

  const res = await peopleFetch(
    accessToken,
    "https://people.googleapis.com/v1/people:createContact",
    { method: "POST", body: JSON.stringify(body) },
  );
  const parsed = await readJsonSafe(res);
  if (!parsed.ok) {
    throw new Error(parsed.snippet);
  }
  const json = parsed.json as GoogleContactPerson & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `createContact_failed_${res.status}`);
  }
  return json;
}

export async function updateContact(
  accessToken: string,
  resourceName: string,
  input: UpsertContactInput,
  knownPerson?: GoogleContactPerson | null,
): Promise<GoogleContactPerson> {
  let existing = knownPerson ?? (await getContact(accessToken, resourceName));
  if (!contactSourceEtag(existing)) {
    await new Promise((r) => setTimeout(r, 300));
    existing = await getContact(accessToken, resourceName);
  }
  const etag = existing?.etag?.trim() || null;
  const sourceEtag = contactSourceEtag(existing);
  if (!etag && !sourceEtag) {
    throw new Error(`missing_etag_for_${resourceName}`);
  }

  const updateFields = ["names", "phoneNumbers"];
  if (input.email?.trim()) updateFields.push("emailAddresses");

  const body = buildPersonBody(input, etag, sourceEtag);
  // Avoid biography on update — reduces etag/source conflicts
  delete body.biographies;

  const url =
    `https://people.googleapis.com/v1/${resourceName}:updateContact?` +
    new URLSearchParams({
      updatePersonFields: updateFields.join(","),
    }).toString();

  const res = await peopleFetch(accessToken, url, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const parsed = await readJsonSafe(res);
  if (!parsed.ok) {
    throw new Error(parsed.snippet);
  }
  const json = parsed.json as GoogleContactPerson & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `updateContact_failed_${res.status}`);
  }
  return json;
}

/** Create or update; if stored resourceName cannot be updated, create a new contact. */
export async function upsertContact(
  accessToken: string,
  resourceName: string | null,
  input: UpsertContactInput,
  phoneE164: string,
  email: string | null,
): Promise<GoogleContactPerson> {
  if (resourceName) {
    try {
      return await updateContact(accessToken, resourceName, input);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("updateContact failed, falling back:", msg);
      // continue to search/create
    }
  }

  try {
    const existing = await findContactByPhoneOrEmail(accessToken, phoneE164, email);
    if (existing?.resourceName) {
      return await updateContact(accessToken, existing.resourceName, input, existing);
    }
  } catch (e) {
    console.error("search/update fallback failed:", e);
  }

  return await createContact(accessToken, input);
}
