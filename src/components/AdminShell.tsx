import { LayoutDashboard, LogOut, TableProperties, Users } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import Button from "./Button";

const adminLinks = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/titles", label: "All Titles", icon: TableProperties },
];

function AdminShell() {
  const navigate = useNavigate();

  function handleLogout() {
    sessionStorage.removeItem("farewell_admin_ok");
    navigate("/admin");
  }

  return (
    <section className="space-y-6">
      <div className="section-shell p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">Admin workspace</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Class titles manager
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Manage students and view all peer-given titles from one place.
            </p>
          </div>

          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>

        <nav className="mt-6 flex flex-wrap gap-3">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  [
                    "inline-flex items-center rounded-2xl border px-4 py-3 text-sm font-medium transition",
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white shadow-card"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")
                }
              >
                <Icon className="mr-2 h-4 w-4" />
                {link.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <Outlet />
    </section>
  );
}

export default AdminShell;
