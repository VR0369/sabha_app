import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Attendees from "./pages/Attendees.jsx";
import Events from "./pages/Events.jsx";
import EventAttendance from "./pages/EventAttendance.jsx";
import Reports from "./pages/Reports.jsx";
import Users from "./pages/Users.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/attendees" element={<Attendees />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:eventId/attendance" element={<EventAttendance />} />
        <Route path="/reports" element={<Reports />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute adminOnly>
              <Users />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
