# Plan

## Test scenarios

1. Given an editable Diagram, when Excalidraw mounts, its input enables only supported canvas actions and disables image insertion and built-in AI.
2. Given the custom main menu, it contains save-as-image, search, help, and clear-canvas actions.
3. Given the custom main menu, local scene loading/saving, raw export, social links, theme switching, and canvas background controls are absent.
4. Existing Diagram scene persistence and remote collaboration tests remain green.

## Implementation

- Add a focused component test that captures Excalidraw’s mount properties and custom menu children.
- Configure supported `UIOptions` in `DiagramEditor`.
- Render an explicit custom Excalidraw `MainMenu` so the package fallback menu is not used.
- Run the focused test, full frontend suite, typecheck, and production build.
- Review and commit the verified frontend-only change.
