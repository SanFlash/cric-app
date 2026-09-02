import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { endpoints, type MatchOut, type TeamOut, type SquadOut } from "../api/client";
import { Modal } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";

export function Score() {
  const { user } = useAuth();
  const canScore = !!user && ["super_admin", "company_admin", "captain", "umpire"].includes(user.role);
  const isAdmin = !!user && ["super_admin", "company_admin"].includes(user.role);

  const [matches, setMatches] = useState<MatchOut[]>([]);
  const [teams, setTeams] = useState<TeamOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickStarting, setQuickStarting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MatchOut | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [teamAId, setTeamAId] = useState<number | "">("");
  const [teamBId, setTeamBId] = useState<number | "">("");
  const [squadsA, setSquadsA] = useState<SquadOut[]>([]);
  const [squadsB, setSquadsB] = useState<SquadOut[]>([]);
  const [squadAId, setSquadAId] = useState<number | "">("");
  const [squadBId, setSquadBId] = useState<number | "">("");
  const [oversLimit, setOversLimit] = useState(20);
  const [tossWinner, setTossWinner] = useState<number | "">("");
  const [tossDecision, setTossDecision] = useState<"bat" | "bowl">("bat");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (teamAId === "") { setSquadsA([]); setSquadAId(""); return; }
    endpoints.squads(teamAId).then((r) => setSquadsA(r.data)).catch(() => setSquadsA([]));
    setSquadAId("");
  }, [teamAId]);

  useEffect(() => {
    if (teamBId === "") { setSquadsB([]); setSquadBId(""); return; }
    endpoints.squads(teamBId).then((r) => setSquadsB(r.data)).catch(() => setSquadsB([]));
    setSquadBId("");
  }, [teamBId]);

  function load() {
    setLoading(true);
    Promise.all([endpoints.matches(), endpoints.teams()])
      .then(([m, t]) => {
        setMatches(m.data);
        setTeams(t.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  async function handleCreate() {
    setFormError(null);
    if (teamAId === "" || teamBId === "" || teamAId === teamBId) {
      setFormError("Pick two different teams.");
      return;
    }
    setSaving(true);
    try {
      const res = await endpoints.createMatch({
        team_a_id: teamAId,
        team_b_id: teamBId,
        scheduled_at: new Date().toISOString(),
        overs_limit: oversLimit,
        squad_a_id: squadAId || undefined,
        squad_b_id: squadBId || undefined,
        toss_winner_team_id: tossWinner || undefined,
        toss_decision: tossWinner ? tossDecision : undefined,
      });
      setShowNew(false);
      window.location.href = `/score/${res.data.id}`;
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setFormError(message ?? "Failed to create match.");
    } finally {
      setSaving(false);
    }
  }

  const [showQuick, setShowQuick] = useState(false);
  const [quickTeamA, setQuickTeamA] = useState<number | "">("");
  const [quickTeamB, setQuickTeamB] = useState<number | "">("");

  async function handleQuickMatch() {
    setQuickError(null);
    if (quickTeamA === "" || quickTeamB === "" || quickTeamA === quickTeamB) {
      setQuickError("Pick two different teams.");
      return;
    }
    setQuickStarting(true);
    try {
      const res = await endpoints.createMatch({
        team_a_id: quickTeamA,
        team_b_id: quickTeamB,
        scheduled_at: new Date().toISOString(),
        overs_limit: 20, // sensible default — no toss/squad/overs picker, just go
      });
      window.location.href = `/score/${res.data.id}`;
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setQuickError(message ?? "Failed to start match.");
      setQuickStarting(false);
    }
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
            Score a Match
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-cream-faint)" }}>
            Start a new match or continue scoring one in progress. Available to Company Admins,
            Captains, and Umpires.
          </p>
        </div>
        {canScore && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowQuick(true)}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 sm:flex-none"
              style={{ backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream)" }}
            >
              ⚡ Quick Match
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 sm:flex-none"
              style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
            >
              + New Match
            </button>
          </div>
        )}
      </motion.div>

      {!canScore && user && (
        <div
          className="mb-6 rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.5)", color: "var(--color-cream-faint)" }}
        >
          Your role ({user.role}) can watch matches live but not score them. Company Admins,
          Captains, and Umpires can start and score matches.
        </div>
      )}

      {loading && <div style={{ color: "var(--color-cream-faint)" }}>Loading…</div>}

      <div className="flex flex-col gap-3">
        {matches.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex flex-col gap-3 rounded-lg border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.5)" }}
          >
            <div>
              <div style={{ color: "var(--color-cream)" }}>
                {teamById[m.team_a_id]?.name ?? `Team ${m.team_a_id}`} vs {teamById[m.team_b_id]?.name ?? `Team ${m.team_b_id}`}
              </div>
              <div className="mt-0.5 text-xs" style={{ color: "var(--color-cream-faint)" }}>
                {m.overs_limit} overs ·{" "}
                <span style={{ color: m.status === "live" ? "var(--color-win)" : "var(--color-cream-faint)" }}>
                  {m.status}
                </span>
                {m.result_summary && ` · ${m.result_summary}`}
              </div>
            </div>
            <div className="flex gap-3">
              <Link to={`/live/${m.id}`} className="text-xs underline" style={{ color: "var(--color-cream-faint)" }}>
                Watch
              </Link>
              {canScore && m.status === "live" && (
                <Link
                  to={`/score/${m.id}`}
                  className="rounded-md px-3 py-1.5 text-xs font-medium"
                  style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
                >
                  Score
                </Link>
              )}
              {isAdmin && (
                <button
                  onClick={() => { setConfirmDelete(m); setDeleteError(null); }}
                  className="text-xs"
                  style={{ color: "var(--color-crimson)" }}
                >
                  Delete
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {!loading && matches.length === 0 && (
          <div className="text-sm" style={{ color: "var(--color-cream-faint)" }}>No matches yet.</div>
        )}
      </div>

      {deleteError && (
        <div className="mt-4 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--color-crimson)", backgroundColor: "rgba(224,49,58,0.08)", color: "var(--color-crimson)" }}>
          {deleteError}
        </div>
      )}

      <Modal open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title="Delete this match?">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: "var(--color-cream-dim)" }}>
            This permanently deletes{" "}
            <b style={{ color: "var(--color-cream)" }}>
              {confirmDelete && `${teamById[confirmDelete.team_a_id]?.name ?? "Team A"} vs ${teamById[confirmDelete.team_b_id]?.name ?? "Team B"}`}
            </b>
            {" "}— every ball bowled, both innings, and any predictions. Every player who played
            in it has their career stats and rating recomputed to correctly exclude it, and if
            this was a tournament fixture, that tournament's whole standings table is rebuilt from
            its remaining matches. <b style={{ color: "var(--color-crimson)" }}>This cannot be undone.</b>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(null)}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream)" }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!confirmDelete) return;
                setDeleting(true);
                try {
                  await endpoints.deleteMatch(confirmDelete.id);
                  setConfirmDelete(null);
                  load();
                } catch (e: unknown) {
                  const message =
                    e && typeof e === "object" && "response" in e
                      ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
                      : undefined;
                  setDeleteError(message ?? "Failed to delete match.");
                  setConfirmDelete(null);
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting}
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: "var(--color-crimson)", color: "white" }}
            >
              {deleting ? "Deleting…" : "Delete Match"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Match">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Team A</label>
              <select
                value={teamAId}
                onChange={(e) => setTeamAId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
              >
                <option value="">Select…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Team B</label>
              <select
                value={teamBId}
                onChange={(e) => setTeamBId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
              >
                <option value="">Select…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {(squadsA.length > 0 || squadsB.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>
                  Team A squad (optional)
                </label>
                <select
                  value={squadAId}
                  onChange={(e) => setSquadAId(e.target.value ? Number(e.target.value) : "")}
                  disabled={squadsA.length === 0}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-40"
                  style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
                >
                  <option value="">Full roster</option>
                  {squadsA.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>
                  Team B squad (optional)
                </label>
                <select
                  value={squadBId}
                  onChange={(e) => setSquadBId(e.target.value ? Number(e.target.value) : "")}
                  disabled={squadsB.length === 0}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-40"
                  style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
                >
                  <option value="">Full roster</option>
                  {squadsB.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <p className="col-span-2 text-[10px]" style={{ color: "var(--color-cream-faint)" }}>
                Picking a squad scopes the Scorer's striker/non-striker/bowler
                pickers to that squad's available players instead of the whole team.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Overs</label>
            <input
              type="number"
              value={oversLimit}
              onChange={(e) => setOversLimit(Number(e.target.value))}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Toss winner (optional)</label>
              <select
                value={tossWinner}
                onChange={(e) => setTossWinner(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
              >
                <option value="">—</option>
                {[teamAId, teamBId].filter((id) => id !== "").map((id) => (
                  <option key={id} value={id}>{teamById[id as number]?.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Elected to</label>
              <select
                value={tossDecision}
                onChange={(e) => setTossDecision(e.target.value as "bat" | "bowl")}
                disabled={tossWinner === ""}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-40"
                style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
              >
                <option value="bat">Bat</option>
                <option value="bowl">Bowl</option>
              </select>
            </div>
          </div>

          {formError && <div className="text-xs" style={{ color: "var(--color-crimson)" }}>{formError}</div>}
          <button
            onClick={handleCreate}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
          >
            {saving ? "Starting…" : "Start Match"}
          </button>
        </div>
      </Modal>

      <Modal open={showQuick} onClose={() => setShowQuick(false)} title="⚡ Quick Match">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: "var(--color-cream-faint)" }}>
            Just pick two teams — 20 overs, no toss, no squad. You can adjust everything else
            later; this just gets you scoring immediately.
          </p>
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Team A</label>
            <select
              value={quickTeamA}
              onChange={(e) => setQuickTeamA(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            >
              <option value="">Select…</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Team B</label>
            <select
              value={quickTeamB}
              onChange={(e) => setQuickTeamB(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            >
              <option value="">Select…</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {quickError && <div className="text-xs" style={{ color: "var(--color-crimson)" }}>{quickError}</div>}
          <button
            onClick={handleQuickMatch}
            disabled={quickStarting}
            className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
          >
            {quickStarting ? "Starting…" : "Start scoring now"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
