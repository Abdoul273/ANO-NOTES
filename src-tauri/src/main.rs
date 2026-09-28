// Gestionnaire de Taches — application native générée par natif (Tauri 2).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::io::Write;
use std::process::{Command, Stdio};

/// Exemple de commande Rust appelable depuis React :
///   import { invoke } from "@tauri-apps/api/core"
///   await invoke("infos_app")
#[tauri::command]
fn infos_app() -> serde_json::Value {
    serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
}

fn store_path() -> std::path::PathBuf {
    std::env::var_os("AURATASK_TASKS_FILE")
        .map(Into::into)
        .unwrap_or_else(|| {
            let home = std::env::var_os("HOME").unwrap_or_default();
            std::path::Path::new(&home).join(".local/share/auratask/tasks.json")
        })
}

/// Magasin partagé avec le panneau Caelestia (Super+Shift+T). Les écritures
/// passent par le script Python verrouillé ; la lecture, appelée toutes les
/// deux secondes, lit directement le fichier (remplacé atomiquement).
fn run_store(command: String, payload: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    if command == "read" {
        if let Ok(text) = std::fs::read_to_string(store_path()) {
            if let Ok(state) = serde_json::from_str::<serde_json::Value>(&text) {
                if state.get("tasks").map_or(false, |t| t.is_array()) {
                    return Ok(state);
                }
            }
        }
    }
    let mut child = Command::new("python3")
        .arg("-c")
        .arg(include_str!("../../scripts/tasks_store.py"))
        .arg(&command)
        .arg("-")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("python3 introuvable : {error}"))?;
    {
        let mut stdin = child.stdin.take().ok_or("Entrée indisponible")?;
        if let Some(data) = payload {
            let input = serde_json::to_vec(&data).map_err(|error| error.to_string())?;
            stdin.write_all(&input).map_err(|error| error.to_string())?;
        }
    }
    let result = child.wait_with_output().map_err(|error| error.to_string())?;
    if !result.status.success() {
        return Err(String::from_utf8_lossy(&result.stderr).to_string());
    }
    serde_json::from_slice(&result.stdout).map_err(|error| error.to_string())
}

#[tauri::command]
async fn tasks_store(command: String, payload: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    if !["read", "import", "apply"].contains(&command.as_str()) {
        return Err("Commande inconnue".into());
    }
    // Hors du thread principal : l'interface ne se fige jamais pendant une synchro.
    tauri::async_runtime::spawn_blocking(move || run_store(command, payload))
        .await
        .map_err(|error| error.to_string())?
}

/// Enregistre un export (PDF, CSV, ICS, JSON) via la boîte de dialogue native :
/// WebKitGTK ignore les téléchargements de blobs.
#[tauri::command]
async fn save_file(app: tauri::AppHandle, name: String, data: Vec<u8>) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    tauri::async_runtime::spawn_blocking(move || {
        let Some(target) = app.dialog().file().set_file_name(&name).blocking_save_file() else {
            return Ok(None);
        };
        let path = target.into_path().map_err(|error| error.to_string())?;
        std::fs::write(&path, data).map_err(|error| error.to_string())?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|error| error.to_string())?
}

fn main() {
    #[cfg(target_os = "linux")]
    {
        // WebKitGTK : le rendu DMA-BUF donne des fenêtres noires avec le pilote NVIDIA propriétaire.
        // Ailleurs (Intel, AMD) on le garde : c'est lui qui rend l'interface fluide via le GPU.
        if std::path::Path::new("/proc/driver/nvidia").exists()
            && std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none()
        {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![infos_app, tasks_store, save_file])
        .run(tauri::generate_context!())
        .expect("impossible de démarrer Gestionnaire de Taches");
}
