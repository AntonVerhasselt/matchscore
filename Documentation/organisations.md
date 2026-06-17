# Organisations

Matchscore uses a **single-organisation-per-user** model. User-facing copy says **club**; code and docs use **organisation**.

Each organisation is linked to exactly one **football team** row (`footballTeams`). The organisation **name** is always the team's display name (e.g. `KSV Aartselaar`, `ASV Geel Dames`). There is no free-text club name at onboarding.

## Data model

Organisation data lives in the app database (`convex/schema.ts`), not in the Better Auth component.

| Table | Purpose |
|-------|---------|
| `organizations` | Team display name, auto-generated slug, **required** `footballTeamId`, optional `logoImageUrl`, creator, created timestamp |
| `organizationMembers` | Links Better Auth `user._id` to an organisation |
| `organizationInvitations` | Pending/accepted/cancelled email invitations with secure token |
| `footballTeams` | Imported club/team data (search, calendar, template bindings) — see [football-season-import.md](./football-season-import.md) |

Better Auth continues to own identity (`user`, `session`, OTP). App tables reference users by `userId` string (Better Auth `_id`), same pattern as `userSettings`.

### Organisation ↔ team

| Rule | Detail |
|------|--------|
| Cardinality | One org → one team; one team → at most one org |
| Index | `organizations.by_footballTeamId` (unique) |
| Name | `organizations.name` = linked `footballTeams.name` |
| Slug | Auto-generated from name at create; **unchanged** when team changes in Settings |

## Invariants

- Each user belongs to **at most one** organisation.
- `createOrganization` requires `footballTeamId`; no org without a linked team.
- A team already linked to another org cannot be selected again (onboarding or Settings).
- Invitations cannot be sent to an email that already belongs to a member.
- Organisation slug is auto-generated from the team name (not shown in UI).
- Invitations expire after 7 days.
- The last member of an organisation **cannot** be removed.

## Flows

### New user onboarding

1. User searches/selects their team on the landing page (optional) or during onboarding.
2. User signs in via email OTP.
3. Post-sign-in logic checks organisation membership.
4. If none → redirect to `/onboarding`.
5. User confirms or selects a team → `createOrganization({ footballTeamId })`.
6. Org name = team name; forced competition sync scheduled if team is on API allowlist.
7. Redirect to `/app`.

### Invitation

1. Any member invites an email from **Settings → Club members**.
2. `inviteMember` creates a pending invitation and sends an email via Resend.
3. Email link: `/accept-invitation/{token}`.
4. Invitee stores token, signs in with OTP using the **invited email**.
5. `acceptInvitation` (or auto-accept by email) creates membership.
6. Invitee goes to `/app` (skips onboarding) — inherits the org's linked team.

### Change linked team (Settings)

1. Any member opens **Settings → Linked team**.
2. Search and select a different `footballTeamId`.
3. `updateOrganizationFootballTeam` patches `footballTeamId` and org `name`; **slug unchanged**.
4. Forced competition sync scheduled for the new team's allowlisted path.
5. Calendar and template preview/render sample data update to the new team's matches.

### Member deletion

1. Any member can delete any member from settings, including themselves.
2. The last remaining member cannot be deleted.
3. `deleteMember` removes the membership row, deletes `userSettings`, and schedules hard deletion of the Better Auth user account.

## Convex API

See [`convex/organizations/`](convex/organizations/):

- **Queries:** `hasOrganization`, `getCurrentMembership`, `listPendingInvitations`, `getInvitationByToken`
- **Mutations:** `createOrganization({ footballTeamId })`, `updateOrganizationFootballTeam`, `inviteMember`, `acceptInvitation`, `acceptPendingInvitationForCurrentUser`, `cancelInvitation`, `deleteMember`

Football team search and calendar: [`convex/football/queries.ts`](../convex/football/queries.ts).

## Related docs

- [User management](user-management.md)
- [Authentication](authentication.md)
- [Convex structure](convex-structure.md)
- [Football season import](football-season-import.md)
- [Voetbal data integration plan](../plans/voetbal-data-integration.md)
