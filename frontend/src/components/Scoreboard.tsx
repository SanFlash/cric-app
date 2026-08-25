import { useEffect, useRef, useState } from "react";

/**
 * Signature element: renders a value as individual segmented digits that
 * flip (rotateX) like a real stadium scoreboard whenever the value changes.
 * Used for the live score, overs, and run rate — anywhere a number updates
 * ball-by-ball, this is what makes it feel live rather than just re-rendered.
 */
function FlipDigit({ char }: { char: string }) {
  const prevChar = useRef(char);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (prevChar.current !== char) {
      setFlipping(true);
      const t = setTimeout(() => setFlipping(false), 500);
      prevChar.current = char;
      return () => clearTimeout(t);
    }
  }, [char]);

  return (
    <span
      className={`scoreboard-digit inline-block ${flipping ? "digit-flip-animate" : ""}`}
      style={{ perspective: "60px" }}
    >
      {char}
    </span>
  );
}

export function ScoreboardValue({
  value,
  size = "text-5xl",
  color = "text-amber",
}: {
  value: string;
  size?: string;
  color?: string;
}) {
  return (
    <span className={`${size} font-bold ${color} tracking-wide`} style={{ color: "var(--color-amber)" }}>
      {value.split("").map((c, i) => (
        <FlipDigit key={i} char={c} />
      ))}
    </span>
  );
}
