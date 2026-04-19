import { useEffect, useState } from "react";
import { STUDENTS, TITLES } from "../data/constants";
import { supabase } from "../lib/supabase";
import type { Student, Title } from "../types";

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

export function useVotingData() {
  const [students, setStudents] = useState<Student[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const [studentsResponse, titlesResponse] = await Promise.all([
        supabase.from("students").select("id, roll_number, student_name").order("roll_number"),
        supabase
          .from("titles")
          .select("id, title_name, display_order, title_type")
          .order("display_order"),
      ]);

      console.log("students response", studentsResponse.data, studentsResponse.error);

      if (studentsResponse.error || titlesResponse.error) {
        setError("Live data could not be loaded, so local placeholder data is being used.");
        setStudents(
          STUDENTS.map((student, index) => ({
            id: `fallback-student-${index + 1}`,
            roll_number: student.roll_number,
            student_name: student.name,
          })),
        );
        setTitles(
          TITLES.map((title, index) => ({
            id: `fallback-title-${index + 1}`,
            title_name: title.title_name,
            display_order: title.display_order ?? index + 1,
            title_type: title.title_type,
          })),
        );
        setLoading(false);
        return;
      }

      setStudents(
        (studentsResponse.data ?? [])
          .map((row) => mapStudentRow(row as Record<string, unknown>))
          .filter((student): student is Student => student !== null),
      );
      setTitles((titlesResponse.data ?? []) as Title[]);
      setLoading(false);
    }

    void load();
  }, []);

  return { students, titles, loading, error };
}
