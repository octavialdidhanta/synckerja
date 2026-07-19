import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const j = JSON.parse(
  fs.readFileSync(path.join(repoRoot, '.tmp-deploy-cs-mcp.json'), 'utf8'),
);
const dir = path.join(repoRoot, 'supabase', 'functions', '.deploy-bundle-cs');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const files = [];
for (const f of j.files) {
  files.push({ name: f.name, content: f.content });
}

fs.writeFileSync(path.join(dir, 'payload.json'), JSON.stringify({
  name: 'tiktok-shop-customer-service',
  entrypoint_path: 'index.ts',
  verify_jwt: false,
  files,
}));
console.log('payload bytes', fs.statSync(path.join(dir, 'payload.json')).size);
