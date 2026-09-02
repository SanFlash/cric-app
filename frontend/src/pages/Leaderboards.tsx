import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { endpoints, type LeaderboardEntryOut } from "../api/client";
import { UploadedImage } from "../components/UploadedImage";

const METRICS = [
  { key: "most_runs", label: "Most Runs", unit: "runs" },
  { key: "highest_score", label: "Highest Score", unit: "runs" },
  { key: "best_average", label: "Best Average", unit: "avg" },
  { key: "best_strike_rate", label: "Best Strike Rate", unit: "SR" },
  { key: "most_sixes", label: "Most Sixes", unit: "6s" },
  { key: "most_wickets", label: "Most Wickets", unit: "wkts" },
  { key: "best_economy", label: "Best Economy", unit: "econ" },
  { key: "most_catches", label: "Most Catches", unit: "ct" },
  { key: "best_form", label: "Best Current Form", unit: "form" },
  { key: "best_overall", label: "Best Overall Rating", unit: "rtg" },
];

export function Leaderboards() {
  const [metric, setMetric] = useState(METRICS[0].key);
  const [entries, setEntries] = useState<LeaderboardEntryOut[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    endpoints
      .leaderboard(metric, { limit: 10 })
      .then((r) => setEntries(r.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [metric]);

  const activeMeta = METRICS.find((m) => m.key === metric)!;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
          Leaderboards
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-cream-faint)" }}>
          Ranked from real per-match performance data — filterable by tournament or team via the API.
        </p>
      </motion.div>

      <div className="mb-6 flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: metric === m.key ? "var(--color-amber)" : "var(--color-pitch-700)",
              color: metric === m.key ? "var(--color-pitch-950)" : "var(--color-cream-dim)",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border p-6" style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.5)" }}>
        {loading && <div style={{ color: "var(--color-cream-faint)" }}>Loading…</div>}
        {!loading && entries.length === 0 && (
          <div style={{ color: "var(--color-cream-faint)" }}>No data for this metric yet.</div>
        )}
        <div className="flex flex-col">
          {entries.map((e, i) => (
            <motion.div
              key={e.player_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between border-b py-3 last:border-b-0"
              style={{ borderColor: "var(--color-pitch-line)" }}
            >
              <div className="flex items-center gap-4">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-bold"
                  style={{
                    fontFamily: "var(--font-mono)",
                    backgroundColor: i < 3 ? "var(--color-amber)" : "var(--color-pitch-700)",
                    color: i < 3 ? "var(--color-pitch-950)" : "var(--color-cream-dim)",
                  }}
                >
                  {i + 1}
                </span>
                <UploadedImage src={e.profile_image_url} name={e.full_name} size={28} shape="circle" />
                <span style={{ color: "var(--color-cream)" }}>{e.full_name}</span>
                {e.secondary && (
                  <span className="text-xs" style={{ color: "var(--color-cream-faint)" }}>
                    {e.secondary}
                  </span>
                )}
              </div>
              <span className="font-mono text-lg font-semibold" style={{ color: "var(--color-amber)", fontFamily: "var(--font-mono)" }}>
                {e.value} <span className="text-xs opacity-60">{activeMeta.unit}</span>
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
