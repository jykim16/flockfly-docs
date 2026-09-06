# Excalidraw menu cleanup context

## Requirements

- Keep the Diagram editor focused on the Flockdoc document lifecycle.
- Preserve drawing, selection, undo/redo, zoom, realtime scene updates, checkpoints, permissions, and sharing.
- Keep useful in-editor menu actions: save as image, search, help, and clear canvas.
- Remove Excalidraw actions that compete with or bypass Flockdoc storage: load scene, save local scene, and raw scene export.
- Remove Excalidraw branding/social links and non-persisted theme/background controls.
- Disable image insertion because the current Diagram collaboration payload persists elements but not Excalidraw binary files.

## Existing documentation

- `README.md` defines Diagram as a collaborative Excalidraw canvas using the same authenticated revision, checkpoint, presence, offline recovery, and sharing infrastructure as other Flockdocs.
- No `CODEASSIST.md` exists. Project-specific commands come from `README.md` and `package.json`.

## Implementation paths

- `src/features/editor/DiagramEditor.tsx`: dynamically mounts Excalidraw and owns the scene-change bridge.
- `src/__tests__/DiagramEditor.test.tsx`: verifies the embedded Excalidraw configuration and retained menu surface.
- `src/lib/diagram-operations.ts`: unchanged scene transport boundary.

## Dependency map

`DiagramEditor` -> Excalidraw UI configuration -> visible embedded editor controls

`DiagramEditor.onChange` -> diagram operation/outbox -> backend revision and checkpoint persistence

The menu customization is presentation-only and does not alter the second path.

## Uncertainty

“Not needed” is interpreted as removing controls that duplicate Flockdoc lifecycle features or cannot be persisted safely, while retaining generally useful diagram actions.
