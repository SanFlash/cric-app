import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { endpoints, type PlayerOut } from "../api/client";

const ROLE_COLORS: Record<string, string> = {
  batter: "var(--color-amber)",
  bowler: "var(--color-crimson)",
  all_rounder: "var(--color-win)",
  wicketkeeper: "var(--color-cream)",
};

export function Players() {
  const [players, setPlayers] = useState<PlayerOut[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    endpoints
      .players()
      .then((r) => setPlayers(r.data.sort((a, b) => b.current_rating - a.current_rating)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = players.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
          Players
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-cream-faint)" }}>
          Every player across every team, ranked by overall rating.
        </p>
      </motion.div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search players…"
        className="mb-6 w-72 rounded-md border px-3 py-2 text-sm outline-none"
        style={{
          borderColor: "var(--color-pitch-line)",
          backgroundColor: "var(--color-pitch-800)",
          color: "var(--color-cream)",
        }}
      />

      {loading && <div style={{ color: "var(--color-cream-faint)" }}>Loading…</div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Link
              to={`/players/${p.id}`}
              className="block rounded-lg border p-4 transition-colors hover:border-[var(--color-amber-dim)]"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(19,28,24,0.5)" }}
            >
              <div className="mb-1 flex items-start justify-between">
                <span className="font-medium" style={{ color: "var(--color-cream)" }}>{p.full_name}</span>
                {p.current_rating > 0 && (
                  <span className="font-mono text-sm font-bold" style={{ color: "var(--color-amber)", fontFamily: "var(--font-mono)" }}>
                    {p.current_rating.toFixed(0)}
                  </span>
                )}
              </div>
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ color: ROLE_COLORS[p.playing_role] ?? "var(--color-cream-dim)", backgroundColor: "rgba(255,255,255,0.04)" }}
              >
                {p.playing_role.replace("_", " ")}
              </span>
            </Link>
          </motion.div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="col-span-full text-sm" style={{ color: "var(--color-cream-faint)" }}>
            No players match "{search}".
          </div>
        )}
      </div>
    </div>
  );
}
