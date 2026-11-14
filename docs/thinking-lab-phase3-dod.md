# Thinking Lab — Definition of Done (Fase 3)

## Checklist

| # | Kriteria | Status |
|---|----------|--------|
| 1 | Page shells: `page/shells/LabMasterColumn`, `LabWorkspaceGrid`, `LabDialogs` | Done |
| 2 | Inspector public shell thin; view + types + kind body modules under `section/inspector/` | Done |
| 3 | Map: `section/map/mapTypes`, `mapGeometry`, MapNodePill/MapBranch exports | Done |
| 4 | Script: `section/script/SpokenReading`, `ExecutionPassChecklist` (+ re-export from panel) | Done |
| 5 | `runExecutionMeaningChecks` / `runExecutionOpenChecks` via `meaningGateRunner` + `runGateChain` | Done |
| 6 | Image open/meaning via `imageGateRunner` + `runGateChain` | Done |
| 7 | Creative: `recommendTypes.ts` extracted | Done |
| 8 | Vitest thinking-lab + MCP thinking suites green | See verification run |
| 9 | Smoke manual documented below | Checklist ready |

## Smoke manual (wajib sebelum produksi)

1. Buka Thinking Lab  
2. Create/save Master Thought  
3. Generate Big Thought → gagal cek → Revise → Lock  
4. Generate Territory → Angle → Idea → Lock idea  
5. Generate Execution → satu fail meaning → open recheck / repair path  

## Ukuran file (verifikasi agent)

| File | Lines (approx) |
|------|----------------|
| `ThinkingLabPage.tsx` | 1810 (shells extracted; props bag still large) |
| `LabNodeInspector.tsx` (public shell) | 5 |
| `inspector/LabNodeInspectorView.tsx` | 1225 |
| `MasterThoughtMapTree.tsx` | 1033 (types/geometry extracted) |
| `ExecutionScriptPanel.tsx` | 1049 (`SpokenReading` + `ExecutionPassChecklist` extracted) |
| `meaningGateRunner.ts` / `imageGateRunner.ts` | 130 / 143 |

Tes: `npm test -- src/thinking-lab` → **510 passed**; `services/mcp` → **298 passed**.

## Fase 4 / backlog

- Pass-switch rewrite penuh + hapus `fixScope` jika tidak dipakai  
- Pecah penuh `LabNodeInspectorView` JSX per kind (bodies saat ini modul checklist)  
- Pecah `ExecutionScriptTable` / Map branch JSX lebih dalam  
- Page &lt; 1200 baris (props bag masih besar)  
- Rename DB `AUDIT_*` / analytics `lab_audit`  
- Playwright E2E  
