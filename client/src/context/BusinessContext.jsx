import { useCallback, useEffect, useMemo, useState } from "react";
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

  const fetchBusinesses = useCallback(() => {
    return businessApi
      .list()
      .then((res) => {
        setBusinesses(res.data.businesses);
        setStatus("ready");
        setError("");
      })
      .catch(() => {
        setError("Could not load your businesses.");
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchBusinesses().then(() => {
      if (cancelled) return;
    });

    return () => {
      cancelled = true;
    };
  }, [fetchBusinesses]);

  // Lets downstream screens (e.g. settings) refresh the business list after
  // a mutation without a full page reload. Callers can await the returned
  // promise if they need to act after the refresh completes.
  const refreshBusinesses = useCallback(() => fetchBusinesses(), [fetchBusinesses]);

  const business = useMemo(
    () => businesses.find((b) => b.id === user.lastActiveBusiness) || businesses[0] || null,
    [businesses, user.lastActiveBusiness]
  );

  const value = useMemo(
    () => ({ business, businessId: business?.id || null, businesses, status, error, refreshBusinesses }),
    [business, businesses, status, error, refreshBusinesses]
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}
