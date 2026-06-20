import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

/**
 * PostgreSQL接続プール。
 * パスワードに記号が含まれていても安全なよう、項目ごとに .env から読む。
 *   PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE
 */
export const pool = new Pool({
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? "5432"),
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? "postgres",
});

export type SessionStatus = "draft" | "deployed";

export interface SessionRow {
  id: number;
  project_name: string;
  target_cloud: string;
  current_jsx: string | null;
  status: SessionStatus;
  deploy_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface MessageRow {
  id: number;
  session_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: Date;
}

/** 起動時にテーブルを用意する（存在しなければ作成）。 */
export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      target_cloud TEXT NOT NULL DEFAULT 'vercel',
      current_jsx TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      deploy_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // 既存テーブル(旧 current_html 時代)にもカラムを追加
  await pool.query(
    `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_jsx TEXT;`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  console.log("DB initialized (sessions, messages)");
}

// ---- セッション操作 ----

export async function createSession(
  projectName: string,
  targetCloud: string
): Promise<SessionRow> {
  const result = await pool.query<SessionRow>(
    `INSERT INTO sessions (project_name, target_cloud) VALUES ($1, $2) RETURNING *`,
    [projectName, targetCloud]
  );
  return result.rows[0]!;
}

export async function getSession(id: number): Promise<SessionRow | null> {
  const result = await pool.query<SessionRow>(
    `SELECT * FROM sessions WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function updateSessionJsx(
  id: number,
  jsx: string
): Promise<void> {
  await pool.query(
    `UPDATE sessions SET current_jsx = $1, updated_at = now() WHERE id = $2`,
    [jsx, id]
  );
}

export async function markSessionDeployed(
  id: number,
  deployUrl: string
): Promise<void> {
  await pool.query(
    `UPDATE sessions SET status = 'deployed', deploy_url = $1, updated_at = now() WHERE id = $2`,
    [deployUrl, id]
  );
}

// ---- メッセージ操作 ----

export async function addMessage(
  sessionId: number,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await pool.query(
    `INSERT INTO messages (session_id, role, content) VALUES ($1, $2, $3)`,
    [sessionId, role, content]
  );
}

export async function getMessages(sessionId: number): Promise<MessageRow[]> {
  const result = await pool.query<MessageRow>(
    `SELECT * FROM messages WHERE session_id = $1 ORDER BY id ASC`,
    [sessionId]
  );
  return result.rows;
}

export async function deleteSession(id: number): Promise<void> {
  // messages は ON DELETE CASCADE で一緒に削除される
  await pool.query(`DELETE FROM sessions WHERE id = $1`, [id]);
}
