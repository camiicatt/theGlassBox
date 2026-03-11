type StudentStartPayload = {
  studentId: string;
  firstName: string;
  lastInitial: string;
  startedAt: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const STARTS_TABLE = import.meta.env.VITE_SUPABASE_STARTS_TABLE || "student_starts";

export async function logStudentStart(payload: StudentStartPayload) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("Supabase is not configured. Missing URL or anon key.");
    return false;
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/${STARTS_TABLE}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify([
        {
          student_id: payload.studentId,
          first_name: payload.firstName,
          last_initial: payload.lastInitial,
          started_at: payload.startedAt,
        },
      ]),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("Supabase student start log failed:", res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase student start log error:", err);
    return false;
  }
}
