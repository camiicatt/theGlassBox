import { trackInsert, trackPatch } from "./fileBackup";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// ── Shared helpers ────────────────────────────────────────────────────────────

function configured(): boolean {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    return false;
  }
  return true;
}

function baseHeaders(prefer: "return=minimal" | "return=representation") {
  return {
    apikey: SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${SUPABASE_ANON_KEY!}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
}

/** INSERT a row and return nothing. Returns true on success. */
async function insert(table: string, row: object): Promise<boolean> {
  if (!configured()) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: baseHeaders("return=minimal"),
      body: JSON.stringify([row]),
    });
    if (!res.ok) {
      console.warn(`[supabase] INSERT ${table} failed:`, res.status, await res.text());
      return false;
    }
    trackInsert(table, row as Record<string, unknown>);
    return true;
  } catch (err) {
    console.warn(`[supabase] INSERT ${table} error:`, err);
    return false;
  }
}

/** INSERT a row and return its generated id, or null on failure. */
async function insertReturningId(table: string, row: object): Promise<number | null> {
  if (!configured()) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: baseHeaders("return=representation"),
      body: JSON.stringify([row]),
    });
    if (!res.ok) {
      console.warn(`[supabase] INSERT ${table} (returning) failed:`, res.status, await res.text());
      return null;
    }
    const rows = (await res.json()) as { id: number }[];
    const id = rows[0]?.id ?? null;
    if (id !== null) trackInsert(table, row as Record<string, unknown>, id);
    return id;
  } catch (err) {
    console.warn(`[supabase] INSERT ${table} (returning) error:`, err);
    return null;
  }
}

/** PATCH (partial update) a row by id. Returns true on success. */
async function patch(table: string, id: number, updates: object): Promise<boolean> {
  if (!configured()) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: baseHeaders("return=minimal"),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      console.warn(`[supabase] PATCH ${table} failed:`, res.status, await res.text());
      return false;
    }
    trackPatch(table, id, updates as Record<string, unknown>);
    return true;
  } catch (err) {
    console.warn(`[supabase] PATCH ${table} error:`, err);
    return false;
  }
}

/** GET rows with a filter string, e.g. "session_id=eq.5&select=id,score" */
async function fetchRows<T>(table: string, filter: string): Promise<T[]> {
  if (!configured()) return [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${filter}&order=created_at.asc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${SUPABASE_ANON_KEY!}`,
        },
      }
    );
    if (!res.ok) {
      console.warn(`[supabase] GET ${table} failed:`, res.status, await res.text());
      return [];
    }
    return res.json();
  } catch (err) {
    console.warn(`[supabase] GET ${table} error:`, err);
    return [];
  }
}

// ── session ───────────────────────────────────────────────────────────────────

/**
 * Creates a session row with the student's name.
 * Called once when the student hits Start on the name page.
 */
export async function createSession(
  firstName: string,
  lastInitial: string
): Promise<number | null> {
  return insertReturningId("session", {
    first_name: firstName,
    last_initial: lastInitial,
    session_started: Date.now(),
    high_score: 0,
    num_runs: 0,
    session_ended: null,
    session_len: 0,
  });
}

/**
 * Marks a session as ended and records its duration + final stats.
 * `startedAt` – the Date.now() captured when createSession was called.
 */
export async function closeSession(
  sessionId: number,
  startedAt: number,
  highScore: number,
  numRuns: number
): Promise<boolean> {
  return patch("session", sessionId, {
    session_ended: Date.now(),
    session_len: Math.round((Date.now() - startedAt) / 1000),
    high_score: highScore,
    num_runs: numRuns,
  });
}

/** Fetches completed sessions (for leaderboard/review). */
export async function fetchSessions(): Promise<
  { id: number; first_name: string; last_initial: string; high_score: number; num_runs: number }[]
> {
  return fetchRows(
    "session",
    "session_ended=not.is.null&select=id,first_name,last_initial,high_score,num_runs"
  );
}

// ── run ───────────────────────────────────────────────────────────────────────

/**
 * Creates a run row linked to a session.
 * Called at the start of each training+AI round pair.
 */
export async function createRun(sessionId: number): Promise<number | null> {
  return insertReturningId("run", {
    session_id: sessionId,
    run_started: Date.now(),
    run_ended: null,
    run_len: 0,
    total_actions: 0,
    total_dungeons: 0,
    total_score: 0,
    total_fight: 0,
    total_hide: 0,
    total_heal: 0,
    total_run: 0,
  });
}

/**
 * Closes a run with aggregated stats.
 * `startedAt` – the Date.now() captured when createRun was called.
 */
export async function closeRun(
  runId: number,
  startedAt: number,
  stats: {
    totalActions: number;
    totalDungeons: number;
    totalScore: number;
    totalFight: number;
    totalHide: number;
    totalHeal: number;
    totalRun: number;
  }
): Promise<boolean> {
  return patch("run", runId, {
    run_ended: Date.now(),
    run_len: Math.round((Date.now() - startedAt) / 1000),
    total_actions: stats.totalActions,
    total_dungeons: stats.totalDungeons,
    total_score: stats.totalScore,
    total_fight: stats.totalFight,
    total_hide: stats.totalHide,
    total_heal: stats.totalHeal,
    total_run: stats.totalRun,
  });
}

/** Fetches all runs for a session. */
export async function fetchRuns(
  sessionId: number
): Promise<{ id: number; total_score: number; total_dungeons: number; run_len: number }[]> {
  return fetchRows(
    "run",
    `session_id=eq.${sessionId}&select=id,total_score,total_dungeons,run_len`
  );
}

// ── player (player stats per run) ─────────────────────────────────────────────

export type RunStats = {
  numActions: number;
  numDungeons: number;
  numFight: number;
  numHide: number;
  numHeal: number;
  numRun: number;
};

/**
 * Creates a player stats row (all zeros) at the start of the TRAINING phase.
 * Returns the new player id so dungeons can link to it immediately.
 */
export async function createPlayerStats(runId: number): Promise<number | null> {
  return insertReturningId("player", {
    run_id: runId,
    num_actions: 0,
    num_dungeons: 0,
    num_fight: 0,
    num_hide: 0,
    num_heal: 0,
    num_run: 0,
  });
}

/** Patches the player stats row with final training-phase counts. Called on AI death. */
export async function updatePlayerStats(
  playerId: number,
  stats: RunStats
): Promise<boolean> {
  return patch("player", playerId, {
    num_actions: stats.numActions,
    num_dungeons: stats.numDungeons,
    num_fight: stats.numFight,
    num_hide: stats.numHide,
    num_heal: stats.numHeal,
    num_run: stats.numRun,
  });
}

// ── ai (AI stats per run) ─────────────────────────────────────────────────────

/**
 * Creates an AI stats row (all zeros) at the start of the AI_RUN phase.
 * Returns the new ai id so dungeons can link to it immediately.
 */
export async function createAiStats(runId: number): Promise<number | null> {
  return insertReturningId("ai", {
    run_id: runId,
    num_actions: 0,
    num_dungeons: 0,
    num_fight: 0,
    num_hide: 0,
    num_heal: 0,
    num_run: 0,
  });
}

/** Patches the AI stats row with final AI-run-phase counts. Called on AI death. */
export async function updateAiStats(
  aiId: number,
  stats: RunStats
): Promise<boolean> {
  return patch("ai", aiId, {
    num_actions: stats.numActions,
    num_dungeons: stats.numDungeons,
    num_fight: stats.numFight,
    num_hide: stats.numHide,
    num_heal: stats.numHeal,
    num_run: stats.numRun,
  });
}

// ── dungeon ───────────────────────────────────────────────────────────────────

/**
 * Creates a dungeon row.
 * Pass `playerId` for a training dungeon, `aiId` for an AI run dungeon.
 */
export async function createDungeon(opts: {
  playerId?: number;
  aiId?: number;
  num: number;
}): Promise<number | null> {
  return insertReturningId("dungeon", {
    player_id: opts.playerId ?? null,
    ai_id: opts.aiId ?? null,
    num: opts.num,
    num_fight: 0,
    num_hide: 0,
    num_run: 0,
    num_heal: 0,
  });
}

/** Updates the dungeon row with final battle action counts. */
export async function updateDungeon(
  dungeonId: number,
  stats: { numFight: number; numHide: number; numHeal: number; numRun: number }
): Promise<boolean> {
  return patch("dungeon", dungeonId, {
    num_fight: stats.numFight,
    num_hide: stats.numHide,
    num_heal: stats.numHeal,
    num_run: stats.numRun,
  });
}

/** Fetches all dungeons for a player stats row. */
export async function fetchDungeonsByPlayer(
  playerId: number
): Promise<{ id: number; num_fight: number; num_hide: number; num_heal: number; num_run: number }[]> {
  return fetchRows(
    "dungeon",
    `player_id=eq.${playerId}&select=id,num_fight,num_hide,num_heal,num_run`
  );
}

/** Fetches all dungeons for an AI stats row. */
export async function fetchDungeonsByAi(
  aiId: number
): Promise<{ id: number; num_fight: number; num_hide: number; num_heal: number; num_run: number }[]> {
  return fetchRows(
    "dungeon",
    `ai_id=eq.${aiId}&select=id,num_fight,num_hide,num_heal,num_run`
  );
}

// ── action ────────────────────────────────────────────────────────────────────

/**
 * Logs a single battle action inside a dungeon.
 * Exactly one of fight/hide/heal/run should be true.
 * confidences – per-action KNN probabilities scaled 0–100 (AI mode only; omit for manual actions).
 */
export async function logAction(
  dungeonId: number,
  action: { fight?: boolean; hide?: boolean; heal?: boolean; run?: boolean },
  health: number,
  enemyHealth: number,
  num: number,
  confidences?: { fight?: number; hide?: number; heal?: number; run?: number }
): Promise<boolean> {
  return insert("action", {
    dungeon_id: dungeonId,
    health,
    enemy_health: enemyHealth,
    fight: action.fight ?? false,
    hide: action.hide ?? false,
    heal: action.heal ?? false,
    run: action.run ?? false,
    num,
    fight_confidence: confidences?.fight ?? null,
    hide_confidence: confidences?.hide ?? null,
    heal_confidence: confidences?.heal ?? null,
    run_confidence: confidences?.run ?? null,
  });
}

/** Fetches all actions for a dungeon. */
export async function fetchActions(
  dungeonId: number
): Promise<
  {
    id: number;
    fight: boolean;
    hide: boolean;
    heal: boolean;
    run: boolean;
    health: number;
    enemy_health: number;
    fight_confidence: number | null;
    hide_confidence: number | null;
    heal_confidence: number | null;
    run_confidence: number | null;
  }[]
> {
  return fetchRows(
    "action",
    `dungeon_id=eq.${dungeonId}&select=id,fight,hide,heal,run,health,enemy_health,fight_confidence,hide_confidence,heal_confidence,run_confidence`
  );
}

// ── leaderboard ───────────────────────────────────────────────────────────────

/**
 * Adds an entry to the leaderboard.
 * `playerName` – display name (e.g. "Kathy-K").
 * `score`      – number of dungeons the AI cleared in the session.
 */
export async function logLeaderboard(playerName: string, score: number): Promise<boolean> {
  return insert("leaderboard", { player_name: playerName, score });
}

/** Fetches the leaderboard ordered by score descending. */
export async function fetchLeaderboard(): Promise<
  { id: number; player_name: string; score: number }[]
> {
  if (!configured()) return [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/leaderboard?select=id,player_name,score&order=score.desc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${SUPABASE_ANON_KEY!}`,
        },
      }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
