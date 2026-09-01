# Plan

## Acceptance criteria

- [x] A remote Paper snapshot updates the mounted editor without remounting its React shell.
- [x] A remote Spreadsheet snapshot updates the mounted editor without remounting its React shell.
- [x] The heavy Univer dynamic mount runs once per opened document, not once per revision.
- [x] Autosave listeners follow the replacement unit and do not create no-op revisions.
- [x] Existing realtime sync and feedback-loop protections remain green.

## Steps

1. Add failing component regressions for stable editor hosts and in-place snapshot application.
2. Extend the mounted Univer adapter with snapshot replacement.
3. Remove revision-based React keys and update editor effects through refs.
4. Run targeted/full tests, typecheck, and production build.
5. Commit and deploy after an asset-only CDK review.
