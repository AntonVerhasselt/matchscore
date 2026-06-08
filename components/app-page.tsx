import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppPageHeaderProps = {
  title: string;
  description?: string;
  className?: string;
};

export function AppPageHeader({
  title,
  description,
  className,
}: AppPageHeaderProps) {
  return (
    <header className={cn("mb-8", className)}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}

type AppPageToolbarProps = {
  children: ReactNode;
  className?: string;
};

export function AppPageToolbar({ children, className }: AppPageToolbarProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}

type AppPageBackLinkProps = {
  href: string;
  children: ReactNode;
};

export function AppPageBackLink({ href, children }: AppPageBackLinkProps) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
      <Link href={href}>
        <ArrowLeft aria-hidden />
        {children}
      </Link>
    </Button>
  );
}
