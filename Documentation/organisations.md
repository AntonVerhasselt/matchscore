# Organisations

Matchscore uses a **single-organisation-per-user** model. User-facing copy says **club**; code and docs use **organisation**.

## Data model

Organisation data lives in the app database (`convex/schema.ts`), not in the Better Auth component.

| Table | Purpose |
|-------|---------|
| `organizations` | Club name, auto-generated slug, optional `logoImageUrl`, creator, created timestamp |
| `organizationMembers` | Links Better Auth `user._id` to an organisation |
| `organizationInvitations` | Pending/accepted/cancelled email invitations with secure token |

Better Auth continues to own identity (`user`, `session`, OTP). App tables reference users by `userId` string (Better Auth `_id`), same pattern as `userSettings`.

## Invariants

- Each user belongs to **at most one** organisation.
- Invitations cannot be sent to an email that already belongs to a member.
- Organisation slug is auto-generated from the name (not shown in UI).
- Invitations expire after 7 days.
- The last member of an organisation **cannot** be removed.

## Flows

### New user onboarding

1. User signs in via email OTP.
2. Post-sign-in logic checks organisation membership.
3. If none → redirect to `/onboarding`.
4. User enters club name → `createOrganization` mutation.
5. Redirect to `/app`.

### Invitation

1. Any member invites an email from **Settings → Club members**.
2. `inviteMember` creates a pending invitation and sends an email via Resend.
3. Email link: `/accept-invitation/{token}`.
4. Invitee stores token, signs in with OTP using the **invited email**.
5. `acceptInvitation` (or auto-accept by email) creates membership.
6. Invitee goes to `/app` (skips onboarding).

### Member deletion

1. Any member can delete any member from settings, including themselves.
2. The last remaining member cannot be deleted.
3. `deleteMember` removes the membership row, deletes `userSettings`, and schedules hard deletion of the Better Auth user account.

## Convex API

See [`convex/organizations/`](convex/organizations/):

- **Queries:** `hasOrganization`, `getCurrentMembership`, `listPendingInvitations`, `getInvitationByToken`
- **Mutations:** `createOrganization`, `inviteMember`, `acceptInvitation`, `acceptPendingInvitationForCurrentUser`, `cancelInvitation`, `deleteMember`

## Related docs

- [User management](user-management.md)
- [Authentication](authentication.md)
- [Convex structure](convex-structure.md)
