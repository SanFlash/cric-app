import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { endpoints } from "../api/client";
import logo from "../assets/logo.png";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await endpoints.login(email, password);
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      navigate("/teams");
    } catch (e: unknown) {
      const status =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { status?: number } }).response?.status
          : undefined;
      setError(status === 401 ? "Incorrect email or password." : "Couldn't log in — is the backend running?");
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
        className="w-full max-w-sm rounded-xl border p-8"
        style={{ borderColor: "var(--color-pitch-line)", backgroundColor: "rgba(16,21,42,0.7)" }}
      >
        <div className="mb-6 flex items-center gap-2">
          <img src={logo} alt="CorpCric" className="h-9 w-9 rounded-full object-cover" style={{ boxShadow: "0 0 0 1px var(--color-amber-dim)" }} />
          <span className="font-display text-lg font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
            CorpCric
          </span>
        </div>

        <h1 className="mb-1 text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-cream)" }}>
          Log in
        </h1>
        <p className="mb-6 text-sm" style={{ color: "var(--color-cream-faint)" }}>
          Seeded demo admin: <span style={{ color: "var(--color-amber)" }}>admin@acme.com</span> /{" "}
          <span style={{ color: "var(--color-amber)" }}>admin12345</span>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--color-cream-faint)" }}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoFocus
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
          </div>

          {error && <div className="text-xs" style={{ color: "var(--color-crimson)" }}>{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-md px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-pitch-950)" }}
          >
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        <div className="mt-6 text-center text-[10px]" style={{ color: "var(--color-cream-faint)", opacity: 0.6 }}>
          Developed by Satyendra Namdeo
        </div>
      </motion.div>
    </div>
  );
}
