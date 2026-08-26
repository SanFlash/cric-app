import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { endpoints, type TeamOut, type PlayerOut } from "../api/client";
import { Modal } from "../components/Modal";
import { ImageUpload } from "../components/ImageUpload";
import { UploadedImage } from "../components/UploadedImage";
import { useAuth } from "../hooks/useAuth";

const ROLE_LABELS: Record<string, string> = {
  batter: "Batter",
  bowler: "Bowler",
  all_rounder: "All-rounder",
  wicketkeeper: "Wicketkeeper",
};

const ROLE_COLORS: Record<string, string> = {
  batter: "var(--color-amber)",
  bowler: "var(--color-crimson)",
  all_rounder: "var(--color-win)",
  wicketkeeper: "var(--color-cream)",
};

const ROLE_OPTIONS = ["batter", "bowler", "all_rounder", "wicketkeeper"];

export function TeamDetail() {
  const { teamId } = useParams();
  const { canManageTeams } = useAuth();
  const [team, setTeam] = useState<TeamOut | null>(null);
  const [players, setPlayers] = useState<PlayerOut[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerRole, setNewPlayerRole] = useState("batter");
  const [newPlayerJersey, setNewPlayerJersey] = useState("");
  const [newPlayerPhoto, setNewPlayerPhoto] = useState<string | null>(null);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [playerFormError, setPlayerFormError] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [showEditTeam, setShowEditTeam] = useState(false);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamCoach, setEditTeamCoach] = useState("");
  const [editTeamLogo, setEditTeamLogo] = useState<string | null>(null);
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamFormError, setTeamFormError] = useState<string | null>(null);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [deleteTeamError, setDeleteTeamError] = useState<string | null>(null);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState(false);

  const [editingPlayer, setEditingPlayer] = useState<PlayerOut | null>(null);
  const [editPlayerName, setEditPlayerName] = useState("");
  const [editPlayerRole, setEditPlayerRole] = useState("batter");
  const [editPlayerJersey, setEditPlayerJersey] = useState("");
  const [editPlayerPhoto, setEditPlayerPhoto] = useState<string | null>(null);
  const [savingEditPlayer, setSavingEditPlayer] = useState(false);
  const [editPlayerError, setEditPlayerError] = useState<string | null>(null);
  const [confirmDeletePlayer, setConfirmDeletePlayer] = useState<PlayerOut | null>(null);
  const [deletingPlayer, setDeletingPlayer] = useState(false);

  function load() {
    if (!teamId) return;
    const id = Number(teamId);
    setLoading(true);
    Promise.all([endpoints.team(id), endpoints.players(id)])
      .then(([t, p]) => {
        setTeam(t.data);
        setPlayers(p.data.sort((a, b) => b.current_rating - a.current_rating));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, [teamId]);

  async function handleAddPlayer() {
    setPlayerFormError(null);
    if (!newPlayerName.trim()) {
      setPlayerFormError("Player name is required.");
      return;
    }
    setSavingPlayer(true);
    try {
      await endpoints.createPlayer({
        team_id: Number(teamId),
        full_name: newPlayerName,
        playing_role: newPlayerRole,
        jersey_number: newPlayerJersey ? Number(newPlayerJersey) : undefined,
        profile_image_url: newPlayerPhoto ?? undefined,
      });
      setShowAddPlayer(false);
      setNewPlayerName("");
      setNewPlayerJersey("");
      setNewPlayerPhoto(null);
      load();
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setPlayerFormError(message ?? "Failed to add player.");
    } finally {
      setSavingPlayer(false);
    }
  }

  async function handleGenerateInvite() {
    if (!teamId) return;
    setInviteLoading(true);
    setCopied(false);
    try {
      const res = await endpoints.createInvite(Number(teamId));
      const fullUrl = `${window.location.origin}${res.data.invite_url}`;
      setInviteUrl(fullUrl);
    } catch {
      setInviteUrl(null);
    } finally {
      setInviteLoading(false);
    }
  }

  function openEditTeam() {
    if (!team) return;
    setEditTeamName(team.name);
    setEditTeamCoach(team.coach_name ?? "");
    setEditTeamLogo(team.logo_url);
    setTeamFormError(null);
    setShowEditTeam(true);
  }

  async function handleSaveTeam() {
    if (!teamId) return;
    setTeamFormError(null);
    if (!editTeamName.trim()) {
      setTeamFormError("Team name is required.");
      return;
    }
    setSavingTeam(true);
    try {
      await endpoints.updateTeam(Number(teamId), {
        name: editTeamName,
        coach_name: editTeamCoach || undefined,
        logo_url: editTeamLogo ?? undefined,
      });
      setShowEditTeam(false);
      load();
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setTeamFormError(message ?? "Failed to update team.");
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleDeleteTeam() {
    if (!teamId) return;
    setDeletingTeam(true);
    setDeleteTeamError(null);
    try {
      await endpoints.deleteTeam(Number(teamId));
      window.location.href = "/teams";
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setDeleteTeamError(message ?? "Failed to delete team.");
      setConfirmDeleteTeam(false);
    } finally {
      setDeletingTeam(false);
    }
  }

  function openEditPlayer(p: PlayerOut) {
    setEditingPlayer(p);
    setEditPlayerName(p.full_name);
    setEditPlayerRole(p.playing_role);
    setEditPlayerJersey("");
    setEditPlayerPhoto(p.profile_image_url);
    setEditPlayerError(null);
  }

  async function handleSaveEditPlayer() {
    if (!editingPlayer) return;
    setEditPlayerError(null);
    if (!editPlayerName.trim()) {
      setEditPlayerError("Player name is required.");
      return;
    }
    setSavingEditPlayer(true);
    try {
      await endpoints.updatePlayer(editingPlayer.id, {
        full_name: editPlayerName,
        playing_role: editPlayerRole,
        ...(editPlayerJersey ? { jersey_number: Number(editPlayerJersey) } : {}),
        profile_image_url: editPlayerPhoto ?? undefined,
      });
      setEditingPlayer(null);
      load();
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setEditPlayerError(message ?? "Failed to update player.");
    } finally {
      setSavingEditPlayer(false);
    }
  }

  async function handleDeletePlayer() {
    if (!confirmDeletePlayer) return;
    setDeletingPlayer(true);
    try {
      await endpoints.deletePlayer(confirmDeletePlayer.id);
      setConfirmDeletePlayer(null);
      load();
    } catch {
      // surfaced by the player simply still appearing in the list
    } finally {
      setDeletingPlayer(false);
    }
  }

  if (loading) return <div style={{ color: "var(--color-cream-faint)" }}>Loading…</div>;
  if (!team) return <div style={{ color: "var(--color-cream-faint)" }}>Team not found.</div>;

  return (
    <div>
      <Link to="/teams" className="mb-4 inline-block text-xs" style={{ color: "var(--color-cream-faint)" }}>
        ← All teams
      </Link>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <UploadedImage src={team.logo_url} name={team.name} size={56} shape="square" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
              {team.name}
            </h1>
            {team.coach_name && (
              <p className="mt-1 text-sm" style={{ color: "var(--color-cream-faint)" }}>
                Coach: {team.coach_name}
              </p>
            )}
          </div>
        </div>
        {canManageTeams && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openEditTeam}
              className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream)" }}
            >
              Edit Team
            </button>
            <button
              onClick={() => { setConfirmDeleteTeam(true); setDeleteTeamError(null); }}
              className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: "rgba(193,39,45,0.12)", color: "var(--color-crimson)" }}
            >
              Delete Team
            </button>
            <button
              onClick={() => { setShowInvite(true); handleGenerateInvite(); }}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 sm:flex-none"
              style={{ backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream)" }}
            >
              Invite Captain
            </button>
            <button
              onClick={() => setShowAddPlayer(true)}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 sm:flex-none"
              style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
            >
              + Add Player
            </button>
          </div>
        )}
      </motion.div>

      {deleteTeamError && (
        <div className="mb-4 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--color-crimson)", backgroundColor: "rgba(193,39,45,0.08)", color: "var(--color-crimson)" }}>
          {deleteTeamError}
        </div>
      )}

      <div className="mb-1.5 flex items-center gap-1 text-[10px] md:hidden" style={{ color: "var(--color-cream-faint)" }}>
        <span>Swipe table for runs, wickets, form &amp; rating</span>
        <span style={{ color: "var(--color-amber)" }}>→</span>
      </div>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(19,28,24,0.5)" }}>
        <div style={{ minWidth: canManageTeams ? 820 : 640 }}>
        <div
          className="grid grid-cols-12 gap-2 border-b px-5 py-3 text-xs uppercase tracking-widest"
          style={{ borderColor: "var(--color-pitch-line)", color: "var(--color-cream-faint)" }}
        >
          <div className="col-span-3">Player</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2 text-right">Runs / Avg</div>
          <div className="col-span-1 text-right">Wkts / Econ</div>
          <div className="col-span-1 text-right">Form</div>
          <div className="col-span-1 text-right">Rating</div>
          {canManageTeams && <div className="col-span-2 text-right">Actions</div>}
        </div>
        {players.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="grid grid-cols-12 items-center gap-2 border-b px-5 py-3 last:border-b-0"
            style={{ borderColor: "var(--color-pitch-line)" }}
          >
            <div className="col-span-3 flex items-center gap-2 font-medium" style={{ color: "var(--color-cream)" }}>
              <UploadedImage src={p.profile_image_url} name={p.full_name} size={24} shape="circle" />
              <Link to={`/players/${p.id}`} className="hover:underline">
                {p.full_name}
              </Link>
            </div>
            <div className="col-span-2">
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  color: ROLE_COLORS[p.playing_role] ?? "var(--color-cream-dim)",
                  backgroundColor: "rgba(255,255,255,0.04)",
                }}
              >
                {ROLE_LABELS[p.playing_role] ?? p.playing_role}
              </span>
            </div>
            <div className="col-span-2 text-right font-mono text-sm" style={{ color: "var(--color-cream-dim)", fontFamily: "var(--font-mono)" }}>
              {p.stats.bat_runs} <span style={{ color: "var(--color-cream-faint)" }}>/ {p.stats.bat_average?.toFixed(1) ?? "—"}</span>
            </div>
            <div className="col-span-1 text-right font-mono text-sm" style={{ color: "var(--color-cream-dim)", fontFamily: "var(--font-mono)" }}>
              {p.stats.bowl_wickets} <span style={{ color: "var(--color-cream-faint)" }}>/ {p.stats.bowl_economy?.toFixed(1) ?? "—"}</span>
            </div>
            <div className="col-span-1 text-right font-mono text-sm" style={{ color: "var(--color-win)", fontFamily: "var(--font-mono)" }}>
              {p.current_form_score.toFixed(0)}
            </div>
            <div
              className="col-span-1 text-right font-mono text-sm font-bold"
              style={{ color: "var(--color-amber)", fontFamily: "var(--font-mono)" }}
            >
              {p.current_rating.toFixed(0)}
            </div>
            {canManageTeams && (
              <div className="col-span-2 flex flex-col items-end gap-0.5 text-xs">
                <button onClick={() => openEditPlayer(p)} className="underline" style={{ color: "var(--color-cream-faint)" }}>
                  Edit
                </button>
                <button onClick={() => setConfirmDeletePlayer(p)} style={{ color: "var(--color-crimson)" }}>
                  Remove
                </button>
              </div>
            )}
          </motion.div>
        ))}
        {players.length === 0 && (
          <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--color-cream-faint)" }}>
            No players on this team yet.
          </div>
        )}
        </div>
      </div>

      <Modal open={showAddPlayer} onClose={() => setShowAddPlayer(false)} title="Add Player">
        <div className="flex flex-col gap-4">
          <ImageUpload label="Upload player photo" onUploaded={setNewPlayerPhoto} shape="circle" />
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Full name</label>
            <input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Playing role</label>
              <select
                value={newPlayerRole}
                onChange={(e) => setNewPlayerRole(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Jersey # (optional)</label>
              <input
                value={newPlayerJersey}
                onChange={(e) => setNewPlayerJersey(e.target.value)}
                type="number"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
              />
            </div>
          </div>
          {playerFormError && <div className="text-xs" style={{ color: "var(--color-crimson)" }}>{playerFormError}</div>}
          <button
            onClick={handleAddPlayer}
            disabled={savingPlayer}
            className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
          >
            {savingPlayer ? "Adding…" : "Add Player"}
          </button>
        </div>
      </Modal>

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite a Captain">
        <p className="mb-4 text-sm" style={{ color: "var(--color-cream-dim)" }}>
          Share this link with your team captain. They'll set up their own account
          and can immediately add players and set the team logo — no password to hand over.
        </p>
        {inviteLoading && <div className="text-sm" style={{ color: "var(--color-cream-faint)" }}>Generating link…</div>}
        {inviteUrl && (
          <div>
            <div
              className="mb-3 break-all rounded-md border px-3 py-2 font-mono text-xs"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-amber)", fontFamily: "var(--font-mono)" }}
            >
              {inviteUrl}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
              }}
              className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            <div className="mt-2 text-[10px]" style={{ color: "var(--color-cream-faint)" }}>
              Expires in 7 days · single use
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showEditTeam} onClose={() => setShowEditTeam(false)} title="Edit Team">
        <div className="flex flex-col gap-4">
          <ImageUpload label="Change team logo" onUploaded={setEditTeamLogo} currentUrl={editTeamLogo} shape="square" />
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Team name</label>
            <input
              value={editTeamName}
              onChange={(e) => setEditTeamName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Coach</label>
            <input
              value={editTeamCoach}
              onChange={(e) => setEditTeamCoach(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            />
          </div>
          {teamFormError && <div className="text-xs" style={{ color: "var(--color-crimson)" }}>{teamFormError}</div>}
          <button
            onClick={handleSaveTeam}
            disabled={savingTeam}
            className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
          >
            {savingTeam ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </Modal>

      <Modal open={confirmDeleteTeam} onClose={() => setConfirmDeleteTeam(false)} title="Delete Team?">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: "var(--color-cream-dim)" }}>
            This will remove <b style={{ color: "var(--color-cream)" }}>{team.name}</b> from your teams list. If
            it still has players, this is blocked — remove or transfer them first.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDeleteTeam(false)}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteTeam}
              disabled={deletingTeam}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: "var(--color-crimson)", color: "white" }}
            >
              {deletingTeam ? "Deleting…" : "Delete Team"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={editingPlayer !== null} onClose={() => setEditingPlayer(null)} title="Edit Player">
        <div className="flex flex-col gap-4">
          <ImageUpload label="Change player photo" onUploaded={setEditPlayerPhoto} currentUrl={editPlayerPhoto} shape="circle" />
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Full name</label>
            <input
              value={editPlayerName}
              onChange={(e) => setEditPlayerName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Role</label>
              <select
                value={editPlayerRole}
                onChange={(e) => setEditPlayerRole(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
              >
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Jersey # (optional)</label>
              <input
                type="number"
                value={editPlayerJersey}
                onChange={(e) => setEditPlayerJersey(e.target.value)}
                placeholder="Unchanged"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
              />
            </div>
          </div>
          {editPlayerError && <div className="text-xs" style={{ color: "var(--color-crimson)" }}>{editPlayerError}</div>}
          <button
            onClick={handleSaveEditPlayer}
            disabled={savingEditPlayer}
            className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
          >
            {savingEditPlayer ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </Modal>

      <Modal open={confirmDeletePlayer !== null} onClose={() => setConfirmDeletePlayer(null)} title="Remove Player?">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: "var(--color-cream-dim)" }}>
            This removes <b style={{ color: "var(--color-cream)" }}>{confirmDeletePlayer?.full_name}</b> from the
            team. Their career stats and match history are kept, not erased — they just won't appear in future
            squads or pickers.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDeletePlayer(null)}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleDeletePlayer}
              disabled={deletingPlayer}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: "var(--color-crimson)", color: "white" }}
            >
              {deletingPlayer ? "Removing…" : "Remove Player"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
