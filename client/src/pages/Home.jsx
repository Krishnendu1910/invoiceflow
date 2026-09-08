import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useBusiness } from "../context/useBusiness";

// Placeholder landing page for an authenticated session. The real dashboard
// (invoice/quotation summaries, outstanding amounts, etc.) is a later phase —
// this just proves the auth + onboarding + business-context flow lands
// somewhere sensible, and links into the Phase 3 Customer/Item screens.
export default function Home() {
  const { user } = useAuth();
  const { business } = useBusiness();

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Welcome, {user.name}</h1>
      <p className="mt-1 text-sm text-slate-500">{user.email}</p>

      {!user.isEmailVerified && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Your email is not verified yet. Some actions are limited until you verify it.
        </div>
      )}

      <div className="mt-6 space-y-1 text-sm text-slate-600">
        <p>Active business: {business.name}</p>
      </div>

      <div className="mt-8 flex gap-3">
        <Link to="/customers" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Manage customers
        </Link>
        <Link to="/items" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Manage items
        </Link>
      </div>
    </div>
  );
}
