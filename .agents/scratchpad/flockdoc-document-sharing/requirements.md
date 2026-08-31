# Flockdoc document sharing requirements

## Scope

- Sharing is available only inside an open Paper or Spreadsheet.
- Owners and managers can add teammates by email and agents by ID.
- Existing collaborator roles can be changed or removed.
- Document invite links can be created, copied, listed, and revoked.
- Opening an invite link while signed in claims the link role and opens the document.
- Viewers and editors without `canShare` cannot open the sharing controls.
- Workspace-level sharing and document-level comments remain out of scope.

## Acceptance criteria

1. The editor Share button opens an accessible dialog backed by live API data.
2. A teammate email may refer to an existing account or a pending account.
3. User, team, and agent grants are listed without exposing the owner's grant or raw link grants.
4. Role updates and removals persist through the unified `entity_access` permission model.
5. Invite-link tokens are shown only on creation; stored links continue to expose metadata and revocation.
6. A signed-in recipient can claim a valid invite token; expired or revoked tokens cannot be claimed.
7. Paper and Spreadsheet use the same sharing component and visual language.

