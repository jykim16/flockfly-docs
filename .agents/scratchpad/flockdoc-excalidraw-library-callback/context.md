# Excalidraw library callback context

## Requirements

- A library selected on `libraries.excalidraw.com` must return to the originating Diagram.
- The `#addLibrary=...&token=...` callback must be consumed by Excalidraw and imported into its library.
- Flockdoc routing, authentication, document persistence, and realtime collaboration must remain unchanged.
- The callback must work on direct page load and when the hash changes in an already-open Diagram.

## Existing documentation

- `README.md` defines Diagram as an embedded collaborative Excalidraw canvas.
- Excalidraw's official integration documentation assigns callback parsing and import to `useHandleLibrary({ excalidrawAPI })`.
- Excalidraw's `libraryReturnUrl` documentation states that the host must set `window.name` to return library installation to the same originating tab.
- No project `CODEASSIST.md` exists.

## Root cause

`DiagramEditor` mounts the Excalidraw component but does not mount its exported `useHandleLibrary` integration hook. The editor therefore creates a valid callback URL without consuming it. The Diagram tab also has no stable `window.name`, so the library site receives `target=_blank` instead of a target identifying the originating tab.

## Implementation paths

- `src/features/editor/DiagramEditor.tsx`: attach the dynamically loaded library handler, stable tab target, and explicit return URL.
- `src/__tests__/DiagramEditor.test.tsx`: verify callback handler wiring and tab targeting.

## Dependency map

Diagram library button -> `libraries.excalidraw.com` -> Flockdoc callback hash -> `useHandleLibrary` -> Excalidraw API library import.

The Diagram scene change/outbox/checkpoint path is independent and remains unchanged.
