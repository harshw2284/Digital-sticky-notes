const express = require("express");
const { Pool } = require("pg");

const PORT = process.env.PORT || 5000;

// All DB settings come from environment variables (set by Compose / Kubernetes)
const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.DB_USER || "notes_user",
  password: process.env.DB_PASSWORD || "notes_pass",
  database: process.env.DB_NAME || "notesdb",
});

const app = express();
app.use(express.json());

// ---------- Business rules / validation ----------
const MAX_TITLE = 100;
const MAX_CONTENT = 1000;

function validateNote(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!title) return { error: "Title cannot be empty." };
  if (!content) return { error: "Note content cannot be empty." };
  if (title.length > MAX_TITLE) return { error: `Title must be ${MAX_TITLE} characters or fewer.` };
  if (content.length > MAX_CONTENT) return { error: `Note must be ${MAX_CONTENT} characters or fewer.` };
  return { title, content };
}

function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid note id." });
    return null;
  }
  return id;
}

// ---------- Routes ----------
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    res.status(503).json({ status: "database unavailable" });
  }
});

app.get("/api/notes", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, content, created_at FROM notes ORDER BY created_at DESC, id DESC"
    );
    res.json(rows);
  } catch (err) { next(err); }
});

app.post("/api/notes", async (req, res, next) => {
  const v = validateNote(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  try {
    const { rows } = await pool.query(
      "INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING id, title, content, created_at",
      [v.title, v.content]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

app.put("/api/notes/:id", async (req, res, next) => {
  const id = parseId(req, res);
  if (id === null) return;
  const v = validateNote(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  try {
    const { rows } = await pool.query(
      "UPDATE notes SET title = $1, content = $2 WHERE id = $3 RETURNING id, title, content, created_at",
      [v.title, v.content, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Note not found." });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

app.delete("/api/notes/:id", async (req, res, next) => {
  const id = parseId(req, res);
  if (id === null) return;
  try {
    const result = await pool.query("DELETE FROM notes WHERE id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Note not found." });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ---------- Error handling ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

// ---------- Start: wait for DB, create table, then listen ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function initDb(retries = 30) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notes (
          id         SERIAL PRIMARY KEY,
          title      VARCHAR(100) NOT NULL,
          content    TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
      console.log("Database ready.");
      return;
    } catch (err) {
      console.log(`Waiting for database (${i}/${retries}): ${err.message}`);
      await sleep(2000);
    }
  }
  throw new Error("Could not connect to the database.");
}

initDb()
  .then(() => app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`)))
  .catch((err) => { console.error(err); process.exit(1); });
