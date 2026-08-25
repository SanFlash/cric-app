import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { endpoints, type LeaderboardEntryOut, type TeamOut } from "../api/client";
import { StatCard } from "../components/StatCard";

export function Dashboard() {
  const [teams, setTeams] = useState<TeamOut[]>([]);
  const [runsLeaders, setRunsLeaders] = useState<LeaderboardEntryOut[]>([]);
  const [wicketsLeaders, setWicketsLeaders] = useState<LeaderboardEntryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      endpoints.teams(),
      endpoints.leaderboard("most_runs", { limit: 5 }),
      endpoints.leaderboard("most_wickets", { limit: 5 }),
    ]).then(([t, r, w]) => {
      if (t.status === "fulfilled") setTeams(t.value.data);
      if (r.status === "fulfilled") setRunsLeaders(r.value.data);
      if (w.status === "fulfilled") setWicketsLeaders(w.value.data);
      if (t.status === "rejected" && r.status === "rejected" && w.status === "rejected") {
        setError("Couldn't reach the API. Is the backend running on :8000?");
      }
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}
        >
          Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-cream-faint)" }}>
          Live standing across every team, match, and player in your organization.
        </p>
      </motion.div>

      {error && (
        <div
          className="mb-6 rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "var(--color-crimson-dim)", backgroundColor: "rgba(193, 39, 45, 0.08)", color: "var(--color-cream-dim)" }}
        >
          {error} Seed some data via the API and refresh — this dashboard reads live, nothing here is mocked.
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Teams" value={teams.length} accent="amber" delay={0} />
        <StatCard label="Total Runs (Top 5)" value={runsLeaders.reduce((a, b) => a + b.value, 0)} accent="cream" delay={0.05} />
        <StatCard label="Total Wickets (Top 5)" value={wicketsLeaders.reduce((a, b) => a + b.value, 0)} accent="crimson" delay={0.1} />
        <StatCard label="Active Squads" value={teams.length} accent="win" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LeaderboardPanel title="Most Runs" entries={runsLeaders} accent="amber" unit="runs" loading={loading} />
        <LeaderboardPanel title="Most Wickets" entries={wicketsLeaders} accent="crimson" unit="wkts" loading={loading} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
          Teams
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {teams.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-lg border px-4 py-3"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(19, 28, 24, 0.5)" }}
            >
              <div className="font-medium" style={{ color: "var(--color-cream)" }}>{t.name}</div>
              {t.coach_name && (
                <div className="mt-0.5 text-xs" style={{ color: "var(--color-cream-faint)" }}>
                  Coach: {t.coach_name}
                </div>
              )}
            </motion.div>
          ))}
          {teams.length === 0 && !loading && !error && (
            <div className="col-span-full text-sm" style={{ color: "var(--color-cream-faint)" }}>
              No teams yet — create one via the API to see it here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaderboardPanel({
  title,
  entries,
  accent,
  unit,
  loading,
}: {
  title: string;
  entries: LeaderboardEntryOut[];
  accent: "amber" | "crimson";
  unit: string;
  loading: boolean;
}) {
  const color = accent === "amber" ? "var(--color-amber)" : "var(--color-crimson)";
  return (
    <div className="rounded-lg border p-5" style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(19, 28, 24, 0.5)" }}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
        {title}
      </h2>
      {loading && <div className="text-sm" style={{ color: "var(--color-cream-faint)" }}>Loading…</div>}
      {!loading && entries.length === 0 && (
        <div className="text-sm" style={{ color: "var(--color-cream-faint)" }}>No data yet.</div>
      )}
      <div className="flex flex-col gap-2">
        {entries.map((e, i) => (
          <motion.div
            key={e.player_id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center justify-between border-b py-1.5 last:border-b-0"
            style={{ borderColor: "var(--color-pitch-line)" }}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs" style={{ color: "var(--color-cream-faint)", fontFamily: "var(--font-mono)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ color: "var(--color-cream)" }}>{e.full_name}</span>
            </div>
            <span className="font-mono text-sm font-semibold" style={{ color, fontFamily: "var(--font-mono)" }}>
              {e.value} <span className="text-xs opacity-60">{unit}</span>
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
