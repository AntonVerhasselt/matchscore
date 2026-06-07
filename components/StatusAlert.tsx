import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { CircleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";

type StatusAlertProps = {
  variant: "success" | "error";
  children: ReactNode;
};

export default function StatusAlert({ variant, children }: StatusAlertProps) {
  if (variant === "success") {
    return (
      <Alert variant="success">
        <CircleCheck aria-hidden="true" />
        <AlertDescription className={cn("text-success/90")}>
          {children}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertDescription className={cn("text-destructive/90")}>
        {children}
      </AlertDescription>
    </Alert>
  );
}
