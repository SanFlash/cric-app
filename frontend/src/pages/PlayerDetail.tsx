import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { endpoints, type PlayerOut, type RatingOut, type FormPointOut, type AchievementOut } from "../api/client";
import { RatingBreakdown } from "../components/RatingBreakdown";
import { FormGraph } from "../components/FormGraph";
import { UploadedImage } from "../components/UploadedImage";

const ACHIEVEMENT_ICONS: Record<string, string> = {
  CENTURY: "💯",
  HALF_CENTURY: "🏏",
  FIVE_WICKETS: "🔥",
  THREE_WICKETS: "🎯",
  BEST_ECONOMY: "🧊",
  POWER_HITTER: "💥",
  BEST_FIELDER: "🧤",
  PLAYER_OF_THE_MATCH: "⭐",
};

export function PlayerDetail() {
  const { playerId } = useParams();
  const [player, setPlayer] = useState<PlayerOut | null>(null);
  const [rating, setRating] = useState<RatingOut | null>(null);
  const [form, setForm] = useState<FormPointOut[]>([]);
  const [achievements, setAchievements] = useState<AchievementOut[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) return;
    const id = Number(playerId);
    Promise.allSettled([
      endpoints.player(id),
      endpoints.playerRating(id),
      endpoints.playerForm(id),
      endpoints.playerAchievements(id),
      endpoints.playerInsights(id),
    ]).then(([p, r, f, a, i]) => {
      if (p.status === "fulfilled") setPlayer(p.value.data);
      if (r.status === "fulfilled") setRating(r.value.data);
      if (f.status === "fulfilled") setForm(f.value.data);
      if (a.status === "fulfilled") setAchievements(a.value.data);
      if (i.status === "fulfilled") setInsights(i.value.data);
      setLoading(false);
    });
  }, [playerId]);

  if (loading) return <div style={{ color: "var(--color-cream-faint)" }}>Loading…</div>;
  if (!player) return <div style={{ color: "var(--color-cream-faint)" }}>Player not found.</div>;

  return (
    <div>
      <Link to="/players" className="mb-4 inline-block text-xs" style={{ color: "var(--color-cream-faint)" }}>
        ← All players
      </Link>

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <UploadedImage src={player.profile_image_url} name={player.full_name} size={64} shape="circle" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
              {player.full_name}
            </h1>
            <p className="mt-1 text-sm capitalize" style={{ color: "var(--color-cream-faint)" }}>
              {player.playing_role.replace("_", " ")}
            </p>
          </div>
        </div>
        {player.current_rating > 0 && (
          <div className="text-right">
            <div className="font-mono text-4xl font-bold" style={{ color: "var(--color-amber)", fontFamily: "var(--font-mono)" }}>
              {player.current_rating.toFixed(0)}
            </div>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
              Overall Rating
            </div>
          </div>
        )}
      </motion.div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          ["Runs", player.stats.bat_runs],
          ["Average", player.stats.bat_average?.toFixed(1) ?? "—"],
          ["Strike Rate", player.stats.bat_strike_rate?.toFixed(0) ?? "—"],
          ["Wickets", player.stats.bowl_wickets],
          ["Catches", player.stats.field_catches],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.5)" }}>
            <div className="font-mono text-2xl font-semibold" style={{ color: "var(--color-cream)", fontFamily: "var(--font-mono)" }}>
              {value}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Rating Breakdown">
          {rating ? (
            <RatingBreakdown rating={rating} />
          ) : (
            <EmptyPanel message="Not enough match data yet for a rating breakdown." />
          )}
        </Panel>

        <Panel title="Form Trend">
          {form.length > 1 ? (
            <FormGraph points={form} />
          ) : (
            <EmptyPanel message="Needs at least 2 matches to show a form trend." />
          )}
        </Panel>

        <Panel title="Achievements">
          {achievements.length > 0 ? (
            <div className="flex flex-col gap-2">
              {achievements.map((a, i) => (
                <motion.div
                  key={`${a.code}-${a.match_id}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 border-b py-2 text-sm last:border-b-0"
                  style={{ borderColor: "var(--color-pitch-line)" }}
                >
                  <span className="text-lg">{ACHIEVEMENT_ICONS[a.code] ?? "🏅"}</span>
                  <span style={{ color: "var(--color-cream)" }}>{a.label}</span>
                </motion.div>
              ))}
            </div>
          ) : (
            <EmptyPanel message="No achievements yet — they're awarded automatically after each match." />
          )}
        </Panel>

        <Panel title="AI Insights">
          {insights.length > 0 ? (
            <div className="flex flex-col gap-3">
              {insights.map((text, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--color-cream-dim)" }}
                >
                  <span style={{ color: "var(--color-amber)" }}>▸</span> {text}
                </motion.p>
              ))}
            </div>
          ) : (
            <EmptyPanel message="Not enough matches yet for a meaningful insight — every insight here is read live from stored stats, never invented." />
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.5)" }}>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="py-6 text-sm" style={{ color: "var(--color-cream-faint)" }}>
      {message}
    </div>
  );
}
