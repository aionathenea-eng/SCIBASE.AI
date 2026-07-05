import express from "express";
import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || join(__dirname, "data.db");

// --- Database ---
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    channel  TEXT NOT NULL DEFAULT 'Outro',
    date     TEXT,
    status   TEXT NOT NULL DEFAULT 'pending',
    value    REAL NOT NULL DEFAULT 0,
    notes    TEXT DEFAULT '',
    created  INTEGER NOT NULL
  );
`);

const VALID_STATUS = new Set(["pending", "won", "lost"]);

function sanitize(body, { partial = false } = {}) {
  const out = {};
  if (!partial || "name" in body) {
    out.name = String(body.name ?? "").trim();
    if (!out.name) throw new Error("O nome/empresa é obrigatório.");
  }
  if (!partial || "channel" in body) out.channel = String(body.channel ?? "Outro").trim() || "Outro";
  if (!partial || "date" in body) out.date = String(body.date ?? "").trim();
  if (!partial || "status" in body) {
    out.status = String(body.status ?? "pending");
    if (!VALID_STATUS.has(out.status)) throw new Error("Estado inválido.");
  }
  if (!partial || "value" in body) out.value = Number(body.value) || 0;
  if (!partial || "notes" in body) out.notes = String(body.notes ?? "").trim();
  return out;
}

// --- App ---
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(join(__dirname, "public")));

const listStmt = db.prepare("SELECT id, name, channel, date, status, value, notes FROM contacts ORDER BY created DESC");
const getStmt = db.prepare("SELECT id, name, channel, date, status, value, notes FROM contacts WHERE id = ?");

app.get("/api/contacts", (req, res) => {
  res.json(listStmt.all());
});

app.post("/api/contacts", (req, res) => {
  try {
    const c = sanitize(req.body);
    const id = randomUUID();
    db.prepare(
      "INSERT INTO contacts (id, name, channel, date, status, value, notes, created) VALUES (?,?,?,?,?,?,?,?)"
    ).run(id, c.name, c.channel, c.date, c.status, c.value, c.notes, Date.now());
    res.status(201).json(getStmt.get(id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/api/contacts/:id", (req, res) => {
  try {
    const existing = getStmt.get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Contacto não encontrado." });
    const c = sanitize(req.body, { partial: true });
    const merged = { ...existing, ...c };
    db.prepare(
      "UPDATE contacts SET name=?, channel=?, date=?, status=?, value=?, notes=? WHERE id=?"
    ).run(merged.name, merged.channel, merged.date, merged.status, merged.value, merged.notes, req.params.id);
    res.json(getStmt.get(req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/contacts/:id", (req, res) => {
  const info = db.prepare("DELETE FROM contacts WHERE id = ?").run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Contacto não encontrado." });
  res.status(204).end();
});

// Bulk import (used by the "Importar" button)
app.post("/api/contacts/import", (req, res) => {
  const arr = Array.isArray(req.body) ? req.body : [];
  const insert = db.prepare(
    "INSERT INTO contacts (id, name, channel, date, status, value, notes, created) VALUES (?,?,?,?,?,?,?,?)"
  );
  let n = 0;
  const tx = db.transaction((rows) => {
    for (const row of rows) {
      try {
        const c = sanitize(row);
        insert.run(randomUUID(), c.name, c.channel, c.date, c.status, c.value, c.notes, Date.now());
        n++;
      } catch { /* skip invalid rows */ }
    }
  });
  tx(arr);
  res.json({ imported: n });
});

app.listen(PORT, () => {
  console.log(`Captação de Clientes a correr em http://localhost:${PORT}`);
});
