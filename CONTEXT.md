# Domain Context & Glossary

This file establishes the ubiquitous language and core domain concepts for RxScan.
Any architectural review or feature development should use exactly these terms.

## Prescription Repository

The **Prescription Repository** is the single source of truth for the local persistence of prescriptions (via IndexedDB).
It is a deep module that guarantees data integrity and automatically maintains materialized views.

- **Queue Assignment**: The repository automatically runs the queue rebalancing algorithm (`rebalanceQueueTx`) at the end of any write transaction that creates, updates, or deletes a prescription. Callers NEVER manually manage queue positions.
- **Surgical Upsert**: When syncing from external sources (like Google Sheets), the repository handles the domain logic of merging new rows, skipping acted-on rows, and correctly resolving duplicates within a single atomic batch operation.

## Prescription

A single medication order for a patient. It goes through various lifecycle states (e.g. `pending`, `scheduled`, `dispensed`).

## Patient

A customer tied to a National ID, often enriched with Loyalty Program data (Name, Phone). Enrichment is managed during the surgical upsert inside the Prescription Repository.

## Architectural Horizon (Future Growth)

As the application scales, keep the following architectural constraints and planned refactors in mind to prevent structural rot:

### 1. Data Access Object (DAO) Splitting
Right now, `app/db.ts` acts as a monolithic "God Object" Repository handling prescriptions, settings, queue rebalancing, and sync metadata. While cohesive, if new domains are added (e.g., `Patients`, `Medications`, `Users`), `db.ts` must be split into domain-specific DAOs (e.g., `prescriptionStore.ts`, `settingsStore.ts`). The goal is to prevent a single file from becoming a bottleneck for all database operations.

### 2. The Sync/Export Adapter Pattern
Currently, the Google Sheets integration and CSV parsing logic within the Sync/Export layer is slightly procedural and tightly coupled. If the application is ever to support other backends (e.g., a real REST API, Firebase, or a hospital HIS), this layer must be refactored to formalize an **Adapter pattern**. This would abstract away the "Google Sheets" specific implementation behind a standard `SyncProvider` interface, allowing multiple backend sources to be swapped seamlessly.
