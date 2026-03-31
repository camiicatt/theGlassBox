const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

async function fetchAll<T>(table: string): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=id.asc`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TABLES = ["session", "run", "player", "ai", "dungeon", "action", "leaderboard"] as const;

export async function exportTableCSV(table: typeof TABLES[number]) {
  const rows = await fetchAll<Record<string, unknown>>(table);
  const csv = toCSV(rows);
  if (!csv) { alert(`No data in table: ${table}`); return; }
  const date = new Date().toISOString().slice(0, 10);
  downloadCSV(csv, `${table}_${date}.csv`);
}

export async function exportAllCSV() {
  const date = new Date().toISOString().slice(0, 10);
  const results = await Promise.all(
    TABLES.map(async (table) => {
      const rows = await fetchAll<Record<string, unknown>>(table);
      return { name: `${table}_${date}.csv`, content: toCSV(rows) };
    })
  );
  const files = results.filter((f) => f.content);
  if (!files.length) return;

  if ("showDirectoryPicker" in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dirHandle = await (window as any).showDirectoryPicker({ startIn: "downloads", mode: "readwrite" });
    for (const { name, content } of files) {
      const fileHandle = await dirHandle.getFileHandle(name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    }
  } else {
    for (const { name, content } of files) {
      downloadCSV(content, name);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}
