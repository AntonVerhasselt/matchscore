export function getUserDisplayName(user: {
  name?: string | null;
  email?: string | null;
}): string {
  if (user.name?.trim()) {
    return user.name.trim();
  }
  return user.email ?? "";
}

export function getUserInitials(user: {
  name?: string | null;
  email?: string | null;
}): string {
  if (user.name?.trim()) {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return (parts[0]?.slice(0, 2) ?? "").toUpperCase();
  }

  const email = user.email ?? "";
  const localPart = email.split("@")[0] ?? "";
  if (!localPart) {
    return "?";
  }
  return localPart.slice(0, 2).toUpperCase();
}
