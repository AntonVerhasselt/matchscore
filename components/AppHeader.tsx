import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { ReactNode } from "react";

type AppHeaderProps = {
  title: string;
  children?: ReactNode;
};

export default function AppHeader({ title, children }: AppHeaderProps) {
  return (
    <header className="mb-8 flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {children ? (
        <div className="flex items-center gap-1">
          {children}
        </div>
      ) : null}
    </header>
  );
}

type AppHeaderLinkProps = {
  href: string;
  children: ReactNode;
};

export function AppHeaderLink({ href, children }: AppHeaderLinkProps) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

type AppHeaderActionProps = {
  onClick: () => void;
  children: ReactNode;
};

export function AppHeaderAction({ onClick, children }: AppHeaderActionProps) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      {children}
    </Button>
  );
}
