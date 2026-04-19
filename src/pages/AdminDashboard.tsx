import { KeyRound, RefreshCcw, RotateCcw, UserCheck, UserX, Users } from "lucide-react";
import { useEffect, useState } from "react";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import StatsCard from "../components/StatsCard";
import { supabase } from "../lib/supabase";
import type { Student } from "../types";

type ResetMode = "status_only" | "status_and_titles";

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [titleCount, setTitleCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Reset status modal state
  const [resetTarget, setResetTarget] = useState<Student | null>(null);
  const [resetStep, setResetStep] = useState<"confirm" | "choose_mode">("confirm");
  const [resetting, setResetting] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    const [studentsRes, titlesCountRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, roll_number, student_name, password")
        .order("roll_number"),
      supabase
        .from("student_titles")
        .select("*", { count: "exact", head: true }),
    ]);

    if (studentsRes.error || titlesCountRes.error) {
      setError("Some data could not be loaded.");
    }

    if (studentsRes.data) setStudents(studentsRes.data as Student[]);
    setTitleCount(titlesCountRes.count ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  function openResetModal(student: Student) {
    setResetTarget(student);
    setResetStep("confirm");
    setFeedback(null);
  }

  function closeResetModal() {
    setResetTarget(null);
    setResetStep("confirm");
  }

  async function handleReset(mode: ResetMode) {
    if (!resetTarget) return;

    setResetting(true);

    // Step 1: Clear password (set to null)
    const pwRes = await supabase
      .from("students")
      .update({ password: null })
      .eq("id", resetTarget.id);

    if (pwRes.error) {
      setError(`Failed to reset: ${pwRes.error.message}`);
      setResetting(false);
      closeResetModal();
      return;
    }

    // Step 2: Delete titles given by this student (if chosen)
    let deletedCount = 0;
    if (mode === "status_and_titles") {
      const titlesRes = await supabase
        .from("student_titles")
        .delete()
        .eq("giver_id", resetTarget.id);

      if (titlesRes.error) {
        setError(`Password reset but failed to delete titles: ${titlesRes.error.message}`);
        setResetting(false);
        closeResetModal();
        await loadDashboard();
        return;
      }

      // Get count from a separate query since delete doesn't return count easily
      deletedCount = -1; // We'll just say "all"
    }

    const modeLabel =
      mode === "status_and_titles"
        ? `Status reset to Pending and all titles given by ${resetTarget.student_name} were deleted.`
        : `Status reset to Pending for ${resetTarget.student_name}. Titles were kept.`;

    setFeedback(modeLabel);
    setResetting(false);
    closeResetModal();
    await loadDashboard();
  }

  const signedUpCount = students.filter((s) => s.password).length;
  const notSignedUpCount = students.length - signedUpCount;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <section className="space-y-6">
        <div className="section-shell p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">
                Admin dashboard
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Class titles overview
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Monitor student sign-ups and the titles being exchanged across the class.
                You can reset any student's status back to Pending.
              </p>
            </div>

            <Button variant="secondary" onClick={() => void loadDashboard()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}

          {feedback && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {feedback}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatsCard
            label="Total students"
            value={students.length}
            helper="Students in the database"
          />
          <StatsCard
            label="Signed up"
            value={signedUpCount}
            helper="Students with passwords set"
          />
          <StatsCard
            label="Not signed up"
            value={notSignedUpCount}
            helper="Students who haven't joined yet"
          />
          <StatsCard
            label="Titles given"
            value={titleCount}
            helper="Total peer titles across all students"
          />
        </div>

        <div className="section-shell overflow-hidden p-0">
          <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
            <h3 className="text-2xl font-semibold text-slate-950">All students</h3>
            <p className="mt-2 text-sm text-slate-600">
              {students.length} students total — Click "Reset" on any signed-up student to clear their password
            </p>
          </div>

          {students.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No students yet"
                description="Add students from the Students tab."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50/80 text-left text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium sm:px-8">Roll number</th>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium text-center">Status</th>
                    <th className="px-6 py-4 font-medium text-right sm:px-8">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {students.map((student) => (
                    <tr key={student.id} className="transition hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-medium text-slate-900 sm:px-8">
                        {student.roll_number}
                      </td>
                      <td className="px-6 py-4 text-slate-700">{student.student_name}</td>
                      <td className="px-6 py-4 text-center">
                        {student.password ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                            <UserCheck className="h-3.5 w-3.5" />
                            Signed up
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                            <UserX className="h-3.5 w-3.5" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right sm:px-8">
                        {student.password ? (
                          <Button
                            variant="danger"
                            onClick={() => openResetModal(student)}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Reset
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Already pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Reset Status Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white p-6 shadow-soft sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">
              Reset student status
            </p>

            {resetStep === "confirm" ? (
              <>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                  Reset {resetTarget.student_name}?
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  This will clear <strong>{resetTarget.student_name}'s</strong> password and change
                  their status from <strong>Signed up</strong> to <strong>Pending</strong>.
                  They will need to set a new password to log in again.
                </p>

                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <div className="flex items-center gap-2 font-medium">
                    <KeyRound className="h-4 w-4" />
                    Would you also like to delete all titles given by this student?
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3">
                  <Button
                    variant="danger"
                    onClick={() => void handleReset("status_and_titles")}
                    disabled={resetting}
                  >
                    {resetting ? "Resetting..." : "Reset status & delete all their titles"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void handleReset("status_only")}
                    disabled={resetting}
                  >
                    {resetting ? "Resetting..." : "Reset status only (keep titles)"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={closeResetModal}
                    disabled={resetting}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

export default AdminDashboard;
