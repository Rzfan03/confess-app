import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, '..', 'data.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS confessions (
    id TEXT PRIMARY KEY,
    sender_name TEXT DEFAULT 'Anonim',
    crush_name TEXT NOT NULL,
    message TEXT NOT NULL,
    contact_type TEXT NOT NULL CHECK(contact_type IN ('wa', 'ig')),
    contact_value TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    sent_at TEXT
  )
`);

const insert = db.prepare(`
  INSERT INTO confessions (id, sender_name, crush_name, message, contact_type, contact_value)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const findById = db.prepare(`SELECT * FROM confessions WHERE id = ?`);

const updateStatus = db.prepare(`
  UPDATE confessions SET status = ?, error_message = ?, sent_at = datetime('now')
  WHERE id = ?
`);

export function createConfession({ id, senderName, crushName, message, contactType, contactValue }) {
  insert.run(id, senderName, crushName, message, contactType, contactValue);
  return findById.get(id);
}

export function getConfession(id) {
  return findById.get(id);
}

export function markSent(id) {
  updateStatus.run('sent', null, id);
}

export function markFailed(id, error) {
  updateStatus.run('failed', error, id);
}

const getPending = db.prepare(`SELECT * FROM confessions WHERE status = 'pending' AND contact_type = 'wa'`);

export function getPendingConfessions() {
  return getPending.all();
}
