use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};
use tauri_plugin_shell::ShellExt;

/// Start Docker Compose services
#[tauri::command]
async fn start_services() -> Result<String, String> {
    // Execute: docker compose up -d
    let output = std::process::Command::new("docker")
        .args(&["compose", "up", "-d"])
        .current_dir("../../") // Root of project
        .output()
        .map_err(|e| format!("Failed to execute docker compose: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Stop Docker Compose services
#[tauri::command]
async fn stop_services() -> Result<String, String> {
    let output = std::process::Command::new("docker")
        .args(&["compose", "down"])
        .current_dir("../../")
        .output()
        .map_err(|e| format!("Failed to execute docker compose: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Check Docker Compose services status
#[tauri::command]
async fn check_status() -> Result<String, String> {
    let output = std::process::Command::new("docker")
        .args(&["compose", "ps"])
        .current_dir("../../")
        .output()
        .map_err(|e| format!("Failed to check status: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Setup system tray (menubar) icon and menu
fn setup_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let show_i = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
    let start_i = MenuItem::with_id(app, "start", "Start Services", true, None::<&str>)?;
    let stop_i = MenuItem::with_id(app, "stop", "Stop Services", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&show_i, &start_i, &stop_i, &quit_i],
    )?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "quit" => {
                app.exit(0);
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "start" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    match start_services().await {
                        Ok(_) => println!("Services started successfully"),
                        Err(e) => eprintln!("Failed to start services: {}", e),
                    }
                });
            }
            "stop" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    match stop_services().await {
                        Ok(_) => println!("Services stopped successfully"),
                        Err(e) => eprintln!("Failed to stop services: {}", e),
                    }
                });
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            setup_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_services,
            stop_services,
            check_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
