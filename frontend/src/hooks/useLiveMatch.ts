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
    innings_id: number;
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
    current_striker: PlayerBrief | null;
    current_non_striker: PlayerBrief | null;
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
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByEffect = useRef(false);

  useEffect(() => {
    if (matchId == null) return;
    closedByEffect.current = false;
    reconnectAttempt.current = 0;

    function connect() {
      const ws = liveMatchSocket(matchId as number);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        reconnectAttempt.current = 0; // back to fast retries if it drops again later
      };
      ws.onclose = () => {
        setConnected(false);
        if (closedByEffect.current) return; // a real unmount, not a dropped connection
        // Reconnect quickly — mobile browsers commonly drop the socket when
        // a tab is backgrounded (switching apps, screen lock), and without
        // this the scorer had to manually navigate away and back to get a
        // live connection again. Short, capped backoff: fast the first few
        // tries, never longer than 5s between attempts.
        const delay = Math.min(500 * 2 ** reconnectAttempt.current, 5000);
        reconnectAttempt.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as LiveScoreboardPayload;
          setPayload(data);
        } catch {
          // ignore malformed frames
        }
      };
    }

    connect();

    // Reconnect immediately when the tab becomes visible again, rather than
    // waiting out the backoff timer — the common case (switched apps, came
    // back) should feel instant, not "eventually."
    function handleVisibility() {
      if (document.visibilityState === "visible" && wsRef.current?.readyState !== WebSocket.OPEN) {
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        reconnectAttempt.current = 0;
        connect();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      closedByEffect.current = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [matchId]);

  return { payload, connected };
}
