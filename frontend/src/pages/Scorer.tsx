import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { endpoints, resolveUploadUrl, type MatchOut, type InningsOut, type PlayerOut, type TeamOut } from "../api/client";
import { useLiveMatch } from "../hooks/useLiveMatch";
import { ScoreboardValue } from "../components/Scoreboard";
import { BallAnimation } from "../components/BallAnimation";
import { NowPlaying } from "../components/NowPlaying";

const RUN_BUTTONS = [
  { label: "0", outcome: "dot" },
  { label: "1", outcome: "one" },
  { label: "2", outcome: "two" },
  { label: "3", outcome: "three" },
  { label: "4", outcome: "four" },
  { label: "6", outcome: "six" },
];
const EXTRA_BUTTONS = [
  { label: "Wide", outcome: "wide" },
  { label: "No Ball", outcome: "no_ball" },
  { label: "Bye", outcome: "bye" },
  { label: "Leg Bye", outcome: "leg_bye" },
];
const DISMISSAL_TYPES = [
  { label: "Bowled", value: "bowled" },
  { label: "Caught", value: "caught" },
  { label: "LBW", value: "lbw" },
  { label: "Run Out", value: "run_out" },
  { label: "Stumped", value: "stumped" },
  { label: "Hit Wicket", value: "hit_wicket" },
];
const NEEDS_FIELDER = new Set(["caught", "run_out", "stumped"]);

function Btn({ children, onClick, disabled, color = "var(--color-pitch-700)", textColor = "var(--color-cream)" }:
  { children: React.ReactNode; onClick: () => void; disabled?: boolean; color?: string; textColor?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg py-3 text-center text-lg font-bold transition-transform active:scale-95 disabled:opacity-30"
      style={{ backgroundColor: color, color: textColor, fontFamily: "var(--font-mono)" }}
    >
      {children}
    </button>
  );
}

function Avatar({ player, size = 32 }: { player: PlayerOut | undefined; size?: number }) {
  if (!player) {
    return <div className="rounded-full" style={{ width: size, height: size, backgroundColor: "var(--color-pitch-700)" }} />;
  }
  return player.profile_image_url ? (
    <img
      src={resolveUploadUrl(player.profile_image_url)}
      alt=""
      className="rounded-full object-cover"
      style={{ width: size, height: size, border: "1px solid var(--color-pitch-line)" }}
    />
  ) : (
    <div
      className="flex items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream-faint)", fontSize: size * 0.4 }}
    >
      {player.full_name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function PlayerPicker({
  label, players, value, onChange, exclude,
}: {
  label: string; players: PlayerOut[]; value: number | ""; onChange: (id: number | "") => void; exclude?: number | "";
}) {
  const selected = players.find((p) => p.id === value);
  const options = exclude ? players.filter((p) => p.id !== exclude) : players;
  return (
    <div>
      <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>{label}</label>
      <div className="flex items-center gap-2">
        <Avatar player={selected} />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
          className="flex-1 rounded-md border px-2 py-2 text-sm outline-none"
          style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
        >
          <option value="">—</option>
          {options.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>
    </div>
  );
}

export function Scorer() {
  const { matchId } = useParams();
  const id = Number(matchId);
  const [match, setMatch] = useState<MatchOut | null>(null);
  const [teams, setTeams] = useState<Record<number, TeamOut>>({});
  const [innings, setInnings] = useState<InningsOut[]>([]);
  const [battingRoster, setBattingRoster] = useState<PlayerOut[]>([]);
  const [bowlingRoster, setBowlingRoster] = useState<PlayerOut[]>([]);

  const [strikerId, setStrikerId] = useState<number | "">("");
  const [nonStrikerId, setNonStrikerId] = useState<number | "">("");
  const [bowlerId, setBowlerId] = useState<number | "">("");
  const [previousBowlerId, setPreviousBowlerId] = useState<number | "">("");
  const [needNewBowler, setNeedNewBowler] = useState(false);

  const [showWicket, setShowWicket] = useState(false);
  const [dismissalType, setDismissalType] = useState("bowled");
  const [dismissedIsStriker, setDismissedIsStriker] = useState(true);
  const [fielderId, setFielderId] = useState<number | "">("");

  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [lastBalls, setLastBalls] = useState<string[]>([]);

  const { payload } = useLiveMatch(match ? id : null);
  const [squadScoped, setSquadScoped] = useState<{ batting: boolean; bowling: boolean }>({ batting: false, bowling: false });

  async function load() {
    const [m, t] = await Promise.all([endpoints.match(id), endpoints.teams()]);
    setMatch(m.data);
    setTeams(Object.fromEntries(t.data.map((tm) => [tm.id, tm])));
    const inn = await endpoints.matchInnings(id).then((r) => r.data);
    setInnings(inn);
    const current = inn.find((i) => !i.is_completed && i.total_balls > 0) ?? inn.find((i) => !i.is_completed) ?? inn[inn.length - 1];
    if (current) {
      const [fullBat, fullBowl, rosterBat, rosterBowl] = await Promise.all([
        endpoints.players(current.batting_team_id).then((r) => r.data),
        endpoints.players(current.bowling_team_id).then((r) => r.data),
        endpoints.matchRoster(id, current.batting_team_id).then((r) => r.data).catch(() => null),
        endpoints.matchRoster(id, current.bowling_team_id).then((r) => r.data).catch(() => null),
      ]);
      // Squad-scoped: only players in the linked squad's available list.
      // Falls back to the full team roster when no squad was set for this match.
      const battingIds = rosterBat?.squad_scoped ? new Set(rosterBat.player_ids) : null;
      const bowlingIds = rosterBowl?.squad_scoped ? new Set(rosterBowl.player_ids) : null;
      setBattingRoster(battingIds ? fullBat.filter((p) => battingIds.has(p.id)) : fullBat);
      setBowlingRoster(bowlingIds ? fullBowl.filter((p) => bowlingIds.has(p.id)) : fullBowl);
      setSquadScoped({ batting: !!rosterBat?.squad_scoped, bowling: !!rosterBowl?.squad_scoped });
    }
  }

  useEffect(() => {
    load();
  }, [matchId]);

  // React to over-completion signalled by the broadcast — same signal every
  // viewer gets, but only the scorer acts on it by blocking further scoring
  // until a new bowler (not the one who just finished) is picked.
  useEffect(() => {
    if (payload?.event?.over_completed) {
      setPreviousBowlerId(payload.event.previous_bowler_id ?? "");
      setBowlerId("");
      setNeedNewBowler(true);
    }
  }, [payload?.event?.delivery_id]);

  const currentInnings = innings.find((i) => !i.is_completed && i.total_balls > 0) ?? innings.find((i) => !i.is_completed) ?? innings[innings.length - 1];

  async function score(outcome: string, extra: Partial<{
    is_wicket: boolean; dismissal_type: string; dismissed_player_id: number; fielder_id: number;
  }> = {}) {
    if (!currentInnings || strikerId === "" || nonStrikerId === "" || bowlerId === "") {
      setError("Select striker, non-striker, and bowler first.");
      return;
    }
    setError(null);
    setScoring(true);
    try {
      await endpoints.scoreDelivery({
        innings_id: currentInnings.id,
        striker_id: Number(strikerId),
        non_striker_id: Number(nonStrikerId),
        bowler_id: Number(bowlerId),
        outcome,
        ...extra,
      });
      setLastBalls((prev) => [outcomeAbbrev(outcome, extra.is_wicket), ...prev].slice(0, 6));

      if (outcome === "one" || outcome === "three") {
        setStrikerId(nonStrikerId);
        setNonStrikerId(strikerId);
      }
      await load();
      setShowWicket(false);
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setError(message ?? "Failed to score that delivery.");
    } finally {
      setScoring(false);
    }
  }

  function outcomeAbbrev(outcome: string, isWicket?: boolean): string {
    if (isWicket) return "W";
    const map: Record<string, string> = {
      dot: "0", one: "1", two: "2", three: "3", four: "4", six: "6",
      wide: "Wd", no_ball: "Nb", bye: "B", leg_bye: "Lb",
    };
    return map[outcome] ?? outcome;
  }

  function handleWicketConfirm() {
    const dismissedId = dismissedIsStriker ? strikerId : nonStrikerId;
    if (dismissedId === "") return;
    score("wicket", {
      is_wicket: true,
      dismissal_type: dismissalType,
      dismissed_player_id: Number(dismissedId),
      ...(NEEDS_FIELDER.has(dismissalType) && fielderId !== "" ? { fielder_id: Number(fielderId) } : {}),
    });
  }

  function confirmNewBowler() {
    if (bowlerId === "") return;
    setNeedNewBowler(false);
  }

  if (!match) return <div style={{ color: "var(--color-cream-faint)" }}>Loading…</div>;

  const teamA = teams[match.team_a_id];
  const teamB = teams[match.team_b_id];
  const battingTeam = currentInnings ? teams[currentInnings.batting_team_id] : undefined;
  const bowlingTeam = currentInnings ? teams[currentInnings.bowling_team_id] : undefined;
  const blocked = needNewBowler;

  return (
    <div>
      <Link to="/score" className="mb-4 inline-block text-xs" style={{ color: "var(--color-cream-faint)" }}>
        ← All matches
      </Link>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-3">
        {teamA?.logo_url ? (
          <img src={resolveUploadUrl(teamA.logo_url)} alt="" className="h-10 w-10 rounded-md object-cover" style={{ border: "1px solid var(--color-pitch-line)" }} />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-md text-xs font-bold" style={{ backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream-faint)" }}>
            {teamA?.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
            {teamA?.name ?? "Team A"} vs {teamB?.name ?? "Team B"}
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-cream-faint)" }}>
            Live on{" "}
            <Link to={`/live/${match.id}`} className="underline" style={{ color: "var(--color-amber)" }}>
              /live/{match.id}
            </Link>
            {" "}on any device.
          </p>
        </div>
        {teamB?.logo_url ? (
          <img src={resolveUploadUrl(teamB.logo_url)} alt="" className="h-10 w-10 rounded-md object-cover" style={{ border: "1px solid var(--color-pitch-line)" }} />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-md text-xs font-bold" style={{ backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream-faint)" }}>
            {teamB?.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </motion.div>

      {payload?.event && <BallAnimation key={payload.event.delivery_id} event={payload.event} />}

      <NowPlaying
        striker={payload?.event?.striker ?? payload?.current_players?.striker}
        nonStriker={payload?.event?.non_striker ?? payload?.current_players?.non_striker}
        bowler={payload?.event?.bowler ?? payload?.current_players?.bowler}
      />

      {payload && (
        <div className="mb-6 rounded-xl border p-5" style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(19,28,24,0.6)" }}>
          <ScoreboardValue value={payload.score} size="text-5xl" />
          <div className="mt-2 flex gap-4 font-mono text-sm" style={{ color: "var(--color-cream-dim)", fontFamily: "var(--font-mono)" }}>
            <span>Overs {payload.overs}</span>
            <span>RR {payload.run_rate.toFixed(2)}</span>
            {battingTeam && bowlingTeam && (
              <span style={{ color: "var(--color-cream-faint)" }}>
                {battingTeam.name} batting · {bowlingTeam.name} bowling
              </span>
            )}
          </div>
          <div className="mt-2 flex gap-1.5">
            {lastBalls.map((b, i) => (
              <span
                key={i}
                className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-bold"
                style={{
                  backgroundColor: b === "W" ? "var(--color-crimson)" : "var(--color-pitch-700)",
                  color: b === "W" ? "white" : "var(--color-cream)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-1 flex gap-3 text-[10px]" style={{ color: "var(--color-cream-faint)" }}>
        {squadScoped.batting && <span>⬤ Striker/Non-striker limited to squad</span>}
        {squadScoped.bowling && <span>⬤ Bowler limited to squad</span>}
      </div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PlayerPicker label="Striker" players={battingRoster} value={strikerId} onChange={setStrikerId} />
        <PlayerPicker label="Non-striker" players={battingRoster} value={nonStrikerId} onChange={setNonStrikerId} />
        <PlayerPicker label="Bowler" players={bowlingRoster} value={bowlerId} onChange={setBowlerId} exclude={needNewBowler ? previousBowlerId : undefined} />
      </div>

      {error && <div className="mb-4 text-sm" style={{ color: "var(--color-crimson)" }}>{error}</div>}

      {blocked && (
        <div
          className="mb-4 rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "var(--color-amber-dim)", backgroundColor: "rgba(242,169,59,0.08)", color: "var(--color-cream)" }}
        >
          Over complete — pick the next bowler above (can't be the same one who just bowled), then
          {" "}
          <button onClick={confirmNewBowler} disabled={bowlerId === ""} className="underline disabled:opacity-40" style={{ color: "var(--color-amber)" }}>
            confirm to continue scoring
          </button>.
        </div>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {RUN_BUTTONS.map((b) => (
          <Btn key={b.outcome} disabled={blocked} onClick={() => score(b.outcome)} color={b.outcome === "four" || b.outcome === "six" ? "var(--color-amber)" : "var(--color-pitch-700)"} textColor={b.outcome === "four" || b.outcome === "six" ? "var(--color-pitch-950)" : "var(--color-cream)"}>
            {b.label}
          </Btn>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {EXTRA_BUTTONS.map((b) => (
          <Btn key={b.outcome} disabled={blocked} onClick={() => score(b.outcome)}>{b.label}</Btn>
        ))}
      </div>
      <button
        onClick={() => setShowWicket(true)}
        disabled={scoring || blocked}
        className="w-full rounded-lg py-3 text-center text-lg font-bold transition-opacity hover:opacity-90 disabled:opacity-30"
        style={{ backgroundColor: "var(--color-crimson)", color: "white", fontFamily: "var(--font-mono)" }}
      >
        WICKET
      </button>

      <AnimatePresence>
        {showWicket && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(10,18,16,0.7)" }}
            onClick={() => setShowWicket(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-xl border p-6"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-900)" }}
            >
              <h2 className="mb-4 text-lg font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
                Record Wicket
              </h2>
              <div className="mb-3">
                <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Dismissal type</label>
                <select
                  value={dismissalType}
                  onChange={(e) => setDismissalType(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
                >
                  {DISMISSAL_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Batter out</label>
                <div className="flex gap-3 text-sm" style={{ color: "var(--color-cream)" }}>
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={dismissedIsStriker} onChange={() => setDismissedIsStriker(true)} />
                    Striker
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={!dismissedIsStriker} onChange={() => setDismissedIsStriker(false)} />
                    Non-striker
                  </label>
                </div>
              </div>
              {NEEDS_FIELDER.has(dismissalType) && (
                <div className="mb-4">
                  <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Fielder</label>
                  <select
                    value={fielderId}
                    onChange={(e) => setFielderId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
                  >
                    <option value="">—</option>
                    {bowlingRoster.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              )}
              <button
                onClick={handleWicketConfirm}
                className="w-full rounded-md px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: "var(--color-crimson)", color: "white" }}
              >
                Confirm Wicket
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
