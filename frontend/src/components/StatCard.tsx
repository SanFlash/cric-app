import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      setValue(from + (target - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

export function StatCard({
  label,
  value,
  suffix = "",
  decimals = 0,
  accent = "amber",
  delay = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  accent?: "amber" | "win" | "crimson" | "cream";
  delay?: number;
}) {
  const animated = useCountUp(value);
  const accentColor = {
    amber: "var(--color-amber)",
    win: "var(--color-win)",
    crimson: "var(--color-crimson)",
    cream: "var(--color-cream)",
  }[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-lg border border-pitch-line bg-pitch-800/60 px-5 py-4"
      style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(19, 28, 24, 0.6)" }}
    >
      <div
        className="font-mono text-3xl font-semibold tracking-tight"
        style={{ color: accentColor, fontFamily: "var(--font-mono)" }}
      >
        {animated.toFixed(decimals)}
        <span className="text-lg opacity-70">{suffix}</span>
      </div>
      <div
        className="mt-1 text-xs uppercase tracking-widest"
        style={{ color: "var(--color-cream-faint)", fontFamily: "var(--font-body)" }}
      >
        {label}
      </div>
    </motion.div>
  );
}
