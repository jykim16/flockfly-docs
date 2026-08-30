# Flockdoc workspace cleanup progress

- [x] Automatic parameters resolved.
- [x] Documentation and component inventory completed.
- [x] RED recorded.
- [x] GREEN recorded.
- [x] Remaining-control audit completed.
- [x] Full validation completed.
- [ ] Commit recorded.

## Notes

- The workspace comment drawer publishes comments against the whole flockdoc rather than content anchors, so its state, UI, WebMCP action, and client helper are removed as one obsolete chain.
- RED: 3 expected failures confirmed the five-item sidebar/storage panel, document-comment tool, and selection/comment drawer were still present.
- Refactor RED: 3 expected failures confirmed My workspace was still inert, file opening still required a double-click, and sharing was still exposed before opening a document.
- GREEN: 2 focused test files and 8 tests passed.
- File rows now open on a normal click/keyboard activation, and My workspace is a real current-page link.
- React review: workspace WebMCP registration now runs once and reads changing API/item state through the existing refs, avoiding duplicate tool registration when authentication changes.
- Rendered QA: the local `/flockdoc/` shell rendered without an error overlay or console warnings; New expanded its create menu and the Papers filter became active.
- Full validation: 6 test files and 37 tests passed; the production Vite build completed successfully.

## Remaining controls needing review

- **Folder creation:** the New → Folder menu item closes the menu but intentionally returns without creating anything.
- **Help:** the question-mark button has no handler or help destination.
- **Editor Share:** Paper and Spreadsheet show a Share button, but no dialog or action is wired yet; this is the correct future location for sharing.
- **People & agents:** the backend mapper currently supplies an empty collaborator list, so this table column cannot show real collaborators.
- **Editor identity:** the editor avatar is hard-coded to `You` instead of using the authenticated profile.
- **Content comments:** `canComment` permissions remain, but Univer selection anchors, comment threads, and editor WebMCP tools still need a content-level design.
- **Create menu UX:** outside-click and Escape dismissal are not implemented.
- **File table accessibility:** the grid uses ARIA table/row roles on buttons and should receive a dedicated keyboard/screen-reader review.
