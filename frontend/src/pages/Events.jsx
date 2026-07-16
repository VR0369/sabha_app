import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client.js";
import Modal from "../components/Modal.jsx";

function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return d.toISOString().slice(0, 10);
}

const EMPTY = { title: "Weekly Sabha", date: nextSunday(), location: "", notes: "" };

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
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
    setForm({ ...EMPTY, date: nextSunday() });
    setModalOpen(true);
  }

  function openEdit(ev) {
    setEditing(ev);
    setForm({ title: ev.title, date: ev.date, location: ev.location || "", notes: ev.notes || "" });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) await api.put(`/api/events/${editing.id}`, form);
      else await api.post("/api/events", form);
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
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
