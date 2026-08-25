import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface BallEvent {
  delivery_id: number;
  outcome: string;
  is_wicket: boolean;
  dismissal_type: string | null;
  runs_batter: number;
  over_completed: boolean;
  previous_bowler_id: number | null;
}

const DISMISSAL_LABELS: Record<string, string> = {
  bowled: "BOWLED", caught: "CAUGHT", lbw: "LBW", run_out: "RUN OUT",
  stumped: "STUMPED", hit_wicket: "HIT WICKET",
};

/**
 * Not a true 3D character animation (that needs a rigged 3D asset pipeline —
 * a separate undertaking). This is deliberately high-quality 2D/SVG motion
 * design instead: runners crossing for singles/twos/threes, the ball racing
 * to the rope for a four, arcing over the ground for a six, stumps
 * shattering on a wicket. Driven entirely by the WS broadcast `event`
 * payload (not computed locally), so every connected client — scorer and
 * every viewer — plays the identical animation at the identical moment.
 */
export function BallAnimation({ event }: { event: BallEvent }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const duration = event.is_wicket ? 2200 : event.outcome === "six" ? 2400 : event.outcome === "four" ? 2000 : 1600;
    const t = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.delivery_id]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none relative mb-4 overflow-hidden rounded-xl border"
          style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(10,18,16,0.5)", height: 120 }}
        >
          {event.is_wicket && <WicketAnim label={event.dismissal_type ? DISMISSAL_LABELS[event.dismissal_type] : "OUT"} />}
          {!event.is_wicket && event.outcome === "six" && <SixAnim />}
          {!event.is_wicket && event.outcome === "four" && <FourAnim />}
          {!event.is_wicket && (event.outcome === "one" || event.outcome === "two" || event.outcome === "three") && (
            <RunAnim runs={event.runs_batter} />
          )}
          {!event.is_wicket && event.outcome === "wide" && <WideAnim />}
          {!event.is_wicket && event.outcome === "no_ball" && <NoBallAnim />}
          {!event.is_wicket && (event.outcome === "bye" || event.outcome === "leg_bye") && (
            <ByeAnim label={event.outcome === "bye" ? "BYE" : "LEG BYE"} />
          )}
          {!event.is_wicket && event.outcome === "dot" && <DotAnim />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Pitch() {
  return (
    <div className="absolute inset-0 flex items-center justify-between px-10">
      <div className="h-16 w-0.5" style={{ backgroundColor: "var(--color-pitch-line)" }} />
      <div className="h-16 w-0.5" style={{ backgroundColor: "var(--color-pitch-line)" }} />
    </div>
  );
}

function Runner({ delay, reverse }: { delay: number; reverse?: boolean }) {
  return (
    <motion.div
      className="absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-sm"
      style={{ backgroundColor: "var(--color-amber)" }}
      initial={{ left: reverse ? "78%" : "12%" }}
      animate={{ left: reverse ? "12%" : "78%" }}
      transition={{ duration: 0.7, delay, ease: "easeInOut" }}
    >
      🏃
    </motion.div>
  );
}

function RunAnim({ runs }: { runs: number }) {
  const crossings = Math.max(1, runs);
  return (
    <>
      <Pitch />
      {Array.from({ length: crossings }).map((_, i) => (
        <Runner key={i} delay={i * 0.75} reverse={i % 2 === 1} />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: crossings * 0.75 * 0.6 }}
        className="absolute right-4 top-3 font-mono text-2xl font-bold"
        style={{ color: "var(--color-win)", fontFamily: "var(--font-mono)" }}
      >
        +{runs}
      </motion.div>
    </>
  );
}

function DotAnim() {
  return (
    <div className="flex h-full items-center justify-center">
      <motion.span
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        className="font-mono text-lg"
        style={{ color: "var(--color-cream-faint)", fontFamily: "var(--font-mono)" }}
      >
        no run
      </motion.span>
    </div>
  );
}

function FourAnim() {
  return (
    <>
      <motion.div
        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: "var(--color-cream)", boxShadow: "0 0 12px 3px var(--color-amber-glow)" }}
        initial={{ left: "8%" }}
        animate={{ left: "92%" }}
        transition={{ duration: 0.9, ease: "easeIn" }}
      />
      <div className="absolute right-3 top-0 h-full w-1.5" style={{ backgroundColor: "var(--color-amber-dim)" }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: -8 }}
        animate={{ opacity: 1, scale: 1.15, rotate: 0 }}
        transition={{ delay: 0.85, type: "spring", stiffness: 260 }}
        className="absolute inset-0 flex items-center justify-center font-mono text-4xl font-black tracking-wide"
        style={{ color: "var(--color-amber)", fontFamily: "var(--font-mono)" }}
      >
        FOUR!
      </motion.div>
    </>
  );
}

function SixAnim() {
  return (
    <>
      <motion.div
        className="absolute h-3 w-3 rounded-full"
        style={{ backgroundColor: "var(--color-cream)", boxShadow: "0 0 14px 4px var(--color-amber-glow)" }}
        initial={{ left: "10%", top: "85%", rotate: 0 }}
        animate={{ left: "88%", top: "5%", rotate: 360 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
        animate={{ opacity: 1, scale: 1.3, rotate: 0 }}
        transition={{ delay: 1.0, type: "spring", stiffness: 260 }}
        className="absolute inset-0 flex items-center justify-center font-mono text-5xl font-black tracking-wide"
        style={{ color: "var(--color-win)", fontFamily: "var(--font-mono)" }}
      >
        SIX!
      </motion.div>
    </>
  );
}

function Stump({ delay, fall }: { delay: number; fall: number }) {
  return (
    <motion.div
      className="absolute bottom-4 h-14 w-1.5 rounded-sm"
      style={{ backgroundColor: "var(--color-cream)", transformOrigin: "bottom center" }}
      initial={{ rotate: 0, opacity: 1 }}
      animate={{ rotate: fall, opacity: 0.3 }}
      transition={{ delay, duration: 0.6, ease: "easeIn" }}
    />
  );
}

function WicketAnim({ label }: { label: string }) {
  return (
    <div className="relative flex h-full items-center justify-center gap-2">
      <Stump delay={0.1} fall={35} />
      <Stump delay={0.2} fall={-15} />
      <Stump delay={0.15} fall={55} />
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1.2 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
        className="absolute font-mono text-4xl font-black tracking-wide"
        style={{ color: "var(--color-crimson)", fontFamily: "var(--font-mono)" }}
      >
        OUT!
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="absolute bottom-2 font-mono text-xs uppercase tracking-widest"
        style={{ color: "var(--color-cream-faint)", fontFamily: "var(--font-mono)" }}
      >
        {label}
      </motion.div>
    </div>
  );
}

function WideAnim() {
  // Ball drifting wide of off-stump, umpire-style horizontal arm signal
  return (
    <div className="relative h-full">
      <Pitch />
      <motion.div
        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: "var(--color-cream)" }}
        initial={{ left: "15%", top: "50%" }}
        animate={{ left: "85%", top: "20%" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute right-6 top-6 h-1 w-16 origin-left rounded-full"
        style={{ backgroundColor: "var(--color-cream-faint)" }}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-bold"
        style={{ color: "var(--color-cream)", fontFamily: "var(--font-mono)" }}
      >
        WIDE
      </motion.div>
    </div>
  );
}

function NoBallAnim() {
  // Foot-fault line flashing red under a ball that's already been struck
  return (
    <div className="relative h-full">
      <motion.div
        className="absolute bottom-6 left-1/4 h-1 w-1/2 rounded-full"
        style={{ backgroundColor: "var(--color-crimson)" }}
        initial={{ opacity: 0.3 }}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 0.6, repeat: 2 }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 260 }}
        className="absolute inset-0 flex items-center justify-center font-mono text-3xl font-black"
        style={{ color: "var(--color-crimson)", fontFamily: "var(--font-mono)" }}
      >
        NO BALL
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0 }}
        className="absolute bottom-3 inset-x-0 text-center font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-cream-faint)", fontFamily: "var(--font-mono)" }}
      >
        free hit next ball
      </motion.div>
    </div>
  );
}

function ByeAnim({ label }: { label: string }) {
  // Ball deflects off-line behind the keeper, batters still cross for the run
  return (
    <div className="relative h-full">
      <motion.div
        className="absolute h-3 w-3 rounded-full"
        style={{ backgroundColor: "var(--color-cream)" }}
        initial={{ left: "50%", top: "50%" }}
        animate={{ left: "20%", top: "75%" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      <Pitch />
      <Runner delay={0.5} />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.1 }}
        className="absolute right-4 top-3 font-mono text-xl font-bold"
        style={{ color: "var(--color-cream-dim)", fontFamily: "var(--font-mono)" }}
      >
        {label}
      </motion.div>
    </div>
  );
}
