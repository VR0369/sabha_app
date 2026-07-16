import { useEffect, useState } from "react";
import api from "../api/client.js";
import Modal from "../components/Modal.jsx";

const EMPTY = { name: "", email: "", phone: "", gender: "", group: "", notes: "", active: true };

export default function Attendees() {
  const [attendees, setAttendees] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const [historyFor, setHistoryFor] = useState(null);
  const [history, setHistory] = useState([]);

  async function load() {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (groupFilter) params.group = groupFilter;
    if (activeFilter !== "") params.active = activeFilter;
    try {
      const [a, g] = await Promise.all([
        api.get("/api/attendees", { params }),
        api.get("/api/attendees/groups"),
      ]);
      setAttendees(a.data);
      setGroups(g.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, groupFilter, activeFilter]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }

  function openEdit(a) {
    setEditing(a);
    setForm({
      name: a.name || "",
      email: a.email || "",
      phone: a.phone || "",
      gender: a.gender || "",
      group: a.group || "",
      notes: a.notes || "",
      active: a.active,
    });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = { ...form };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === "") payload[k] = k === "email" ? null : payload[k];
    });
    if (payload.email === "") payload.email = null;
    try {
      if (editing) await api.put(`/api/attendees/${editing.id}`, payload);
      else await api.post("/api/attendees", payload);
      setModalOpen(false);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not save attendee");
    } finally {
      setSaving(false);
    }
  }

  async function remove(a) {
    if (!confirm(`Delete ${a.name}? This also removes their attendance history.`)) return;
    await api.delete(`/api/attendees/${a.id}`);
    load();
  }

  async function openHistory(a) {
    setHistoryFor(a);
    const res = await api.get(`/api/attendance/attendee/${a.id}`);
    setHistory(res.data);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Attendees</h1>
          <p className="text-sm text-slate-500">{attendees.length} participant(s)</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          + Add attendee
        </button>
      </div>

      <div className="card flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search name, email or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[12rem]" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select className="input max-w-[10rem]" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Group</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : attendees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No attendees found.
                </td>
              </tr>
            ) : (
              attendees.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-slate-500">{a.group || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{a.email || a.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${a.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                      {a.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost text-xs" onClick={() => openHistory(a)}>
                        History
                      </button>
                      <button className="btn-ghost text-xs" onClick={() => openEdit(a)}>
                        Edit
                      </button>
                      <button className="btn-danger text-xs" onClick={() => remove(a)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? "Edit attendee" : "Add attendee"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save} disabled={saving || !form.name}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Group</label>
            <input
              className="input"
              value={form.group}
              onChange={(e) => setForm({ ...form, group: e.target.value })}
              placeholder="e.g. Youth"
              list="group-list"
            />
            <datalist id="group-list">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Gender</label>
            <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active (included in attendance rosters)
          </label>
        </div>
      </Modal>

      <Modal open={!!historyFor} title={`History — ${historyFor?.name || ""}`} onClose={() => setHistoryFor(null)}>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No attendance recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.event_id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{h.title}</div>
                  <div className="text-xs text-slate-400">{h.date}</div>
                </div>
                <span className={`badge ${h.status === "present" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                  {h.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
