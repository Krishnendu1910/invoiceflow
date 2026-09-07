const env = require("../config/env");

const REFRESH_COOKIE_NAME = "invoiceflow_refresh_token";
const OAUTH_STATE_COOKIE_NAME = "invoiceflow_oauth_state";

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    domain: env.cookie.domain,
    path: "/api/auth",
  };
}

function setRefreshCookie(res, rawToken, expiresAt) {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    ...baseCookieOptions(),
    expires: expiresAt,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions());
}

function setOAuthStateCookie(res, state) {
  res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
    ...baseCookieOptions(),
    path: "/api/auth/google",
    maxAge: 10 * 60 * 1000,
  });
}

function clearOAuthStateCookie(res) {
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, { ...baseCookieOptions(), path: "/api/auth/google" });
}

module.exports = {
  REFRESH_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  setRefreshCookie,
  clearRefreshCookie,
  setOAuthStateCookie,
  clearOAuthStateCookie,
};
