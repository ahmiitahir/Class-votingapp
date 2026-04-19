import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import type { ParseError, ParseResult } from "papaparse";
import AdminConfirmModal from "../components/AdminConfirmModal";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import TextField from "../components/TextField";
import { supabase } from "../lib/supabase";
import type { Student } from "../types";
import { parseStudentsCsvRecords, type ParsedStudentCsvRow } from "../utils/studentsCsv";

type StudentFormState = {
  roll_number: string;
  student_name: string;
};

const initialForm: StudentFormState = {
  roll_number: "",
  student_name: "",
};

function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentFormState>(initialForm);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [csvPreviewRows, setCsvPreviewRows] = useState<ParsedStudentCsvRow[]>([]);
  const [csvParseSummary, setCsvParseSummary] = useState<{
    duplicateCount: number;
    invalidRowCount: number;
    skippedEmptyRowCount: number;
    detectedHeaders: string[];
    normalizedHeaders: string[];
    invalidRowReasons: string[];
  } | null>(null);
  const [importSummary, setImportSummary] = useState<{
    importedCount: number;
    skippedCount: number;
    duplicateCount: number;
    invalidRowCount: number;
  } | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function mapStudentRow(row: Record<string, unknown>): Student | null {
    const id = typeof row.id === "string" ? row.id : "";
    const rollNumber = typeof row.roll_number === "string" ? row.roll_number : "";
    const studentName =
      typeof row.name === "string"
        ? row.name
        : typeof row.student_name === "string"
          ? row.student_name
          : "";

    if (!id || !rollNumber || !studentName) {
      return null;
    }

    return {
      id,
      roll_number: rollNumber,
      student_name: studentName,
    };
  }

  async function loadStudents() {
    setLoading(true);
    const response = await supabase
      .from("students")
      .select("id, roll_number, student_name")
      .order("roll_number");

    console.log("students response", response.data, response.error);

    console.log("[AdminStudentsPage] students fetch response", {
      data: response.data,
      error: response.error,
      status: response.status,
      statusText: response.statusText,
    });

    if (response.error) {
      console.error("[AdminStudentsPage] students fetch failed", response.error);
      setError("Students could not be loaded right now.");
    } else {
      const mappedStudents = (response.data ?? [])
        .map((row) => mapStudentRow(row as Record<string, unknown>))
        .filter((student): student is Student => student !== null);

      console.log("[AdminStudentsPage] normalized students rows", mappedStudents);
      setStudents(mappedStudents);
      setError(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadStudents();
  }, []);

  function resetForm() {
    setEditingStudent(null);
    setForm(initialForm);
  }

  function resetCsvPreview() {
    setCsvPreviewRows([]);
    setCsvParseSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function startEdit(student: Student) {
    setEditingStudent(student);
    setForm({
      roll_number: student.roll_number,
      student_name: student.student_name,
    });
    setFeedback(null);
  }

  async function syncStudentReferences(previous: Student, next: StudentFormState) {
    if (previous.student_name !== next.student_name) {
      await Promise.all([
        supabase
          .from("submission_votes")
          .update({ selected_student_name: next.student_name })
          .eq("selected_student_name", previous.student_name),
        supabase
          .from("submission_votes")
          .update({ selected_student_name_2: next.student_name })
          .eq("selected_student_name_2", previous.student_name),
      ]);
    }

    await Promise.all([
      supabase
        .from("voter_credentials")
        .update({
          roll_number: next.roll_number,
          student_name: next.student_name,
        })
        .eq("roll_number", previous.roll_number),
      supabase
        .from("submissions")
        .update({
          roll_number: next.roll_number,
          student_name: next.student_name,
        })
        .eq("roll_number", previous.roll_number),
    ]);
  }

  async function applyStudentUpsert(previous: Student | null, next: StudentFormState) {
    const studentPayload = {
      roll_number: next.roll_number,
      student_name: next.student_name,
    };

    const response = previous
      ? await supabase.from("students").update(studentPayload).eq("id", previous.id)
      : await supabase.from("students").insert(studentPayload);

    if (response.error) {
      throw new Error(response.error.message);
    }

    if (previous) {
      await syncStudentReferences(previous, next);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      roll_number: form.roll_number.trim().toLowerCase(),
      student_name: form.student_name.trim(),
    };

    if (!payload.roll_number || !payload.student_name) {
      setError("Roll number and student name are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      await applyStudentUpsert(editingStudent, payload);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Student save failed.");
      setSaving(false);
      return;
    }

    setFeedback(editingStudent ? "Student updated." : "Student added.");
    setImportSummary(null);
    resetForm();
    await loadStudents();
    setSaving(false);
  }

  function handleChooseCsv() {
    fileInputRef.current?.click();
  }

  function handleCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);
    setFeedback(null);
    setImportSummary(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      encoding: "utf-8",
      delimitersToGuess: [",", ";", "\t", "|"],
      complete: (result: ParseResult<Record<string, string>>) => {
        console.log("[AdminStudentsPage] raw parsed CSV rows", result.data);
        console.log("[AdminStudentsPage] Papa Parse errors", result.errors);

        const fatalErrors = result.errors.filter((parserError: ParseError) => {
          const code = parserError.code ?? "";
          return code === "UndetectableDelimiter" || code === "MissingQuotes" || code === "InvalidQuotes";
        });

        if (fatalErrors.length > 0 && (result.data?.length ?? 0) === 0) {
          console.error("[AdminStudentsPage] fatal CSV parse errors", fatalErrors);
          setError(
            `The CSV could not be read properly: ${fatalErrors[0]?.message ?? "unknown parser error"}.`,
          );
          setCsvPreviewRows([]);
          setCsvParseSummary(null);
          return;
        }

        const parsed = parseStudentsCsvRecords(result.data ?? []);

        if ("error" in parsed) {
          console.error("[AdminStudentsPage] CSV header detection failed", {
            rawRows: result.data,
            parseErrors: result.errors,
          });
          setError(parsed.error);
          setCsvPreviewRows([]);
          setCsvParseSummary(null);
          return;
        }

        console.log("[AdminStudentsPage] detected headers", parsed.detectedHeaders);
        console.log("[AdminStudentsPage] normalized headers", parsed.normalizedHeaders);
        console.log("[AdminStudentsPage] invalid row reasons", parsed.invalidRowReasons);

        setCsvPreviewRows(parsed.parsedRows);
        setCsvParseSummary({
          duplicateCount: parsed.duplicateCount,
          invalidRowCount: parsed.invalidRowCount,
          skippedEmptyRowCount: parsed.skippedEmptyRowCount,
          detectedHeaders: parsed.detectedHeaders,
          normalizedHeaders: parsed.normalizedHeaders,
          invalidRowReasons: parsed.invalidRowReasons,
        });

        if (parsed.parsedRows.length === 0) {
          const firstReason = parsed.invalidRowReasons[0];
          setError(
            firstReason
              ? `The CSV was read, but no valid student rows were found. ${firstReason}`
              : "The CSV was read, but it does not contain any valid student rows to import.",
          );
        } else {
          const parserWarningCount = result.errors.length;
          setFeedback(
            `Parsed ${parsed.parsedRows.length} valid student rows. Invalid rows: ${parsed.invalidRowCount}. Duplicates: ${parsed.duplicateCount}.${parserWarningCount > 0 ? ` Parser warnings: ${parserWarningCount}.` : ""} Review the preview before importing.`,
          );
        }
      },
      error: (parserError) => {
        console.error("[AdminStudentsPage] CSV file read failed", parserError);
        setError(
          `The CSV file could not be read${parserError?.message ? `: ${parserError.message}` : "."}`,
        );
        setCsvPreviewRows([]);
        setCsvParseSummary(null);
      },
    });
  }

  async function handleImportStudents() {
    if (csvPreviewRows.length === 0) {
      setError("Upload a CSV with at least one valid student row before importing.");
      return;
    }

    setImportingCsv(true);
    setError(null);
    setFeedback(null);
    setImportSummary(null);

    const existingByRoll = new Map(students.map((student) => [student.roll_number, student]));
    let importedCount = 0;
    let skippedCount = 0;

    try {
      for (const row of csvPreviewRows) {
        const existingStudent = existingByRoll.get(row.roll_number) ?? null;

        if (
          existingStudent &&
          existingStudent.student_name === row.student_name &&
          existingStudent.roll_number === row.roll_number
        ) {
          skippedCount += 1;
          continue;
        }

        await applyStudentUpsert(existingStudent, row);
        importedCount += 1;
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "CSV import failed.");
      setImportingCsv(false);
      return;
    }

    await loadStudents();

    setImportSummary({
      importedCount,
      skippedCount,
      duplicateCount: csvParseSummary?.duplicateCount ?? 0,
      invalidRowCount: csvParseSummary?.invalidRowCount ?? 0,
    });
    setFeedback(
      "CSV import completed. Existing students with matching roll numbers were updated when the uploaded name differed.",
    );
    resetCsvPreview();
    setImportingCsv(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setSaving(true);

    const [studentDelete, credentialDelete] = await Promise.all([
      supabase.from("students").delete().eq("id", deleteTarget.id),
      supabase.from("voter_credentials").delete().eq("roll_number", deleteTarget.roll_number),
    ]);

    if (studentDelete.error || credentialDelete.error) {
      setError(studentDelete.error?.message ?? credentialDelete.error?.message ?? "Delete failed.");
    } else {
      setFeedback(`Deleted ${deleteTarget.student_name}. Existing historical votes were preserved.`);
      setDeleteTarget(null);
      await loadStudents();
    }

    setSaving(false);
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="section-shell p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">Students management</p>
          <h3 className="mt-3 text-2xl font-semibold text-slate-950">
            {editingStudent ? "Edit student" : "Add student"}
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Student records power the voter list, candidate dropdowns, export generation, and credential matching.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvFileChange}
            />
            <Button type="button" variant="secondary" onClick={handleChooseCsv}>
              <Upload className="mr-2 h-4 w-4" />
              Upload CSV
            </Button>
            {csvPreviewRows.length > 0 || csvParseSummary ? (
              <Button type="button" variant="ghost" onClick={resetCsvPreview}>
                Clear CSV
              </Button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <TextField
              label="Roll number"
              value={form.roll_number}
              onChange={(event) => setForm((current) => ({ ...current, roll_number: event.target.value }))}
              placeholder="22i-2506"
            />
            <TextField
              label="Student name"
              value={form.student_name}
              onChange={(event) =>
                setForm((current) => ({ ...current, student_name: event.target.value }))
              }
              placeholder="Hania Bashir"
            />

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {feedback ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {feedback}
              </div>
            ) : null}

            {importSummary ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Import summary</p>
                <p className="mt-2">Imported: {importSummary.importedCount}</p>
                <p>Skipped: {importSummary.skippedCount}</p>
                <p>Duplicates in CSV: {importSummary.duplicateCount}</p>
                <p>Invalid rows: {importSummary.invalidRowCount}</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={saving}>
                <Plus className="mr-2 h-4 w-4" />
                {editingStudent ? "Save changes" : "Add student"}
              </Button>
              {editingStudent ? (
                <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="section-shell overflow-hidden p-0">
            <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-950">CSV preview</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Review parsed rows before importing. Extra columns are ignored.
                  </p>
                </div>
                {csvParseSummary ? (
                  <p className="text-sm text-slate-500">
                    Valid: {csvPreviewRows.length} · Duplicates: {csvParseSummary.duplicateCount} · Invalid:{" "}
                    {csvParseSummary.invalidRowCount}
                  </p>
                ) : null}
              </div>
            </div>

            {csvPreviewRows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No CSV preview yet"
                  description="Upload a CSV with roll number and student name columns to preview the parsed student list."
                />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50/80 text-left text-slate-500">
                      <tr>
                        <th className="px-6 py-4 font-medium sm:px-8">Roll number</th>
                        <th className="px-6 py-4 font-medium">Student name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {csvPreviewRows.map((student) => (
                        <tr key={student.roll_number}>
                          <td className="px-6 py-4 font-medium text-slate-900 sm:px-8">
                            {student.roll_number}
                          </td>
                          <td className="px-6 py-4 text-slate-700">{student.student_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-slate-200 px-6 py-5 sm:px-8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-600">
                      Existing students with the same roll number will be updated if the uploaded name changed.
                    </p>
                    <Button type="button" onClick={() => void handleImportStudents()} disabled={importingCsv}>
                      <Upload className="mr-2 h-4 w-4" />
                      {importingCsv ? "Importing..." : "Import Students"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="section-shell overflow-hidden p-0">
            <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
              <h3 className="text-2xl font-semibold text-slate-950">All students</h3>
              <p className="mt-2 text-sm text-slate-600">{students.length} active students</p>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-slate-500">Loading students...</div>
            ) : students.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No students yet"
                  description="Add students here so they appear in voting and export flows."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50/80 text-left text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-medium sm:px-8">Roll number</th>
                      <th className="px-6 py-4 font-medium">Student name</th>
                      <th className="px-6 py-4 font-medium text-right sm:px-8">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {students.map((student) => (
                      <tr key={student.id}>
                        <td className="px-6 py-4 font-medium text-slate-900 sm:px-8">{student.roll_number}</td>
                        <td className="px-6 py-4 text-slate-700">{student.student_name}</td>
                        <td className="px-6 py-4 sm:px-8">
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="secondary" onClick={() => startEdit(student)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            <Button type="button" variant="danger" onClick={() => setDeleteTarget(student)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <AdminConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete student?"
        description={
          deleteTarget
            ? `This removes ${deleteTarget.student_name} from the class list and deletes the matching voter credential record. Historical votes already cast will stay in results.`
            : ""
        }
        confirmLabel="Delete student"
        tone="danger"
        busy={saving}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

export default AdminStudentsPage;
