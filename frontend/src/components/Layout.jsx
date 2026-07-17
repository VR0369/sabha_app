import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const nav = [
  { to: "/", label: "Dashboard", icon: "📊", end: true },
  { to: "/attendees", label: "Attendees", icon: "👥" },
  { to: "/events", label: "Events", icon: "📅" },
  { to: "/reports", label: "Reports", icon: "📈" },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const items = [...nav];
  if (isAdmin) items.push({ to: "/users", label: "Users", icon: "⚙️" });

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-7xl flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-slate-200 bg-white md:min-h-screen md:w-60 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2 px-5 py-5">
            <img src="/logo.png" alt="Sabha logo" className="h-9 w-9 object-contain" />
            <div>
              <div className="font-semibold leading-tight">Sabha</div>
              <div className="text-xs text-slate-400">Attendance</div>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
            <div className="text-sm text-slate-400">Weekly Spiritual Event</div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium leading-tight">{user?.name}</div>
                <div className="text-xs capitalize text-slate-400">{user?.role}</div>
              </div>
              <button onClick={handleLogout} className="btn-ghost text-xs">
                Logout
              </button>
            </div>
          </header>
          <main className="p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
