import { useEffect, useMemo, useState } from "react";
import api from "../api/client.js";

const CATEGORIES = {
  regular: { label: "Regular", cls: "bg-emerald-50 text-emerald-600" },
  occasional: { label: "Occasional", cls: "bg-amber-50 text-amber-600" },
  absentee: { label: "Absentee", cls: "bg-red-50 text-red-600" },
};

export default function Reports() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState("");

  useEffect(() => {
    api
      .get("/api/reports/attendees")
      .then((res) => setRows(res.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!category || r.category === category) &&
          (!search || r.name.toLowerCase().includes(search.toLowerCase()))
      ),
    [rows, category, search]
  );

  async function download(kind) {
    setDownloading(kind);
    try {
      const url = kind === "matrix" ? "/api/reports/export/matrix.csv" : "/api/reports/export/attendees.csv";
      const res = await api.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = kind === "matrix" ? "attendance_matrix.csv" : "attendee_report.csv";
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setDownloading("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-slate-500">Participation summary for every attendee</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => download("attendees")} disabled={downloading}>
            {downloading === "attendees" ? "Exporting…" : "⬇ Summary CSV"}
          </button>
          <button className="btn-primary" onClick={() => download("matrix")} disabled={downloading}>
            {downloading === "matrix" ? "Exporting…" : "⬇ Full register CSV"}
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search attendee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[12rem]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          <option value="regular">Regular (≥75%)</option>
          <option value="occasional">Occasional</option>
          <option value="absentee">Absentee (≤25%)</option>
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Group</th>
              <th className="px-4 py-3 text-right">Present</th>
              <th className="px-4 py-3 text-right">Absent</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3">Category</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No attendees match.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const cat = CATEGORIES[r.category] || CATEGORIES.occasional;
                const rate = Math.round(r.attendance_rate * 100);
                return (
                  <tr key={r.attendee_id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-slate-500">{r.group || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{r.present}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-500">{r.absent}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{rate}%</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${cat.cls}`}>{cat.label}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
