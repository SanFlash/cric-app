import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { endpoints, type TeamOut, type PlayerOut } from "../api/client";
import { Modal } from "../components/Modal";
import { ImageUpload } from "../components/ImageUpload";
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

  if (loading) return <div style={{ color: "var(--color-cream-faint)" }}>Loading…</div>;
  if (!team) return <div style={{ color: "var(--color-cream-faint)" }}>Team not found.</div>;

  return (
    <div>
      <Link to="/teams" className="mb-4 inline-block text-xs" style={{ color: "var(--color-cream-faint)" }}>
        ← All teams
      </Link>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          {team.logo_url ? (
            <img src={team.logo_url} alt="" className="h-14 w-14 rounded-lg object-cover sm:h-16 sm:w-16" style={{ border: "1px solid var(--color-pitch-line)" }} />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-lg text-lg font-bold sm:h-16 sm:w-16"
              style={{ backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream-faint)" }}
            >
              {team.name.slice(0, 2).toUpperCase()}
            </div>
          )}
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
          <div className="flex gap-2">
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

      <div className="mb-1.5 flex items-center gap-1 text-[10px] md:hidden" style={{ color: "var(--color-cream-faint)" }}>
        <span>Swipe table for runs, wickets, form &amp; rating</span>
        <span style={{ color: "var(--color-amber)" }}>→</span>
      </div>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(19,28,24,0.5)" }}>
        <div style={{ minWidth: 640 }}>
        <div
          className="grid grid-cols-12 gap-2 border-b px-5 py-3 text-xs uppercase tracking-widest"
          style={{ borderColor: "var(--color-pitch-line)", color: "var(--color-cream-faint)" }}
        >
          <div className="col-span-4">Player</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2 text-right">Runs / Avg</div>
          <div className="col-span-2 text-right">Wkts / Econ</div>
          <div className="col-span-1 text-right">Form</div>
          <div className="col-span-1 text-right">Rating</div>
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
            <div className="col-span-4 flex items-center gap-2 font-medium" style={{ color: "var(--color-cream)" }}>
              {p.profile_image_url ? (
                <img src={p.profile_image_url} alt="" className="h-6 w-6 rounded-full object-cover" style={{ border: "1px solid var(--color-pitch-line)" }} />
              ) : (
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream-faint)" }}
                >
                  {p.full_name.slice(0, 1).toUpperCase()}
                </span>
              )}
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
            <div className="col-span-2 text-right font-mono text-sm" style={{ color: "var(--color-cream-dim)", fontFamily: "var(--font-mono)" }}>
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
    </div>
  );
}
