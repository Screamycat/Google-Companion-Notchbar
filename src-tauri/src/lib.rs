mod audio;
mod bluetooth;
mod clipboard;
mod controls;
pub mod convert;
mod discord;
mod display;
mod documents;
mod drop;
mod fps;
mod gemini;
mod hit_test;
mod media;
mod memory;
mod mixer;
mod ocr;
mod privacy;
pub mod secrets;
mod system;
mod config;

use std::sync::Mutex;

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Emitter, Manager, State, WebviewWindow};
use tauri_plugin_autostart::MacosLauncher;
#[cfg(not(windows))]
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, SetForegroundWindow};

/// Opens/closes the notch from anywhere. Ctrl+Alt = AltGr on German keyboards;
/// AltGr+Space types nothing, so there's no conflict.
const SHORTCUT_LABEL: &str = "Strg+Alt+Leertaste";

/// For main.rs: elevated "Unlock FPS" call (see fps::fps_unlock).
pub fn fps_elevated_unlock(sid: &str) -> i32 {
    fps::elevated_unlock(sid)
}

#[derive(Default)]
pub struct ShortcutsState {
    pub notch: Mutex<Option<Shortcut>>,
    pub ai: Mutex<Option<Shortcut>>,
}

fn parse_shortcut_string(s: &str) -> Option<Shortcut> {
    let trimmed = s.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("off") || trimmed.eq_ignore_ascii_case("disabled") || trimmed.eq_ignore_ascii_case("none") {
        return None;
    }
    let parts: Vec<String> = trimmed
        .split('+')
        .map(|p| {
            let p_trim = p.trim();
            match p_trim.to_uppercase().as_str() {
                "WIN" | "WINDOWS" | "META" | "CMD" | "COMMAND" | "SUPER" => "Super".to_string(),
                "CTRL" | "CONTROL" => "Control".to_string(),
                "ALT" | "OPTION" => "Alt".to_string(),
                "SHIFT" => "Shift".to_string(),
                other => other.to_string(),
            }
        })
        .collect();
    let normalized = parts.join("+");
    normalized.parse::<Shortcut>().ok()
}

#[tauri::command]
fn set_notch_shortcut(shortcut_str: Option<String>, app: AppHandle) -> Result<(), String> {
    let state = app.state::<ShortcutsState>();
    let mut lock = state.notch.lock().unwrap();

    let shortcut_str = shortcut_str.filter(|s| !s.is_empty() && !s.eq_ignore_ascii_case("off") && !s.eq_ignore_ascii_case("disabled"));

    if let Some(ref s) = shortcut_str {
        let new_sc = parse_shortcut_string(s)
            .ok_or_else(|| format!("Invalid shortcut format: '{s}'"))?;

        if lock.as_ref() == Some(&new_sc) {
            return Ok(());
        }

        if state.ai.lock().unwrap().as_ref() == Some(&new_sc) {
            return Err("Shortcut already in use by Gemini Assistant".to_string());
        }

        if let Some(ref old) = *lock {
            let _ = app.global_shortcut().unregister(old.clone());
        }

        app.global_shortcut()
            .register(new_sc.clone())
            .map_err(|e| format!("Could not register shortcut '{s}': {e}"))?;

        *lock = Some(new_sc);
        return Ok(());
    }

    if let Some(ref old) = *lock {
        let _ = app.global_shortcut().unregister(old.clone());
    }
    *lock = None;
    Ok(())
}

#[tauri::command]
fn set_ai_shortcut(shortcut_str: Option<String>, app: AppHandle) -> Result<(), String> {
    let state = app.state::<ShortcutsState>();
    let mut lock = state.ai.lock().unwrap();

    let shortcut_str = shortcut_str.filter(|s| !s.is_empty() && !s.eq_ignore_ascii_case("off") && !s.eq_ignore_ascii_case("disabled"));

    if let Some(ref s) = shortcut_str {
        let new_sc = parse_shortcut_string(s)
            .ok_or_else(|| format!("Invalid shortcut format: '{s}'"))?;

        if lock.as_ref() == Some(&new_sc) {
            return Ok(());
        }

        if state.notch.lock().unwrap().as_ref() == Some(&new_sc) {
            return Err("Shortcut already in use by Open / Close Notch".to_string());
        }

        if let Some(ref old) = *lock {
            let _ = app.global_shortcut().unregister(old.clone());
        }

        app.global_shortcut()
            .register(new_sc.clone())
            .map_err(|e| format!("Could not register shortcut '{s}': {e}"))?;

        *lock = Some(new_sc);
        return Ok(());
    }

    if let Some(ref old) = *lock {
        let _ = app.global_shortcut().unregister(old.clone());
    }
    *lock = None;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        // A second launch doesn't open a second notch.
        .plugin(tauri_plugin_single_instance::init(|_, _, _| {}))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        // Updates: signed installers from GitHub, only on click in the settings.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, pressed, event| {
                    if event.state() == ShortcutState::Pressed {
                        let shortcuts = app.state::<ShortcutsState>();
                        let is_notch = shortcuts.notch.lock().unwrap().as_ref() == Some(pressed);
                        let is_ai = shortcuts.ai.lock().unwrap().as_ref() == Some(pressed);
                        if is_notch {
                            let _ = app.emit("notch://shortcut", ());
                        } else if is_ai {
                            let _ = app.emit("notch://shortcut-ai", ());
                        }
                    }
                })
                .build(),
        )
        .manage(hit_test::HitState::default())
        .manage(media::MediaState::default())
        .manage(mixer::MixerState::default())
        .manage(clipboard::ClipboardState::default())
        .manage(FocusState::default())
        .manage(TrayItems::default())
        .manage(audio::AudioState::default())
        .manage(system::SystemState::default())
        .manage(display::DisplayState::default())
        .manage(discord::DiscordState::default())
        .manage(gemini::GeminiState::default())
        .manage(ShortcutsState::default())
        .invoke_handler(tauri::generate_handler![
            hit_test::set_hit_rect,
            hit_test::set_pinned,
            media::media_get,
            media::media_control,
            memory::memory_low,
            clipboard::clipboard_list,
            clipboard::clipboard_mode,
            clipboard::clipboard_copy,
            clipboard::clipboard_delete,
            clipboard::clipboard_clear,
            clipboard::clipboard_preview,
            clipboard::clipboard_paste_files,
            clipboard::clipboard_ocr,
            keyboard_focus,
            audio::audio_levels,
            secrets::secret_set,
            secrets::secret_delete,
            secrets::secret_has,
            system::system_stats,
            convert::convert_probe,
            convert::convert_files,
            convert::reveal_file,
            convert::open_path,
            convert::copy_files,
            convert::file_preview,
            display::display_monitors,
            display::display_apply,
            fps::gaming_fps,
            fps::fps_unlock,
            controls::volume_get,
            controls::volume_set,
            mixer::mixer_list,
            mixer::mixer_set,
            mixer::media_open_source,
            controls::focus_get,
            controls::focus_set,
            controls::brightness_get,
            controls::brightness_set,
            controls::lock_workstation,
            controls::sleep_pc,
            bluetooth::bluetooth_list,
            bluetooth::bluetooth_connect,
            bluetooth::bluetooth_battery,
            bluetooth::bluetooth_settings,
            privacy::privacy_state,
            discord::discord_configure,
            discord::discord_action,
            discord::discord_state,
            set_language,
            autostart_get,
            autostart_set,
            config::config_save,
            config::config_load,
            gemini::gemini_init,
            gemini::gemini_open_window,
            gemini::gemini_hide_window,
            gemini::gemini_send,
            gemini::gemini_abort,
            gemini::gemini_new_chat,
            gemini::gemini_set_model,
            set_notch_shortcut,
            set_ai_shortcut,
            clipboard::clipboard_set_limits,
        ])
        .setup(move |app| {
            let window = app.get_webview_window("notch").expect("window 'notch' missing");
            display::place(&window, &app.state::<display::DisplayState>())?;
            window.show()?;
            // Only after show(): this fails on a window that was never shown.
            window.set_ignore_cursor_events(true)?;
            drop::install(&window);
            hit_test::spawn(app.handle().clone(), window.clone());
            display::spawn(app.handle().clone(), window);
            media::spawn(app.handle().clone());
            clipboard::spawn(app.handle().clone());
            audio::spawn(app.handle().clone(), &app.state::<audio::AudioState>());

            // If another app owns the shortcut, the notch still runs, just without it.
            let default_notch = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space);
            let _ = app.global_shortcut().register(default_notch.clone());
            let default_ai = Shortcut::new(Some(Modifiers::ALT), Code::KeyA);
            let _ = app.global_shortcut().register(default_ai.clone());

            let shortcuts_state = app.state::<ShortcutsState>();
            *shortcuts_state.notch.lock().unwrap() = Some(default_notch);
            *shortcuts_state.ai.lock().unwrap() = Some(default_ai);
            enable_autostart_once(app.handle());
            build_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to start Google-Companion Notchbar");
}

/// Window that was in the foreground before the shortcut opened the notch.
#[derive(Default)]
struct FocusState(Mutex<isize>);

/// Opened via shortcut → take focus (for Esc/typing).
/// Closed → give focus back to the previous app, otherwise typing goes nowhere.
#[tauri::command]
fn keyboard_focus(focus: bool, window: WebviewWindow, state: State<'_, FocusState>) {
    let Ok(own) = window.hwnd() else { return };
    let own = own.0 as isize;
    let foreground = unsafe { GetForegroundWindow() }.0 as isize;
    let mut previous = state.0.lock().unwrap();

    if focus {
        if foreground != own {
            *previous = foreground;
        }
        let _ = window.set_focus();
    } else if foreground == own && *previous != 0 {
        let _ = unsafe { SetForegroundWindow(HWND(*previous as *mut _)) };
        *previous = 0;
    }
}

#[cfg(windows)]
mod autostart_win {
    use std::env::current_exe;
    use windows_registry::{CURRENT_USER, Type};

    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const TASK_MGR_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
    const APP_NAME: &str = "Google-Companion Notchbar";
    const LEGACY_NAMES: &[&str] = &["Google NotchBar", "L4-Notchbar", "notch"];
    const ENABLED_BYTES: [u8; 12] = [0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    pub fn is_enabled() -> bool {
        CURRENT_USER
            .open(RUN_KEY)
            .and_then(|k| k.get_string(APP_NAME))
            .is_ok()
    }

    pub fn set(enabled: bool) -> Result<(), String> {
        if enabled {
            enable()
        } else {
            disable()
        }
    }

    pub fn enable() -> Result<(), String> {
        let exe = current_exe().map_err(|e| e.to_string())?;
        let quoted_path = format!("\"{}\"", exe.display());
        let run_key = CURRENT_USER.create(RUN_KEY).map_err(|e| e.to_string())?;
        run_key.set_string(APP_NAME, &quoted_path).map_err(|e| e.to_string())?;

        // Clean up legacy keys
        for &legacy in LEGACY_NAMES {
            let _ = run_key.remove_value(legacy);
        }

        // Also ensure Task Manager hasn't marked it disabled in StartupApproved
        if let Ok(task_key) = CURRENT_USER.create(TASK_MGR_KEY) {
            let _ = task_key.set_bytes(APP_NAME, Type::Bytes, &ENABLED_BYTES);
            for &legacy in LEGACY_NAMES {
                let _ = task_key.remove_value(legacy);
            }
        }
        Ok(())
    }

    pub fn disable() -> Result<(), String> {
        if let Ok(run_key) = CURRENT_USER.options().write().open(RUN_KEY) {
            let _ = run_key.remove_value(APP_NAME);
            for &legacy in LEGACY_NAMES {
                let _ = run_key.remove_value(legacy);
            }
        }
        if let Ok(task_key) = CURRENT_USER.options().write().open(TASK_MGR_KEY) {
            let _ = task_key.remove_value(APP_NAME);
            for &legacy in LEGACY_NAMES {
                let _ = task_key.remove_value(legacy);
            }
        }
        Ok(())
    }

    /// If autostart was previously registered without quotation marks or under an old name,
    /// fix it so that Windows can execute it on reboot.
    pub fn fix_if_needed() {
        if let Ok(run_key) = CURRENT_USER.open(RUN_KEY) {
            let val = run_key.get_string(APP_NAME);
            let has_legacy = LEGACY_NAMES.iter().any(|&n| run_key.get_string(n).is_ok());

            if let Ok(path) = val {
                if !path.starts_with('"') || has_legacy {
                    let _ = enable();
                }
            } else if has_legacy {
                let _ = enable();
            }
        }
    }
}

fn autostart_is_enabled(app: &AppHandle) -> bool {
    #[cfg(windows)]
    {
        let _ = app;
        autostart_win::is_enabled()
    }
    #[cfg(not(windows))]
    {
        app.autolaunch().is_enabled().unwrap_or(false)
    }
}

fn autostart_set_internal(enabled: bool, app: &AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        let _ = app;
        autostart_win::set(enabled)
    }
    #[cfg(not(windows))]
    {
        let manager = app.autolaunch();
        if enabled { manager.enable() } else { manager.disable() }.map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn autostart_get(app: AppHandle) -> bool {
    autostart_is_enabled(&app)
}

#[tauri::command]
fn autostart_set(enabled: bool, app: AppHandle) -> Result<(), String> {
    autostart_set_internal(enabled, &app)
}

/// Enables autostart on the very first launch; after that the tray check and settings decide.
fn enable_autostart_once(app: &AppHandle) {
    let Ok(dir) = app.path().app_data_dir() else { return };
    let marker = dir.join("autostart-initialized");
    if marker.exists() {
        #[cfg(windows)]
        autostart_win::fix_if_needed();
        return;
    }
    if autostart_set_internal(true, app).is_ok() {
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(marker, "");
    }
}

/// Tray items whose text or check state changes at runtime.
struct Tray {
    open: MenuItem<tauri::Wry>,
    settings: MenuItem<tauri::Wry>,
    autostart: CheckMenuItem<tauri::Wry>,
    quit: MenuItem<tauri::Wry>,
}

#[derive(Default)]
struct TrayItems(Mutex<Option<Tray>>);

/// Open (shortcut right-aligned via tab, like Windows menus), settings, autostart, quit.
fn tray_texts(lang: &str) -> [String; 4] {
    if lang == "de" {
        [format!("Google-Companion Notchbar öffnen\t{SHORTCUT_LABEL}"), "Einstellungen …".into(), "Mit Windows starten".into(), "Google-Companion Notchbar beenden".into()]
    } else {
        let keys = SHORTCUT_LABEL.replace("Strg", "Ctrl").replace("Leertaste", "Space");
        [format!("Open Google-Companion Notchbar\t{keys}"), "Settings …".into(), "Start with Windows".into(), "Quit Google-Companion Notchbar".into()]
    }
}

#[tauri::command]
fn set_language(lang: String, state: State<'_, TrayItems>) {
    if let Some(tray) = state.0.lock().unwrap().as_ref() {
        let [a, b, c, d] = tray_texts(&lang);
        let _ = tray.open.set_text(a);
        let _ = tray.settings.set_text(b);
        let _ = tray.autostart.set_text(c);
        let _ = tray.quit.set_text(d);
    }
}

/// Dark tray menu to match the notch instead of the light default.
/// uxtheme only exports this by ordinal: SetPreferredAppMode = 135, FlushMenuThemes = 136
/// (Windows 10 1903+). If missing, the menu just stays light.
fn dark_menus() {
    use windows::core::{w, PCSTR};
    use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};
    const FORCE_DARK: i32 = 2;
    unsafe {
        let Ok(uxtheme) = LoadLibraryW(w!("uxtheme.dll")) else { return };
        if let Some(f) = GetProcAddress(uxtheme, PCSTR(135 as *const u8)) {
            let set_preferred_app_mode: extern "system" fn(i32) -> i32 = std::mem::transmute(f);
            set_preferred_app_mode(FORCE_DARK);
        }
        if let Some(f) = GetProcAddress(uxtheme, PCSTR(136 as *const u8)) {
            let flush_menu_themes: extern "system" fn() = std::mem::transmute(f);
            flush_menu_themes();
        }
    }
}

/// Without a taskbar entry, the tray is where you open, configure and quit.
/// Left click opens the notch, right click shows the menu.
fn build_tray(app: &App) -> tauri::Result<()> {
    dark_menus();
    let enabled = autostart_is_enabled(app.handle());
    let [open_text, settings_text, autostart_text, quit_text] = tray_texts("en");
    let open = MenuItem::with_id(app, "open", open_text, true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", settings_text, true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(app, "autostart", autostart_text, true, enabled, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", quit_text, true, None::<&str>)?;
    *app.state::<TrayItems>().0.lock().unwrap() = Some(Tray {
        open: open.clone(),
        settings: settings.clone(),
        autostart: autostart.clone(),
        quit: quit.clone(),
    });
    let menu = Menu::with_items(
        app,
        &[&open, &settings, &PredefinedMenuItem::separator(app)?, &autostart, &PredefinedMenuItem::separator(app)?, &quit],
    )?;

    let autostart_item = autostart.clone();
    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Google-Companion Notchbar")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                let _ = tray.app_handle().emit("notch://open", None::<&str>);
            }
        })
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "open" => {
                let _ = app.emit("notch://open", None::<&str>);
            }
            "settings" => {
                let _ = app.emit("notch://open", Some("settings"));
            }
            "quit" => app.exit(0),
            "autostart" => {
                // The check item toggles itself on click; read the new state.
                let on = autostart_item.is_checked().unwrap_or(false);
                let _ = autostart_set_internal(on, app);
            }
            _ => {}
        })
        .build(app)?;
    Ok(())
}
