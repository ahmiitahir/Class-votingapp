import type { Student } from "../types";

const SESSION_KEY = "farewell_student";

export function getLoggedInStudent(): Student | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Student;
    if (parsed.id && parsed.roll_number && parsed.student_name) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setLoggedInStudent(student: Student) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(student));
}

export function clearLoggedInStudent() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function isStudentAuthenticated(): boolean {
  return getLoggedInStudent() !== null;
}
