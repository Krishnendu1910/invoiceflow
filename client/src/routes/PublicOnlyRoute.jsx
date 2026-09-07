import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import FullPageSpinner from "../components/FullPageSpinner";

// Keeps already-logged-in users off /login and /signup.
export default function PublicOnlyRoute() {
  const { status } = useAuth();

  if (status === "loading") {
    return <FullPageSpinner />;
  }

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
