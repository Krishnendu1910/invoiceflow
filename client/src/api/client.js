import axios from "axios";
import { getAccessToken, setAccessToken } from "./tokenStore";
import { emitSessionExpired } from "./authEvents";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

// withCredentials so the httpOnly refresh cookie is sent to /api/auth/*.
const apiClient = axios.create({ baseURL, withCredentials: true });

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Deduplicates concurrent refresh attempts: if several requests 401 at once,
// only one /api/auth/refresh call is made and the rest await its result.
let refreshPromise = null;

function requestRefresh() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${baseURL}/auth/refresh`, null, { withCredentials: true })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.startsWith("/auth/");

    if (error.response?.status !== 401 || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const { data } = await requestRefresh();
      setAccessToken(data.data.accessToken);
      originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      setAccessToken(null);
      emitSessionExpired();
      return Promise.reject(refreshError);
    }
  }
);

export default apiClient;
