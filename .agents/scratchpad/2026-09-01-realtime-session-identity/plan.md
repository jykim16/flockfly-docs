# Plan

## Acceptance criteria

- [x] A copied legacy/session-storage ID is not reused as the live page identity.
- [x] Repeated ID reads in one page realm return the same value for reconnect stability.
- [x] Separate page realms independently generate IDs because the singleton is not stored in shared or copied browser storage.
- [x] Local echo filtering still ignores this page's own commits.
- [x] Existing realtime recovery and snapshot feedback-loop protections remain green.

## Steps

1. Add a failing duplicated-tab identity regression.
2. Replace storage-backed identity with a page-realm singleton.
3. Run targeted and full tests, typecheck, and production build.
4. Commit the hotfix and deploy after reviewing an asset-only CDK diff.
