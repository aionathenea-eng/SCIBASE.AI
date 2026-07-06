import Database from "better-sqlite3";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

const DB_PATH = process.env.DATABASE_URL || "./data/contacts.sqlite";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id             TEXT PRIMARY KEY,
    business_name  TEXT NOT NULL,
    sector         TEXT DEFAULT '',
    contact_name   TEXT DEFAULT '',
    mobile         TEXT DEFAULT '',
    email          TEXT DEFAULT '',
    channel        TEXT NOT NULL DEFAULT 'whatsapp',
    owner          TEXT NOT NULL DEFAULT 'andre',
    status         TEXT NOT NULL DEFAULT 'pendiente',
    source         TEXT DEFAULT '',
    source_url     TEXT DEFAULT '',
    last_message   TEXT DEFAULT '',
    next_action    TEXT DEFAULT '',
    next_action_at TEXT DEFAULT '',
    notes          TEXT DEFAULT '',
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id          TEXT PRIMARY KEY,
    contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    direction   TEXT NOT NULL DEFAULT 'outbound',
    channel     TEXT NOT NULL DEFAULT 'whatsapp',
    message     TEXT DEFAULT '',
    outcome     TEXT DEFAULT '',
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
  CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner);
  CREATE INDEX IF NOT EXISTS idx_contacts_channel ON contacts(channel);
  CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id);
`);
