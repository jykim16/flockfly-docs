# Web App Flockdocs

Web App flockdocs store a collaborative bundle of relative `.html`, `.css`, and `.js` files with one HTML entrypoint. Bundle changes use the same revision journal, realtime delivery, checkpoints, offline outbox, roles, sharing, versions, and recovery flow as the other flockdoc types.

## Preview and review boundary

The preview runs in an iframe with scripts and forms enabled, but without same-origin access, popups, downloads, or top-level navigation. A restrictive content security policy blocks network requests and nested frames. Local stylesheet and script references are inlined from the saved bundle.

The review bridge is inspired by the open-source [Lavish project](https://github.com/kunchenguid/lavish-axi): Flockdoc injects it only into the rendered preview and never writes it into the user's files. Annotate mode outlines targets and records a stable CSS selector, tag name, and visible text. Interact mode restores the app's normal click behavior. Parent and preview messages are scoped to the current iframe window and a per-render token.

Element comments use the existing permission-backed Flockdoc comment threads. Their anchors have this shape:

```json
{
  "kind": "webapp",
  "selector": "#checkout > button:nth-of-type(1)",
  "tag": "button",
  "text": "Buy now"
}
```

## WebMCP tools

- `inspect_web_app`
- `list_web_app_files`
- `read_web_app_file`
- `read_web_app_comments`
- `write_web_app_files` (editors only)
- `delete_web_app_files` (editors only)

The comment reader returns the selector anchor with each comment so an agent can find the precise element before changing HTML, CSS, or JavaScript.
