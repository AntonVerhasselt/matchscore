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
    <Avatar className={className}>
      {hasLogo ? (
        <AvatarImage
          src={logoImageUrl!}
          alt={name}
          className="rounded-[inherit]"
        />
      ) : null}
      <AvatarFallback
        className={cn(
          "rounded-lg bg-sidebar-primary text-sidebar-primary-foreground",
          fallbackClassName,
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
