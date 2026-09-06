# Plan

## Test scenarios

1. Given a Diagram with a non-alphanumeric document ID, mounting sets a stable alphanumeric tab target derived from that ID; unmounting restores the prior name.
2. Given the dynamically loaded Excalidraw API, the library callback handler receives that API instance.
3. Excalidraw receives an explicit return URL containing the current origin and pathname but no callback hash.
4. Existing menu restrictions, Diagram collaboration tests, and workspace behavior remain green.

## Implementation

- Extend the Excalidraw test double to expose and observe the library callback hook.
- Add failing assertions for tab naming, return URL, and API handoff.
- Add a small adapter component around the dynamically loaded hook to preserve code splitting and React hook ordering.
- Run focused tests, the complete frontend suite, typecheck, build, and rendered callback QA.
- Review and commit without pushing or deploying.
