// The access token lives only in memory — this module-level variable — and
// is never written to localStorage/sessionStorage. It is intentionally lost
// on a full page reload; AuthContext re-establishes it via /api/auth/refresh
// (which relies on the httpOnly refresh cookie) on mount.
let accessToken = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;
}
