import axios from "axios";

// In local dev, VITE_API_URL is unset and every path stays relative — Vite's
// dev-server proxy (vite.config.ts) forwards /api, /uploads, and /ws to the
// backend, so the frontend and backend appear same-origin. In production,
// where the frontend (Static Site) and backend (Web Service) are genuinely
// different origins on Render, VITE_API_URL is set at build time to the
// backend's real URL, and every relative path below gets that prefix instead.
const API_ORIGIN = import.meta.env.VITE_API_URL ?? "";

export const api = axios.create({
  baseURL: `${API_ORIGIN}/api/v1`,
});

/** Resolves an uploaded-image path (e.g. "/uploads/xxx.png") to a URL that
 * works regardless of whether the frontend and backend share an origin. */
export function resolveUploadUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path; // already absolute
  return `${API_ORIGIN}${path}`;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On any 401, the token is missing/expired/invalid — clear it and send the
// user to /login rather than letting every page show a silent "not
// authenticated" failure with no way to recover.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && window.location.pathname !== "/login") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// --- Types (mirrors backend Pydantic schemas) ---

export interface TeamOut {
  id: number;
  company_id: number;
  name: string;
  logo_url: string | null;
  coach_name: string | null;
}

export interface TournamentOut {
  id: number;
  company_id: number;
  name: string;
  format: string;
  season_label: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface PlayerCareerStats {
  bat_runs: number;
  bat_average: number | null;
  bat_strike_rate: number | null;
  bowl_wickets: number;
  bowl_economy: number | null;
  field_catches: number;
}

export interface PlayerOut {
  id: number;
  full_name: string;
  team_id: number | null;
  playing_role: string;
  profile_image_url: string | null;
  current_rating: number;
  current_form_score: number;
  stats: PlayerCareerStats;
}

export interface RatingOut {
  player_id: number;
  batting_rating: number;
  bowling_rating: number;
  fielding_rating: number;
  form_rating: number;
  consistency_rating: number;
  pressure_rating: number;
  overall_rating: number;
}

export interface FormPointOut {
  match_id: number;
  computed_at: string;
  form_score: number;
  batting_form: number;
  bowling_form: number;
  match_impact_score: number;
}

export interface AchievementOut {
  code: string;
  label: string;
  match_id: number | null;
  awarded_at: string;
}

export interface PredictionOut {
  match_id: number;
  team_a_win_pct: number;
  team_b_win_pct: number;
  context: string;
  factors: { items: { factor: string; direction: string; weight: number }[] };
}

export interface MatchAwardOut {
  player_id: number;
  full_name: string;
  profile_image_url: string | null;
  headline: string;
  game_changer_note: string | null;
}

export interface MatchSummaryOut {
  player_of_the_match: MatchAwardOut | null;
  highest_scorer: MatchAwardOut | null;
  best_bowler: MatchAwardOut | null;
}

export interface StandingOut {
  team_id: number;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  points: number;
  net_run_rate: number;
}

export interface LeaderboardEntryOut {
  player_id: number;
  full_name: string;
  value: number;
  secondary: string | null;
  profile_image_url: string | null;
}

export interface SquadOut {
  id: number;
  team_id: number;
  name: string;
  tournament_id: number | null;
}

export interface SquadPlayerOut {
  id: number;
  squad_id: number;
  player_id: number;
  is_available: boolean;
  unavailability_reason: string | null;
}

export interface XISlotOut {
  player_id: number;
  full_name: string;
  playing_role: string;
  current_rating: number;
  reason: string;
}

export interface XIRecommendationOut {
  slots: XISlotOut[];
  bench: XISlotOut[];
  warnings: string[];
  summary: string;
}

export interface MatchOut {
  id: number;
  team_a_id: number;
  team_b_id: number;
  scheduled_at: string;
  overs_limit: number;
  status: string;
  tournament_id: number | null;
  squad_a_id: number | null;
  squad_b_id: number | null;
  toss_winner_team_id: number | null;
  toss_decision: string | null;
  winner_team_id: number | null;
  result_summary: string | null;
}

export interface InningsOut {
  id: number;
  innings_number: number;
  batting_team_id: number;
  bowling_team_id: number;
  total_runs: number;
  total_wickets: number;
  total_balls: number;
  is_completed: boolean;
  target: number | null;
}

export interface DeliveryIn {
  innings_id: number;
  striker_id: number;
  non_striker_id: number;
  bowler_id: number;
  outcome: string;
  extra_runs?: number;
  is_wicket?: boolean;
  dismissal_type?: string | null;
  dismissed_player_id?: number | null;
  fielder_id?: number | null;
}

export const endpoints = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return api.post<{ access_token: string; refresh_token: string; token_type: string }>("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },
  me: () => api.get("/auth/me"),
  teams: (companyId?: number) => api.get<TeamOut[]>("/teams", { params: { company_id: companyId } }),
  team: (id: number) => api.get<TeamOut>(`/teams/${id}`),
  createTeam: (payload: { company_id: number; name: string; logo_url?: string; coach_name?: string }) =>
    api.post<TeamOut>("/teams", payload),
  updateTeam: (id: number, payload: Partial<{ name: string; logo_url: string; coach_name: string }>) =>
    api.patch<TeamOut>(`/teams/${id}`, payload),
  deleteTeam: (id: number) => api.delete(`/teams/${id}`),
  createInvite: (teamId: number) => api.post<{ token: string; invite_url: string; expires_at: string }>(`/teams/${teamId}/invites`),
  getInvite: (token: string) => api.get<{ valid: boolean; team_name: string | null; team_id: number | null; reason: string | null }>(`/invites/${token}`),
  acceptInvite: (token: string, payload: { email: string; password: string; full_name: string; team_logo_url?: string }) =>
    api.post<{ access_token: string; refresh_token: string; team_id: number }>(`/invites/${token}/accept`, payload),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{ url: string; content_type: string; size_bytes: number }>("/uploads/image", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  players: (teamId?: number) => api.get<PlayerOut[]>("/players", { params: { team_id: teamId } }),
  player: (id: number) => api.get<PlayerOut>(`/players/${id}`),
  createPlayer: (payload: Record<string, unknown>) => api.post<PlayerOut>("/players", payload),
  updatePlayer: (id: number, payload: Record<string, unknown>) => api.patch<PlayerOut>(`/players/${id}`, payload),
  deletePlayer: (id: number) => api.delete(`/players/${id}`),
  squads: (teamId?: number) => api.get<SquadOut[]>("/squads", { params: { team_id: teamId } }),
  createSquad: (payload: { team_id: number; name: string; tournament_id?: number }) =>
    api.post<SquadOut>("/squads", payload),
  squadPlayers: (squadId: number) => api.get<SquadPlayerOut[]>(`/squads/${squadId}/players`),
  addPlayerToSquad: (squadId: number, playerId: number) =>
    api.post<SquadPlayerOut>(`/squads/${squadId}/players`, { player_id: playerId }),
  removePlayerFromSquad: (squadId: number, playerId: number) =>
    api.delete(`/squads/${squadId}/players/${playerId}`),
  setAvailability: (squadId: number, playerId: number, isAvailable: boolean, reason?: string) =>
    api.patch<SquadPlayerOut>(`/squads/${squadId}/players/${playerId}/availability`, {
      is_available: isAvailable,
      unavailability_reason: reason ?? null,
    }),
  recommendXI: (squadId: number) => api.get<XIRecommendationOut>(`/analytics/squads/${squadId}/recommend-xi`),
  matches: (params?: { status?: string; team_id?: number }) => api.get<MatchOut[]>("/matches", { params }),
  match: (id: number) => api.get<MatchOut>(`/matches/${id}`),
  matchInnings: (id: number) => api.get<InningsOut[]>(`/matches/${id}/innings`),
  matchRoster: (matchId: number, teamId: number) =>
    api.get<{ squad_scoped: boolean; squad_id: number | null; player_ids: number[] }>(`/matches/${matchId}/roster`, { params: { team_id: teamId } }),
  createMatch: (payload: Record<string, unknown>) => api.post<MatchOut>("/matches", payload),
  scoreDelivery: (payload: DeliveryIn) => api.post("/matches/deliveries", payload),
  tournaments: (companyId?: number) => api.get<TournamentOut[]>("/tournaments", { params: { company_id: companyId } }),
  createTournament: (payload: { company_id: number; name: string; format: string; season_label?: string }) =>
    api.post<TournamentOut>("/tournaments", payload),
  playerRating: (id: number) => api.get<RatingOut>(`/analytics/players/${id}/rating`),
  playerForm: (id: number, limit = 20) => api.get<FormPointOut[]>(`/analytics/players/${id}/form`, { params: { limit } }),
  playerAchievements: (id: number, limit = 20) => api.get<AchievementOut[]>(`/analytics/players/${id}/achievements`, { params: { limit } }),
  playerInsights: (id: number) => api.get<string[]>(`/analytics/players/${id}/insights`),
  latestPrediction: (matchId: number) => api.get<PredictionOut>(`/analytics/matches/${matchId}/predictions/latest`),
  momentum: (matchId: number) => api.get<PredictionOut[]>(`/analytics/matches/${matchId}/predictions/momentum`),
  computePreMatchPrediction: (matchId: number) => api.post<PredictionOut>(`/analytics/matches/${matchId}/predictions/pre-match`),
  matchSummary: (matchId: number) => api.get<MatchSummaryOut | null>(`/analytics/matches/${matchId}/summary`),
  standings: (tournamentId: number) => api.get<StandingOut[]>(`/tournaments/${tournamentId}/standings`),
  leaderboard: (metric: string, params?: Record<string, unknown>) =>
    api.get<LeaderboardEntryOut[]>(`/leaderboards/${metric}`, { params }),
};

export function liveMatchSocket(matchId: number): WebSocket {
  if (API_ORIGIN) {
    const base = new URL(API_ORIGIN);
    const proto = base.protocol === "https:" ? "wss" : "ws";
    return new WebSocket(`${proto}://${base.host}/ws/matches/${matchId}`);
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return new WebSocket(`${proto}://${window.location.host}/ws/matches/${matchId}`);
}
