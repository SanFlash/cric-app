import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { endpoints, type TeamOut, type TeamStrengthOut, type TeamCompareOut } from "../api/client";

const PILLARS: { key: keyof TeamStrengthOut; label: string }[] = [
  { key: "batting_strength", label: "Batting" },
  { key: "bowling_strength", label: "Bowling" },
  { key: "fielding_strength", label: "Fielding" },
  { key: "recent_form_strength", label: "Form" },
];

export function TeamRatingPanel({ teamId, allTeams }: { teamId: number; allTeams: TeamOut[] }) {
  const [strength, setStrength] = useState<TeamStrengthOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [opponentId, setOpponentId] = useState<number | "">("");
  const [comparison, setComparison] = useState<TeamCompareOut | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    setLoading(true);
    setStrength(null);
    setComparison(null);
    setOpponentId("");
    endpoints.rosterStrength(teamId)
      .then((r) => setStrength(r.data))
      .catch(() => setStrength(null))
      .finally(() => setLoading(false));
  }, [teamId]);

  async function handleCompare(id: number | "") {
    setOpponentId(id);
    if (id === "") {
      setComparison(null);
      return;
    }
    setComparing(true);
    try {
      const r = await endpoints.compareTeams(teamId, id);
      setComparison(r.data);
    } catch {
      setComparison(null);
    } finally {
      setComparing(false);
    }
  }

  if (loading) {
    return (
      <div className="mb-6 rounded-xl border p-5" style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.5)" }}>
        <div className="text-sm" style={{ color: "var(--color-cream-faint)" }}>Computing team rating…</div>
      </div>
    );
  }

  if (!strength) {
    return (
      <div className="mb-6 rounded-xl border p-5" style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.5)" }}>
        <div className="text-sm" style={{ color: "var(--color-cream-faint)" }}>
          Add players to this team to see its rating and a win prediction against other teams.
        </div>
      </div>
    );
  }

  const opponents = allTeams.filter((t) => t.id !== teamId);
  const opponentTeam = allTeams.find((t) => t.id === opponentId);
  const opponentName = opponentTeam?.name ?? "Opponent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-xl border p-5"
      style={{ borderColor: "var(--color-amber-dim)", backgroundColor: "rgba(16,21,42,0.5)" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-amber)" }}>
          Team Rating
        </div>
        <div className="font-mono text-3xl font-bold" style={{ color: "var(--color-amber)", fontFamily: "var(--font-mono)" }}>
          {strength.overall_strength.toFixed(0)}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PILLARS.map((p) => (
          <div key={p.key}>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>{p.label}</div>
            <div className="font-mono text-lg font-semibold" style={{ color: "var(--color-cream)", fontFamily: "var(--font-mono)" }}>
              {(strength[p.key] as number).toFixed(0)}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4" style={{ borderColor: "var(--color-pitch-line)" }}>
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
          Win Prediction
        </div>
        {opponents.length === 0 ? (
          <div className="text-xs" style={{ color: "var(--color-cream-faint)" }}>
            Create another team to see a hypothetical win probability against them.
          </div>
        ) : (
          <>
            <select
              value={opponentId}
              onChange={(e) => handleCompare(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none sm:max-w-xs"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            >
              <option value="">Compare against…</option>
              {opponents.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            {comparing && <div className="mt-3 text-xs" style={{ color: "var(--color-cream-faint)" }}>Computing…</div>}

            {comparison && !comparing && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-baseline justify-between font-mono text-sm" style={{ fontFamily: "var(--font-mono)" }}>
                  <span style={{ color: "var(--color-amber)" }}>
                    <b>{comparison.team_a_win_pct}%</b> this team
                  </span>
                  <span style={{ color: "var(--color-cream-faint)" }}>
                    {comparison.team_b_win_pct}% {opponentName}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--color-pitch-700)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${comparison.team_a_win_pct}%`, backgroundColor: "var(--color-amber)" }}
                  />
                </div>
                {comparison.factors.items.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1">
                    {comparison.factors.items.map((f, i) => (
                      <li key={i} className="text-xs" style={{ color: "var(--color-cream-faint)" }}>
                        {f.factor}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
