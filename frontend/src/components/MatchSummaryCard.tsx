import { motion } from "framer-motion";
import type { MatchAwardOut, MatchSummaryOut } from "../api/client";
import { UploadedImage } from "./UploadedImage";

function AwardCard({
  label, icon, award,
}: {
  label: string; icon: string; award: MatchAwardOut | null;
}) {
  if (!award) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--color-amber-dim)", backgroundColor: "rgba(242,169,59,0.06)" }}
    >
      <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--color-amber)" }}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <UploadedImage src={award.profile_image_url} name={award.full_name} size={44} shape="circle" />
        <div className="min-w-0">
          <div className="truncate font-semibold" style={{ color: "var(--color-cream)" }}>{award.full_name}</div>
          <div className="font-mono text-xs" style={{ color: "var(--color-cream-dim)", fontFamily: "var(--font-mono)" }}>
            {award.headline}
          </div>
        </div>
      </div>
      {award.game_changer_note && (
        <div className="mt-2 rounded-md px-2.5 py-1.5 text-[11px]" style={{ backgroundColor: "rgba(255,255,255,0.04)", color: "var(--color-cream-faint)" }}>
          {award.game_changer_note}
        </div>
      )}
    </motion.div>
  );
}

export function MatchSummaryCard({ summary }: { summary: MatchSummaryOut }) {
  const { player_of_the_match, highest_scorer, best_bowler } = summary;
  if (!player_of_the_match && !highest_scorer && !best_bowler) return null;

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest" style={{ backgroundColor: "var(--color-win-dim)", color: "var(--color-win)" }}>
          Match Completed
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AwardCard label="Player of the Match" icon="🏆" award={player_of_the_match} />
        <AwardCard label="Highest Scorer" icon="🏏" award={highest_scorer} />
        <AwardCard label="Best Bowler" icon="🎯" award={best_bowler} />
      </div>
    </div>
  );
}
