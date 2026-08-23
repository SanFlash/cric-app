import { useEffect, useRef, useState } from "react";
import { liveMatchSocket } from "../api/client";

export interface PlayerBrief {
  id: number;
  full_name: string;
  profile_image_url: string | null;
}

export interface LiveScoreboardPayload {
  type: string;
  match_id: number;
  innings_id: number;
  innings_number: number;
  score: string;
  overs: string;
  run_rate: number;
  target: number | null;
  is_completed: boolean;
  win_probability?: {
    team_a_pct: number;
    team_b_pct: number;
    context: string;
  };
  event?: {
    delivery_id: number;
    outcome: string;
    is_wicket: boolean;
    dismissal_type: string | null;
    runs_batter: number;
    over_completed: boolean;
    previous_bowler_id: number | null;
    striker: PlayerBrief | null;
    non_striker: PlayerBrief | null;
    bowler: PlayerBrief | null;
    dismissed_player: PlayerBrief | null;
    fielder: PlayerBrief | null;
  };
  current_players?: {
    striker: PlayerBrief | null;
    non_striker: PlayerBrief | null;
    bowler: PlayerBrief | null;
  } | null;
}

export function useLiveMatch(matchId: number | null) {
  const [payload, setPayload] = useState<LiveScoreboardPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (matchId == null) return;
    const ws = liveMatchSocket(matchId);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LiveScoreboardPayload;
        setPayload(data);
      } catch {
        // ignore malformed frames
      }
    };
    return () => ws.close();
  }, [matchId]);

  return { payload, connected };
}
