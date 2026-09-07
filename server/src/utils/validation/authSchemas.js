const { z } = require("zod");

const email = z.string().trim().toLowerCase().min(1, "Email is required").email("Invalid email address");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

const name = z.string().trim().min(1, "Name is required").max(100, "Name must be at most 100 characters");

const register = z.object({
  name,
  email,
  password,
});

const login = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

const verifyEmail = z.object({
  token: z.string().min(1, "Token is required"),
});

const resendVerification = z.object({
  email,
});

const forgotPassword = z.object({
  email,
});

const resetPassword = z.object({
  token: z.string().min(1, "Token is required"),
  password,
});

const deleteAccount = z.object({
  password: z.string().min(1).optional(),
});

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  deleteAccount,
};
