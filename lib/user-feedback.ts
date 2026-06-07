import { toast } from "sonner";

export function showSuccessToast(message: string) {
  toast.success(message);
}

export function showErrorToast(message: string) {
  toast.error(message);
}

type UserFeedbackOptions = {
  successMessage?: string;
  errorMessage: string;
};

export async function withUserFeedback<T>(
  action: () => Promise<T>,
  { successMessage, errorMessage }: UserFeedbackOptions,
): Promise<T | undefined> {
  try {
    const result = await action();
    if (successMessage) {
      showSuccessToast(successMessage);
    }
    return result;
  } catch (error) {
    console.error("User action failed:", errorMessage, error);
    showErrorToast(errorMessage);
    return undefined;
  }
}
