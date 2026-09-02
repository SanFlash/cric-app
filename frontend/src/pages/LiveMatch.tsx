import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveMatch } from "../hooks/useLiveMatch";
import { ScoreboardValue } from "../components/Scoreboard";
import { WinProbabilityBar } from "../components/WinProbabilityBar";
import { MomentumChart } from "../components/MomentumChart";
import { BallAnimation } from "../components/BallAnimation";
import { NowPlaying } from "../components/NowPlaying";
import { UploadedImage } from "../components/UploadedImage";
import { ChaseBanner } from "../components/ChaseBanner";
import { PitchGraphic } from "../components/PitchGraphic";
import { computeChaseSummary } from "../utils/chase";
import { MatchSummaryCard } from "../components/MatchSummaryCard";
import { endpoints, type PredictionOut, type MatchOut, type TeamOut, type MatchSummaryOut } from "../api/client";

export function LiveMatch() {
  const { matchId: matchIdParam } = useParams();
  const navigate = useNavigate();
  const [matchId, setMatchId] = useState<number | null>(matchIdParam ? Number(matchIdParam) : null);
  const { payload, connected } = useLiveMatch(matchId);
  const [prediction, setPrediction] = useState<PredictionOut | null>(null);
  const [momentum, setMomentum] = useState<PredictionOut[]>([]);
  const [match, setMatch] = useState<MatchOut | null>(null);
  const [teamA, setTeamA] = useState<TeamOut | null>(null);
  const [teamB, setTeamB] = useState<TeamOut | null>(null);
  const [summary, setSummary] = useState<MatchSummaryOut | null>(null);
  const [allMatches, setAllMatches] = useState<MatchOut[]>([]);
  const [teamsById, setTeamsById] = useState<Record<number, TeamOut>>({});
  const [matchesLoading, setMatchesLoading] = useState(true);
  const chaseSummary = payload && match ? computeChaseSummary(payload.score, payload.overs, payload.target, match.overs_limit) : null;

  // Powers the match-selector list: every match, teams for name lookups.
  // Fetched once on mount, independent of whether a specific match is
  // already selected — so the "← All matches" back-link always has
  // fresh data to show, not just on first load.
  useEffect(() => {
    Promise.all([endpoints.matches(), endpoints.teams()]).then(([m, t]) => {
      setAllMatches(m.data);
      setTeamsById(Object.fromEntries(t.data.map((team) => [team.id, team])));
      setMatchesLoading(false);
    }).catch(() => setMatchesLoading(false));
  }, []);

  function selectMatch(id: number) {
    setMatchId(id);
    navigate(`/live/${id}`);
  }

  useEffect(() => {
    if (matchId == null) return;
    endpoints.latestPrediction(matchId).then((r) => setPrediction(r.data)).catch(() => {
      // No prediction computed for this match yet — compute one now
      // rather than leaving the win-probability meter empty. This is
      // exactly what the Predictions page's "Compute" button does; doing
      // it automatically here means a freshly-started match still shows
      // a meter the first time someone watches it, not just after
      // someone's separately visited Predictions and clicked compute.
      endpoints.computePreMatchPrediction(matchId).then((r2) => setPrediction(r2.data)).catch(() => setPrediction(null));
    });
    endpoints.momentum(matchId).then((r) => setMomentum(r.data)).catch(() => setMomentum([]));
    endpoints.match(matchId).then((r) => {
      setMatch(r.data);
      Promise.all([endpoints.team(r.data.team_a_id), endpoints.team(r.data.team_b_id)]).then(([a, b]) => {
        setTeamA(a.data);
        setTeamB(b.data);
      });
    }).catch(() => setMatch(null));
    // Checks match.status, not payload.is_completed — see the identical
    // note in Scorer.tsx. payload.is_completed reflects the CURRENT
    // INNINGS, not the whole match, so using it here would show a
    // misleading "Completed" state after just innings 1 finishes.
    if (match?.status === "completed") {
      endpoints.matchSummary(matchId).then((r) => setSummary(r.data)).catch(() => setSummary(null));
    }
  }, [matchId, payload?.score, match?.status]); // refetch when the score changes, or the match completes

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
          Live Match Center
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-cream-faint)" }}>
          {match ? `${teamA?.name ?? "Team A"} vs ${teamB?.name ?? "Team B"} — ` : ""}
          Ball-by-ball score, live win probability, and momentum — streamed over WebSocket.
        </p>
      </motion.div>

      {matchId != null && (
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => { setMatchId(null); navigate("/live"); }}
            className="text-xs underline"
            style={{ color: "var(--color-cream-faint)" }}
          >
            ← All matches
          </button>
          <span className="flex items-center gap-2 text-xs" style={{ color: "var(--color-cream-faint)" }}>
            <span
              className={connected ? "live-dot" : ""}
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: connected ? "var(--color-win)" : "var(--color-crimson)",
              }}
            />
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      )}

      {matchId == null && (
        <div className="mb-6">
          {matchesLoading ? (
            <div className="text-sm" style={{ color: "var(--color-cream-faint)" }}>Loading matches…</div>
          ) : allMatches.length === 0 ? (
            <EmptyState message="No matches yet — start one from Score a Match." />
          ) : (
            <div className="flex flex-col gap-2">
              {[...allMatches]
                .sort((a, b) => (a.status === "live" ? -1 : 0) - (b.status === "live" ? -1 : 0))
                .map((m) => {
                  const ta = teamsById[m.team_a_id];
                  const tb = teamsById[m.team_b_id];
                  return (
                    <button
                      key={m.id}
                      onClick={() => selectMatch(m.id)}
                      className="flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:border-[var(--color-amber-dim)]"
                      style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.5)" }}
                    >
                      <div className="flex items-center gap-3">
                        {ta && <UploadedImage src={ta.logo_url} name={ta.name} size={28} shape="square" />}
                        <span className="font-medium" style={{ color: "var(--color-cream)" }}>
                          {ta?.name ?? "Team A"} vs {tb?.name ?? "Team B"}
                        </span>
                        {tb && <UploadedImage src={tb.logo_url} name={tb.name} size={28} shape="square" />}
                      </div>
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest"
                        style={{
                          backgroundColor: m.status === "live" ? "rgba(224,49,58,0.15)" : m.status === "completed" ? "var(--color-win-dim)" : "var(--color-pitch-700)",
                          color: m.status === "live" ? "var(--color-crimson)" : m.status === "completed" ? "var(--color-win)" : "var(--color-cream-faint)",
                        }}
                      >
                        {m.status === "live" ? "● Live" : m.status}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {matchId != null && !payload && (
        <EmptyState message="Connected, waiting for the first ball. Score a delivery via the API to see this come alive." />
      )}

      <AnimatePresence>
        {payload && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-xl border p-8"
            style={{
              borderColor: "var(--color-amber-dim)",
              background: "linear-gradient(160deg, rgba(16,21,42,0.95) 0%, rgba(12,16,32,0.95) 55%, rgba(34,211,238,0.06) 100%)",
              position: "relative",
            }}
          >
            <PitchGraphic />
            <div className="relative">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {teamA && <UploadedImage src={teamA.logo_url} name={teamA.name} size={24} shape="square" />}
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
                  style={{
                    backgroundColor: match?.status === "completed" ? "var(--color-win-dim)" : "rgba(224,49,58,0.15)",
                    color: match?.status === "completed" ? "var(--color-win)" : "var(--color-crimson)",
                  }}
                >
                  {match?.status === "completed" ? "Completed" : "● Live"}
                </span>
                {teamB && <UploadedImage src={teamB.logo_url} name={teamB.name} size={24} shape="square" />}
              </div>
              <span className="font-mono text-xs" style={{ color: "var(--color-cream-faint)", fontFamily: "var(--font-mono)" }}>
                Innings {payload.innings_number}
              </span>
            </div>

            {match?.status === "completed" && match?.result_summary && (
              <div className="mb-4 text-sm font-medium" style={{ color: "var(--color-win)" }}>
                {match.result_summary}
              </div>
            )}

            {match?.status === "completed" && summary && <MatchSummaryCard summary={summary} />}

            {payload.event && payload.event.innings_id === payload.innings_id && (
              <BallAnimation key={payload.event.delivery_id} event={payload.event} />
            )}

            {(() => {
              const eventIsCurrent = payload.event?.innings_id === payload.innings_id;
              const liveEvent = eventIsCurrent ? payload.event : undefined;
              return (
                <NowPlaying
                  striker={liveEvent?.current_striker ?? payload.current_players?.striker}
                  nonStriker={liveEvent?.current_non_striker ?? payload.current_players?.non_striker}
                  bowler={liveEvent?.bowler ?? payload.current_players?.bowler}
                />
              );
            })()}

            {match && chaseSummary && match?.status !== "completed" && <ChaseBanner chase={chaseSummary} />}

            <div className="mb-2">
              <ScoreboardValue value={payload.score} size="text-7xl" />
            </div>
            <div className="mb-6 flex gap-6 font-mono text-sm" style={{ fontFamily: "var(--font-mono)" }}>
              <span style={{ color: "var(--color-cream-dim)" }}>
                Overs <b style={{ color: "var(--color-cream)" }}>{payload.overs}</b>
              </span>
              <span style={{ color: "var(--color-cream-dim)" }}>
                RR <b style={{ color: "var(--color-cream)" }}>{payload.run_rate.toFixed(2)}</b>
              </span>
              {payload.target != null && (
                <span style={{ color: "var(--color-cream-dim)" }}>
                  Target <b style={{ color: "var(--color-amber)" }}>{payload.target}</b>
                </span>
              )}
            </div>

            {(payload.win_probability || prediction) && (
              <div className="mb-6">
                <div className="mb-2 text-xs uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
                  Win Probability
                </div>
                <WinProbabilityBar
                  teamAName={teamA?.name ?? "Team A"}
                  teamBName={teamB?.name ?? "Team B"}
                  teamAPct={payload.win_probability?.team_a_pct ?? prediction?.team_a_win_pct ?? 50}
                />
              </div>
            )}

            {momentum.length > 1 && (
              <div>
                <div className="mb-2 text-xs uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
                  Momentum
                </div>
                <MomentumChart points={momentum} />
              </div>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-dashed p-12 text-center text-sm"
      style={{ borderColor: "var(--color-pitch-line)", color: "var(--color-cream-faint)" }}
    >
      {message}
    </div>
  );
}
