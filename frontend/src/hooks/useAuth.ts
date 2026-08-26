import { useEffect, useState } from "react";
import { endpoints } from "../api/client";

export interface CurrentUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  company_id: number | null;
}

export function useAuth() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  function refresh() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    endpoints
      .me()
      .then((r) => setUser(r.data as CurrentUser))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    window.location.href = "/login";
  }

  const ADMIN_ROLES = ["super_admin", "company_admin"];
  const canManageTeams = !!user && (ADMIN_ROLES.includes(user.role) || user.role === "captain");
  // The common player login — read-only: watch live scores, browse
  // performance stats. Not scoped to manage or score anything.
  const isSpectatorOnly = !!user && user.role === "player";

  return { user, loading, logout, refresh, canManageTeams, isSpectatorOnly };
}
