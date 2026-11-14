# Master Thought flow module

Handlers for creating and saving a Master Thought live in [`masterThoughtFlow.ts`](../src/thinking-lab/page/masterThoughtFlow.ts).

## API

- `saveMasterBelief(ctx, input)` — switched-on checks, then confirm/save.
- `createMasterThoughtActions(deps)` → `{ onCreate, onSuggestBeliefs, onSaveMaster, saveMasterBelief }`

## Usage in the page

`ThinkingLabPage` builds `createMasterThoughtActions({ run, runManual, masters, skipFor, … })` alongside other `*Flow` modules.

Written-belief checks are **not** on `gateChain` (by design for phase 2).