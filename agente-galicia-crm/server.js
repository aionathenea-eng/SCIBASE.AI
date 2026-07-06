import express from "express";
import session from "express-session";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db } from "./db.js";
import { checkLogin, requireAuth, USERS } from "./auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8790);
const HOST = process.env.HOST || "127.0.0.1";

if (!process.env.SESSION_SECRET) {
  console.error("SESSION_SECRET não definido. Configura /etc/agente-galicia-crm/.env");
  process.exit(1);
}
if (!process.env.CRM_API_TOKEN) {
  console.error("CRM_API_TOKEN não definido. Configura /etc/agente-galicia-crm/.env");
  process.exit(1);
}

const VALID_STATUS = new Set([
  "pendiente", "enviado", "respondio", "no_interesado", "interesado", "demo_agendada", "cliente",
]);
const VALID_OWNER = new Set(USERS);
const VALID_DIRECTION = new Set(["outbound", "inbound"]);

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  name: "agc.sid",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
}));

// --- Health (público, sem dados sensíveis) ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// --- Auth ---
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (checkLogin(String(username || ""), password)) {
    req.session.user = username;
    return res.json({ username });
  }
  res.status(401).json({ error: "Credenciais inválidas." });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

app.get("/api/me", (req, res) => {
  if (req.session && req.session.user) return res.json({ username: req.session.user });
  res.status(401).json({ error: "Não autenticado." });
});

// --- Helpers ---
function sanitizeContact(body, { partial = false } = {}) {
  const out = {};
  if (!partial || "business_name" in body) {
    out.business_name = String(body.business_name ?? "").trim();
    if (!out.business_name) throw new Error("O nome do negócio é obrigatório.");
  }
  if (!partial || "sector" in body) out.sector = String(body.sector ?? "").trim();
  if (!partial || "contact_name" in body) out.contact_name = String(body.contact_name ?? "").trim();
  if (!partial || "mobile" in body) out.mobile = String(body.mobile ?? "").trim();
  if (!partial || "email" in body) out.email = String(body.email ?? "").trim();
  if (!partial || "channel" in body) out.channel = String(body.channel ?? "whatsapp").trim() || "whatsapp";
  if (!partial || "owner" in body) {
    out.owner = String(body.owner ?? "andre");
    if (!VALID_OWNER.has(out.owner)) throw new Error("Responsável inválido.");
  }
  if (!partial || "status" in body) {
    out.status = String(body.status ?? "pendiente");
    if (!VALID_STATUS.has(out.status)) throw new Error("Estado inválido.");
  }
  if (!partial || "source" in body) out.source = String(body.source ?? "").trim();
  if (!partial || "source_url" in body) out.source_url = String(body.source_url ?? "").trim();
  if (!partial || "last_message" in body) out.last_message = String(body.last_message ?? "").trim();
  if (!partial || "next_action" in body) out.next_action = String(body.next_action ?? "").trim();
  if (!partial || "next_action_at" in body) out.next_action_at = String(body.next_action_at ?? "").trim();
  if (!partial || "notes" in body) out.notes = String(body.notes ?? "").trim();
  return out;
}

function sanitizeInteraction(body) {
  const direction = String(body.direction ?? "outbound");
  if (!VALID_DIRECTION.has(direction)) throw new Error("Direção inválida.");
  return {
    direction,
    channel: String(body.channel ?? "whatsapp").trim() || "whatsapp",
    message: String(body.message ?? "").trim(),
    outcome: String(body.outcome ?? "").trim(),
  };
}

const getContactStmt = db.prepare("SELECT * FROM contacts WHERE id = ?");

// --- API de contactos (protegida: sessão OU Bearer token) ---
const api = express.Router();
api.use(requireAuth);

api.get("/contacts", (req, res) => {
  const { status, owner, channel, q } = req.query;
  const clauses = [];
  const params = {};
  if (status) { clauses.push("status = @status"); params.status = status; }
  if (owner) { clauses.push("owner = @owner"); params.owner = owner; }
  if (channel) { clauses.push("channel = @channel"); params.channel = channel; }
  if (q) {
    clauses.push("(business_name LIKE @q OR contact_name LIKE @q OR notes LIKE @q OR sector LIKE @q)");
    params.q = `%${q}%`;
  }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  const rows = db.prepare(`SELECT * FROM contacts ${where} ORDER BY updated_at DESC`).all(params);
  res.json(rows);
});

api.get("/contacts/:id", (req, res) => {
  const row = getContactStmt.get(req.params.id);
  if (!row) return res.status(404).json({ error: "Contacto não encontrado." });
  res.json(row);
});

api.post("/contacts", (req, res) => {
  try {
    const c = sanitizeContact(req.body);
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO contacts
        (id, business_name, sector, contact_name, mobile, email, channel, owner, status,
         source, source_url, last_message, next_action, next_action_at, notes, created_at, updated_at)
      VALUES
        (@id, @business_name, @sector, @contact_name, @mobile, @email, @channel, @owner, @status,
         @source, @source_url, @last_message, @next_action, @next_action_at, @notes, @created_at, @updated_at)
    `).run({ id, ...c, created_at: now, updated_at: now });
    res.status(201).json(getContactStmt.get(id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

api.patch("/contacts/:id", (req, res) => {
  try {
    const existing = getContactStmt.get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Contacto não encontrado." });
    const c = sanitizeContact(req.body, { partial: true });
    const merged = { ...existing, ...c, updated_at: new Date().toISOString() };
    db.prepare(`
      UPDATE contacts SET
        business_name=@business_name, sector=@sector, contact_name=@contact_name, mobile=@mobile,
        email=@email, channel=@channel, owner=@owner, status=@status, source=@source,
        source_url=@source_url, last_message=@last_message, next_action=@next_action,
        next_action_at=@next_action_at, notes=@notes, updated_at=@updated_at
      WHERE id=@id
    `).run({ ...merged, id: req.params.id });
    res.json(getContactStmt.get(req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

api.get("/contacts/:id/interactions", (req, res) => {
  const contact = getContactStmt.get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contacto não encontrado." });
  const rows = db.prepare("SELECT * FROM interactions WHERE contact_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json(rows);
});

api.post("/contacts/:id/interactions", (req, res) => {
  try {
    const contact = getContactStmt.get(req.params.id);
    if (!contact) return res.status(404).json({ error: "Contacto não encontrado." });
    const i = sanitizeInteraction(req.body);
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO interactions (id, contact_id, direction, channel, message, outcome, created_at)
      VALUES (@id, @contact_id, @direction, @channel, @message, @outcome, @created_at)
    `).run({ id, contact_id: req.params.id, ...i, created_at: now });
    db.prepare("UPDATE contacts SET last_message=@msg, updated_at=@now WHERE id=@id").run({
      msg: i.message || contact.last_message, now, id: req.params.id,
    });
    res.status(201).json(db.prepare("SELECT * FROM interactions WHERE id = ?").get(id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

api.get("/export/contacts.csv", (req, res) => {
  const rows = db.prepare("SELECT * FROM contacts ORDER BY updated_at DESC").all();
  const head = [
    "id", "business_name", "sector", "contact_name", "mobile", "email", "channel", "owner",
    "status", "source", "source_url", "last_message", "next_action", "next_action_at", "notes",
    "created_at", "updated_at",
  ];
  const csvCell = (v) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [head, ...rows.map((r) => head.map((h) => r[h]))]
    .map((r) => r.map(csvCell).join(",")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="contacts.csv"');
  res.send("﻿" + csv);
});

app.use("/api", api);

// --- Frontend estático ---
app.use(express.static(join(__dirname, "public")));

app.listen(PORT, HOST, () => {
  console.log(`Agente Galicia CRM a correr em http://${HOST}:${PORT}`);
});
