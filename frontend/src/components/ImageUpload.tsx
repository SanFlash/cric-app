import { useRef, useState } from "react";
import { endpoints, resolveUploadUrl } from "../api/client";

export function ImageUpload({
  currentUrl,
  onUploaded,
  label = "Upload image",
  shape = "square",
}: {
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  label?: string;
  shape?: "square" | "circle";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setPreview(URL.createObjectURL(file)); // instant local preview while it uploads
    setUploading(true);
    try {
      const res = await endpoints.uploadImage(file);
      setPreview(resolveUploadUrl(res.data.url) ?? res.data.url);
      onUploaded(res.data.url);
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setError(message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const radius = shape === "circle" ? "9999px" : "8px";

  return (
    <div className="flex items-center gap-4">
      <div
        className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden border"
        style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-700)", borderRadius: radius }}
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" onError={() => setPreview(null)} />
        ) : (
          <span style={{ color: "var(--color-cream-faint)", fontSize: 24 }}>+</span>
        )}
      </div>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-md px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--color-pitch-700)", color: "var(--color-cream)" }}
        >
          {uploading ? "Uploading…" : label}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {error && <div className="mt-1 text-xs" style={{ color: "var(--color-crimson)" }}>{error}</div>}
        <div className="mt-1 text-[10px]" style={{ color: "var(--color-cream-faint)" }}>
          JPG, PNG, or WebP · up to 5MB
        </div>
      </div>
    </div>
  );
}
