
use tauri::{webview::NewWindowResponse, WebviewUrl, WebviewWindowBuilder};

const ANNOYANCE_BLOCKER: &str = include_str!("annoyanceblock.js");
const APP_URL: &str = "https://rivestream.org";
const BLOCKED_HOSTS: &[&str] = &[
    "adbpage.com",
    "adcash.com",
    "adexchangeclear.com",
    "gamerhit.co",
];

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn is_allowed_navigation(url: &tauri::Url) -> bool {
    if let Some(host) = url.host_str() {
        if is_blocked_host(host) {
            return false;
        }
    }

    match url.host_str() {
        Some("rivestream.org") => true,
        Some(host) if host.ends_with(".rivestream.org") => true,

        Some("rive-5d1b4.firebaseapp.com") => true,

        None => matches!(url.scheme(), "about" | "data" | "blob"),

        _ => false,
    }
}

fn is_blocked_host(host: &str) -> bool {
    let host = host.to_ascii_lowercase();

    BLOCKED_HOSTS
        .iter()
        .any(|blocked| host == *blocked || host.ends_with(&format!(".{blocked}")))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            let url: tauri::Url = APP_URL.parse().expect("invalid APP_URL");

            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("RiveStream")
                .inner_size(1280.0, 800.0)
                .resizable(true)
                .devtools(true)
                .initialization_script(ANNOYANCE_BLOCKER)
                .on_navigation(|url| {
                    let allowed = is_allowed_navigation(url);

                    if !allowed {
                        println!("[nav-block] blocked navigation: {url}");
                    }

                    allowed
                })
                .on_new_window(|url, _features| {
                    if let Some(host) = url.host_str() {
                        if is_blocked_host(host) {
                            println!("[new-window-block] blocked ad host: {url}");
                            return NewWindowResponse::Deny;
                        }
                    }

                    println!("[new-window-block] blocked new window: {url}");
                    NewWindowResponse::Deny
                })
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
