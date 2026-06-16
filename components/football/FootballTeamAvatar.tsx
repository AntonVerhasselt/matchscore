"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type FootballTeamAvatarProps = {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function FootballTeamAvatar({
  name,
  logoUrl,
  size = "default",
  className,
}: FootballTeamAvatarProps) {
  return (
    <Avatar size={size} className={cn("bg-background", className)}>
      {logoUrl ? <AvatarImage src={logoUrl} alt="" /> : null}
      <AvatarFallback className="bg-muted font-heading text-xs font-bold uppercase">
        {getInitials(name) || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
