# Context

## Goal

Replace the Presentation flockdoc type with a collaborative Web App type. A Web App stores a bounded bundle of HTML, CSS, and JavaScript files, renders its entry point in a sandboxed iframe, and lets people attach Flockdoc comments to selected DOM elements so agents can read precise feedback.

## Existing documentation

- `README.md` defines four Flockdoc types, collaboration guarantees, WebMCP registration, tests, and the AWS deployment workflow.
- `docs/IMPLEMENTATION_PLAN.md` describes shared roles, permissions, revisions, comments, and realtime collaboration.
- No `CODEASSIST.md` exists. A future one could capture the coordinated frontend/backend validation and deployment sequence.

## Lavish reference

The design follows `kunchenguid/lavish-axi` where it fits Flockdoc:

- Run untrusted artifacts in a sandboxed iframe without same-origin access.
- Inject a small review SDK at render time instead of modifying saved source files.
- Highlight elements on hover and generate stable CSS selectors using IDs and bounded DOM ancestry.
- Send selector, tag, and visible text across a validated `postMessage` boundary.
- Separate annotation mode from interaction mode so native controls remain usable.

Flockdoc differs by persisting bundles through its revision journal and element feedback through its existing multi-user comment API rather than a local CLI polling queue.

## Architecture

- Shared/backend contract: replace `presentation.univer.update` with `webapp.bundle.update` and validate bundle paths, file types, entry point, file count, and total bytes.
- Frontend bundle model: normalized `{ entrypoint, files }`, where files are keyed by safe relative paths and contain UTF-8 text.
- Preview compiler: inline bundle-local stylesheet and script references into the entry HTML, inject a restrictive CSP and annotation SDK, then render through `iframe.srcdoc` with `sandbox="allow-scripts allow-forms"`.
- Web App editor: file rail, source editor, refreshable preview, annotate/interact switch, anchored comment composer, and comment thread list.
- WebMCP: inspect/list/read/write/delete bundle files and read anchored comments. Mutation tools remain editor-only; comments remain readable to viewers and commenters.
- Collaboration: reuse the existing durable outbox, operation journal, realtime events, checkpoints, permissions, sharing, offline recovery, and comment endpoints.

## Security boundaries

- No `allow-same-origin`, popups, top navigation, or downloads in the preview sandbox.
- Injected CSP blocks network, frames, navigation, and form submission; scripts and styles must come from the stored bundle.
- The parent accepts selector messages only from the active iframe window and matching per-render token.
- Paths reject traversal, absolute forms, query/hash suffixes, backslashes, and unsupported extensions.
- Backend size limits are authoritative.

## Migration

Existing `presentation` metadata rows become `webapp`. Their incompatible snapshots normalize to a safe starter bundle when opened. Presentation-only frontend modules and dependencies are removed.

