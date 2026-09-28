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

#[tauri::command]
fn tasks_store(command: String, payload: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    if !["read", "import", "apply"].contains(&command.as_str()) {
        return Err("Commande inconnue".into());
    }
    let mut child = Command::new("python3")
        .arg("-c")
        .arg(include_str!("../../scripts/tasks_store.py"))
        .arg(command)
        .arg("-")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| error.to_string())?;
    if let Some(data) = payload {
        let input = serde_json::to_vec(&data).map_err(|error| error.to_string())?;
        child.stdin.take().ok_or("Entrée indisponible")?
            .write_all(&input).map_err(|error| error.to_string())?;
    }
    let result = child.wait_with_output().map_err(|error| error.to_string())?;
    if !result.status.success() {
        return Err(String::from_utf8_lossy(&result.stderr).to_string());
    }
    serde_json::from_slice(&result.stdout).map_err(|error| error.to_string())
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
        .invoke_handler(tauri::generate_handler![infos_app, tasks_store])
        .run(tauri::generate_context!())
        .expect("impossible de démarrer Gestionnaire de Taches");
}
