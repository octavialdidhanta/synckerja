# Big Thought certification

This document is the definition of done for the existing Big Thought engine. It does not change Generate, Audit, Fix, Challenger, Lock, or the production prompts.

## Coverage map

Existing stage tests already prove their own contracts. The certification layer does not copy those assertions.

| Behavior | Already proved | Certification adds |
| --- | --- | --- |
| Resolved elaboration or restatement becomes `GENERATE_REJECT` | `policy.test.ts` | Not copied |
| Premise, reason, and evidence can be `GENERATE_VALID` | `policy.test.ts` | Not copied |
| Generate quota, persistence, and prompt bans | `generate.test.ts` | Not copied |
| Audit verdicts, stale sibling membership, fix persistence | `audit.test.ts` | Not copied |
| Fix replaces only `AUDIT_FAIL` rows | `fix.test.ts` | Not copied |
| Challenger missing-support shape and legacy status | `challenger.test.ts` | Not copied |
| Lock flags passed in directly | `lock.test.ts` | Not copied |
| Consequence, criterion, example, tactic, and execution reject | — | Deterministic policy completeness |
| Scored set cannot lock when proof, fingerprint, duplicate, or challenger gates fail | — | Deterministic integration |
| Golden parent/candidate sentences | — | Corpus data, judged only by the live runner |

## Pipeline

Generate → individual semantic judge → `individualAdmission` → sibling audit → Fix → Challenger → Lock.

## When the engine is CERTIFIED

The Big Thought engine is CERTIFIED only when all of the following are true:

- Every existing deterministic test passes.
- Every new deterministic certification test passes.
- There are zero critical safety failures.
- Known restatement, elaboration, and method cases do not become `GENERATE_VALID`.
- Known clean material-support cases do not fail consistently.
- Critical sibling duplicate cases are detected.
- Lock gates stay fail-closed.
- Critical live cases do not oscillate between `GENERATE_VALID` and `GENERATE_REJECT`.

`UNRESOLVED` is allowed for a genuinely ambiguous case (`NOT_VALID`).

## Status meanings

| Field | Values |
| --- | --- |
| `deterministicStatus` | `PASS`, `FAIL`, `NOT_RUN` |
| `liveSemanticStatus` | `PASS`, `FAIL`, `NOT_RUN` |
| `overall` | `CERTIFIED`, `PENDING_LIVE`, `NOT_CERTIFIED` |

`semantic AI certified` is not claimed while live certification has not been run.

`deterministicStatus` comes from the exit code of the Big Thought deterministic suite. It is not hardcoded.

- Deterministic suite fails: live certification does not start. Overall is `NOT_CERTIFIED`.
- Deterministic suite passes and the live flag is absent: live status stays `NOT_RUN`. Overall is `PENDING_LIVE`. No network call is made.
- Deterministic suite passes and the live suite passes with no critical, false-negative, repeatability, or sibling failures: overall is `CERTIFIED`.

A live-only run still reports `deterministicStatus: NOT_RUN`. That report cannot be `CERTIFIED`.

A failed HTTP request, an authentication failure, a provider error, or a response with no usable script is an infrastructure failure. It is recorded in `infrastructureFailures` and is not treated as semantic `UNRESOLVED`. A model script that itself returns `UNRESOLVED` remains a semantic ambiguity. Any infrastructure failure makes the live result `FAIL` and the overall result `NOT_CERTIFIED`.

## How to run

Offline, included in the default suite:

```bash
npm test
```

That command must not call Supabase, the network, or a live model.

Final certification, separate from Vitest's default run. It runs the Big Thought deterministic suite first, then live semantic certification only when the flag is set:

```bash
THINKING_LAB_LIVE_CERTIFICATION=1 THINKING_LAB_ACCESS_TOKEN=... npm run certify:thinking-lab:bt
```

Without `THINKING_LAB_LIVE_CERTIFICATION=1`, that command still runs the deterministic suite. If those tests pass, it prints `PENDING_LIVE` and does not call the network. The access token is read from the environment. It is not stored in the repository.

Live-only status, which does not claim a combined certification:

```bash
THINKING_LAB_LIVE_CERTIFICATION=1 THINKING_LAB_ACCESS_TOKEN=... npm run certify:thinking-lab:bt:live
```

Each critical individual case is sent through production `judgeBigThought` five times at temperature `0`. Each critical sibling case is sent through production `judgeSiblingSet` five times. Explanation wording is not required to match.

## Frozen after certification

After the engine is certified, the Big Thought system is frozen.

Re-open production semantic code only when a reproducible structural regression pattern is found. One borderline sentence, or one output that is merely less preferred, is not a reason to patch production.

If live certification finds a semantic failure, record it as a `CERTIFICATION BLOCKER` with the case id, expected result, actual result, repeatability, and the suspected failure pattern. A production prompt patch is a separate task after that pattern is established.
