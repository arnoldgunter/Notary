import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

let db = null;

export async function initDB() {
  if (db) return db;
  db = await Database.load("sqlite:notes.db");

  // Notebooks
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes_count INTEGER DEFAULT 0
    )
  `);

  // Notes
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notebook_id INTEGER,
      name TEXT,
      content JSON,
      important BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(notebook_id) REFERENCES notebooks(id)
    )
  `);

  // Migrate the former { name, content } note payload to the normalized schema.
  await db.execute(`
    UPDATE notes
    SET
      name = COALESCE(NULLIF(json_extract(content, '$.name'), ''), name),
      content = json_extract(content, '$.content')
    WHERE json_valid(content)
      AND json_type(content, '$.content') = 'object'
      AND json_type(content, '$.content.type') = 'text'
  `);
  await db.execute(`
    UPDATE notebooks
    SET notes_count = (
      SELECT COUNT(*) FROM notes WHERE notes.notebook_id = notebooks.id
    )
  `);

  return db;
}

export async function closeDB() {
  if (!db) return;
  await db.close();
  db = null;
}

export async function readDatabase() {
  await closeDB();
  try {
    return await invoke("read_database");
  } finally {
    await initDB();
  }
}

export async function getDatabasePath() {
  return invoke("get_database_path");
}

export async function replaceDatabase(bytes) {
  await closeDB();
  try {
    await invoke("replace_database", { bytes: Array.from(bytes) });
  } finally {
    await initDB();
  }
}

export async function addNotebook(name) {
  const database = await initDB();
  const result = await database.execute(
    "INSERT INTO notebooks (name) VALUES ($1)",
    [name],
  );
  return result?.lastInsertRowid;
}

export async function getNotebooks() {
  const database = await initDB();
  const result = await database.select("SELECT * FROM notebooks");
  return result ?? [];
}

export async function addNote(notebookId, content, important = false) {
  const database = await initDB();
  await database.execute(
    "INSERT INTO notes (notebook_id, name, content, important) VALUES ($1, $2, $3, $4)",
    [notebookId, content.name, JSON.stringify(content.content), important ? 1 : 0],
  );
  await database.execute(
    "UPDATE notebooks SET notes_count = notes_count + 1 WHERE id = $1",
    [notebookId],
  );
}

export async function getNotes(notebookId) {
  const database = await initDB();
  const result = await database.select(
    "SELECT * FROM notes WHERE notebook_id = $1 ORDER BY created_at ASC",
    [notebookId],
  );
  return result ?? [];
}

export async function getNoteById(noteId) {
  const database = await initDB();
  const result = await database.select("SELECT * FROM notes WHERE id = $1", [
    noteId,
  ]);
  return result?.[0] ?? null;
}

export async function deleteNote(noteId) {
  const database = await initDB();
  const result = await database.select(
    "SELECT notebook_id FROM notes WHERE id = $1",
    [noteId],
  );
  const notebookId = result?.[0]?.notebook_id;
  if (!notebookId) return;

  await database.execute("DELETE FROM notes WHERE id = $1", [noteId]);
  await database.execute(
    "UPDATE notebooks SET notes_count = MAX(0, notes_count - 1) WHERE id = $1",
    [notebookId],
  );
}

export async function deleteNotebook(notebookId) {
  const database = await initDB();
  await database.execute("DELETE FROM notes WHERE notebook_id = $1", [
    notebookId,
  ]);
  await database.execute("DELETE FROM notebooks WHERE id = $1", [notebookId]);
}

export async function updateNote(noteId, content, important = 0) {
  const database = await initDB();
  const serializedContent =
    typeof content === "string" ? JSON.parse(content) : content;
  const noteName = serializedContent?.name;
  const noteContent = serializedContent?.content ?? serializedContent;

  if (typeof noteName === "string" && !serializedContent?.content) {
    await database.execute("UPDATE notes SET name = $1 WHERE id = $2", [
      noteName,
      noteId,
    ]);
    return;
  }

  if (typeof noteName === "string") {
    await database.execute(
      "UPDATE notes SET name = $1, content = $2, important = $3 WHERE id = $4",
      [noteName, JSON.stringify(noteContent), important ? 1 : 0, noteId],
    );
    return;
  }

  await database.execute(
    "UPDATE notes SET content = $1, important = $2 WHERE id = $3",
    [JSON.stringify(noteContent), important ? 1 : 0, noteId],
  );
}

export async function updateNotebook(notebookId, name) {
  const database = await initDB();
  await database.execute("UPDATE notebooks SET name = $1 WHERE id = $2", [
    name,
    notebookId,
  ]);
}
