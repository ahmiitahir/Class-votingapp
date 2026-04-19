import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  MessageSquarePlus,
  Pencil,
  Send,
  Sparkles,
  Trophy,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import { supabase } from "../lib/supabase";
import type { Student, StudentTitle } from "../types";
import { getLoggedInStudent } from "../utils/auth";

function ProfileBrowserPage() {
  const currentUser = getLoggedInStudent()!;
  const [students, setStudents] = useState<Student[]>([]);
  const [titles, setTitles] = useState<StudentTitle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [titleInput, setTitleInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showJumpMenu, setShowJumpMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 300 });
  const jumpButtonRef = useRef<HTMLButtonElement>(null);

  const loadData = useCallback(async () => {
    const [studentsRes, titlesRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, roll_number, student_name")
        .order("student_name"),
      supabase
        .from("student_titles")
        .select("id, giver_id, receiver_id, title_text, created_at"),
    ]);

    if (studentsRes.data) {
      const otherStudents = (studentsRes.data as Student[]).filter(
        (s) => s.id !== currentUser.id,
      );
      setStudents(otherStudents);
    }

    if (titlesRes.data) {
      setTitles(titlesRes.data as StudentTitle[]);
    }

    setLoading(false);
  }, [currentUser.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentStudent = students[currentIndex] ?? null;

  const [allStudents, setAllStudents] = useState<Student[]>([]);
  useEffect(() => {
    supabase
      .from("students")
      .select("id, roll_number, student_name")
      .then((res) => {
        if (res.data) setAllStudents(res.data as Student[]);
      });
  }, []);

  const studentLookup = useMemo(
    () => new Map(allStudents.map((s) => [s.id, s])),
    [allStudents],
  );

  const receivedTitles = useMemo(() => {
    if (!currentStudent) return [];
    return titles.filter((t) => t.receiver_id === currentStudent.id);
  }, [titles, currentStudent]);

  const myTitleForCurrent = useMemo(() => {
    if (!currentStudent) return null;
    return (
      titles.find(
        (t) =>
          t.giver_id === currentUser.id &&
          t.receiver_id === currentStudent.id,
      ) ?? null
    );
  }, [titles, currentStudent, currentUser.id]);

  const givenCount = useMemo(
    () => titles.filter((t) => t.giver_id === currentUser.id).length,
    [titles, currentUser.id],
  );

  const titledStudentIds = useMemo(() => {
    const set = new Set<string>();
    titles
      .filter((t) => t.giver_id === currentUser.id)
      .forEach((t) => set.add(t.receiver_id));
    return set;
  }, [titles, currentUser.id]);

  useEffect(() => {
    setTitleInput(myTitleForCurrent?.title_text ?? "");
    setFeedback(null);
  }, [myTitleForCurrent, currentIndex]);

  function calcPos() {
    if (!jumpButtonRef.current) return;
    const rect = jumpButtonRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    const MENU_WIDTH = isMobile ? window.innerWidth - 24 : 288;
    const leftPos = isMobile ? 12 : Math.max(8, rect.right - MENU_WIDTH);
    const topPos = rect.bottom + 8;
    const availableHeight = window.innerHeight - topPos - 16;
    setMenuPos({
      top: topPos,
      left: leftPos,
      width: MENU_WIDTH,
      maxHeight: Math.max(120, availableHeight),
    });
  }

  // Close on outside click
  useEffect(() => {
    if (!showJumpMenu) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-jump-menu]") &&
        !target.closest("[data-jump-portal]")
      ) {
        setShowJumpMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showJumpMenu]);

  // Recalculate on scroll/resize
  useEffect(() => {
    if (!showJumpMenu) return;
    window.addEventListener("scroll", calcPos, true);
    window.addEventListener("resize", calcPos);
    return () => {
      window.removeEventListener("scroll", calcPos, true);
      window.removeEventListener("resize", calcPos);
    };
  }, [showJumpMenu]);

  function toggleJumpMenu() {
    calcPos();
    setShowJumpMenu((v) => !v);
  }

  async function handleSaveTitle() {
    if (!currentStudent) return;
    const trimmed = titleInput.trim();
    if (!trimmed) { setFeedback("Write a title first!"); return; }
    if (trimmed.length > 60) { setFeedback("Title must be 60 characters or less."); return; }

    setSaving(true);
    setFeedback(null);

    if (myTitleForCurrent) {
      const res = await supabase
        .from("student_titles")
        .update({ title_text: trimmed })
        .eq("id", myTitleForCurrent.id);
      if (res.error) { setFeedback("Failed to update. Try again."); setSaving(false); return; }
    } else {
      const res = await supabase.from("student_titles").insert({
        giver_id: currentUser.id,
        receiver_id: currentStudent.id,
        title_text: trimmed,
      });
      if (res.error) {
        setFeedback(res.error.code === "23505"
          ? "You already gave this person a title. Refresh to see it."
          : "Failed to save. Try again.");
        setSaving(false);
        return;
      }
    }

    const updated = await supabase
      .from("student_titles")
      .select("id, giver_id, receiver_id, title_text, created_at");
    if (updated.data) setTitles(updated.data as StudentTitle[]);
    setFeedback(myTitleForCurrent ? "✓ Title updated!" : "✓ Title saved!");
    setSaving(false);
  }

  function goNext() {
    if (currentIndex < students.length - 1) setCurrentIndex(currentIndex + 1);
  }

  function goPrev() {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }

  function jumpTo(index: number) {
    setCurrentIndex(index);
    setShowJumpMenu(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <EmptyState
        title="No classmates found"
        description="There are no other students in the database yet. Ask your admin to add students."
      />
    );
  }

  const progressPercent =
    students.length > 0 ? (givenCount / students.length) * 100 : 0;

  return (
    <section className="space-y-6">
      {/* Progress Bar */}
      <div className="section-shell p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-blue-600 text-white">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {givenCount}/{students.length} titles given
              </p>
              <p className="text-xs text-slate-500">
                {givenCount === students.length
                  ? "🎉 You've titled everyone!"
                  : `${students.length - givenCount} remaining`}
              </p>
            </div>
          </div>

          <div data-jump-menu>
            <button
              ref={jumpButtonRef}
              type="button"
              onClick={toggleJumpMenu}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Profile {currentIndex + 1} of {students.length}
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${showJumpMenu ? "rotate-180" : ""
                  }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-500 via-blue-500 to-emerald-500 transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Portal dropdown — renders at body level, fully responsive */}
      {showJumpMenu &&
        createPortal(
          <div
            data-jump-portal
            className="fixed z-[9999] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
          >
            {students.map((s, idx) => {
              const hasTitled = titledStudentIds.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => jumpTo(idx)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${idx === currentIndex
                      ? "bg-accent-50 text-accent-500"
                      : "hover:bg-slate-50"
                    }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${hasTitled
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-slate-100 text-slate-400"
                      }`}
                  >
                    {hasTitled ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </span>
                  <span className="min-w-0 truncate font-medium text-slate-700">
                    {s.student_name}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-slate-400">
                    {s.roll_number}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Left: Profile Card */}
        <div className="space-y-5">
          <div className="section-shell overflow-hidden">
            <div className="border-b border-slate-200 bg-gradient-to-br from-accent-50 via-blue-50/30 to-white p-6 sm:p-8 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-blue-600 text-3xl font-bold text-white shadow-lg ring-4 ring-white">
                {currentStudent!.student_name.charAt(0).toUpperCase()}
              </div>
              <h2 className="mt-4 text-2xl font-bold text-slate-950 sm:text-3xl">
                {currentStudent!.student_name}
              </h2>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-600">
                <User className="h-3.5 w-3.5" />
                {currentStudent!.roll_number}
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                {myTitleForCurrent ? (
                  <>
                    <Pencil className="h-4 w-4 text-accent-500" />
                    Your title for {currentStudent!.student_name.split(" ")[0]}
                  </>
                ) : (
                  <>
                    <MessageSquarePlus className="h-4 w-4 text-accent-500" />
                    Give {currentStudent!.student_name.split(" ")[0]} a title
                  </>
                )}
              </div>

              <div className="mt-3 flex gap-3">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => { setTitleInput(e.target.value); setFeedback(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSaveTitle(); }}
                  placeholder="e.g. Most Creative Mind, Class Entertainer..."
                  maxLength={60}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent-500/30 focus:ring-2 focus:ring-accent-500/10"
                />
                <Button onClick={() => void handleSaveTitle()} disabled={saving}>
                  {saving ? "..." : myTitleForCurrent ? (
                    <><Check className="mr-1 h-4 w-4" />Update</>
                  ) : (
                    <><Send className="mr-1 h-4 w-4" />Save</>
                  )}
                </Button>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-400">{titleInput.length}/60 characters</p>
                {feedback && (
                  <p className={`text-xs font-semibold ${feedback.includes("✓") ? "text-emerald-600" : "text-rose-600"}`}>
                    {feedback}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={goPrev} disabled={currentIndex === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" />Previous
            </Button>
            <Button variant="secondary" onClick={goNext} disabled={currentIndex === students.length - 1}>
              Next<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Right: Titles received */}
        <div className="section-shell overflow-hidden p-0 lg:sticky lg:top-6">
          <div className="border-b border-slate-200 px-6 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Titles received</h3>
                <p className="text-sm text-slate-500">
                  {receivedTitles.length} title{receivedTitles.length !== 1 ? "s" : ""} given to{" "}
                  {currentStudent!.student_name.split(" ")[0]}
                </p>
              </div>
            </div>
          </div>

          {receivedTitles.length === 0 ? (
            <div className="p-6 sm:p-8">
              <EmptyState title="No titles yet" description="Be the first to give this classmate a title!" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[calc(100vh-220px)] overflow-y-auto">
              {receivedTitles.map((title) => {
                const giver = studentLookup.get(title.giver_id);
                const isMyTitle = title.giver_id === currentUser.id;
                return (
                  <div
                    key={title.id}
                    className={`flex items-start gap-3 px-6 py-3.5 sm:px-8 transition ${isMyTitle ? "bg-accent-50/30" : ""}`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isMyTitle ? "bg-gradient-to-br from-accent-500 to-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {giver?.student_name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">&ldquo;{title.title_text}&rdquo;</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        — {giver?.student_name ?? "Unknown"} ({giver?.roll_number ?? ""})
                        {isMyTitle && (
                          <span className="ml-2 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-500">You</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ProfileBrowserPage;