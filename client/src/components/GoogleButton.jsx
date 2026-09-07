import { useEffect, useState } from "react";
import apiClient from "../api/client";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

// Google sign-in is a full-page redirect (the backend needs to set an
// httpOnly cookie during the OAuth callback), not an XHR/fetch call, so this
// renders a plain link rather than an onClick handler.
export default function GoogleButton() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get("/auth/config")
      .then((res) => {
        if (!cancelled) setEnabled(res.data.data.googleEnabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) {
    return (
      <div
        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-400"
        title="Google sign-in is not configured on this server yet."
      >
        Continue with Google
      </div>
    );
  }

  return (
    <a
      href={`${API_BASE_URL}/auth/google`}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      Continue with Google
    </a>
  );
}
