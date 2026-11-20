#!/usr/bin/env python3
"""Turn Supabase get_advisors output into stable keys, and diff against a baseline.

Usage:
  advisor_keys.py snapshot SECURITY.json PERFORMANCE.json > baseline.json
  advisor_keys.py diff baseline.json SECURITY.json PERFORMANCE.json
Diff prints NEW items (exit 1 if any) and RESOLVED items. Performance INFO lints
(unindexed FK, unused index) are tracked only as counts, since they churn.
"""
import json, sys

PERF_COUNT_ONLY = {"unindexed_foreign_keys", "unused_index"}

def load(path):
    with open(path) as f:
        data = json.load(f)
    if isinstance(data, list):  # MCP may wrap as [{"type":"text","text":...}]
        data = json.loads(data[0]["text"])
    return data.get("result", data).get("lints", [])

def key(lint, f):
    m = f.get("metadata") or {}
    parts = [lint["name"], m.get("schema", ""), m.get("name", "")]
    if m.get("arguments") is not None:
        parts.append(m["arguments"])
    if m.get("fkey_name"):
        parts.append(m["fkey_name"])
    if not m.get("name"):
        parts.append(f.get("detail", ""))
    return "|".join(parts)

def collect(sec_path, perf_path):
    keys, counts = set(), {}
    for kind, path in (("security", sec_path), ("performance", perf_path)):
        for lint in load(path):
            counts[f"{kind}:{lint['name']}:{lint['level']}"] = lint.get("count", len(lint.get("findings", [])))
            if kind == "performance" and lint["name"] in PERF_COUNT_ONLY:
                continue
            for f in lint.get("findings", []):
                keys.add(f"{lint['level']}|{key(lint, f)}")
    return keys, counts

def main():
    cmd = sys.argv[1]
    if cmd == "snapshot":
        keys, counts = collect(sys.argv[2], sys.argv[3])
        json.dump({"counts": dict(sorted(counts.items())), "keys": sorted(keys)}, sys.stdout, indent=1)
        print()
    elif cmd == "diff":
        base = json.load(open(sys.argv[2]))
        keys, counts = collect(sys.argv[3], sys.argv[4])
        new = sorted(keys - set(base["keys"]))
        gone = sorted(set(base["keys"]) - keys)
        print(f"NEW {len(new)}")
        for k in new: print("  +", k)
        print(f"RESOLVED {len(gone)}")
        for k in gone: print("  -", k)
        print("COUNTS (now vs baseline)")
        for c in sorted(set(counts) | set(base["counts"])):
            a, b = counts.get(c, 0), base["counts"].get(c, 0)
            print(f"  {c}: {a} (baseline {b})" + ("  <-- up" if a > b else ""))
        sys.exit(1 if new else 0)

if __name__ == "__main__":
    main()
