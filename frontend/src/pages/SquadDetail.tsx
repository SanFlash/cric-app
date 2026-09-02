import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  endpoints,
  type SquadOut,
  type SquadPlayerOut,
  type PlayerOut,
  type XIRecommendationOut,
} from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { UploadedImage } from "../components/UploadedImage";

const ROLE_COLORS: Record<string, string> = {
  batter: "var(--color-amber)",
  bowler: "var(--color-crimson)",
  all_rounder: "var(--color-win)",
  wicketkeeper: "var(--color-cream)",
};

export function SquadDetail() {
  const { squadId } = useParams();
  const { canManageTeams } = useAuth();
  const [squad, setSquad] = useState<SquadOut | null>(null);
  const [squadPlayers, setSquadPlayers] = useState<SquadPlayerOut[]>([]);
  const [roster, setRoster] = useState<PlayerOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [addPlayerId, setAddPlayerId] = useState<number | "">("");
  const [recommendation, setRecommendation] = useState<XIRecommendationOut | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  async function load() {
    if (!squadId) return;
    const id = Number(squadId);
    setLoading(true);
    try {
      const allSquads = await endpoints.squads().then((r) => r.data);
      const found = allSquads.find((s) => s.id === id) ?? null;
      setSquad(found);
      if (found) {
        const [sp, rosterData] = await Promise.all([
          endpoints.squadPlayers(id).then((r) => r.data),
          endpoints.players(found.team_id).then((r) => r.data),
        ]);
        setSquadPlayers(sp);
        setRoster(rosterData);
      }
    } catch {
      setSquad(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [squadId]);

  const rosterById = Object.fromEntries(roster.map((p) => [p.id, p]));
  const squadPlayerIds = new Set(squadPlayers.map((sp) => sp.player_id));
  const availableToAdd = roster.filter((p) => !squadPlayerIds.has(p.id));

  async function handleAddPlayer() {
    if (!squad || addPlayerId === "") return;
    await endpoints.addPlayerToSquad(squad.id, Number(addPlayerId));
    setAddPlayerId("");
    load();
  }

  async function handleToggleAvailability(playerId: number, current: boolean) {
    if (!squad) return;
    await endpoints.setAvailability(squad.id, playerId, !current);
    load();
  }

  async function handleRemove(playerId: number) {
    if (!squad) return;
    await endpoints.removePlayerFromSquad(squad.id, playerId);
    load();
  }

  async function handleRecommendXI() {
    if (!squad) return;
    setRecommending(true);
    setRecError(null);
    setRecommendation(null);
    try {
      const res = await endpoints.recommendXI(squad.id);
      setRecommendation(res.data);
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setRecError(message ?? "Couldn't generate a recommendation.");
    } finally {
      setRecommending(false);
    }
  }

  if (loading) return <div style={{ color: "var(--color-cream-faint)" }}>Loading…</div>;
  if (!squad) return <div style={{ color: "var(--color-cream-faint)" }}>Squad not found.</div>;

  return (
    <div>
      <Link to="/squads" className="mb-4 inline-block text-xs" style={{ color: "var(--color-cream-faint)" }}>
        ← All squads
      </Link>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
          {squad.name}
        </h1>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-5" style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.5)" }}>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
            Members ({squadPlayers.length})
          </h2>

          {canManageTeams && availableToAdd.length > 0 && (
            <div className="mb-4 flex gap-2">
              <select
                value={addPlayerId}
                onChange={(e) => setAddPlayerId(e.target.value ? Number(e.target.value) : "")}
                className="flex-1 rounded-md border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
              >
                <option value="">Add a player…</option>
                {availableToAdd.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
              <button
                onClick={handleAddPlayer}
                disabled={addPlayerId === ""}
                className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40"
                style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
              >
                Add
              </button>
            </div>
          )}

          <div className="flex flex-col gap-1">
            {squadPlayers.map((sp, i) => {
              const p = rosterById[sp.player_id];
              return (
                <motion.div
                  key={sp.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between border-b py-2 last:border-b-0"
                  style={{ borderColor: "var(--color-pitch-line)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: sp.is_available ? "var(--color-win)" : "var(--color-crimson)" }}
                    />
                    <UploadedImage src={p?.profile_image_url} name={p?.full_name ?? "?"} size={22} shape="circle" />
                    <span style={{ color: "var(--color-cream)" }}>{p?.full_name ?? `Player ${sp.player_id}`}</span>
                    {p && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ color: ROLE_COLORS[p.playing_role] ?? "var(--color-cream-dim)", backgroundColor: "rgba(255,255,255,0.04)" }}
                      >
                        {p.playing_role.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  {canManageTeams && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleAvailability(sp.player_id, sp.is_available)}
                        className="text-[11px] underline"
                        style={{ color: sp.is_available ? "var(--color-cream-faint)" : "var(--color-win)" }}
                      >
                        Mark {sp.is_available ? "unavailable" : "available"}
                      </button>
                      <button
                        onClick={() => handleRemove(sp.player_id)}
                        className="text-[11px]"
                        style={{ color: "var(--color-crimson)" }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
            {squadPlayers.length === 0 && (
              <div className="py-6 text-sm" style={{ color: "var(--color-cream-faint)" }}>
                No players in this squad yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border p-5" style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.5)" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
              Recommended XI
            </h2>
            <button
              onClick={handleRecommendXI}
              disabled={recommending}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
            >
              {recommending ? "Thinking…" : "Generate"}
            </button>
          </div>

          {recError && <div className="text-sm" style={{ color: "var(--color-crimson)" }}>{recError}</div>}

          {!recommendation && !recError && (
            <div className="py-6 text-sm" style={{ color: "var(--color-cream-faint)" }}>
              Mark players available, then click Generate for a rating-based XI with reasons for each pick.
            </div>
          )}

          {recommendation && (
            <div>
              <p className="mb-3 text-sm" style={{ color: "var(--color-cream-dim)" }}>{recommendation.summary}</p>

              {recommendation.warnings.length > 0 && (
                <div
                  className="mb-3 rounded-md border px-3 py-2 text-xs"
                  style={{ borderColor: "var(--color-crimson-dim)", backgroundColor: "rgba(224,49,58,0.08)", color: "var(--color-cream-dim)" }}
                >
                  {recommendation.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {recommendation.slots.map((s, i) => (
                  <motion.div
                    key={s.player_id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b pb-2 last:border-b-0"
                    style={{ borderColor: "var(--color-pitch-line)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: "var(--color-cream)" }}>
                        {i + 1}. {s.full_name}
                      </span>
                      <span className="font-mono text-xs font-bold" style={{ color: "var(--color-amber)", fontFamily: "var(--font-mono)" }}>
                        {s.current_rating.toFixed(0)}
                      </span>
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--color-cream-faint)" }}>{s.reason}</div>
                  </motion.div>
                ))}
              </div>

              {recommendation.bench.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-[10px] uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>Bench</div>
                  {recommendation.bench.map((s) => (
                    <div key={s.player_id} className="text-xs" style={{ color: "var(--color-cream-dim)" }}>{s.full_name}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
