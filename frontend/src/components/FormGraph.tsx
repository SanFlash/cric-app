import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { FormPointOut } from "../api/client";

export function FormGraph({ points }: { points: FormPointOut[] }) {
  const data = points.map((p, i) => ({ idx: i + 1, form: p.form_score }));

  return (
    <div style={{ width: "100%", height: 160 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="idx"
            tick={{ fill: "var(--color-cream-faint)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            axisLine={{ stroke: "var(--color-pitch-line)" }}
            tickLine={false}
            label={{ value: "Match #", position: "insideBottom", offset: -4, fill: "var(--color-cream-faint)", fontSize: 10 }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "var(--color-cream-faint)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-pitch-800)",
              border: "1px solid var(--color-pitch-line)",
              borderRadius: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
            labelFormatter={(l) => `Match ${l}`}
            formatter={(v) => [Number(v).toFixed(1), "Form"]}
          />
          <Line
            type="monotone"
            dataKey="form"
            stroke="var(--color-win)"
            strokeWidth={2}
            dot={{ fill: "var(--color-win)", r: 3 }}
            isAnimationActive
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
