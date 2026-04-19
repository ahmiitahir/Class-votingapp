import { Copy, Download, KeyRound } from "lucide-react";
import { useState } from "react";
import Button from "../components/Button";
import TextField from "../components/TextField";
import { supabase } from "../lib/supabase";
import type { VoterCredential } from "../types";
import {
  buildCredentialExportRows,
  buildCredentialUpserts,
  type CredentialStudentRow,
  createCredentialsCsv,
  downloadCsv,
  normalizeEmailSuffix,
} from "../utils/credentials";

const GOOGLE_SHEETS_SCRIPT = `function sendVotingEmails() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const subject = "Your Farewell Voting Access";

  for (let i = 1; i < data.length; i++) {
    const rollNumber = data[i][0];
    const studentName = data[i][1];
    const email = data[i][2];
    const password = data[i][3];
    const sentStatus = data[i][4];

    if (!email || !password) continue;
    if (sentStatus === "YES") continue;

    const body = \`Hi \${studentName},

You have been given access to the farewell voting website.

Your details are:

Roll Number: \${rollNumber}
Password: \${password}

Voting Link:
PASTE_YOUR_WEBSITE_LINK_HERE

Important:
- You can vote only once
- Do not share your password with anyone
- Self voting is not allowed

Thank you.\`;

    GmailApp.sendEmail(email, subject, body);
    sheet.getRange(i + 1, 5).setValue("YES");
  }
}`;

function AdminExportPage() {
  const [emailSuffix, setEmailSuffix] = useState("@nu.edu.pk");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);

  function normalizeStudentRow(row: Record<string, unknown>): CredentialStudentRow | null {
    const rollNumber =
      typeof row.roll_number === "string" ? row.roll_number.trim().toLowerCase() : "";
    const studentName =
      typeof row.student_name === "string"
        ? row.student_name.trim()
        : typeof row.name === "string"
          ? row.name.trim()
          : "";

    if (!rollNumber || !studentName) {
      return null;
    }

    return {
      roll_number: rollNumber,
      student_name: studentName,
    };
  }

  async function handleExport() {
    const normalizedSuffix = normalizeEmailSuffix(emailSuffix);

    if (!normalizedSuffix) {
      setError("Enter an email suffix like @nu.edu.pk before exporting.");
      return;
    }

    setWorking(true);
    setError(null);
    setFeedback(null);

    const [studentsResponse, credentialsResponse] = await Promise.all([
      supabase.from("students").select("id, roll_number, student_name").order("roll_number"),
      supabase
        .from("voter_credentials")
        .select("id, roll_number, student_name, voter_password, is_used, used_at")
        .order("roll_number"),
    ]);

    console.log("students response", studentsResponse.data, studentsResponse.error);
    console.log("credentials response", credentialsResponse.data, credentialsResponse.error);
    console.log("[AdminExportPage] studentsResponse", studentsResponse);
    console.log("[AdminExportPage] credentialsResponse", credentialsResponse);

    if (studentsResponse.error) {
      console.error("[AdminExportPage] students fetch failed", studentsResponse.error);
      setError(`Students fetch failed: ${studentsResponse.error.message}`);
      setWorking(false);
      return;
    }

    if (credentialsResponse.error) {
      console.error("[AdminExportPage] credentials fetch failed", credentialsResponse.error);
      setError(`Credentials fetch failed: ${credentialsResponse.error.message}`);
      setWorking(false);
      return;
    }

    const normalizedStudents = (studentsResponse.data ?? [])
      .map((row) => normalizeStudentRow(row as Record<string, unknown>))
      .filter((student): student is CredentialStudentRow => student !== null);
    console.log("[AdminExportPage] normalizedStudents", normalizedStudents);

    if (normalizedStudents.length === 0) {
      setError("CSV generation failed: no valid student rows were found in the students table.");
      setWorking(false);
      return;
    }

    const credentials = (credentialsResponse.data ?? []) as VoterCredential[];
    const credentialsByRoll = new Map(credentials.map((credential) => [credential.roll_number, credential]));

    const missingCredentialRows = normalizedStudents
      .filter((student) => !credentialsByRoll.has(student.roll_number))
      .map((student) => buildCredentialUpserts([student], credentials)[0])
      .filter((credential): credential is NonNullable<typeof credential> => Boolean(credential));

    if (missingCredentialRows.length > 0) {
      const insertResponse = await supabase
        .from("voter_credentials")
        .insert(missingCredentialRows)
        .select("id, roll_number, student_name, voter_password, is_used, used_at");

      if (insertResponse.error) {
        console.error("[AdminExportPage] credential creation failed", insertResponse.error);
        setError(`Credential creation failed: ${insertResponse.error.message}`);
        setWorking(false);
        return;
      }

      credentials.push(...((insertResponse.data ?? []) as VoterCredential[]));
    }

    const csvRows = buildCredentialExportRows(normalizedStudents, credentials, normalizedSuffix);
    console.log("[AdminExportPage] generatedExportRows", csvRows);

    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`voter_credentials_${timestamp}.csv`, createCredentialsCsv(csvRows));
    } catch (csvError) {
      console.error("[AdminExportPage] CSV generation failed", csvError);
      setError(
        `CSV generation failed: ${csvError instanceof Error ? csvError.message : "Unknown error"}`,
      );
      setWorking(false);
      return;
    }

    setFeedback(`Exported ${csvRows.length} student credentials using ${normalizedSuffix}.`);
    setWorking(false);
  }

  async function handleCopyScript() {
    await navigator.clipboard.writeText(GOOGLE_SHEETS_SCRIPT);
    setScriptCopied(true);
    window.setTimeout(() => setScriptCopied(false), 2000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <div className="section-shell p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">Export CSV</p>
          <h3 className="mt-3 text-2xl font-semibold text-slate-950">Generate one email-ready CSV</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Emails are derived during export from each roll number plus the suffix you provide here.
            Passwords are generated once and reused unless you regenerate them from Utilities.
          </p>

          <div className="mt-8 space-y-4">
            <TextField
              label="Email suffix or domain"
              hint="Stored only in the downloaded CSV"
              value={emailSuffix}
              onChange={(event) => setEmailSuffix(event.target.value)}
              placeholder="@nu.edu.pk"
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

            <Button onClick={() => void handleExport()} disabled={working}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="section-shell p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">
            Email workflow
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-slate-950">
            Send passwords by email with Google Sheets
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This gives you a quick way to send each student their password and automatically mark
            `sent = YES` in the sheet after each email is sent.
          </p>

          <div className="mt-6 space-y-2 text-sm leading-6 text-slate-700">
            <p>1. Download the CSV from this page.</p>
            <p>2. Open Google Sheets.</p>
            <p>3. Import the CSV.</p>
            <p>4. Go to Extensions &gt; Apps Script.</p>
            <p>5. Replace the default script with the script shown here.</p>
            <p>6. Paste in the voting website link.</p>
            <p>7. Save and run the script.</p>
            <p>8. Approve permissions.</p>
            <p>9. The script will send emails and mark sent = YES.</p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Replace <span className="font-medium text-slate-900">PASTE_YOUR_WEBSITE_LINK_HERE</span>{" "}
              with your deployed site link before running the script.
            </p>
            <Button type="button" variant="secondary" onClick={() => void handleCopyScript()}>
              <Copy className="mr-2 h-4 w-4" />
              {scriptCopied ? "Copied" : "Copy Script"}
            </Button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200 bg-slate-950 p-4 shadow-card">
            <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-100">
              <code>{GOOGLE_SHEETS_SCRIPT}</code>
            </pre>
          </div>
        </div>
      </div>

      <div className="section-shell p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-slate-900 p-3 text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-slate-950">Export rules</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The database keeps only roll number, student name, password state, and usage tracking.
              Email addresses are composed on demand and never stored permanently.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="text-sm font-medium text-slate-900">Email generation</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Example: <span className="font-medium text-slate-900">22i-2506</span> becomes{" "}
              <span className="font-medium text-slate-900">i222506</span>, then the suffix is added.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="text-sm font-medium text-slate-900">Password behavior</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Existing voter passwords are reused. Missing passwords are generated automatically and
              saved before the CSV downloads.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminExportPage;
