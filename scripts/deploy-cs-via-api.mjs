import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const projectRef = 'wqdzqqshoifwyrltzgvx';
const slug = 'tiktok-shop-customer-service';
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const payload = JSON.parse(
  fs.readFileSync(path.join(repoRoot, '.tmp-deploy-cs-mcp.json'), 'utf8'),
);

const form = new FormData();
form.append(
  'metadata',
  JSON.stringify({
    name: slug,
    entrypoint_path: 'index.ts',
    verify_jwt: false,
  }),
);

for (const file of payload.files) {
  // Management API expects file paths relative to function root
  const blob = new Blob([file.content], { type: 'application/typescript' });
  form.append('file', blob, file.name);
}

const url = `https://api.supabase.com/v1/projects/${projectRef}/functions/deploy?slug=${encodeURIComponent(slug)}`;
const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const text = await res.text();
console.log(res.status, text.slice(0, 2000));
if (!res.ok) process.exit(1);
