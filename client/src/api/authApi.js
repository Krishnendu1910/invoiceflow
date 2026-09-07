import apiClient from "./client";

export const authApi = {
  register: (payload) => apiClient.post("/auth/register", payload).then((res) => res.data),
  login: (payload) => apiClient.post("/auth/login", payload).then((res) => res.data),
  refresh: () => apiClient.post("/auth/refresh").then((res) => res.data),
  logout: () => apiClient.post("/auth/logout").then((res) => res.data),
  logoutAll: () => apiClient.post("/auth/logout-all").then((res) => res.data),
  me: () => apiClient.get("/auth/me").then((res) => res.data),
  verifyEmail: (token) => apiClient.post("/auth/verify-email", { token }).then((res) => res.data),
  resendVerification: (email) => apiClient.post("/auth/resend-verification", { email }).then((res) => res.data),
  forgotPassword: (email) => apiClient.post("/auth/forgot-password", { email }).then((res) => res.data),
  resetPassword: (token, password) =>
    apiClient.post("/auth/reset-password", { token, password }).then((res) => res.data),
};
