import { LogOut, Sparkles, TableProperties, UserCircle } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearLoggedInStudent, getLoggedInStudent } from "../utils/auth";
import Button from "./Button";

const studentLinks = [
  { to: "/profiles", label: "Profiles", icon: UserCircle },
  { to: "/all-titles", label: "All Titles", icon: TableProperties },
];

function Layout() {
  const navigate = useNavigate();
  const student = getLoggedInStudent();

  function handleLogout() {
    clearLoggedInStudent();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-halo text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <NavLink to="/" className="group flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-blue-600 text-white shadow-md transition group-hover:shadow-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Class Farewell
                </p>
                <h1 className="text-lg font-bold text-slate-900">
                  Title Station
                </h1>
              </div>
            </NavLink>

            {student ? (
              <div className="flex items-center gap-4">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-slate-700">
                    {student.student_name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {student.roll_number}
                  </p>
                </div>
                <Button variant="ghost" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            ) : null}
          </div>

          {student ? (
            <nav className="mt-5 flex flex-wrap gap-3">
              {studentLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      [
                        "inline-flex items-center rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
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
          ) : null}
        </header>

        <main className="flex-1">
          <Outlet />
        </main>

        <footer className="mt-12 border-t border-slate-200/60 py-6 text-center text-xs text-slate-400">
          Class Farewell Title Station &middot; Give titles, make memories
        </footer>
      </div>
    </div>
  );
}

export default Layout;
