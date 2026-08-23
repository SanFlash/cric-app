import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { PredictionOut } from "../api/client";

export function MomentumChart({ points }: { points: PredictionOut[] }) {
  const data = points.map((p, i) => ({
    idx: i,
    label: p.context.replace("_", " "),
    teamA: p.team_a_win_pct,
  }));

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="momentumFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-amber)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-amber)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-cream-faint)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={{ stroke: "var(--color-pitch-line)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "var(--color-cream-faint)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <ReferenceLine y={50} stroke="var(--color-pitch-500)" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{
              background: "var(--color-pitch-800)",
              border: "1px solid var(--color-pitch-line)",
              borderRadius: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-cream-dim)" }}
            itemStyle={{ color: "var(--color-amber)" }}
            formatter={(v) => [`${Number(v).toFixed(1)}%`, "Team A win%"]}
          />
          <Area
            type="monotone"
            dataKey="teamA"
            stroke="var(--color-amber)"
            strokeWidth={2}
            fill="url(#momentumFill)"
            isAnimationActive
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
