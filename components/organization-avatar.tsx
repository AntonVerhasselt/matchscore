import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOrganizationInitials } from "@/lib/organization-display";
import { cn } from "@/lib/utils";

type OrganizationAvatarProps = {
  name: string;
  logoImageUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
};

export function OrganizationAvatar({
  name,
  logoImageUrl,
  className,
  fallbackClassName,
}: OrganizationAvatarProps) {
  const initials = getOrganizationInitials(name);
  const hasLogo = Boolean(logoImageUrl?.trim());

  return (
    <Avatar
      className={cn(
        "rounded-lg bg-white/65 after:border-white/30",
        className,
      )}
    >
      {hasLogo ? (
        <AvatarImage
          src={logoImageUrl!}
          alt={name}
          className="rounded-[inherit] object-contain p-1"
        />
      ) : null}
      <AvatarFallback
        className={cn(
          "rounded-[inherit] bg-white/65 text-sidebar-foreground",
          fallbackClassName,
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
