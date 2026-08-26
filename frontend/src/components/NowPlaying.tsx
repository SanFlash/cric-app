import type { PlayerBrief } from "../hooks/useLiveMatch";
import { UploadedImage } from "./UploadedImage";

function MiniAvatar({ player }: { player: PlayerBrief | null | undefined }) {
  if (!player) {
    return <div className="h-8 w-8 rounded-full" style={{ backgroundColor: "var(--color-pitch-700)" }} />;
  }
  return <UploadedImage src={player.profile_image_url} name={player.full_name} size={32} shape="circle" />;
}

export function NowPlaying({
  striker, nonStriker, bowler,
}: {
  striker: PlayerBrief | null | undefined;
  nonStriker: PlayerBrief | null | undefined;
  bowler: PlayerBrief | null | undefined;
}) {
  if (!striker && !nonStriker && !bowler) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-5 text-xs" style={{ color: "var(--color-cream-dim)" }}>
      <div className="flex items-center gap-2">
        <MiniAvatar player={striker} />
        <div>
          <div style={{ color: "var(--color-amber)" }}>{striker?.full_name ?? "—"} *</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>Striker</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <MiniAvatar player={nonStriker} />
        <div>
          <div>{nonStriker?.full_name ?? "—"}</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>Non-striker</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <MiniAvatar player={bowler} />
        <div>
          <div style={{ color: "var(--color-crimson)" }}>{bowler?.full_name ?? "—"}</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-cream-faint)" }}>Bowling</div>
        </div>
      </div>
    </div>
  );
}
