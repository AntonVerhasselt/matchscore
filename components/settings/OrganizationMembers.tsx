"use client";

import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { showErrorToast, showSuccessToast } from "@/lib/user-feedback";

type PendingDelete = {
  memberId: Id<"organizationMembers">;
  isCurrentUser: boolean;
  displayName: string;
};

function formatJoinedDate(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

export function OrganizationMembers() {
  const t = useTranslations("settings.members");
  const locale = useLocale();
  const router = useRouter();
  const membership = useQuery(api.organizations.queries.getCurrentMembership);
  const pendingInvitations = useQuery(
    api.organizations.queries.listPendingInvitations,
  );
  const inviteMember = useMutation(api.organizations.mutations.inviteMember);
  const deleteMember = useMutation(api.organizations.mutations.deleteMember);
  const cancelInvitation = useMutation(
    api.organizations.mutations.cancelInvitation,
  );

  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [deletingMemberId, setDeletingMemberId] =
    useState<Id<"organizationMembers"> | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] =
    useState<Id<"organizationInvitations"> | null>(null);

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    setInviting(true);
    const invitedEmail = email.trim();

    try {
      await inviteMember({ email: invitedEmail });
      setEmail("");
      showSuccessToast(t("inviteSuccess", { email: invitedEmail }));
    } catch {
      showErrorToast(t("inviteFailed"));
    } finally {
      setInviting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    const { memberId, isCurrentUser, displayName } = pendingDelete;

    setDeletingMemberId(memberId);

    try {
      await deleteMember({ memberId });
      setPendingDelete(null);

      if (isCurrentUser) {
        await authClient.signOut();
        router.push("/");
        router.refresh();
        return;
      }

      showSuccessToast(t("deleteSuccess", { member: displayName }));
    } catch {
      showErrorToast(t("deleteFailed"));
    } finally {
      setDeletingMemberId(null);
    }
  };

  const handleCancelInvitation = async (
    invitationId: Id<"organizationInvitations">,
  ) => {
    setCancellingInvitationId(invitationId);

    try {
      await cancelInvitation({ invitationId });
      showSuccessToast(t("cancelInviteSuccess"));
    } catch {
      showErrorToast(t("cancelFailed"));
    } finally {
      setCancellingInvitationId(null);
    }
  };

  if (membership === undefined || pendingInvitations === undefined) {
    return null;
  }

  if (!membership) {
    return null;
  }

  const memberCount = membership.members.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={(event) => void handleInvite(event)} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t("inviteEmail")}</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("invitePlaceholder")}
              required
            />
          </div>
          <Button type="submit" disabled={inviting || !email.trim()}>
            {inviting ? t("inviting") : t("inviteButton")}
          </Button>
        </form>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            {t("membersHeading")}
          </h3>
          <ul className="divide-y rounded-md border">
            {membership.members.map((member) => (
              <li
                key={member.memberId}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {member.name || member.email}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {member.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("joinedOn", {
                      date: formatJoinedDate(member.joinedAt, locale),
                    })}
                  </p>
                </div>
                {memberCount > 1 ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deletingMemberId === member.memberId}
                    onClick={() =>
                      setPendingDelete({
                        memberId: member.memberId,
                        isCurrentUser: member.isCurrentUser,
                        displayName: member.name || member.email,
                      })
                    }
                  >
                    {t("deleteButton")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {pendingInvitations.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              {t("pendingHeading")}
            </h3>
            <ul className="divide-y rounded-md border">
              {pendingInvitations.map((invitation) => (
                <li
                  key={invitation.invitationId}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <p className="truncate text-sm">{invitation.email}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      cancellingInvitationId === invitation.invitationId
                    }
                    onClick={() =>
                      void handleCancelInvitation(invitation.invitationId)
                    }
                  >
                    {t("cancelInvite")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingMemberId) {
            setPendingDelete(null);
          }
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          showCloseButton={!deletingMemberId}
        >
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <TriangleAlert className="size-5" aria-hidden />
              </div>
              <div className="space-y-2 pr-6">
                <DialogTitle>
                  {pendingDelete?.isCurrentUser
                    ? t("confirmDeleteSelfTitle")
                    : t("confirmDeleteTitle")}
                </DialogTitle>
                <DialogDescription>
                  {pendingDelete?.isCurrentUser
                    ? t("confirmDeleteSelfDescription")
                    : t("confirmDeleteDescription", {
                        member: pendingDelete?.displayName ?? "",
                      })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(deletingMemberId)}
              onClick={() => setPendingDelete(null)}
            >
              {t("confirmDeleteCancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(deletingMemberId)}
              onClick={() => void handleConfirmDelete()}
            >
              {deletingMemberId
                ? t("confirmDeleteDeleting")
                : t("confirmDeleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
