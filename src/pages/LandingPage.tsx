import { ArrowRight, KeyRound, Sparkles, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchableSelect from "../components/SearchableSelect";
import { supabase } from "../lib/supabase";
import type { SelectOption, Student } from "../types";
import { getLoggedInStudent, setLoggedInStudent } from "../utils/auth";

function LandingPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoll, setSelectedRoll] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"idle" | "login" | "signup">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = getLoggedInStudent();
    if (existing) {
      navigate("/profiles", { replace: true });
      return;
    }

    async function load() {
      try {
        const response = await supabase
          .from("students")
          .select("id, roll_number, student_name, password")
          .order("student_name");

        if (response.error) {
          console.error("Failed to load students:", response.error);
          setError("Could not load students. Please refresh the page.");
        } else if (response.data) {
          setStudents(response.data as Student[]);
        }
      } catch (err) {
        console.error("Error loading students:", err);
        setError("Could not connect to the database. Please check your connection.");
      }
      setLoading(false);
    }

    void load();
  }, [navigate]);

  const studentLookup = useMemo(
    () => new Map(students.map((s) => [s.roll_number, s])),
    [students],
  );

  const options: SelectOption[] = useMemo(
    () =>
      students.map((s) => ({
        value: s.roll_number,
        label: `${s.student_name} — ${s.roll_number}`,
        description: s.password ? "Has password" : "New",
      })),
    [students],
  );

  function handleRollChange(value: string) {
    setSelectedRoll(value);
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setMode("idle");

    const student = studentLookup.get(value);
    if (!student) return;

    if (student.password) {
      setMode("login");
    } else {
      setMode("signup");
    }
  }

  async function handleLogin() {
    const student = studentLookup.get(selectedRoll);
    if (!student) return;

    if (!password.trim()) {
      setError("Enter your password.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const response = await supabase
      .from("students")
      .select("id, roll_number, student_name")
      .eq("roll_number", selectedRoll)
      .eq("password", password.trim())
      .maybeSingle();

    if (response.error) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    if (!response.data) {
      setError("Incorrect password.");
      setSubmitting(false);
      return;
    }

    setLoggedInStudent(response.data as Student);
    navigate("/profiles");
  }

  async function handleSignup() {
    const student = studentLookup.get(selectedRoll);
    if (!student) return;

    if (!password.trim()) {
      setError("Choose a password.");
      return;
    }

    if (password.trim().length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const response = await supabase
      .from("students")
      .update({ password: password.trim() })
      .eq("id", student.id)
      .is("password", null)
      .select("id, roll_number, student_name")
      .maybeSingle();

    if (response.error) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    if (!response.data) {
      setError("This account has already been set up. Try logging in.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      setSubmitting(false);
      return;
    }

    setLoggedInStudent(response.data as Student);
    navigate("/profiles");
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <section className="space-y-8">
      {/* Hero */}
      <div className="section-shell relative overflow-hidden p-8 sm:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-50 via-white to-emerald-50/30 opacity-60" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent-500">
            <Sparkles className="h-3.5 w-3.5" />
            Class Farewell Titles
          </div>
          <h2 className="mt-6 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Give a title to every classmate
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Browse through each classmate's profile one by one and give them a
            unique, fun title. Everyone gives, everyone receives — let's make farewell memorable!
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Login / Signup Card */}
        <div className="section-shell p-8 sm:p-10">
          <h3 className="text-2xl font-semibold text-slate-950">
            {mode === "login"
              ? "Welcome back!"
              : mode === "signup"
                ? "Set up your account"
                : "Select your name to begin"}
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {mode === "login"
              ? "Enter your password to log in and continue giving titles."
              : mode === "signup"
                ? "Choose a password so only you can give titles from your account."
                : "Find yourself in the list below and log in or sign up."}
          </p>

          <div className="mt-8 space-y-5">
            <SearchableSelect
              label="Find your name"
              placeholder="Search by name or roll number..."
              value={selectedRoll}
              options={options}
              onChange={handleRollChange}
              helperText={`${students.length} students`}
            />

            {mode === "login" && (
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-card animate-in">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <KeyRound className="h-4 w-4 text-accent-500" />
                  Enter your password
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleLogin();
                  }}
                  placeholder="Your password"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-accent-500/10"
                />
                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}
                <Button onClick={() => void handleLogin()} disabled={submitting} className="w-full">
                  {submitting ? "Logging in..." : "Log in"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {mode === "signup" && (
              <div className="space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-card animate-in">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <UserPlus className="h-4 w-4" />
                  First time? Set a password to get started.
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Choose a password (min 4 chars)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-accent-500/10"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSignup();
                  }}
                  placeholder="Confirm password"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-accent-500/10"
                />
                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}
                <Button onClick={() => void handleSignup()} disabled={submitting} className="w-full">
                  {submitting ? "Setting up..." : "Sign up & enter"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Info cards */}
        <div className="grid gap-5 content-start">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card transition hover:shadow-soft">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-blue-600 text-white">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-900">Profile by profile</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              You'll see one classmate at a time. Give them a creative title,
              then move to the next. You must give a title to everyone!
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card transition hover:shadow-soft">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <KeyRound className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-900">Your titles, your choice</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Each student gives exactly one title per classmate. Set a password on your first visit
              so no one else can change your titles.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card transition hover:shadow-soft">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-900">See all titles</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Once you're done, browse the "All Titles" page to see what everyone
              got. It's a fun way to see how people view each other!
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingPage;
