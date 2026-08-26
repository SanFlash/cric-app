import { useState } from "react";
import { resolveUploadUrl } from "../api/client";

/**
 * Renders an uploaded image (team logo / player photo) with a graceful
 * fallback to initials if it fails to load — not a browser broken-image
 * icon. This matters because uploaded files can genuinely disappear out
 * from under a stored URL: Render's free tier has no persistent disk, so
 * every spin-down/wake-up cycle (or redeploy) wipes backend/uploads/ while
 * the database still remembers the old path. That's an infrastructure
 * limitation this component can't fix, but it can stop it from looking
 * broken — onError swaps to the same initials avatar shown when there
 * was never an image at all.
 */
export function UploadedImage({
  src, name, size = 32, shape = "circle", className = "",
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  shape?: "circle" | "square";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveUploadUrl(src);
  const radius = shape === "circle" ? "9999px" : "8px";

  if (!resolved || failed) {
    return (
      <div
        className={`flex flex-shrink-0 items-center justify-center font-bold ${className}`}
        style={{
          width: size, height: size, borderRadius: radius,
          backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream-faint)",
          fontSize: size * 0.4,
        }}
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt=""
      onError={() => setFailed(true)}
      className={`flex-shrink-0 object-cover ${className}`}
      style={{ width: size, height: size, borderRadius: radius, border: "1px solid var(--color-pitch-line)" }}
    />
  );
}
