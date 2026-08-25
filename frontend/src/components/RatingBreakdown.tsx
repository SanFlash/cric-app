import { motion } from "framer-motion";
import type { RatingOut } from "../api/client";

const COMPONENTS: { key: keyof RatingOut; label: string }[] = [
  { key: "batting_rating", label: "Batting" },
  { key: "bowling_rating", label: "Bowling" },
  { key: "fielding_rating", label: "Fielding" },
  { key: "form_rating", label: "Form" },
  { key: "consistency_rating", label: "Consistency" },
  { key: "pressure_rating", label: "Pressure" },
];

export function RatingBreakdown({ rating }: { rating: RatingOut }) {
  return (
    <div className="flex flex-col gap-3">
      {COMPONENTS.map((c, i) => {
        const value = rating[c.key] as number;
        return (
          <div key={c.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span style={{ color: "var(--color-cream-dim)" }}>{c.label}</span>
              <span className="font-mono" style={{ color: "var(--color-amber)", fontFamily: "var(--font-mono)" }}>
                {value.toFixed(0)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--color-pitch-600)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: "var(--color-amber)" }}
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 0.7, delay: i * 0.05, ease: "easeOut" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
