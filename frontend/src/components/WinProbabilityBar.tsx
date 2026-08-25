import { motion } from "framer-motion";

export function WinProbabilityBar({
  teamAName,
  teamBName,
  teamAPct,
}: {
  teamAName: string;
  teamBName: string;
  teamAPct: number;
}) {
  const teamBPct = 100 - teamAPct;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between font-mono text-sm" style={{ fontFamily: "var(--font-mono)" }}>
        <span style={{ color: "var(--color-amber)" }}>
          {teamAName} <b>{teamAPct.toFixed(0)}%</b>
        </span>
        <span style={{ color: "var(--color-cream-dim)" }}>
          <b>{teamBPct.toFixed(0)}%</b> {teamBName}
        </span>
      </div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--color-pitch-600)" }}
      >
        <motion.div
          className="h-full"
          style={{ backgroundColor: "var(--color-amber)" }}
          initial={{ width: 0 }}
          animate={{ width: `${teamAPct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <motion.div
          className="h-full"
          style={{ backgroundColor: "var(--color-pitch-500)" }}
          initial={{ width: 0 }}
          animate={{ width: `${teamBPct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
