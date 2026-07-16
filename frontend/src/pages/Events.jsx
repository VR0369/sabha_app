import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client.js";
import Modal from "../components/Modal.jsx";

function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return d.toISOString().slice(0, 10);
}

const EMPTY = {
  title: "Weekly Sabha",
  date: nextSunday(),
  location: "",
  theme: "",
  host: "",
  speakers: [],
  activity: "",
  notes: "",
};

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [hasSpeaker, setHasSpeaker] = useState(false);
  const [hasActivity, setHasActivity] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/api/events");
      setEvents(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, date: nextSunday(), speakers: [] });
    setHasSpeaker(false);
    setHasActivity(false);
    setModalOpen(true);
  }

  function openEdit(ev) {
    setEditing(ev);
    const speakers = (ev.speakers || []).map((s) => ({ name: s.name || "", topic: s.topic || "" }));
    setForm({
      title: ev.title,
      date: ev.date,
      location: ev.location || "",
      theme: ev.theme || "",
      host: ev.host || "",
      speakers,
      activity: ev.activity || "",
      notes: ev.notes || "",
    });
    setHasSpeaker(speakers.length > 0);
    setHasActivity(Boolean(ev.activity));
    setModalOpen(true);
  }

  // --- Speaker Yes/No + count 1-5 ---
  function chooseSpeaker(yes) {
    setHasSpeaker(yes);
    setForm((f) => ({
      ...f,
      speakers: yes ? (f.speakers.length ? f.speakers : [{ name: "", topic: "" }]) : [],
    }));
  }

  function setSpeakerCount(n) {
    setForm((f) => {
      const speakers = [...f.speakers];
      while (speakers.length < n) speakers.push({ name: "", topic: "" });
      speakers.length = n;
      return { ...f, speakers };
    });
  }

  function updateSpeaker(i, key, value) {
    setForm((f) => ({
      ...f,
      speakers: f.speakers.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)),
    }));
  }

  // --- Activity Yes/No ---
  function chooseActivity(yes) {
    setHasActivity(yes);
    if (!yes) setForm((f) => ({ ...f, activity: "" }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        speakers: hasSpeaker ? form.speakers : [],
        activity: hasActivity ? form.activity : "",
      };
      if (editing) await api.put(`/api/events/${editing.id}`, payload);
      else await api.post("/api/events", payload);
      setModalOpen(false);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not save event");
    } finally {
      setSaving(false);
    }
  }

  async function remove(ev) {
    if (!confirm(`Delete "${ev.title}"? This removes its attendance records.`)) return;
    await api.delete(`/api/events/${ev.id}`);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-sm text-slate-500">{events.length} weekly session(s)</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          + New event
        </button>
      </div>

      {loading ? (
        <div className="card text-center text-slate-400">Loading…</div>
      ) : events.length === 0 ? (
        <div className="card text-center text-slate-400">No events yet. Create your first weekly session.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => {
            const total = ev.present_count + ev.absent_count;
            const rate = total ? Math.round((ev.present_count / total) * 100) : 0;
            const speakers = (ev.speakers || []).filter((s) => s.name || s.topic);
            return (
              <div key={ev.id} className="card flex flex-col">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{ev.title}</h3>
                    <div className="text-sm text-slate-400">{ev.date}</div>
                  </div>
                  <span className="badge bg-brand-50 text-brand-700">{rate}%</span>
                </div>
                {ev.location && <div className="mt-1 text-sm text-slate-500">📍 {ev.location}</div>}
                {(ev.theme || ev.host || speakers.length > 0 || ev.activity) && (
                  <div className="mt-2 space-y-0.5 text-sm text-slate-500">
                    {ev.theme && (
                      <div>🎯 <span className="font-medium text-slate-600">Theme:</span> {ev.theme}</div>
                    )}
                    {ev.host && (
                      <div>🎤 <span className="font-medium text-slate-600">Host:</span> {ev.host}</div>
                    )}
                    {speakers.map((s, i) => (
                      <div key={i}>
                        🗣️ {s.name}
                        {s.topic && <span className="text-slate-400"> — {s.topic}</span>}
                      </div>
                    ))}
                    {ev.activity && (
                      <div>🎬 <span className="font-medium text-slate-600">Activity:</span> {ev.activity}</div>
                    )}
                  </div>
                )}
                <div className="mt-3 flex gap-4 text-sm">
                  <span className="text-emerald-600">● {ev.present_count} present</span>
                  <span className="text-red-500">● {ev.absent_count} absent</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="btn-primary flex-1 text-xs" onClick={() => navigate(`/events/${ev.id}/attendance`)}>
                    Mark attendance
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => openEdit(ev)}>
                    Edit
                  </button>
                  <button className="btn-danger text-xs" onClick={() => remove(ev)}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? "Edit event" : "New event"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save} disabled={saving || !form.title || !form.date}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="label">Theme</label>
            <input className="input" value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} />
          </div>
          <div>
            <label className="label">Host</label>
            <input className="input" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          </div>

          {/* Speaker: Yes/No, then how many, then that many Speaker + Topic rows */}
          <div>
            <label className="label">Speaker</label>
            <div className="flex gap-5 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="hasSpeaker" checked={hasSpeaker === true} onChange={() => chooseSpeaker(true)} />
                Yes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="hasSpeaker" checked={hasSpeaker === false} onChange={() => chooseSpeaker(false)} />
                No
              </label>
            </div>
          </div>

          {hasSpeaker && (
            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <div>
                <label className="label">How many speakers?</label>
                <select
                  className="input"
                  value={form.speakers.length || 1}
                  onChange={(e) => setSpeakerCount(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              {form.speakers.map((s, i) => (
                <div key={i} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Speaker {i + 1}</label>
                    <input className="input" value={s.name} onChange={(e) => updateSpeaker(i, "name", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Topic</label>
                    <input className="input" value={s.topic} onChange={(e) => updateSpeaker(i, "topic", e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Activity: Yes/No, then a details box only when Yes */}
          <div>
            <label className="label">Activity</label>
            <div className="flex gap-5 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="hasActivity" checked={hasActivity === true} onChange={() => chooseActivity(true)} />
                Yes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="hasActivity" checked={hasActivity === false} onChange={() => chooseActivity(false)} />
                No
              </label>
            </div>
          </div>
          {hasActivity && (
            <div>
              <label className="label">Activity details</label>
              <textarea className="input" rows={2} value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} />
            </div>
          )}

          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
