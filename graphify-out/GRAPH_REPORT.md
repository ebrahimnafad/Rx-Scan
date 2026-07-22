# Graph Report - .  (2026-07-21)

## Corpus Check
- Corpus is ~23,157 words - fits in a single context window. You may not need a graph.

## Summary
- 348 nodes · 779 edges · 15 communities (14 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 26 edges
2. `compilerOptions` - 16 edges
3. `nowISO()` - 15 edges
4. `Prescription` - 14 edges
5. `Settings` - 11 edges
6. `Card()` - 11 edges
7. `getSettings()` - 9 edges
8. `PrescriptionStatus` - 9 edges
9. `invalidateAfterMutation()` - 9 edges
10. `todayISO()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `invalidateAfterMutation()` --references--> `queryClient`  [EXTRACTED]
  src/shared/api/mutations.ts → src/app/App.tsx
- `PrescriptionsPage()` --indirect_call--> `getSettings()`  [INFERRED]
  src/pages/prescriptions/PrescriptionsPage.tsx → src/app/db.ts
- `useSettings()` --indirect_call--> `getSettings()`  [INFERRED]
  src/pages/settings/SettingsPage.tsx → src/app/db.ts
- `getDb()` --calls--> `branchDbName()`  [EXTRACTED]
  src/adapters/idb/base.ts → src/adapters/idb/meta.ts
- `getDb()` --calls--> `getActiveBranchId()`  [EXTRACTED]
  src/adapters/idb/base.ts → src/adapters/idb/meta.ts

## Import Cycles
- None detected.

## Communities (15 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (45): FilterKey, Settings, SortKey, SwipeDirection, SwipeHandlers, SwipeOptions, useSwipeGesture(), BEAM (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (38): App(), queryClient, countAllStatuses(), eraseAllData(), useBadgeCounts(), useOverdueScheduler(), RootLayout(), useBranch() (+30 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (33): ADR-0002, ADR-0008, clearAllPrescriptions(), dedupKey(), fullOuterMerge(), ADR-0001, ADR-0006, ADR-0007 (+25 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (29): countByStatus(), getAllPrescriptions(), getPrescriptionById(), getPrescriptionsByStatus(), updatePrescription(), upsertPrescription(), deriveHistoryFields(), migrateOldBackup() (+21 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (21): RFC-4180, patientEnrichment(), SyncResult, cleanLoyaltyName(), parseSheet1(), SENTINELS_NAME, parseSheet2(), surgicalUpsert() (+13 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (25): jsdom, devDependencies, jsdom, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (23): idb, lucide-react, motion, dependencies, idb, lucide-react, motion, react (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (18): clear(), countFromIndex(), get(), getAll(), getAllFromIndex(), getDb(), getFromIndex(), put() (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ESNext, src, src/vite-env.d.ts, compilerOptions, allowImportingTsExtensions, baseUrl (+14 more)

### Community 9 - "Community 9"
Cohesion: 0.28
Nodes (15): resetDbConnection(), Branch, branchDbName(), createBranch(), deleteBranch(), getActiveBranchId(), getBranches(), getMetaDb() (+7 more)

### Community 10 - "Community 10"
Cohesion: 0.70
Nodes (4): nowISO(), openDB(), promoteScheduled(), todayISO()

## Knowledge Gaps
- **97 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+92 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDb()` connect `Community 7` to `Community 9`, `Community 2`, `Community 3`, `Community 4`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Community 5` to `Community 6`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `Settings` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 7`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _97 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06604324956165984 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06936026936026936 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07419712070874862 - nodes in this community are weakly interconnected._