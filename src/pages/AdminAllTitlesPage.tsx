import { RefreshCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminConfirmModal from "../components/AdminConfirmModal";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import { supabase } from "../lib/supabase";
import type { Student, StudentTitle } from "../types";

function AdminAllTitlesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [titles, setTitles] = useState<StudentTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StudentTitle | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [studentsRes, titlesRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, roll_number, student_name")
        .order("roll_number"),
      supabase
        .from("student_titles")
        .select("id, giver_id, receiver_id, title_text, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (studentsRes.data) setStudents(studentsRes.data as Student[]);
    if (titlesRes.data) setTitles(titlesRes.data as StudentTitle[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const studentLookup = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return titles;
    return titles.filter((t) => {
      const giver = studentLookup.get(t.giver_id);
      const receiver = studentLookup.get(t.receiver_id);
      return (
        t.title_text.toLowerCase().includes(q) ||
        giver?.student_name.toLowerCase().includes(q) ||
        giver?.roll_number.toLowerCase().includes(q) ||
        receiver?.student_name.toLowerCase().includes(q) ||
        receiver?.roll_number.toLowerCase().includes(q)
      );
    });
  }, [titles, search, studentLookup]);

  async function confirmDeleteTitle() {
    if (!deleteTarget) return;

    setDeleting(true);
    const res = await supabase
      .from("student_titles")
      .delete()
      .eq("id", deleteTarget.id);

    if (res.error) {
      setFeedback(`Failed to delete: ${res.error.message}`);
    } else {
      const giverName = studentLookup.get(deleteTarget.giver_id)?.student_name ?? "Unknown";
      const receiverName = studentLookup.get(deleteTarget.receiver_id)?.student_name ?? "Unknown";
      setFeedback(`Deleted title "${deleteTarget.title_text}" (${giverName} → ${receiverName}).`);
      setTitles((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    }

    setDeleteTarget(null);
    setDeleting(false);
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  const deleteTargetGiver = deleteTarget ? studentLookup.get(deleteTarget.giver_id) : null;
  const deleteTargetReceiver = deleteTarget ? studentLookup.get(deleteTarget.receiver_id) : null;

  return (
    <>
      <section className="space-y-6">
        <div className="section-shell p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">
                Admin view
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                All given titles
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Complete log of every title given by every student — {titles.length} total.
                You can delete any title from here.
              </p>
            </div>

            <div className="flex gap-3">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search titles, names..."
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-accent-500/10"
                />
              </div>
              <Button variant="secondary" onClick={() => void loadData()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          {feedback && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {feedback}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No titles yet"
            description={
              search
                ? "No titles match your search."
                : "Students haven't started giving titles yet."
            }
          />
        ) : (
          <div className="section-shell overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50/80 text-left text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium sm:px-8">From (Giver)</th>
                    <th className="px-6 py-4 font-medium">To (Receiver)</th>
                    <th className="px-6 py-4 font-medium">Title</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium text-right sm:px-8">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.map((title) => {
                    const giver = studentLookup.get(title.giver_id);
                    const receiver = studentLookup.get(title.receiver_id);
                    return (
                      <tr key={title.id} className="transition hover:bg-slate-50/50">
                        <td className="px-6 py-4 sm:px-8">
                          <p className="font-medium text-slate-900">
                            {giver?.student_name ?? "Unknown"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {giver?.roll_number ?? ""}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">
                            {receiver?.student_name ?? "Unknown"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {receiver?.roll_number ?? ""}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          &ldquo;{title.title_text}&rdquo;
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {new Date(title.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right sm:px-8">
                          <Button
                            variant="danger"
                            onClick={() => {
                              setFeedback(null);
                              setDeleteTarget(title);
                            }}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <AdminConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete this title?"
        description={
          deleteTarget
            ? `This will permanently remove the title "${deleteTarget.title_text}" given by ${deleteTargetGiver?.student_name ?? "Unknown"} to ${deleteTargetReceiver?.student_name ?? "Unknown"}.`
            : ""
        }
        confirmLabel="Delete title"
        tone="danger"
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteTitle()}
      />
    </>
  );
}

export default AdminAllTitlesPage;
