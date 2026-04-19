import { Navigate, Route, Routes } from "react-router-dom";
import AdminGuard from "./components/AdminGuard";
import AdminShell from "./components/AdminShell";
import Layout from "./components/Layout";
import StudentGuard from "./components/StudentGuard";
import AdminAllTitlesPage from "./pages/AdminAllTitlesPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import AdminStudentsPage from "./pages/AdminStudentsPage";
import AllTitlesPage from "./pages/AllTitlesPage";
import LandingPage from "./pages/LandingPage";
import ProfileBrowserPage from "./pages/ProfileBrowserPage";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route element={<StudentGuard />}>
          <Route path="/profiles" element={<ProfileBrowserPage />} />
          <Route path="/all-titles" element={<AllTitlesPage />} />
        </Route>
        <Route path="/admin" element={<AdminLogin />} />
        <Route element={<AdminGuard />}>
          <Route element={<AdminShell />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/students" element={<AdminStudentsPage />} />
            <Route path="/admin/titles" element={<AdminAllTitlesPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
