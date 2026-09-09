const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { REFRESH_COOKIE_NAME, setRefreshCookie, clearRefreshCookie, setOAuthStateCookie, OAUTH_STATE_COOKIE_NAME, clearOAuthStateCookie } = require("../utils/cookies");
const authService = require("../services/auth.service");
const googleService = require("../services/google.service");
const env = require("../config/env");

function requestMeta(req) {
  return { userAgent: req.headers["user-agent"] || null, ip: req.ip };
}

function attachSessionCookie(res, refreshToken, session) {
  setRefreshCookie(res, refreshToken, session.expiresAt);
}

const config = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    data: {
      googleEnabled: googleService.isConfigured,
      emailMode: env.email.mode,
    },
  });
});

const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: "Account created. Please check your email to verify your address.",
    data: { user },
  });
});

const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken, refreshSession } = await authService.login(req.body, requestMeta(req));

  attachSessionCookie(res, refreshToken, refreshSession);

  return sendSuccess(res, {
    message: "Logged in successfully.",
    data: { user, accessToken },
  });
});

const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  try {
    const { user, accessToken, refreshToken, refreshSession } = await authService.refresh(
      rawRefreshToken,
      requestMeta(req)
    );

    attachSessionCookie(res, refreshToken, refreshSession);

    return sendSuccess(res, {
      message: "Session refreshed.",
      data: { user, accessToken },
    });
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
});

const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  await authService.logout(rawRefreshToken);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: "Logged out." });
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user._id);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: "Logged out of all sessions." });
});

const me = asyncHandler(async (req, res) => {
  return sendSuccess(res, { data: { user: authService.toPublicUser(req.user) } });
});

const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body.token);
  return sendSuccess(res, { message: "Email verified successfully." });
});

const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.body.email);
  return sendSuccess(res, {
    message: "If an account exists with that email, a verification link has been sent.",
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  return sendSuccess(res, {
    message: "If an account exists with that email, a password reset link has been sent.",
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  return sendSuccess(res, { message: "Password reset successfully. Please log in again." });
});

const deleteAccount = asyncHandler(async (req, res) => {
  await authService.deleteAccount(req.user._id, req.body.password);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: "Account and all associated data permanently deleted." });
});

const googleStart = asyncHandler(async (req, res) => {
  if (!googleService.isConfigured) {
    throw new ApiError(501, "Google sign-in is not configured on this server.");
  }

  const state = googleService.generateState();
  setOAuthStateCookie(res, state);
  res.redirect(googleService.getAuthUrl(state));
});

const googleCallback = asyncHandler(async (req, res) => {
  if (!googleService.isConfigured) {
    throw new ApiError(501, "Google sign-in is not configured on this server.");
  }

  const { code, state } = req.query;
  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE_NAME];
  clearOAuthStateCookie(res);

  if (!code || !state || !cookieState || state !== cookieState) {
    throw new ApiError(400, "Invalid or expired Google sign-in attempt. Please try again.");
  }

  const profile = await googleService.getVerifiedProfile(code);
  const user = await authService.findOrCreateGoogleUser(profile);
  const { refreshToken, refreshSession } = await authService.issueSessionTokens(user, requestMeta(req));

  attachSessionCookie(res, refreshToken, refreshSession);

  // The refresh cookie is now set; the SPA's existing refresh-on-load flow
  // will pick up the session from here, so we just send the user home.
  res.redirect(env.clientUrl);
});

module.exports = {
  config,
  register,
  login,
  refresh,
  logout,
  logoutAll,
  me,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  deleteAccount,
  googleStart,
  googleCallback,
};
