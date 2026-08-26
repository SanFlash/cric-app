import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { endpoints, type SquadOut, type TeamOut } from "../api/client";
import { Modal } from "../components/Modal";
import { UploadedImage } from "../components/UploadedImage";
import { useAuth } from "../hooks/useAuth";

export function Squads() {
  const { canManageTeams } = useAuth();
  const [squads, setSquads] = useState<SquadOut[]>([]);
  const [teams, setTeams] = useState<TeamOut[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTeamId, setNewTeamId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([endpoints.squads(), endpoints.teams()])
      .then(([s, t]) => {
        setSquads(s.data);
        setTeams(t.data);
        if (t.data.length > 0 && newTeamId == null) setNewTeamId(t.data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  async function handleCreate() {
    setFormError(null);
    if (!newName.trim() || newTeamId == null) {
      setFormError("Squad name and team are required.");
      return;
    }
    setSaving(true);
    try {
      await endpoints.createSquad({ team_id: newTeamId, name: newName });
      setShowNew(false);
      setNewName("");
      load();
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setFormError(message ?? "Failed to create squad.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
            Squads
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-cream-faint)" }}>
            Named player pools per team — mark availability and get a recommended Playing XI.
          </p>
        </div>
        {canManageTeams && (
          <button
            onClick={() => setShowNew(true)}
            className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
          >
            + New Squad
          </button>
        )}
      </motion.div>

      {loading && <div style={{ color: "var(--color-cream-faint)" }}>Loading…</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {squads.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link
              to={`/squads/${s.id}`}
              className="block rounded-xl border p-5 transition-colors hover:border-[var(--color-amber-dim)]"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(19,28,24,0.5)" }}
            >
              <div className="mb-2 flex items-center gap-2">
                <UploadedImage src={teamById[s.team_id]?.logo_url} name={teamById[s.team_id]?.name ?? `Team ${s.team_id}`} size={24} shape="square" />
                <div className="text-xs" style={{ color: "var(--color-cream-faint)" }}>
                  {teamById[s.team_id]?.name ?? `Team ${s.team_id}`}
                </div>
              </div>
              <div className="text-lg font-semibold" style={{ color: "var(--color-cream)", fontFamily: "var(--font-display)" }}>
                {s.name}
              </div>
            </Link>
          </motion.div>
        ))}
        {!loading && squads.length === 0 && (
          <div className="col-span-full text-sm" style={{ color: "var(--color-cream-faint)" }}>
            No squads yet.
          </div>
        )}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Squad">
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Team</label>
            <select
              value={newTeamId ?? ""}
              onChange={(e) => setNewTeamId(Number(e.target.value))}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Squad name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Season Squad"
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
            {saving ? "Creating…" : "Create Squad"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
