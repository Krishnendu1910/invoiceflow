import { useEffect, useMemo, useState } from "react";
import { businessApi } from "../api/businessApi";
import { useAuth } from "./useAuth";
import { BusinessContext } from "./businessContextInstance";

// Phase 3 scope: resolves the user's active business (the one set during
// onboarding) so Customer/Item screens know which business to scope their
// requests to. A full business switcher is a later feature — this just
// gives every business-scoped screen one shared source for "which business."
export function BusinessProvider({ children }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    businessApi
      .list()
      .then((res) => {
        if (!cancelled) {
          setBusinesses(res.data.businesses);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load your businesses.");
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const business = useMemo(
    () => businesses.find((b) => b.id === user.lastActiveBusiness) || businesses[0] || null,
    [businesses, user.lastActiveBusiness]
  );

  const value = useMemo(
    () => ({ business, businessId: business?.id || null, businesses, status, error }),
    [business, businesses, status, error]
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}
