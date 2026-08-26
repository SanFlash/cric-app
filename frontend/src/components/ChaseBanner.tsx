import { motion } from "framer-motion";
import type { ChaseSummary } from "../utils/chase";

export function ChaseBanner({ chase }: { chase: ChaseSummary }) {
  const { runsNeeded, ballsRemaining, requiredRunRate } = chase;
  const oversRemaining = `${Math.floor(ballsRemaining / 6)}.${ballsRemaining % 6}`;

  if (runsNeeded === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-lg border px-4 py-2.5 text-sm font-semibold"
        style={{ borderColor: "var(--color-win)", backgroundColor: "rgba(76,154,91,0.12)", color: "var(--color-win)" }}
      >
        Target reached!
      </motion.div>
    );
  }
  if (ballsRemaining === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-lg border px-4 py-2.5 text-sm font-semibold"
        style={{ borderColor: "var(--color-crimson)", backgroundColor: "rgba(193,39,45,0.1)", color: "var(--color-crimson)" }}
      >
        Overs used up — {runsNeeded} run{runsNeeded === 1 ? "" : "s"} short.
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border px-4 py-2.5"
      style={{ borderColor: "var(--color-amber-dim)", backgroundColor: "rgba(242,169,59,0.08)" }}
    >
      <span className="font-mono text-lg font-bold" style={{ color: "var(--color-amber)", fontFamily: "var(--font-mono)" }}>
        Need {runsNeeded}
      </span>
      <span className="text-sm" style={{ color: "var(--color-cream-dim)" }}>
        off {ballsRemaining} ball{ballsRemaining === 1 ? "" : "s"} ({oversRemaining} overs)
      </span>
      <span className="ml-auto font-mono text-sm" style={{ color: "var(--color-cream-faint)", fontFamily: "var(--font-mono)" }}>
        RRR {requiredRunRate.toFixed(2)}
      </span>
    </motion.div>
  );
}
