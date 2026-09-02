/**
 * A subtle top-down cricket pitch graphic — the 22-yard strip with
 * creases, plus a hint of the field circle — rendered as a low-opacity
 * background texture, not a literal illustration competing with real
 * content. Meant to sit behind the scoreboard/hero cards so the app
 * reads as unmistakably "cricket," not a generic sports dashboard.
 */
export function PitchGraphic({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 300"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* outer field boundary */}
      <ellipse cx="200" cy="150" rx="230" ry="170" fill="none" stroke="var(--color-amber)" strokeOpacity="0.06" strokeWidth="2" />
      <ellipse cx="200" cy="150" rx="170" ry="125" fill="none" stroke="var(--color-amber)" strokeOpacity="0.05" strokeWidth="1.5" />
      {/* the 22-yard pitch strip */}
      <rect x="178" y="55" width="44" height="190" fill="var(--color-amber)" fillOpacity="0.04" stroke="var(--color-amber)" strokeOpacity="0.09" strokeWidth="1.5" />
      {/* popping creases at each end */}
      <line x1="178" y1="80" x2="222" y2="80" stroke="var(--color-amber)" strokeOpacity="0.1" strokeWidth="1.5" />
      <line x1="178" y1="220" x2="222" y2="220" stroke="var(--color-amber)" strokeOpacity="0.1" strokeWidth="1.5" />
      {/* stumps, both ends — three thin verticals */}
      {[192, 200, 208].map((x) => (
        <g key={`a-${x}`}>
          <line x1={x} y1="72" x2={x} y2="82" stroke="var(--color-amber)" strokeOpacity="0.14" strokeWidth="1.5" />
          <line x1={x} y1="218" x2={x} y2="228" stroke="var(--color-amber)" strokeOpacity="0.14" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  );
}
