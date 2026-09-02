import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { endpoints, type MatchOut, type TeamOut, type PredictionOut } from "../api/client";
import { WinProbabilityBar } from "../components/WinProbabilityBar";
import { MomentumChart } from "../components/MomentumChart";
import { useAuth } from "../hooks/useAuth";

export function Predictions() {
  const { canManageTeams } = useAuth();
  const [matches, setMatches] = useState<MatchOut[]>([]);
  const [teams, setTeams] = useState<Record<number, TeamOut>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [latest, setLatest] = useState<PredictionOut | null>(null);
  const [momentum, setMomentum] = useState<PredictionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [noPrediction, setNoPrediction] = useState(false);

  useEffect(() => {
    Promise.all([endpoints.matches(), endpoints.teams()]).then(([m, t]) => {
      setMatches(m.data);
      setTeams(Object.fromEntries(t.data.map((tm) => [tm.id, tm])));
      if (m.data.length > 0) setSelectedId(m.data[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function loadPrediction(matchId: number) {
    setNoPrediction(false);
    try {
      const [l, m] = await Promise.all([endpoints.latestPrediction(matchId), endpoints.momentum(matchId)]);
      setLatest(l.data);
      setMomentum(m.data);
    } catch {
      setLatest(null);
      setMomentum([]);
      setNoPrediction(true);
    }
  }

  useEffect(() => {
    if (selectedId != null) loadPrediction(selectedId);
  }, [selectedId]);

  async function handleCompute() {
    if (selectedId == null) return;
    setComputing(true);
    try {
      await endpoints.computePreMatchPrediction(selectedId);
      await loadPrediction(selectedId);
    } catch {
      // surfaced implicitly by noPrediction staying true / latest staying null
    } finally {
      setComputing(false);
    }
  }

  const selected = matches.find((m) => m.id === selectedId);
  const teamAName = selected ? teams[selected.team_a_id]?.name ?? "Team A" : "Team A";
  const teamBName = selected ? teams[selected.team_b_id]?.name ?? "Team B" : "Team B";

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
          Predictions
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-cream-faint)" }}>
          Win probability, momentum, and the factors behind each number — never shown as a
          guaranteed outcome.
        </p>
      </motion.div>

      {loading && <div style={{ color: "var(--color-cream-faint)" }}>Loading…</div>}

      {!loading && matches.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {matches.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: selectedId === m.id ? "var(--color-amber)" : "var(--color-pitch-700)",
                color: selectedId === m.id ? "var(--color-pitch-950)" : "var(--color-cream-dim)",
              }}
            >
              {teams[m.team_a_id]?.name ?? "Team A"} vs {teams[m.team_b_id]?.name ?? "Team B"}
            </button>
          ))}
        </div>
      )}

      {!loading && matches.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm" style={{ borderColor: "var(--color-pitch-line)", color: "var(--color-cream-faint)" }}>
          No matches yet — create one from{" "}
          <a href="/score" className="underline" style={{ color: "var(--color-amber)" }}>Score a Match</a>.
        </div>
      )}

      {selected && (
        <div className="rounded-xl border p-6" style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.5)" }}>
          {noPrediction && (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm" style={{ color: "var(--color-cream-faint)" }}>
                No prediction computed yet for {teamAName} vs {teamBName}.
              </p>
              {canManageTeams && (
                <button
                  onClick={handleCompute}
                  disabled={computing}
                  className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
                >
                  {computing ? "Computing…" : "Compute pre-match prediction"}
                </button>
              )}
            </div>
          )}

          {latest && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
                  {latest.context === "pre_match" ? "Pre-match" : `Live — ${latest.context.replace("_", " ")}`}
                </span>
                {canManageTeams && (
                  <button
                    onClick={handleCompute}
                    disabled={computing}
                    className="text-xs underline disabled:opacity-40"
                    style={{ color: "var(--color-amber)" }}
                  >
                    {computing ? "Recomputing…" : "Recompute"}
                  </button>
                )}
              </div>

              <WinProbabilityBar teamAName={teamAName} teamBName={teamBName} teamAPct={latest.team_a_win_pct} />

              {latest.factors.items.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2 text-xs uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
                    Why
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {latest.factors.items.map((f, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between text-sm"
                      >
                        <span style={{ color: "var(--color-cream-dim)" }}>{f.factor}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            color: f.direction === "favor_a" ? "var(--color-amber)" : "var(--color-cream-dim)",
                            backgroundColor: "rgba(255,255,255,0.04)",
                          }}
                        >
                          {f.direction === "favor_a" ? teamAName : teamBName}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {momentum.length > 1 && (
                <div className="mt-6">
                  <div className="mb-2 text-xs uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
                    Momentum
                  </div>
                  <MomentumChart points={momentum} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
