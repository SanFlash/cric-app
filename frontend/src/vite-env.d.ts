/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute backend URL (e.g. https://corpcric-api.onrender.com) for
   * production builds where the frontend and backend are separate origins.
   * Unset in local dev — Vite's proxy handles same-origin forwarding instead. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
