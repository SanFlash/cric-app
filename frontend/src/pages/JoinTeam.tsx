import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { endpoints } from "../api/client";
import { ImageUpload } from "../components/ImageUpload";

export function JoinTeam() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<"loading" | "valid" | "invalid">("loading");
  const [teamName, setTeamName] = useState<string | null>(null);
  const [invalidReason, setInvalidReason] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    endpoints
      .getInvite(token)
      .then((r) => {
        if (r.data.valid) {
          setStatus("valid");
          setTeamName(r.data.team_name);
        } else {
          setStatus("invalid");
          setInvalidReason(r.data.reason);
        }
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  async function handleSubmit() {
    if (!token) return;
    setError(null);
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      setError("Please fill in your name, email, and a password of at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await endpoints.acceptInvite(token, {
        full_name: fullName,
        email,
        password,
        team_logo_url: logoUrl ?? undefined,
      });
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      navigate(`/teams/${res.data.team_id}`);
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setError(message ?? "Something went wrong — the link may have expired.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="turf-texture flex min-h-screen items-center justify-center p-6"
      style={{ backgroundColor: "var(--color-pitch-950)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-xl border p-8"
        style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(19,28,24,0.7)" }}
      >
        <div className="mb-6 flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)", fontFamily: "var(--font-display)" }}
          >
            CC
          </div>
          <span className="font-display text-lg font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
            CorpCric
          </span>
        </div>

        {status === "loading" && <div style={{ color: "var(--color-cream-faint)" }}>Checking your invite…</div>}

        {status === "invalid" && (
          <div>
            <h1 className="mb-2 text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
              This invite link isn't valid
            </h1>
            <p className="text-sm" style={{ color: "var(--color-cream-faint)" }}>
              {invalidReason === "already_used" && "This invite has already been used to create an account."}
              {invalidReason === "expired" && "This invite link has expired. Ask your admin for a new one."}
              {invalidReason === "not_found" && "We couldn't find this invite. Double-check the link."}
              {!invalidReason && "Please ask your admin to send you a new invite link."}
            </p>
          </div>
        )}

        {status === "valid" && (
          <div>
            <h1 className="mb-1 text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
              Set up {teamName}
            </h1>
            <p className="mb-6 text-sm" style={{ color: "var(--color-cream-faint)" }}>
              Create your captain account and, if you'd like, set your team's logo right now.
              You can add players immediately after.
            </p>

            <div className="mb-4">
              <ImageUpload label="Upload team logo (optional)" onUploaded={setLogoUrl} shape="square" />
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Your name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "var(--color-pitch-800)", color: "var(--color-cream)" }}
                />
                <div className="mt-1 text-[10px]" style={{ color: "var(--color-cream-faint)" }}>At least 8 characters</div>
              </div>

              {error && <div className="text-xs" style={{ color: "var(--color-crimson)" }}>{error}</div>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-2 rounded-md px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
              >
                {submitting ? "Setting up your team…" : "Create account & manage team"}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
