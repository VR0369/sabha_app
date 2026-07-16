import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api/client.js";
import StatCard from "../components/StatCard.jsx";

// Validated palette (light surface) — see dataviz reference palette.
const C = {
  series: "#2a78d6", // blue — trend line
  present: "#0ca30c", // status: good
  absent: "#d03b3b", // status: critical
  grid: "#e1e0d9",
  axis: "#898781",
};

const pct = (v) => `${Math.round((v || 0) * 100)}%`;

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/reports/dashboard")
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card text-center text-slate-400">Loading dashboard…</div>;
  if (!data) return null;

  const t = data.totals;
  const trend = data.trend.map((d) => ({ ...d, rate: Math.round(d.attendance_rate * 100) }));
  const hasData = t.events > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-500">Attendance overview and trends</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Active attendees" value={t.active_attendees} sub={`${t.attendees} total`} />
        <StatCard label="Events held" value={t.events} />
        <StatCard label="Avg attendance" value={pct(t.overall_attendance_rate)} accent="text-brand-600" />
        <StatCard label="Regulars" value={t.regular_count} sub="≥ 75% attendance" accent="text-emerald-600" />
        <StatCard label="At-risk absentees" value={t.absentee_count} sub="≤ 25% attendance" accent="text-red-500" />
      </div>

      {!hasData ? (
        <div className="card text-center text-slate-400">
          No events yet. <Link to="/events" className="text-brand-600 hover:underline">Create an event</Link> and start
          marking attendance to see analytics.
        </div>
      ) : (
        <>
          <div className="card">
            <h2 className="mb-1 font-semibold">Attendance rate over time</h2>
            <p className="mb-4 text-xs text-slate-400">Percentage of marked attendees present, per event</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={{ stroke: C.grid }} />
                <YAxis
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 11, fill: C.axis }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="Attendance rate"
                  stroke={C.series}
                  strokeWidth={2}
                  dot={{ r: 4, fill: C.series }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-1 font-semibold">Present vs absent</h2>
              <p className="mb-4 text-xs text-slate-400">Marked attendance per event</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend} margin={{ top: 8, right: 12, left: -12, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={{ stroke: C.grid }} />
                  <YAxis tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="present" name="Present" fill={C.present} radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="absent" name="Absent" fill={C.absent} radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h2 className="mb-1 font-semibold">Attendance by group</h2>
              <p className="mb-4 text-xs text-slate-400">Average attendance rate per group</p>
              {data.group_breakdown.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">No group data.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    layout="vertical"
                    data={data.group_breakdown.map((g) => ({ ...g, rate: Math.round(g.attendance_rate * 100) }))}
                    margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke={C.grid} horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="group" width={90} tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} />
                    <Bar dataKey="rate" name="Attendance rate" fill={C.series} radius={[0, 4, 4, 0]}>
                      {data.group_breakdown.map((_, i) => (
                        <Cell key={i} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <RankList title="Most regular attendees" rows={data.top_regulars} tone="emerald" />
            <RankList title="Frequent absentees" rows={data.top_absentees} tone="red" />
          </div>
        </>
      )}
    </div>
  );
}

function RankList({ title, rows, tone }) {
  const badge = tone === "emerald" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600";
  return (
    <div className="card">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">Not enough data yet.</p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {rows.map((r) => (
            <li key={r.attendee_id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-slate-400">
                  {r.present}/{r.total_events} events {r.group ? `· ${r.group}` : ""}
                </div>
              </div>
              <span className={`badge ${badge}`}>{pct(r.attendance_rate)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
