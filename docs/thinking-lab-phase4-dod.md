# Thinking Lab — Definition of Done (Fase 4 teknis)

Scope: extract-only + type-safety. Item produk (rename `AUDIT_*`, redesign creative pillar, Playwright) **di luar** gelombang ini — lihat [`thinking-lab-phase2-remaining.md`](./thinking-lab-phase2-remaining.md).

## Checklist

| # | Kriteria | Status |
|---|----------|--------|
| 1 | Script helpers → `section/script/` (`ScriptChrome`, `ScriptAssets`, `SceneTables`); panel API stabil | Done |
| 2 | Map primitives nyata: `MapNodePill`, `MapBranch` (`EqualBranch`, `MapCurves`, `longestLabel`) | Done |
| 3 | Inspector: `types.ts` dipakai; `InspectorChrome`; body per kind (Idea/Angle/Territory/BigThought/Master) | Done |
| 4 | `LabWorkspaceGridProps` typed slices (tanpa `[key: string]: any`); dead destructure dibuang; unbound scan OK | Done |
| 5 | Pass-switch / `FixScope` alignment docs; `FixScope` **tetap live** untuk meaning-line repair | Done |
| 6 | Vitest thinking-lab hijau | See verification |
| 7 | Docs: phase4-dod + remaining updated | Done |

## Ukuran file (verifikasi)

| File | Lines (approx) |
|------|----------------|
| `ExecutionScriptPanel.tsx` | 583 |
| `MasterThoughtMapTree.tsx` | 784 |
| `inspector/LabNodeInspectorView.tsx` | 627 |
| `LabWorkspaceGrid.tsx` | 972 |
| `ThinkingLabPage.tsx` | 1718 (typed slices; target &lt;1200 ditunda — wiring tetap on-page) |

## Verifikasi

- `npm test -- src/thinking-lab/section/ExecutionScriptPanel.test.tsx` — pass
- `npm test -- src/thinking-lab/section/MasterThoughtMapTree.test.tsx` — pass (17)
- `npm test -- src/thinking-lab/section/LabNodeInspector.test.tsx` — pass (50)
- `npm test -- src/thinking-lab --run` — **510 passed** (setelah props slices)
- `npm test -- src/thinking-lab/shared/fixScope.test.ts` + `execution/test-file/passChecklist.test.ts` — pass
- Unbound scan: `scripts/thinking-lab-labWorkspaceGrid-unbound-scan.mjs` → OK

## Smoke manual (sama Fase 3)

1. Buka Thinking Lab (mount tanpa `ReferenceError`)
2. Create/save Master Thought
3. Generate Big Thought → gagal cek → Revise → Lock
4. Generate Territory → Angle → Idea → Lock idea
5. Generate Execution → fail meaning → repair; toggle satu pass-switch

## FixScope keputusan

`FixScope` / `fixScopeLines` **wajib tetap**: dipakai `buildExecutionMeaningRepairPrompt`. Pass-switch memakai prompt terpisah (`buildPassSwitchRewritePrompt`); keduanya didokumentasikan di `gateRegistry.ts`.
