use std::fs;
use std::path::PathBuf;
use rusqlite::Connection;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("App-Konfigurationsverzeichnis konnte nicht ermittelt werden: {error}"))?;

    Ok(app_config_dir.join("notes.db"))
}

#[tauri::command]
fn get_database_path(app: tauri::AppHandle) -> Result<String, String> {
    Ok(database_path(&app)?.display().to_string())
}

#[tauri::command]
fn read_database(app: tauri::AppHandle) -> Result<Vec<u8>, String> {
    let path = database_path(&app)?;
    fs::read(&path).map_err(|error| format!("Datenbank konnte nicht gelesen werden: {error}"))
}

#[tauri::command]
fn replace_database(app: tauri::AppHandle, bytes: Vec<u8>) -> Result<(), String> {
    if bytes.len() < 16 || &bytes[..16] != b"SQLite format 3\0" {
        return Err("Die ausgewählte Datei ist keine gültige SQLite-Datenbank.".to_string());
    }

    let path = database_path(&app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "Datenbankverzeichnis konnte nicht ermittelt werden.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Datenbankverzeichnis konnte nicht erstellt werden: {error}"))?;

      let validation_path = parent.join("notes.db.validation");
      fs::write(&validation_path, &bytes)
          .map_err(|error| format!("Importdatei konnte nicht geprüft werden: {error}"))?;
      let validation_result = (|| -> Result<(), String> {
          let connection = Connection::open(&validation_path)
              .map_err(|error| format!("SQLite-Datenbank konnte nicht geöffnet werden: {error}"))?;
          let integrity: String = connection
              .query_row("PRAGMA integrity_check", [], |row| row.get(0))
              .map_err(|error| format!("SQLite-Integritätsprüfung fehlgeschlagen: {error}"))?;
          if integrity != "ok" {
              return Err(format!("SQLite-Integritätsprüfung fehlgeschlagen: {integrity}"));
          }

          for table in ["notebooks", "notes"] {
              let exists: bool = connection
                  .query_row(
                      "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
                      [table],
                      |row| row.get(0),
                  )
                  .map_err(|error| format!("Datenbankschema konnte nicht geprüft werden: {error}"))?;
              if !exists {
                  return Err(format!("Importdatei enthält nicht die benötigte Tabelle '{table}'."));
              }
          }
          Ok(())
      })();
      let _ = fs::remove_file(&validation_path);
      validation_result?;

      let temporary_path = parent.join("notes.db.importing");
    fs::write(&temporary_path, bytes)
        .map_err(|error| format!("Importdatei konnte nicht geschrieben werden: {error}"))?;
    fs::rename(&temporary_path, &path).map_err(|error| {
        let _ = fs::remove_file(&temporary_path);
        format!("Datenbank konnte nicht ersetzt werden: {error}")
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_oauth::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_database_path,
            read_database,
            replace_database
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
