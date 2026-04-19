import { Search, Sparkles, TableProperties } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import { supabase } from "../lib/supabase";
import type { Student, StudentTitle } from "../types";

function AllTitlesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [titles, setTitles] = useState<StudentTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");

  useEffect(() => {
    async function load() {
      const [studentsRes, titlesRes] = await Promise.all([
        supabase
          .from("students")
          .select("id, roll_number, student_name")
          .order("student_name"),
        supabase
          .from("student_titles")
          .select("id, giver_id, receiver_id, title_text, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (studentsRes.data) setStudents(studentsRes.data as Student[]);
      if (titlesRes.data) setTitles(titlesRes.data as StudentTitle[]);
      setLoading(false);
    }

    void load();
  }, []);

  const studentLookup = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students],
  );

  const titlesByReceiver = useMemo(() => {
    const map = new Map<string, StudentTitle[]>();
    for (const title of titles) {
      const existing = map.get(title.receiver_id) ?? [];
      existing.push(title);
      map.set(title.receiver_id, existing);
    }
    return map;
  }, [titles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.student_name.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q),
    );
  }, [students, search]);

  const flatTitles = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return titles;
    return titles.filter((t) => {
      const receiver = studentLookup.get(t.receiver_id);
      return (
        t.title_text.toLowerCase().includes(q) ||
        receiver?.student_name.toLowerCase().includes(q) ||
        receiver?.roll_number.toLowerCase().includes(q)
      );
    });
  }, [titles, search, studentLookup]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="section-shell p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-500">
              <Sparkles className="h-3.5 w-3.5" />
              All Titles
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
              Every title, every student
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Browse all {titles.length} titles your classmates have given each
              other. Search by name, roll number, or title text.
            </p>
          </div>

          <div className="flex items-center gap-3">
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

            <div className="flex rounded-2xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`rounded-xl px-3 py-2 text-xs font-medium transition ${viewMode === "table"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                <TableProperties className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`rounded-xl px-3 py-2 text-xs font-medium transition ${viewMode === "cards"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <>
          {flatTitles.length === 0 ? (
            <EmptyState
              title="No titles found"
              description={
                search
                  ? "Try a different search term."
                  : "No titles have been given yet."
              }
            />
          ) : (
            <div className="section-shell overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50/80 text-left text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-medium sm:px-8">
                        Student (Receiver)
                      </th>
                      <th className="px-6 py-4 font-medium">Title</th>
                      <th className="px-6 py-4 font-medium">Given by</th>
                      <th className="px-6 py-4 font-medium text-right sm:px-8">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {flatTitles.map((title) => {
                      const receiver = studentLookup.get(title.receiver_id);
                      return (
                        <tr
                          key={title.id}
                          className="transition hover:bg-slate-50/50"
                        >
                          <td className="px-6 py-4 sm:px-8">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-blue-600 text-xs font-bold text-white">
                                {receiver?.student_name
                                  ?.charAt(0)
                                  ?.toUpperCase() ?? "?"}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {receiver?.student_name ?? "Unknown"}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {receiver?.roll_number ?? ""}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
                              &ldquo;{title.title_text}&rdquo;
                            </span>
                          </td>
                          {/* ── Giver hidden ── */}
                          <td className="px-6 py-4">
                            <p className="text-sm italic text-slate-400">
                              nahi bataonga 🙂
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right text-xs text-slate-400 sm:px-8">
                            {new Date(title.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Cards View */}
      {viewMode === "cards" && (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              title="No students found"
              description={
                search
                  ? "Try a different search term."
                  : "No students in the database yet."
              }
            />
          ) : (
            <div className="space-y-4">
              {filtered.map((student) => {
                const received = titlesByReceiver.get(student.id) ?? [];
                return (
                  <div
                    key={student.id}
                    className="section-shell overflow-hidden p-0"
                  >
                    <div className="flex items-center gap-4 border-b border-slate-200 bg-gradient-to-r from-accent-50/40 to-white px-6 py-4 sm:px-8">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-blue-600 text-lg font-bold text-white shadow-md">
                        {student.student_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-slate-900">
                          {student.student_name}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {student.roll_number}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {received.length} title
                        {received.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {received.length === 0 ? (
                      <div className="px-6 py-4 text-sm italic text-slate-400 sm:px-8">
                        No titles given yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {received.map((title) => (
                          <div
                            key={title.id}
                            className="flex items-center justify-between gap-4 px-6 py-3 sm:px-8"
                          >
                            <p className="text-sm font-medium text-slate-700">
                              &ldquo;{title.title_text}&rdquo;
                            </p>
                            {/* ── Giver hidden ── */}
                            <p className="shrink-0 text-xs italic text-slate-400">
                              — nahi bataonga 🙂
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default AllTitlesPage;