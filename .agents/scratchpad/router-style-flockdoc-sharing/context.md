# Router-style Flockdoc sharing context

## Requirements

- Paper and Spreadsheet sharing must follow the Router member/invitation component and wire shapes.
- Document roles are `owner`, `manager`, `commenter`, and `viewer`; assignable labels are “Can manage”, “Can comment”, and “Can view”.
- `manager` can edit documents and invite people. `commenter` can read/comment. `viewer` can read.
- Owners retain access administration, general-access, and deletion authority.
- Restricted/public general access and ordinary document URL copying match Router behavior.
- Existing legacy editor grants migrate to manager capability so editing access is not lost.

## Existing pattern

Router sharing uses `RouterMember = AccessGrant + role`, a separate non-authorizing invitation record, explicit accept/decline, email-keyed role/removal routes, private/public visibility, and a portal dialog with focus trapping. Flockdoc will mirror those concepts with Flockdoc-specific names and the extra commenter role.

## Integration paths

- Backend contracts/schema/services/routes: `context-router/shared` and `context-router/api`.
- Frontend API, workspace invitation surface, and shared editor dialog: `flockfly-docs/src`.
- Legacy token share routes remain readable during migration but are no longer presented by the UI.

