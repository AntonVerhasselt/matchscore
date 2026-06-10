"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Debounced idle autosave delay for the template editor.
 *
 * Design editors (Figma, Canva, Notion, Google Docs) save after the user pauses,
 * not on every pointer move. A 2–3 second debounce balances responsiveness with
 * server load and avoids saving mid-drag. See:
 * - https://isaacfei.com/posts/editor-autosave-tanstack-start/
 * - https://medium.com/@brooklyndippo/to-save-or-to-autosave-autosaving-patterns-in-modern-web-applications-39c26061aa6b
 */
export const TEMPLATE_AUTOSAVE_DELAY_MS = 2500;

type UseTemplateAutosaveOptions = {
  enabled?: boolean;
  isDirty: boolean;
  isSaving: boolean;
  /** Resets the debounce timer whenever these values change while dirty. */
  changeSignature: unknown;
  save: () => Promise<void>;
};

export function useTemplateAutosave({
  enabled = true,
  isDirty,
  isSaving,
  changeSignature,
  save,
}: UseTemplateAutosaveOptions) {
  const saveRef = useRef(save);
  const isDirtyRef = useRef(isDirty);
  const isSavingRef = useRef(isSaving);
  const needsResaveRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  saveRef.current = save;
  isDirtyRef.current = isDirty;
  isSavingRef.current = isSaving;

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
        console.error("Template autosave failed:", error);
      });
    }, TEMPLATE_AUTOSAVE_DELAY_MS);
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

  useEffect(() => {
    if (!enabled || !isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, isDirty]);
}
