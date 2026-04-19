import { KeyRound, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import AdminConfirmModal from "../components/AdminConfirmModal";
import Button from "../components/Button";
import { supabase } from "../lib/supabase";
import type { Student, VoterCredential } from "../types";
import { buildCredentialUpserts } from "../utils/credentials";

type UtilityAction = "reset-submissions" | "reset-password-usage" | "regenerate-passwords" | null;

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

function AdminUtilitiesPage() {
  const [pendingAction, setPendingAction] = useState<UtilityAction>(null);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction() {
    if (!pendingAction) {
      return;
    }

    setWorking(true);
    setFeedback(null);
    setError(null);

    if (pendingAction === "reset-submissions") {
      const response = await supabase
        .from("submissions")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (response.error) {
        setError(response.error.message);
      } else {
        setFeedback("All submissions and linked votes were reset.");
      }
    }

    if (pendingAction === "reset-password-usage") {
      const response = await supabase
        .from("voter_credentials")
        .update({ is_used: false, used_at: null })
        .eq("is_used", true);

      if (response.error) {
        setError(response.error.message);
      } else {
        setFeedback("All used-password markers were reset.");
      }
    }

    if (pendingAction === "regenerate-passwords") {
      const [studentsResponse, credentialsResponse] = await Promise.all([
        supabase.from("students").select("id, roll_number, student_name").order("roll_number"),
        supabase
          .from("voter_credentials")
          .select("id, roll_number, student_name, voter_password, is_used, used_at")
          .order("roll_number"),
      ]);

      console.log("students response", studentsResponse.data, studentsResponse.error);
      console.log("credentials response", credentialsResponse.data, credentialsResponse.error);

      if (studentsResponse.error || credentialsResponse.error) {
        setError("Students or credentials could not be loaded.");
      } else {
        const upserts = buildCredentialUpserts(
          (studentsResponse.data ?? [])
            .map((row) => mapStudentRow(row as Record<string, unknown>))
            .filter((student): student is Student => student !== null),
          (credentialsResponse.data ?? []) as VoterCredential[],
          true,
        );

        const response = await supabase
          .from("voter_credentials")
          .upsert(upserts, { onConflict: "roll_number" });

        if (response.error) {
          setError(response.error.message);
        } else {
          setFeedback("Passwords were regenerated for all current students and marked unused.");
        }
      }
    }

    setPendingAction(null);
    setWorking(false);
  }

  const actionCopy = {
    "reset-submissions": {
      title: "Reset all submissions?",
      description:
        "This clears every voter submission and all linked title selections. Use this when you want to reopen voting from a clean slate.",
      confirmLabel: "Reset submissions",
      tone: "danger" as const,
    },
    "reset-password-usage": {
      title: "Reset all used passwords?",
      description:
        "This keeps the same stored passwords but marks every credential as unused so students can vote again.",
      confirmLabel: "Reset used passwords",
      tone: "default" as const,
    },
    "regenerate-passwords": {
      title: "Regenerate all passwords?",
      description:
        "This creates new passwords for every current student and marks them all as unused. Use Export CSV again after this so the latest passwords are sent.",
      confirmLabel: "Regenerate passwords",
      tone: "danger" as const,
    },
  };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="section-shell p-6 sm:p-8">
          <Trash2 className="h-8 w-8 text-rose-600" />
          <h3 className="mt-5 text-xl font-semibold text-slate-950">Reset all submissions</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Deletes the submission records and cascades the linked votes so the event can start over.
          </p>
          <Button className="mt-6" variant="danger" onClick={() => setPendingAction("reset-submissions")}>
            Reset submissions
          </Button>
        </div>

        <div className="section-shell p-6 sm:p-8">
          <RotateCcw className="h-8 w-8 text-amber-600" />
          <h3 className="mt-5 text-xl font-semibold text-slate-950">Reset used passwords</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Keeps existing passwords but clears the one-time-use markers so students can vote again.
          </p>
          <Button className="mt-6" variant="secondary" onClick={() => setPendingAction("reset-password-usage")}>
            Reset used passwords
          </Button>
        </div>

        <div className="section-shell p-6 sm:p-8">
          <KeyRound className="h-8 w-8 text-slate-900" />
          <h3 className="mt-5 text-xl font-semibold text-slate-950">Regenerate passwords</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Issues new passwords for every current student and resets usage tracking in one action.
          </p>
          <Button className="mt-6" onClick={() => setPendingAction("regenerate-passwords")}>
            Regenerate passwords
          </Button>
        </div>
      </div>

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

      <AdminConfirmModal
        open={Boolean(pendingAction)}
        title={pendingAction ? actionCopy[pendingAction].title : ""}
        description={pendingAction ? actionCopy[pendingAction].description : ""}
        confirmLabel={pendingAction ? actionCopy[pendingAction].confirmLabel : "Confirm"}
        tone={pendingAction ? actionCopy[pendingAction].tone : "default"}
        busy={working}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void runAction()}
      />
    </>
  );
}

export default AdminUtilitiesPage;
