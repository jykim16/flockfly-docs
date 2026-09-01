# Realtime collaboration progress

## Setup

- [x] Parameters acquired: automatic mode, two repositories, six agreed milestones.
- [x] Documentation directory and logs created.
- [x] Repository instructions and relevant architecture inspected.
- [x] Cross-repository dependency map recorded.

## Milestone 1 — realtime foundation

- [x] RED: backend broker, ticket, authorization, and publication tests failed for missing behavior.
- [x] RED: frontend ticket and realtime client tests failed for missing behavior.
- [x] GREEN: backend scoped subscriptions and revision/presence events pass.
- [x] GREEN: frontend reconnecting subscription and safe refresh pass.
- [x] REFACTOR: Redis subscriptions share one subscriber connection per API task; React callback churn does not reconnect sockets; clean remote remounts do not write stale snapshots during disposal.
- [x] VERIFY: backend 234 passing/1 skipped; frontend 53 passing; infrastructure 2 passing; backend workspace typechecks; frontend typecheck and production build pass.
- [x] COMMIT: one matching milestone commit per affected repository recorded here.

### TDD notes

- Backend RED was the expected missing realtime port/service failure. The socket integration test additionally required loopback permission because the workspace sandbox denies `listen(2)`.
- Frontend RED was the expected missing ticket/client/synchronizer behavior.
- WebSocket delivery is deliberately non-authoritative. Milestone 2 adds durable reconnect catch-up from `flockdoc_updates`.

### Milestone 1 commits

- Backend: `8c7bcc1` — `feat(flockdoc): add realtime collaboration foundation`
- Frontend: this milestone commit — `feat: add realtime collaboration foundation`

## Milestone 2 — durable recovery

- [x] RED: backend ordered history, pagination, validation, authorization, and retention-gap tests failed for missing behavior.
- [x] RED: frontend API, reconnect recovery, replay, and snapshot-fallback tests failed for missing behavior.
- [x] GREEN: backend durable event listing and client identity persistence pass.
- [x] GREEN: frontend reconnect catch-up and safe fallback pass.
- [x] REFACTOR: stable revision-derived event IDs, strict cursor advancement, serialized recovery, and recovery-error reconnects follow existing API/client conventions.
- [x] VERIFY: backend 237 passing/1 skipped; frontend 58 passing; infrastructure 2 passing; backend workspace typechecks; frontend typecheck and production build pass.
- [x] COMMIT: one matching milestone commit per affected repository recorded here.

### TDD notes

- Backend RED returned the expected route-level 404s before the durable GET endpoint existed.
- Frontend RED failed on the missing list API, recovery coordinator, connect hook, and snapshot-recovery method.
- `snapshotRevision` is now explicit so a checkpoint is never mistaken for content covering later operation revisions.
- Retention is permitted only when an authoritative checkpoint covers the discarded prefix; a reported gap therefore triggers checkpoint loading rather than partial replay.

### Milestone 2 commits

- Backend: `9707ffb` — `feat(flockdoc): add durable realtime recovery`
- Frontend: this milestone commit — `feat: add durable realtime recovery`

## Remaining milestones

- [x] Milestone 3 — spreadsheet operations.
- [x] Milestone 4 — structural collaboration.
- [ ] Milestone 5 — Paper collaboration.
- [ ] Milestone 6 — snapshot retirement.

## Milestone 3 — spreadsheet operations

- [x] RED: backend operation validation, authorization, idempotency, and publication tests failed for missing behavior.
- [x] RED: frontend conversion, API submission, recovery cursor, and remote apply tests failed for missing behavior.
- [x] GREEN: canonical value/formula/clear operations persist in the durable journal and replay through the existing event protocol.
- [x] GREEN: Univer captures local cell edits and applies remote operations without replacing the editor shell.
- [x] REFACTOR: submissions are serialized, optimistic echoes are suppressed, unsupported Univer values are ignored, and checkpoint replacement restores event subscriptions.
- [x] VERIFY: backend focused and full workspace suites pass; backend workspace typechecks; frontend 68 tests and 2 infrastructure tests pass; frontend typecheck and production build pass.
- [x] COMMIT: one matching milestone commit per affected repository recorded here.

### Milestone 3 commits

- Backend: `b3df51d` — `feat(flockdoc): add spreadsheet cell operations`
- Frontend: this milestone commit — `feat: add spreadsheet cell operations`

### Capability status

`VITE_FLOCKDOC_SPREADSHEET_OPERATIONS=true` enables the operation path. It remains off by default until Milestone 4 covers structural and formatting changes, preventing partially operation-backed spreadsheets from silently losing unsupported edits.

## Milestone 4 — structural collaboration

- [x] DEFINE: exact-base structural conflict policy and checkpoint compaction boundary.
- [x] RED: backend structural validation, ordering, conflict, and compaction tests.
- [x] RED: frontend command conversion, apply, recovery, and checkpoint tests.
- [x] GREEN: backend structural journal and checkpoint behavior.
- [x] GREEN: frontend Univer structural capture/apply and checkpoint authoring.
- [x] VERIFY: frontend 71 tests, 2 infrastructure tests, typecheck, and production build pass; backend focused 19 tests and workspace typechecks pass.
- [x] COMMIT: this milestone commit — `feat: add structural spreadsheet collaboration`.

### Implementation notes

- Sheet events use stable Univer sheet IDs; row/column and merge commands are converted from their persisted command ranges.
- Remote operations apply through the mounted Univer facade while a transient guard suppresses local echo capture.
- Every 100 revisions beyond the last checkpoint requests a live Univer snapshot. The backend archives idempotency keys before pruning covered journal rows.
- Stale structural writes surface the current revision and preserve the local browser state for explicit recovery rather than silently applying ambiguous indexes.

🤖 Assisted by the code-assist SOP
