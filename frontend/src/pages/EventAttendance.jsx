import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client.js";

export default function EventAttendance() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [roster, setRoster] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [ev, r] = await Promise.all([
        api.get(`/api/events/${eventId}`),
        api.get(`/api/attendance/event/${eventId}`),
      ]);
      setEvent(ev.data);
      setRoster(r.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  function setStatus(attendeeId, status) {
    setRoster((prev) =>
      prev.map((r) => (r.attendee_id === attendeeId ? { ...r, status } : r))
    );
  }

  function markAll(status) {
    setRoster((prev) => prev.map((r) => ({ ...r, status })));
  }

  const filtered = useMemo(
    () => roster.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [roster, search]
  );

  const counts = useMemo(() => {
    const present = roster.filter((r) => r.status === "present").length;
    const absent = roster.filter((r) => r.status === "absent").length;
    return { present, absent, unmarked: roster.length - present - absent };
  }, [roster]);

  async function save() {
    setSaving(true);
    const records = roster
      .filter((r) => r.status === "present" || r.status === "absent")
      .map((r) => ({ attendee_id: r.attendee_id, status: r.status }));
    try {
      await api.post(`/api/attendance/event/${eventId}`, { records });
      setSavedAt(new Date());
    } catch (err) {
      alert(err.response?.data?.detail || "Could not save attendance");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card text-center text-slate-400">Loading…</div>;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/events" className="text-sm text-brand-600 hover:underline">
          ← Back to events
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{event?.title}</h1>
            <p className="text-sm text-slate-500">
              {event?.date} {event?.location ? `· ${event.location}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {savedAt && (
              <span className="text-xs text-emerald-600">Saved {savedAt.toLocaleTimeString()}</span>
            )}
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save attendance"}
            </button>
          </div>
        </div>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-emerald-600">✔ {counts.present} present</span>
          <span className="text-red-500">✘ {counts.absent} absent</span>
          <span className="text-slate-400">○ {counts.unmarked} unmarked</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input max-w-xs"
            placeholder="Search attendee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-ghost text-xs" onClick={() => markAll("present")}>
            All present
          </button>
          <button className="btn-ghost text-xs" onClick={() => markAll("absent")}>
            All absent
          </button>
        </div>
      </div>

      <div className="card p-0">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400">
            No active attendees. Add attendees first.
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {filtered.map((r) => (
              <li key={r.attendee_id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium">{r.name}</div>
                  {r.group && <div className="text-xs text-slate-400">{r.group}</div>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatus(r.attendee_id, "present")}
                    className={`btn text-xs ring-1 ${
                      r.status === "present"
                        ? "bg-emerald-500 text-white ring-emerald-500"
                        : "bg-white text-emerald-600 ring-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => setStatus(r.attendee_id, "absent")}
                    className={`btn text-xs ring-1 ${
                      r.status === "absent"
                        ? "bg-red-500 text-white ring-red-500"
                        : "bg-white text-red-600 ring-red-200 hover:bg-red-50"
                    }`}
                  >
                    Absent
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
