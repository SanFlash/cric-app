import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { endpoints, type TournamentOut, type StandingOut, type TeamOut } from "../api/client";
import { Modal } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";

const FORMAT_OPTIONS = [
  { label: "League", value: "league" },
  { label: "Knockout", value: "knockout" },
  { label: "Group Stage", value: "group_stage" },
  { label: "Round Robin", value: "round_robin" },
];

export function Tournaments() {
  const { user, canManageTeams } = useAuth();
  const [tournaments, setTournaments] = useState<TournamentOut[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [standings, setStandings] = useState<StandingOut[]>([]);
  const [teams, setTeams] = useState<Record<number, TeamOut>>({});
  const [loading, setLoading] = useState(true);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFormat, setNewFormat] = useState("round_robin");
  const [newSeason, setNewSeason] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([endpoints.tournaments(), endpoints.teams()]).then(([t, teamsRes]) => {
      setTournaments(t.data);
      setTeams(Object.fromEntries(teamsRes.data.map((tm) => [tm.id, tm])));
      if (t.data.length > 0 && selected == null) setSelected(t.data[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(load, []);

  useEffect(() => {
    if (selected == null) return;
    endpoints.standings(selected).then((r) => setStandings(r.data)).catch(() => setStandings([]));
  }, [selected]);

  async function handleCreate() {
    setFormError(null);
    if (!newName.trim()) {
      setFormError("Tournament name is required.");
      return;
    }
    if (!user?.company_id) {
      setFormError("Your account isn't linked to a company.");
      return;
    }
    setSaving(true);
    try {
      const res = await endpoints.createTournament({
        company_id: user.company_id, name: newName, format: newFormat, season_label: newSeason || undefined,
      });
      setShowNew(false);
      setNewName("");
      setNewSeason("");
      setSelected(res.data.id);
      load();
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setFormError(message ?? "Failed to create tournament.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
            Tournaments
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-cream-faint)" }}>
            Points table, sorted by points then net run rate — recalculated automatically after every match.
          </p>
        </div>
        {canManageTeams && (
          <button
            onClick={() => setShowNew(true)}
            className="self-start rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
          >
            + New Tournament
          </button>
        )}
      </motion.div>

      {loading && <div style={{ color: "var(--color-cream-faint)" }}>Loading…</div>}

      {!loading && tournaments.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {tournaments.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: selected === t.id ? "var(--color-amber)" : "var(--color-pitch-700)",
                  color: selected === t.id ? "var(--color-pitch-950)" : "var(--color-cream-dim)",
                }}
              >
                {t.name} {t.season_label && `· ${t.season_label}`}
              </button>
            ))}
          </div>

          <div className="mb-1.5 flex items-center gap-1 text-[10px] md:hidden" style={{ color: "var(--color-cream-faint)" }}>
            <span>Swipe table for NRR &amp; points</span>
            <span style={{ color: "var(--color-amber)" }}>→</span>
          </div>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(19,28,24,0.5)" }}>
            <div style={{ minWidth: 560 }}>
              <div
                className="grid grid-cols-12 gap-2 border-b px-5 py-3 text-xs uppercase tracking-widest"
                style={{ borderColor: "var(--color-pitch-line)", color: "var(--color-cream-faint)" }}
              >
                <div className="col-span-4">Team</div>
                <div className="col-span-1 text-right">P</div>
                <div className="col-span-1 text-right">W</div>
                <div className="col-span-1 text-right">L</div>
                <div className="col-span-1 text-right">T</div>
                <div className="col-span-2 text-right">NRR</div>
                <div className="col-span-2 text-right">Points</div>
              </div>
              {standings.map((s, i) => (
                <motion.div
                  key={s.team_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="grid grid-cols-12 items-center gap-2 border-b px-5 py-3 last:border-b-0"
                  style={{ borderColor: "var(--color-pitch-line)" }}
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-bold"
                      style={{
                        fontFamily: "var(--font-mono)",
                        backgroundColor: i === 0 ? "var(--color-amber)" : "var(--color-pitch-700)",
                        color: i === 0 ? "var(--color-pitch-950)" : "var(--color-cream-dim)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ color: "var(--color-cream)" }}>{teams[s.team_id]?.name ?? `Team ${s.team_id}`}</span>
                  </div>
                  <div className="col-span-1 text-right font-mono text-sm" style={{ color: "var(--color-cream-dim)", fontFamily: "var(--font-mono)" }}>{s.played}</div>
                  <div className="col-span-1 text-right font-mono text-sm" style={{ color: "var(--color-win)", fontFamily: "var(--font-mono)" }}>{s.won}</div>
                  <div className="col-span-1 text-right font-mono text-sm" style={{ color: "var(--color-crimson)", fontFamily: "var(--font-mono)" }}>{s.lost}</div>
                  <div className="col-span-1 text-right font-mono text-sm" style={{ color: "var(--color-cream-dim)", fontFamily: "var(--font-mono)" }}>{s.tied}</div>
                  <div
                    className="col-span-2 text-right font-mono text-sm"
                    style={{ color: s.net_run_rate >= 0 ? "var(--color-win)" : "var(--color-crimson)", fontFamily: "var(--font-mono)" }}
                  >
                    {s.net_run_rate >= 0 ? "+" : ""}{s.net_run_rate.toFixed(3)}
                  </div>
                  <div className="col-span-2 text-right font-mono text-lg font-bold" style={{ color: "var(--color-amber)", fontFamily: "var(--font-mono)" }}>
                    {s.points}
                  </div>
                </motion.div>
              ))}
              {standings.length === 0 && (
                <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--color-cream-faint)" }}>
                  No matches played in this tournament yet.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && tournaments.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm" style={{ borderColor: "var(--color-pitch-line)", color: "var(--color-cream-faint)" }}>
          No tournaments yet.
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Tournament">
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Tournament name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Summer Corporate Cup"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Format</label>
            <select
              value={newFormat}
              onChange={(e) => setNewFormat(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            >
              {FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Season (optional)</label>
            <input
              value={newSeason}
              onChange={(e) => setNewSeason(e.target.value)}
              placeholder="e.g. 2026"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            />
          </div>
          {formError && <div className="text-xs" style={{ color: "var(--color-crimson)" }}>{formError}</div>}
          <button
            onClick={handleCreate}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
          >
            {saving ? "Creating…" : "Create Tournament"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
