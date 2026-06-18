"use client";

import { useCallback, useEffect, useRef } from "react";

export const COMPOSE_AUTOSAVE_DELAY_MS = 2000;

type UseComposeAutosaveOptions = {
  enabled?: boolean;
  isDirty: boolean;
  isSaving: boolean;
  changeSignature: unknown;
  save: () => Promise<void>;
};

export function useComposeAutosave({
  enabled = true,
  isDirty,
  isSaving,
  changeSignature,
  save,
}: UseComposeAutosaveOptions) {
  const saveRef = useRef(save);
  const isDirtyRef = useRef(isDirty);
  const isSavingRef = useRef(isSaving);
  const needsResaveRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveRef.current = save;
    isDirtyRef.current = isDirty;
    isSavingRef.current = isSaving;
  }, [save, isDirty, isSaving]);

  const clearScheduledSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const flushSave = useCallback(async () => {
    if (!enabled || !isDirtyRef.current) {
      return;
    }

    if (isSavingRef.current) {
      needsResaveRef.current = true;
      return;
    }

    await saveRef.current();
  }, [enabled]);

  const scheduleAutosave = useCallback(() => {
    clearScheduledSave();
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      void flushSave().catch((error) => {
        console.error("Compose autosave failed:", error);
      });
    }, COMPOSE_AUTOSAVE_DELAY_MS);
  }, [clearScheduledSave, flushSave]);

  useEffect(() => {
    if (!enabled || !isDirty) {
      clearScheduledSave();
      return;
    }

    scheduleAutosave();
    return clearScheduledSave;
  }, [changeSignature, clearScheduledSave, enabled, isDirty, scheduleAutosave]);

  useEffect(() => {
    if (!enabled || isSaving || !needsResaveRef.current) {
      return;
    }

    needsResaveRef.current = false;
    if (isDirty) {
      scheduleAutosave();
    }
  }, [enabled, isDirty, isSaving, scheduleAutosave]);

  return { flushSave, clearScheduledSave };
}
