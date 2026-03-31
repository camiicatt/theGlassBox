type Row = Record<string, unknown>;

// ── In-memory store ───────────────────────────────────────────────────────────

const store = new Map<string, Map<string | number, Row>>();
let tempKey = 0;

function getTable(table: string): Map<string | number, Row> {
  if (!store.has(table)) store.set(table, new Map());
  return store.get(table)!;
}

export function trackInsert(table: string, row: Row, id?: number) {
  const key = id ?? `_tmp${tempKey++}`;
  getTable(table).set(key, id !== undefined ? { id, ...row } : row);
}

export function trackPatch(table: string, id: number, updates: Row) {
  const tbl = getTable(table);
  tbl.set(id, { ...(tbl.get(id) ?? {}), ...updates });
}

// ── CSV builder ───────────────────────────────────────────────────────────────

function toCSV(rows: Row[]): string {
  if (rows.length === 0) return "";
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

// ── Download helpers ──────────────────────────────────────────────────────────

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function saveToFolder(files: { name: string; content: string }[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dirHandle = await (window as any).showDirectoryPicker({ startIn: "downloads", mode: "readwrite" });
  for (const { name, content } of files) {
    const fileHandle = await dirHandle.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Called at session end (Switch Student / Next Student).
 * If the browser supports the File System Access API, prompts the user to pick
 * a folder and writes all CSVs there in one go. Falls back to staggered
 * individual downloads otherwise.
 */
export async function downloadStudentBackup(studentId: string) {
  const date = new Date().toISOString().slice(0, 10);
  const tables = [...store.entries()].filter(([, tbl]) => tbl.size > 0);

  const files = tables
    .map(([table, tbl]) => ({ name: `${studentId}_${table}_${date}.csv`, content: toCSV([...tbl.values()]) }))
    .filter((f) => f.content);

  store.clear();

  if (!files.length) return;

  if ("showDirectoryPicker" in window) {
    await saveToFolder(files);
  } else {
    for (const { name, content } of files) {
      triggerDownload(content, name);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}
