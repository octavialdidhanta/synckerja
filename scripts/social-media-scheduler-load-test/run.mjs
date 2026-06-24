#!/usr/bin/env node
/**
 * Invoke social-media-scheduler on an interval and print a summary.
 *
 * Env:
 *   SUPABASE_URL
 *   SCHEDULED_POSTS_INTERNAL_SECRET
 *
 * Usage:
 *   node scripts/social-media-scheduler-load-test/run.mjs --duration-minutes 20 --invoke-interval-sec 60
 */

const args = process.argv.slice(2);

function readArg(name, fallback) {
  const idx = args.indexOf(name);
  if (idx === -1 || !args[idx + 1]) return fallback;
  return args[idx + 1];
}

const durationMinutes = Number(readArg('--duration-minutes', '20'));
const invokeIntervalSec = Number(readArg('--invoke-interval-sec', '60'));

const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const secret = process.env.SCHEDULED_POSTS_INTERNAL_SECRET ?? '';

if (!supabaseUrl || !secret) {
  console.error('Set SUPABASE_URL and SCHEDULED_POSTS_INTERNAL_SECRET');
  process.exit(1);
}

const endpoint = `${supabaseUrl}/functions/v1/social-media-scheduler`;
const endAt = Date.now() + durationMinutes * 60_000;

const totals = {
  invokes: 0,
  published_ok: 0,
  claimed: 0,
  deferred_rate_limited: 0,
  failed: 0,
  max_duration_ms: 0,
};

async function invokeOnce() {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${json.error ?? text}`);
  }

  return json;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log(`Load test runner: ${durationMinutes} min, interval ${invokeIntervalSec}s`);
console.log(`Endpoint: ${endpoint}`);

while (Date.now() < endAt) {
  const started = Date.now();
  try {
    const result = await invokeOnce();
    totals.invokes += 1;
    totals.published_ok += Number(result.published_ok ?? 0);
    totals.claimed += Number(result.claimed ?? 0);
    totals.deferred_rate_limited += Number(result.deferred_rate_limited ?? 0);
    totals.failed += Number(result.failed ?? 0);
    totals.max_duration_ms = Math.max(totals.max_duration_ms, Number(result.duration_ms ?? 0));

    const monitoring = result.monitoring ?? {};
    console.log(
      `[${new Date().toISOString()}] duration=${result.duration_ms}ms published_ok=${result.published_ok} claimed=${result.claimed} deferred=${result.deferred_rate_limited} pending_due=${monitoring.pending_due_now_count ?? '?'} pending_late=${monitoring.pending_late_count ?? '?'}`,
    );
  } catch (err) {
    console.error(`[${new Date().toISOString()}] invoke failed:`, err instanceof Error ? err.message : err);
  }

  const elapsed = Date.now() - started;
  const waitMs = Math.max(0, invokeIntervalSec * 1000 - elapsed);
  if (Date.now() + waitMs >= endAt) break;
  await sleep(waitMs);
}

console.log('\n--- Summary ---');
console.log(JSON.stringify(totals, null, 2));
console.log('Run report.sql in Supabase SQL editor for p95 latency and tick stats.');
