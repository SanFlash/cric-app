import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { endpoints, type PredictionOut, type MatchOut, type TeamOut } from "../api/client";
import { useLiveMatch } from "../hooks/useLiveMatch";
import { ScoreboardValue } from "../components/Scoreboard";
import { WinProbabilityBar } from "../components/WinProbabilityBar";
import { MomentumChart } from "../components/MomentumChart";
import { BallAnimation } from "../components/BallAnimation";
import { NowPlaying } from "../components/NowPlaying";
import { UploadedImage } from "../components/UploadedImage";
import { ChaseBanner } from "../components/ChaseBanner";
import { computeChaseSummary } from "../utils/chase";

export function LiveMatch() {
  const { matchId: matchIdParam } = useParams();
  const [matchIdInput, setMatchIdInput] = useState(matchIdParam ?? "1");
  const [matchId, setMatchId] = useState<number | null>(matchIdParam ? Number(matchIdParam) : null);
  const { payload, connected } = useLiveMatch(matchId);
  const [prediction, setPrediction] = useState<PredictionOut | null>(null);
  const [momentum, setMomentum] = useState<PredictionOut[]>([]);
  const [match, setMatch] = useState<MatchOut | null>(null);
  const [teamA, setTeamA] = useState<TeamOut | null>(null);
  const [teamB, setTeamB] = useState<TeamOut | null>(null);
  const chaseSummary = payload && match ? computeChaseSummary(payload.score, payload.overs, payload.target, match.overs_limit) : null;

  useEffect(() => {
    if (matchId == null) return;
    endpoints.latestPrediction(matchId).then((r) => setPrediction(r.data)).catch(() => setPrediction(null));
    endpoints.momentum(matchId).then((r) => setMomentum(r.data)).catch(() => setMomentum([]));
    endpoints.match(matchId).then((r) => {
      setMatch(r.data);
      Promise.all([endpoints.team(r.data.team_a_id), endpoints.team(r.data.team_b_id)]).then(([a, b]) => {
        setTeamA(a.data);
        setTeamB(b.data);
      });
    }).catch(() => setMatch(null));
  }, [matchId, payload?.score]); // refetch momentum when the score changes

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

      <div className="mb-6 flex items-center gap-3">
        <input
          value={matchIdInput}
          onChange={(e) => setMatchIdInput(e.target.value)}
          placeholder="Match ID"
          className="w-32 rounded-md border px-3 py-2 text-sm font-mono outline-none"
          style={{
            borderColor: "var(--color-pitch-line)",
            backgroundColor: "var(--color-pitch-800)",
            color: "var(--color-cream)",
            fontFamily: "var(--font-mono)",
          }}
        />
        <button
          onClick={() => setMatchId(Number(matchIdInput))}
          className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
        >
          Watch match
        </button>
        {matchId != null && (
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
        )}
      </div>

      {matchId == null && (
        <EmptyState message="Enter a match ID and press Watch to connect to its live scoreboard." />
      )}

      {matchId != null && !payload && (
        <EmptyState message="Connected, waiting for the first ball. Score a delivery via the API to see this come alive." />
      )}

      <AnimatePresence>
        {payload && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border p-8"
            style={{
              borderColor: "var(--color-pitch-line)",
              background: "linear-gradient(180deg, rgba(19,28,24,0.9), rgba(14,21,18,0.9))",
            }}
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {teamA && <UploadedImage src={teamA.logo_url} name={teamA.name} size={24} shape="square" />}
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
                  style={{
                    backgroundColor: payload.is_completed ? "var(--color-win-dim)" : "rgba(193,39,45,0.15)",
                    color: payload.is_completed ? "var(--color-win)" : "var(--color-crimson)",
                  }}
                >
                  {payload.is_completed ? "Completed" : "● Live"}
                </span>
                {teamB && <UploadedImage src={teamB.logo_url} name={teamB.name} size={24} shape="square" />}
              </div>
              <span className="font-mono text-xs" style={{ color: "var(--color-cream-faint)", fontFamily: "var(--font-mono)" }}>
                Innings {payload.innings_number}
              </span>
            </div>

            {payload.event && <BallAnimation key={payload.event.delivery_id} event={payload.event} />}

            <NowPlaying
              striker={payload.event?.striker ?? payload.current_players?.striker}
              nonStriker={payload.event?.non_striker ?? payload.current_players?.non_striker}
              bowler={payload.event?.bowler ?? payload.current_players?.bowler}
            />

            {match && chaseSummary && <ChaseBanner chase={chaseSummary} />}

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
