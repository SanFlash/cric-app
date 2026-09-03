import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { endpoints, type PlayerOut, type TeamOut } from "../api/client";
import { Modal } from "../components/Modal";
import { ImageUpload } from "../components/ImageUpload";
import { useAuth } from "../hooks/useAuth";

const ROLE_LABELS: Record<string, string> = {
  batter: "Batter", bowler: "Bowler", all_rounder: "All-rounder", wicketkeeper: "Wicketkeeper",
};
const ROLE_OPTIONS = ["batter", "bowler", "all_rounder", "wicketkeeper"];

const ROLE_COLORS: Record<string, string> = {
  batter: "var(--color-amber)",
  bowler: "var(--color-crimson)",
  all_rounder: "var(--color-win)",
  wicketkeeper: "var(--color-cream)",
};

export function Players() {
  const { user } = useAuth();
  const canManage = !!user && ["super_admin", "company_admin"].includes(user.role);

  const [players, setPlayers] = useState<PlayerOut[]>([]);
  const [teams, setTeams] = useState<TeamOut[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("batter");
  const [newTeamId, setNewTeamId] = useState<number | "">("");
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([endpoints.players(), endpoints.teams()])
      .then(([p, t]) => {
        setPlayers(p.data.sort((a, b) => b.current_rating - a.current_rating));
        setTeams(t.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const teamsById: Record<number, TeamOut> = Object.fromEntries(teams.map((t) => [t.id, t]));

  async function handleAddPlayer() {
    setFormError(null);
    if (!newName.trim()) {
      setFormError("Player name is required.");
      return;
    }
    setSaving(true);
    try {
      await endpoints.createPlayer({
        full_name: newName,
        playing_role: newRole,
        team_id: newTeamId === "" ? undefined : newTeamId,
        profile_image_url: newPhoto ?? undefined,
      });
      setShowAdd(false);
      setNewName("");
      setNewRole("batter");
      setNewTeamId("");
      setNewPhoto(null);
      load();
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setFormError(message ?? "Failed to add player.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = players.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
            Players
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-cream-faint)" }}>
            Every player across every team, ranked by overall rating.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex-shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
          >
            + Add Player
          </button>
        )}
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
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.5)" }}
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
              <div className="mt-1 text-[11px]" style={{ color: "var(--color-cream-faint)" }}>
                {p.team_id ? teamsById[p.team_id]?.name ?? "…" : "No team"}
              </div>
            </Link>
          </motion.div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="col-span-full text-sm" style={{ color: "var(--color-cream-faint)" }}>
            No players match "{search}".
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Player">
        <div className="flex flex-col gap-4">
          <ImageUpload label="Player photo (optional)" onUploaded={setNewPhoto} currentUrl={newPhoto} shape="circle" />
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Full name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            >
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>
              Team (optional — leave as "No team" to add them as a free agent you can assign later)
            </label>
            <select
              value={newTeamId}
              onChange={(e) => setNewTeamId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            >
              <option value="">No team</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {formError && <div className="text-xs" style={{ color: "var(--color-crimson)" }}>{formError}</div>}
          <button
            onClick={handleAddPlayer}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
          >
            {saving ? "Adding…" : "Add Player"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
