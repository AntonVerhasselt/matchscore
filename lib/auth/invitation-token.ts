const INVITATION_TOKEN_KEY = "matchscore:invitationToken";

export function storeInvitationToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(INVITATION_TOKEN_KEY, token);
}

export function consumeInvitationToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const token = sessionStorage.getItem(INVITATION_TOKEN_KEY);
  if (token) {
    sessionStorage.removeItem(INVITATION_TOKEN_KEY);
  }
  return token;
}

export function peekInvitationToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return sessionStorage.getItem(INVITATION_TOKEN_KEY);
}
