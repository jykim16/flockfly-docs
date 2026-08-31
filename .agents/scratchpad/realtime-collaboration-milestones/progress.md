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

## Later milestones

- [ ] Milestone 2 — durable recovery.
- [ ] Milestone 3 — spreadsheet operations.
- [ ] Milestone 4 — structural collaboration.
- [ ] Milestone 5 — Paper collaboration.
- [ ] Milestone 6 — snapshot retirement.
