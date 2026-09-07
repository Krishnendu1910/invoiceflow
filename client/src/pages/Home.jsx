import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import Button from "../components/Button";

// Placeholder landing page for an authenticated session. The real dashboard
// (invoice/quotation summaries, outstanding amounts, etc.) is a later phase —
// this just proves the auth + onboarding flow lands somewhere sensible.
export default function Home() {
  const { user, logout, logoutAll } = useAuth();

  if (!user.lastActiveBusiness) {
    return <Navigate to="/onboarding/business" replace />;
  }

  return (
    <div className="min-h-svh bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Welcome, {user.name}</h1>
        <p className="mt-1 text-sm text-slate-500">{user.email}</p>

        {!user.isEmailVerified && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Your email is not verified yet. Some actions are limited until you verify it.
          </div>
        )}

        <div className="mt-6 space-y-1 text-sm text-slate-600">
          <p>Active business ID: {user.lastActiveBusiness}</p>
        </div>

        <div className="mt-8 flex gap-3">
          <Button variant="secondary" onClick={logout}>
            Log out
          </Button>
          <Button variant="secondary" onClick={logoutAll}>
            Log out of all devices
          </Button>
        </div>
      </div>
    </div>
  );
}
