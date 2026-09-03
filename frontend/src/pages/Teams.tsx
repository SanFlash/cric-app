import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { endpoints, type TeamOut, type PlayerOut } from "../api/client";
import { Modal } from "../components/Modal";
import { ImageUpload } from "../components/ImageUpload";
import { UploadedImage } from "../components/UploadedImage";
import { useAuth } from "../hooks/useAuth";

interface TeamWithRoster extends TeamOut {
  players: PlayerOut[];
}

export function Teams() {
  const { user, canManageTeams } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamWithRoster[]>([]);
  const [allPlayers, setAllPlayers] = useState<PlayerOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCoach, setNewCoach] = useState("");
  const [newLogo, setNewLogo] = useState<string | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [playerSearch, setPlayerSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function loadTeams() {
    setLoading(true);
    Promise.all([
      endpoints.teams().then(async (r) => {
        const withRosters = await Promise.all(
          r.data.map(async (t) => {
            const players = await endpoints.players(t.id).then((res) => res.data).catch(() => []);
            return { ...t, players };
          })
        );
        setTeams(withRosters);
      }),
      endpoints.players().then((r) => setAllPlayers(r.data)),
    ]).finally(() => setLoading(false));
  }

  useEffect(loadTeams, []);

  function togglePlayer(id: number) {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateTeam() {
    setFormError(null);
    if (!newName.trim()) {
      setFormError("Team name is required.");
      return;
    }
    setSaving(true);
    try {
      if (!user?.company_id) {
        setFormError("Your account isn't linked to a company, so a team can't be created. Contact a Super Admin.");
        setSaving(false);
        return;
      }
      const res = await endpoints.createTeam({ company_id: user.company_id, name: newName, coach_name: newCoach || undefined, logo_url: newLogo ?? undefined });
      const newTeamId = res.data.id;

      // Assign whichever existing players were selected — reuses the
      // same transfer endpoint TeamDetail's roster management already
      // relies on, one call per player (no bulk-assign endpoint exists,
      // and this list is realistically small enough that it doesn't need one).
      for (const playerId of selectedPlayerIds) {
        await endpoints.transferPlayer(playerId, newTeamId);
      }

      setShowNewTeam(false);
      setNewName("");
      setNewCoach("");
      setNewLogo(null);
      setSelectedPlayerIds(new Set());
      setPlayerSearch("");
      // Land on the new team's page — where its rating and win prediction
      // (from whichever players were just assigned) are shown.
      navigate(`/teams/${newTeamId}`);
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setFormError(message ?? "Failed to create team.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
            Teams
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-cream-faint)" }}>
            Every team in your organization, with squad size and average rating.
          </p>
        </div>
        {canManageTeams && (
          <button
            onClick={() => setShowNewTeam(true)}
            className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
          >
            + New Team
          </button>
        )}
      </motion.div>

      {loading && <div style={{ color: "var(--color-cream-faint)" }}>Loading…</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teams.map((t, i) => {
          const rated = t.players.filter((p) => p.current_rating > 0);
          const avgRating = rated.length ? rated.reduce((a, p) => a + p.current_rating, 0) / rated.length : 0;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link
                to={`/teams/${t.id}`}
                className="block rounded-xl border p-5 transition-colors hover:border-[var(--color-amber-dim)]"
                style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.5)" }}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <UploadedImage src={t.logo_url} name={t.name} size={40} shape="square" />
                    <div>
                      <div className="text-lg font-semibold" style={{ color: "var(--color-cream)", fontFamily: "var(--font-display)" }}>
                        {t.name}
                      </div>
                      {t.coach_name && (
                        <div className="mt-0.5 text-xs" style={{ color: "var(--color-cream-faint)" }}>
                          Coach: {t.coach_name}
                        </div>
                      )}
                    </div>
                  </div>
                  {avgRating > 0 && (
                    <div
                      className="rounded-md px-2 py-1 font-mono text-sm font-bold"
                      style={{ backgroundColor: "rgba(34,211,238,0.12)", color: "var(--color-amber)", fontFamily: "var(--font-mono)" }}
                    >
                      {avgRating.toFixed(0)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: "var(--color-cream-dim)" }}>
                  <span>{t.players.length} players</span>
                  <span>{t.players.filter((p) => p.playing_role === "bowler").length} bowlers</span>
                  <span>{t.players.filter((p) => p.playing_role === "all_rounder").length} all-rounders</span>
                </div>
              </Link>
            </motion.div>
          );
        })}
        {!loading && teams.length === 0 && (
          <div className="col-span-full text-sm" style={{ color: "var(--color-cream-faint)" }}>
            No teams yet.
          </div>
        )}
      </div>

      <Modal open={showNewTeam} onClose={() => setShowNewTeam(false)} title="New Team">
        <div className="flex flex-col gap-4">
          <ImageUpload label="Upload team logo" onUploaded={setNewLogo} shape="square" />
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Team name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Coach (optional)</label>
            <input
              value={newCoach}
              onChange={(e) => setNewCoach(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>
              Add existing players (optional) — {selectedPlayerIds.size} selected
            </label>
            <input
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              placeholder="Search players…"
              className="mb-2 w-full rounded-md border px-3 py-1.5 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            />
            <div
              className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border p-2"
              style={{ borderColor: "var(--color-pitch-line)" }}
            >
              {allPlayers
                .filter((p) => p.full_name.toLowerCase().includes(playerSearch.toLowerCase()))
                .map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={selectedPlayerIds.has(p.id)}
                      onChange={() => togglePlayer(p.id)}
                    />
                    <UploadedImage src={p.profile_image_url} name={p.full_name} size={20} shape="circle" />
                    <span style={{ color: "var(--color-cream)" }}>{p.full_name}</span>
                    <span className="ml-auto text-[10px]" style={{ color: "var(--color-cream-faint)" }}>
                      {p.team_id ? "on a team" : "free agent"}
                    </span>
                  </label>
                ))}
              {allPlayers.length === 0 && (
                <div className="px-1.5 py-1 text-xs" style={{ color: "var(--color-cream-faint)" }}>No players exist yet.</div>
              )}
            </div>
            <div className="mt-1 text-[10px]" style={{ color: "var(--color-cream-faint)" }}>
              Selecting a player already on another team moves them here — same as Edit → Transfer elsewhere.
            </div>
          </div>
          {formError && <div className="text-xs" style={{ color: "var(--color-crimson)" }}>{formError}</div>}
          <button
            onClick={handleCreateTeam}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
          >
            {saving ? "Creating…" : "Create Team"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
