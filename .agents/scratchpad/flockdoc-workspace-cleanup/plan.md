# Flockdoc workspace cleanup plan

## Test scenarios

1. The sidebar exposes only My workspace and no storage panel.
2. The workspace title has no Share, link-copy, or overflow action group.
3. A file row has no starred affordance and selecting it cannot open a document-level comment drawer.
4. Providing a legacy document-comment action does not register `flockdoc.comment`; real sharing remains available for document permissions.
5. Existing Paper and Spreadsheet opening continues to work.

## Implementation checklist

- [x] Inventory requested and adjacent nonfunctional workspace controls.
- [x] Add failing workspace and WebMCP tests.
- [x] Remove obsolete sidebar, title, star, selection, and comment UI.
- [x] Remove the unanchored comment WebMCP/API/type surface.
- [x] Update public documentation and delete the obsolete component.
- [x] Audit remaining controls that need review.
- [x] Run the full test suite and production build.
- [ ] Commit without pushing.

## Decisions

- Keep editor-level Share controls and permission fields because the requested boundary is inside a specific document.
- Keep backend comment capability out of scope; only remove this frontend's document-level, unanchored use.
- Prefer deleting dead state and components over hiding them with CSS.
