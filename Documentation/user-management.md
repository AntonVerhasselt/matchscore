# User management

Club member management lives in **Settings → Club members** (`/app/settings`).

## Permissions

There are no roles. **Any member** can:

- Invite new users by email
- Delete any member, including themselves (hard-deletes the auth account)
- Cancel pending invitations

Restrictions:

- Cannot invite yourself
- Cannot delete the last remaining member (including yourself when you are the only member)

## Invite a member

1. Enter the invitee's email and click **Send invitation**.
2. Any existing pending invite for that email in the same organisation is replaced.
3. An email is sent with a link to `/accept-invitation/{token}`.
4. Email locale uses the **inviter's** saved locale from `userSettings`.

## Accept an invitation

1. Invitee opens the email link.
2. The accept page shows the club name and invited email.
3. Invitee continues to sign-in and completes OTP with the **same email**.
4. After sign-in:
   - If an invitation token is stored → `acceptInvitation`
   - Else if a pending invite exists for the signed-in email → `acceptPendingInvitationForCurrentUser`
5. Invitee lands on `/app` (no onboarding).

If the signed-in email does not match the invitation, acceptance fails with a clear error.

## Delete a member

Deletion is permanent:

1. Confirm in the browser dialog.
2. `deleteMember` removes the `organizationMembers` row.
3. `userSettings` for that user is deleted.
4. Better Auth `session`, `account`, and `user` rows are deleted via `internal.auth.deleteUserAccount`.

The deleted user cannot sign in again.

## Cancel a pending invitation

Any member can cancel a pending invitation from the pending list in settings. The invitation status becomes `cancelled`; the invitee can no longer accept it.

## Edge cases

| Scenario | Behaviour |
|----------|-----------|
| Expired invitation | Accept page shows expired message; sign-in auto-accept skips expired invites |
| Already accepted invitation | Accept page shows already-accepted message |
| User signs in without clicking invite link but has pending invite | Auto-accepted by email after OTP |
| User without org visits `/app` | Redirected to `/onboarding` |
| User with org visits `/onboarding` | Redirected to `/app` |

## Related docs

- [Organisations](organisations.md)
- [Authentication](authentication.md)
- [Email internationalization](email-internationalization.md)
