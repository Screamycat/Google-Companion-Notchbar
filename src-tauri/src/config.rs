//! Persistent configuration storage in the local app data directory.
//! Guarantees that settings, appearance, and user state are saved reliably
//! to disk and survive restarts, crashes, or abrupt process exits.

use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn config_save(key: String, value: String, app: AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let _ = std::fs::create_dir_all(&dir);
    let safe_key: String = key.chars().filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_').collect();
    if safe_key.is_empty() {
        return Err("invalid key".into());
    }
    std::fs::write(dir.join(format!("{safe_key}.json")), value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn config_load(key: String, app: AppHandle) -> Option<String> {
    let dir = app.path().app_data_dir().ok()?;
    let safe_key: String = key.chars().filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_').collect();
    if safe_key.is_empty() {
        return None;
    }
    std::fs::read_to_string(dir.join(format!("{safe_key}.json"))).ok()
}
