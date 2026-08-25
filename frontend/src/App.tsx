import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";

const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const LiveMatch = lazy(() => import("./pages/LiveMatch").then((m) => ({ default: m.LiveMatch })));
const Leaderboards = lazy(() => import("./pages/Leaderboards").then((m) => ({ default: m.Leaderboards })));
const Teams = lazy(() => import("./pages/Teams").then((m) => ({ default: m.Teams })));
const TeamDetail = lazy(() => import("./pages/TeamDetail").then((m) => ({ default: m.TeamDetail })));
const Tournaments = lazy(() => import("./pages/Tournaments").then((m) => ({ default: m.Tournaments })));
const Players = lazy(() => import("./pages/Players").then((m) => ({ default: m.Players })));
const PlayerDetail = lazy(() => import("./pages/PlayerDetail").then((m) => ({ default: m.PlayerDetail })));
const JoinTeam = lazy(() => import("./pages/JoinTeam").then((m) => ({ default: m.JoinTeam })));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Squads = lazy(() => import("./pages/Squads").then((m) => ({ default: m.Squads })));
const SquadDetail = lazy(() => import("./pages/SquadDetail").then((m) => ({ default: m.SquadDetail })));
const Score = lazy(() => import("./pages/Score").then((m) => ({ default: m.Score })));
const Scorer = lazy(() => import("./pages/Scorer").then((m) => ({ default: m.Scorer })));
const Predictions = lazy(() => import("./pages/Predictions").then((m) => ({ default: m.Predictions })));

function RouteFallback() {
  return (
    <div className="flex h-40 items-center justify-center">
      <span className="font-mono text-sm" style={{ color: "var(--color-cream-faint)", fontFamily: "var(--font-mono)" }}>
        Loading…
      </span>
    </div>
  );
}

function withSuspense(el: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{el}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      {/* Public, unauthenticated — no sidebar/Layout */}
      <Route path="/join/:token" element={withSuspense(<JoinTeam />)} />
      <Route path="/login" element={withSuspense(<Login />)} />

      <Route element={<Layout />}>
        <Route path="/" element={withSuspense(<Dashboard />)} />
        <Route path="/live" element={withSuspense(<LiveMatch />)} />
        <Route path="/live/:matchId" element={withSuspense(<LiveMatch />)} />
        <Route path="/leaderboards" element={withSuspense(<Leaderboards />)} />
        <Route path="/teams" element={withSuspense(<Teams />)} />
        <Route path="/teams/:teamId" element={withSuspense(<TeamDetail />)} />
        <Route path="/tournaments" element={withSuspense(<Tournaments />)} />
        <Route path="/players" element={withSuspense(<Players />)} />
        <Route path="/players/:playerId" element={withSuspense(<PlayerDetail />)} />
        <Route path="/squads" element={withSuspense(<Squads />)} />
        <Route path="/squads/:squadId" element={withSuspense(<SquadDetail />)} />
        <Route path="/score" element={withSuspense(<Score />)} />
        <Route path="/score/:matchId" element={withSuspense(<Scorer />)} />
        <Route path="/predictions" element={withSuspense(<Predictions />)} />
      </Route>
    </Routes>
  );
}
