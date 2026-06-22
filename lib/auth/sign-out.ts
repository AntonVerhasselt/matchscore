export const SIGN_OUT_QUERY_PARAM = "signout";

/** Hard-navigate home immediately; session is cleared on the homepage. */
export function signOutAndRedirectHome() {
  window.location.assign(`/?${SIGN_OUT_QUERY_PARAM}=true`);
}
