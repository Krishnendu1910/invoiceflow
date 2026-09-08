import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { BusinessProvider } from "../context/BusinessContext";
import { useBusiness } from "../context/useBusiness";
import FullPageSpinner from "./FullPageSpinner";

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
  }`;

// Shared authenticated layout: top nav + the active business's data. Any
// screen scoped to a business (customers, items, and later invoices/
// quotations) mounts inside this shell instead of re-fetching/re-guarding
// business context on its own.
function AppShellContent() {
  const { user, logout } = useAuth();
  const { business, status } = useBusiness();

  if (status === "loading") {
    return <FullPageSpinner />;
  }

  if (!business) {
    return <Navigate to="/onboarding/business" replace />;
  }

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-900">{business.name}</span>
            <nav className="flex gap-1">
              <NavLink to="/" end className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/customers" className={navLinkClass}>
                Customers
              </NavLink>
              <NavLink to="/items" className={navLinkClass}>
                Items
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">{user.name}</span>
            <button type="button" onClick={logout} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export default function AppShell() {
  return (
    <BusinessProvider>
      <AppShellContent />
    </BusinessProvider>
  );
}
