import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const root = path.join(repoRoot, 'supabase', 'functions');
const entry = 'tiktok-shop-customer-service/index.ts';
const seen = new Set();
const files = [];

function toDeployName(relFromRoot) {
  if (relFromRoot.startsWith('tiktok-shop-customer-service/')) {
    return relFromRoot.slice('tiktok-shop-customer-service/'.length);
  }
  return '../' + relFromRoot;
}

function walk(relFromRoot) {
  const normalized = relFromRoot.replace(/\\/g, '/');
  if (seen.has(normalized)) return;
  seen.add(normalized);
  const abs = path.join(root, normalized);
  if (!fs.existsSync(abs)) {
    console.error('missing', abs);
    return;
  }
  const content = fs.readFileSync(abs, 'utf8');
  files.push({ name: toDeployName(normalized), content });
  const re = /from\s+["'](\.\.?\/[^"']+)["']/g;
  let m;
  while ((m = re.exec(content))) {
    let imp = m[1];
    if (!imp.endsWith('.ts') && !imp.endsWith('.js')) imp += '.ts';
    const fromDir = path.dirname(abs);
    const target = path.normalize(path.join(fromDir, imp));
    const nextRel = path.relative(root, target).replace(/\\/g, '/');
    walk(nextRel);
  }
}

walk(entry);
console.log(JSON.stringify(files.map((f) => ({ name: f.name, bytes: f.content.length })), null, 2));
fs.writeFileSync(path.join(repoRoot, '.tmp-deploy-cs.json'), JSON.stringify({ files }));
