import { useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "◆" },
  { to: "/score", label: "Score a Match", icon: "✎" },
  { to: "/live", label: "Live Match", icon: "●" },
  { to: "/predictions", label: "Predictions", icon: "%" },
  { to: "/teams", label: "Teams", icon: "■" },
  { to: "/players", label: "Players", icon: "♦" },
  { to: "/squads", label: "Squads", icon: "▣" },
  { to: "/tournaments", label: "Tournaments", icon: "▼" },
  { to: "/leaderboards", label: "Leaderboards", icon: "▲" },
];

// The common player login is a read-only spectator: watch live scores and
// browse performance stats, nothing management- or scoring-related.
const SPECTATOR_NAV_PATHS = new Set(["/", "/live", "/predictions", "/players", "/leaderboards"]);

const COMING_SOON = ["Notifications", "Settings"];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  company_admin: "Company Admin",
  captain: "Captain",
  player: "Player",
  viewer: "Viewer",
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, loading, logout, isSpectatorOnly } = useAuth();
  const visibleNavItems = isSpectatorOnly ? NAV_ITEMS.filter((i) => SPECTATOR_NAV_PATHS.has(i.to)) : NAV_ITEMS;
  return (
    <>
      <div className="mb-8 flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold"
          style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)", fontFamily: "var(--font-display)" }}
        >
          CC
        </div>
        <span className="font-display text-lg font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
          CorpCric
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                isActive ? "font-medium" : ""
              }`
            }
            style={({ isActive }: { isActive: boolean }) => ({
              color: isActive ? "var(--color-amber)" : "var(--color-cream-dim)",
              backgroundColor: isActive ? "rgba(34, 211, 238, 0.08)" : "transparent",
            })}
          >
            <span style={{ fontSize: 10 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <div className="mt-6 mb-2 px-3 text-[10px] uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
          Coming soon
        </div>
        {COMING_SOON.map((label) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm opacity-40"
            style={{ color: "var(--color-cream-dim)" }}
          >
            <span style={{ fontSize: 10 }}>○</span>
            {label}
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t pt-4" style={{ borderColor: "var(--color-pitch-line)" }}>
        {loading ? (
          <span className="font-mono text-[11px]" style={{ color: "var(--color-cream-faint)", fontFamily: "var(--font-mono)" }}>
            Checking session…
          </span>
        ) : user ? (
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="live-dot h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--color-win)" }} />
              <span className="truncate text-xs font-medium" style={{ color: "var(--color-cream)" }}>{user.full_name}</span>
            </div>
            <div className="mb-2 text-[10px] uppercase tracking-widest" style={{ color: "var(--color-amber)" }}>
              {ROLE_LABELS[user.role] ?? user.role}
            </div>
            <button onClick={logout} className="text-[11px] underline" style={{ color: "var(--color-cream-faint)" }}>
              Log out
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--color-crimson)" }} />
              <span className="text-xs" style={{ color: "var(--color-cream-faint)" }}>Not logged in</span>
            </div>
            <Link
              to="/login"
              onClick={onNavigate}
              className="inline-block rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
            >
              Log in
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const activeItem = NAV_ITEMS.find((i) => (i.to === "/" ? location.pathname === "/" : location.pathname.startsWith(i.to)));

  return (
    <div className="turf-texture min-h-screen md:flex" style={{ backgroundColor: "var(--color-pitch-950)" }}>
      {/* Mobile top bar — hidden on md+ */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 md:hidden"
        style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-950)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)", fontFamily: "var(--font-display)" }}
          >
            CC
          </div>
          <span className="font-display text-base font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
            {activeItem?.label ?? "CorpCric"}
          </span>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-md"
          style={{ backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream)" }}
        >
          ☰
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden"
            style={{ backgroundColor: "rgba(8,11,22,0.7)" }}
            onClick={() => setDrawerOpen(false)}
          >
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "tween", duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-full w-64 flex-col overflow-y-auto border-r px-5 py-6"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-950)" }}
            >
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar — hidden below md */}
      <aside
        className="hidden w-60 flex-shrink-0 flex-col border-r px-5 py-6 md:flex"
        style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(8, 11, 22, 0.6)" }}
      >
        <SidebarContent />
      </aside>

      <main className="flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
