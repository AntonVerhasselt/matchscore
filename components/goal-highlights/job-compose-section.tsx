"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useCallback, useState, type ChangeEvent } from "react";

import {
  POSTING_CHANNEL_PLATFORMS,
  PostingChannelBlock,
} from "@/components/automations/posting-channel-block";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useComposeAutosave } from "@/hooks/use-compose-autosave";
import type { PostingChannel, PostingChannelStatuses } from "@/lib/automations/types";
import { MAX_DRAFT_CAPTION_LENGTH } from "@/lib/goal-highlights/constants";
import { showErrorToast, showSuccessToast } from "@/lib/user-feedback";

type JobComposeSectionProps = {
  jobId: Id<"veoPostJobs">;
  draftCaption: string | null;
  postingChannels: PostingChannelStatuses;
  hasVideo: boolean;
  status: "pending" | "fetching" | "processing" | "ready" | "failed";
};

export function JobComposeSection({
  jobId,
  draftCaption,
  postingChannels,
  hasVideo,
  status,
}: JobComposeSectionProps) {
  const t = useTranslations("app.goalHighlights");
  const updateDraftCaption = useMutation(api.veoPosts.mutations.updateDraftCaption);
  const setPostingChannelEnabled = useMutation(
    api.veoPosts.mutations.setPostingChannelEnabled,
  );

  const [caption, setCaption] = useState(draftCaption ?? "");
  const [savedCaption, setSavedCaption] = useState(draftCaption ?? "");
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [captionSaveState, setCaptionSaveState] = useState<"idle" | "saved">(
    "idle",
  );
  const [savingPostingChannel, setSavingPostingChannel] =
    useState<PostingChannel | null>(null);

  const isCaptionDirty = caption !== savedCaption;
  const canPost = status === "ready" && hasVideo;

  const saveCaption = useCallback(async () => {
    if (!isCaptionDirty) {
      return;
    }

    setIsSavingCaption(true);
    try {
      await updateDraftCaption({ jobId, draftCaption: caption });
      setSavedCaption(caption);
      setCaptionSaveState("saved");
    } catch {
      showErrorToast(t("composeSaveFailed"));
    } finally {
      setIsSavingCaption(false);
    }
  }, [caption, isCaptionDirty, jobId, t, updateDraftCaption]);

  useComposeAutosave({
    isDirty: isCaptionDirty,
    isSaving: isSavingCaption,
    changeSignature: caption,
    save: saveCaption,
  });

  const handleCaptionBlur = () => {
    void saveCaption();
  };

  const handlePostingChannelChange = async (
    postingChannel: PostingChannel,
    isEnabled: boolean,
  ) => {
    if (savingPostingChannel !== null) {
      return;
    }

    setSavingPostingChannel(postingChannel);
    try {
      await setPostingChannelEnabled({
        jobId,
        postingChannel,
        isEnabled,
      });
      showSuccessToast(t("channelToggleSuccess"));
    } catch {
      showErrorToast(t("channelToggleFailed"));
    } finally {
      setSavingPostingChannel(null);
    }
  };

  const handlePostToSocial = () => {
    showSuccessToast(t("postComingSoon"));
  };

  const captionHint =
    captionSaveState === "saved" && !isCaptionDirty && !isSavingCaption
      ? t("composeSaved")
      : isSavingCaption
        ? t("composeSaving")
        : isCaptionDirty
          ? t("composeUnsaved")
          : null;

  return (
    <section className="space-y-6 rounded-lg border p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="goal-highlight-caption">{t("captionLabel")}</Label>
          {captionHint ? (
            <span className="text-xs text-muted-foreground">{captionHint}</span>
          ) : null}
        </div>
        <Textarea
          id="goal-highlight-caption"
          value={caption}
          maxLength={MAX_DRAFT_CAPTION_LENGTH}
          placeholder={t("captionPlaceholder")}
          rows={4}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setCaption(event.target.value);
            setCaptionSaveState("idle");
          }}
          onBlur={handleCaptionBlur}
        />
        <p className="text-xs text-muted-foreground">
          {t("captionCharacterCount", {
            count: caption.length,
            max: MAX_DRAFT_CAPTION_LENGTH,
          })}
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-medium text-foreground">
          {t("socialChannelsTitle")}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {POSTING_CHANNEL_PLATFORMS.map((platform) => (
            <PostingChannelBlock
              key={platform}
              platform={platform}
              idPrefix={`goal-highlights-${jobId}`}
              postingChannels={postingChannels}
              savingPostingChannel={savingPostingChannel}
              onPostingChannelChange={(postingChannel, checked) =>
                void handlePostingChannelChange(postingChannel, checked)
              }
            />
          ))}
        </div>
      </div>

      <Button
        type="button"
        disabled={!canPost}
        onClick={handlePostToSocial}
        className="w-full sm:w-auto"
      >
        {t("postToSocial")}
      </Button>
    </section>
  );
}
