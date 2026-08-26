/** Parses a "X.Y" overs string (X complete overs, Y balls into the next)
 * into total legal balls bowled. */
export function ballsFromOversString(overs: string): number {
  const [wholeOvers, ballsIntoOver] = overs.split(".").map(Number);
  return (wholeOvers || 0) * 6 + (ballsIntoOver || 0);
}

export interface ChaseSummary {
  runsNeeded: number;
  ballsRemaining: number;
  requiredRunRate: number;
}

/** Returns null when there's nothing to chase (1st innings, or no target
 * set yet) — the caller should only render a chase summary when this is
 * non-null. */
export function computeChaseSummary(
  score: string, overs: string, target: number | null, oversLimit: number
): ChaseSummary | null {
  if (target == null) return null;
  const currentRuns = Number(score.split("/")[0]);
  const runsNeeded = Math.max(0, target - currentRuns);
  const ballsBowled = ballsFromOversString(overs);
  const ballsRemaining = Math.max(0, oversLimit * 6 - ballsBowled);
  const requiredRunRate = ballsRemaining > 0 ? (runsNeeded / ballsRemaining) * 6 : 0;
  return { runsNeeded, ballsRemaining, requiredRunRate };
}
