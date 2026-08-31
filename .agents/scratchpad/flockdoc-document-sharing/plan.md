# Implementation plan

1. Extend the Flockdoc permission API for email-addressed grants, collaborator removal, and invite-link claiming.
2. Add failing backend contract tests covering pending emails, role changes/removal, and link claims.
3. Add typed frontend API methods and failing UI tests for the document Share dialog.
4. Build a shared editor header/dialog used by both Paper and Spreadsheet.
5. Add invite-token routing to claim access before loading document state.
6. Run focused tests, full test suites, typechecks, builds, and infrastructure tests.
7. Commit each repository, deploy backend then frontend, and perform read-only production browser QA.

