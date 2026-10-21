//! Clipboard history.
//!
//! A thread polls `GetClipboardSequenceNumber` (cheap, no window needed) and reads the
//! content on every change. Password manager content is skipped.
//! History is persisted to disk under the app data directory (capped at 30 items and 6 images).

use std::collections::HashSet;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use arboard::{Clipboard, ImageData};
use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use windows::core::w;
use windows::Win32::Foundation::HGLOBAL;
use windows::Win32::System::DataExchange::{
    CloseClipboard, GetClipboardData, GetClipboardSequenceNumber, IsClipboardFormatAvailable, OpenClipboard,
    RegisterClipboardFormatW,
};
use windows::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};

const DEFAULT_MAX_ITEMS: usize = 30;
/// Only the newest images are kept (stored as PNG, a screenshot is roughly 0.5–3 MB).
const DEFAULT_MAX_IMAGES: usize = 6;
const THUMB_SIZE: u32 = 240;
const PREVIEW_CHARS: usize = 400;
const POLL: Duration = Duration::from_millis(300);
/// Larger image files are not loaded for a preview.
const MAX_THUMB_FILE_BYTES: u64 = 40 * 1024 * 1024;
const IMAGE_EXTENSIONS: [&str; 7] = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "ico"];

enum Content {
    Text(String),
    Image(StoredImage),
    Files(Vec<PathBuf>),
}

/// A copied image, kept as PNG: raw RGBA held a 4K screenshot at 33 MB, so a few
/// screenshots in the history took hundreds of MB.
struct StoredImage {
    width: u32,
    height: u32,
    png: Vec<u8>,
    thumbnail: String,
}

impl StoredImage {
    fn new(img: ImageData<'_>) -> Option<Self> {
        let rgba = image::RgbaImage::from_raw(img.width as u32, img.height as u32, img.bytes.into_owned())?;
        let thumbnail = thumbnail(&rgba)?;
        let mut png = Vec::new();
        // Fast compression: a 4K screenshot takes well under a second on the poll thread.
        let encoder = image::codecs::png::PngEncoder::new_with_quality(
            &mut png,
            image::codecs::png::CompressionType::Fast,
            image::codecs::png::FilterType::Adaptive,
        );
        rgba.write_with_encoder(encoder).ok()?;
        Some(Self { width: rgba.width(), height: rgba.height(), png, thumbnail })
    }

    fn rgba(&self) -> Option<image::RgbaImage> {
        Some(image::load_from_memory_with_format(&self.png, image::ImageFormat::Png).ok()?.to_rgba8())
    }
}

struct Entry {
    id: u64,
    content: Content,
    item: ClipItem,
}

/// What the frontend sees, without the full data.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipItem {
    id: u64,
    /// "text" | "link" | "image" | "files"
    kind: &'static str,
    text: String,
    /// PNG preview as a data URL (images and copied image files).
    thumbnail: Option<String>,
    /// Files: how many entries are folders (for the icon).
    folders: usize,
    /// Unix time in ms.
    copied_at: u64,
}

pub struct ClipboardState {
    entries: Mutex<Vec<Entry>>,
    /// Last seen sequence number. Updated on our own copies so copying an entry back
    /// doesn't create a duplicate.
    last_seq: Mutex<u32>,
    next_id: Mutex<u64>,
    /// What gets recorded, see `Mode`. Set by the frontend from the enabled tools.
    mode: AtomicU8,
    pub max_items: Mutex<usize>,
    pub max_images: Mutex<usize>,
}

impl Default for ClipboardState {
    fn default() -> Self {
        Self {
            entries: Mutex::new(Vec::new()),
            last_seq: Mutex::new(0),
            next_id: Mutex::new(0),
            mode: AtomicU8::new(0),
            max_items: Mutex::new(DEFAULT_MAX_ITEMS),
            max_images: Mutex::new(DEFAULT_MAX_IMAGES),
        }
    }
}

/// Recording modes. `ALL` is the default, so nothing is missed before the frontend reports.
/// Clipboard tool on: everything. Only Ask on (its quick actions use the latest text):
/// text only, so screenshots are never encoded. Both off: nothing is read.
const MODE_ALL: u8 = 0;
const MODE_TEXT: u8 = 1;
const MODE_OFF: u8 = 2;

#[tauri::command]
pub fn clipboard_list(state: State<'_, ClipboardState>) -> Vec<ClipItem> {
    items(&state)
}

#[tauri::command]
pub fn clipboard_set_limits(max_items: usize, max_images: usize, app: AppHandle, state: State<'_, ClipboardState>) {
    let items_cap = max_items.clamp(5, 200);
    let images_cap = max_images.clamp(1, 50);

    *state.max_items.lock().unwrap() = items_cap;
    *state.max_images.lock().unwrap() = images_cap;

    let before = state.entries.lock().unwrap().len();
    {
        let mut entries = state.entries.lock().unwrap();
        let mut images = 0;
        entries.retain(|e| {
            if matches!(e.content, Content::Image(_)) {
                images += 1;
                images <= images_cap
            } else {
                true
            }
        });
        entries.truncate(items_cap);
    }
    save_to_disk(&app, &state);
    if state.entries.lock().unwrap().len() != before {
        emit(&app, &state);
    }
}

/// `mode`: "all" | "text" | "off". Drops entries the new mode doesn't keep (frees the images).
#[tauri::command]
pub fn clipboard_mode(mode: &str, app: AppHandle, state: State<'_, ClipboardState>) {
    let mode = match mode {
        "off" => MODE_OFF,
        "text" => MODE_TEXT,
        _ => MODE_ALL,
    };
    if state.mode.swap(mode, Ordering::Relaxed) == mode {
        return;
    }
    let before = state.entries.lock().unwrap().len();
    state.entries.lock().unwrap().retain(|e| match mode {
        MODE_OFF => false,
        MODE_TEXT => matches!(e.content, Content::Text(_)),
        _ => true,
    });
    if state.entries.lock().unwrap().len() != before {
        save_to_disk(&app, &state);
        emit(&app, &state);
    }
}

#[tauri::command]
pub fn clipboard_copy(id: u64, app: AppHandle, state: State<'_, ClipboardState>) -> Result<(), String> {
    {
        let mut entries = state.entries.lock().unwrap();
        let index = entries.iter().position(|e| e.id == id).ok_or("Eintrag nicht gefunden")?;
        let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
        match &entries[index].content {
            Content::Text(t) => clipboard.set_text(t.clone()),
            Content::Image(img) => {
                let rgba = img.rgba().ok_or("Bild unlesbar")?;
                clipboard.set_image(ImageData { width: img.width as usize, height: img.height as usize, bytes: rgba.into_raw().into() })
            }
            Content::Files(files) => clipboard.set().file_list(files),
        }
        .map_err(|e| e.to_string())?;
        *state.last_seq.lock().unwrap() = unsafe { GetClipboardSequenceNumber() };

        // Move to the top with a fresh timestamp.
        let mut entry = entries.remove(index);
        entry.item.copied_at = now_ms();
        entries.insert(0, entry);
    }
    save_to_disk(&app, &state);
    emit(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn clipboard_delete(id: u64, app: AppHandle, state: State<'_, ClipboardState>) {
    state.entries.lock().unwrap().retain(|e| e.id != id);
    save_to_disk(&app, &state);
    emit(&app, &state);
}

#[tauri::command]
pub fn clipboard_clear(app: AppHandle, state: State<'_, ClipboardState>) {
    state.entries.lock().unwrap().clear();
    save_to_disk(&app, &state);
    emit(&app, &state);
}

/// Large preview of an image entry (copied image or first image file).
#[derive(Serialize)]
pub struct Preview {
    src: String,
    width: u32,
    height: u32,
}

const PREVIEW_SIZE: u32 = 1400;

#[tauri::command]
pub async fn clipboard_preview(id: u64, state: State<'_, ClipboardState>) -> Result<Option<Preview>, String> {
    // Copy the image data and release the lock right away; encoding takes a while.
    enum Source {
        Png(Vec<u8>),
        File(PathBuf),
    }
    let source = {
        let entries = state.entries.lock().unwrap();
        let Some(entry) = entries.iter().find(|e| e.id == id) else { return Ok(None) };
        match &entry.content {
            Content::Image(img) => Some(Source::Png(img.png.clone())),
            Content::Files(files) => files.iter().find(|p| is_image_file(p)).cloned().map(Source::File),
            Content::Text(_) => None,
        }
    };
    let Some(source) = source else { return Ok(None) };
    tauri::async_runtime::spawn_blocking(move || {
        let rgba = match source {
            Source::Png(png) => image::load_from_memory_with_format(&png, image::ImageFormat::Png).ok()?.to_rgba8(),
            Source::File(path) => image::open(path).ok()?.to_rgba8(),
        };
        let (width, height) = rgba.dimensions();
        let scale = (PREVIEW_SIZE as f32 / width.max(height) as f32).min(1.0);
        let (w, h) = (((width as f32 * scale) as u32).max(1), ((height as f32 * scale) as u32).max(1));
        let small = image::imageops::resize(&rgba, w, h, image::imageops::FilterType::Triangle);
        let mut png = Vec::new();
        small.write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png).ok()?;
        Some(Preview { src: format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png)), width, height })
    })
    .await
    .map_err(|e| e.to_string())
}

/// OCR on an image entry (screenshot): the recognized text goes on the clipboard
/// and on top of the history, like a fresh copy. Image files are capped.
const MAX_OCR_FILE_BYTES: u64 = 20 * 1024 * 1024;

#[tauri::command]
pub async fn clipboard_ocr(id: u64, app: AppHandle, state: State<'_, ClipboardState>) -> Result<String, String> {
    // Copy the image bytes and release the lock; OCR takes a second or two.
    let png = {
        let entries = state.entries.lock().unwrap();
        let entry = entries.iter().find(|e| e.id == id).ok_or("Eintrag nicht gefunden")?;
        match &entry.content {
            Content::Image(img) => img.png.clone(),
            Content::Files(files) => {
                let path = files.iter().find(|p| is_image_file(p)).ok_or("Kein Bild in diesem Eintrag")?;
                if std::fs::metadata(path).ok().is_some_and(|m| m.len() > MAX_OCR_FILE_BYTES) {
                    return Err("Bild zu groß für Texterkennung".to_string());
                }
                std::fs::read(path).map_err(|_| "Bild nicht lesbar".to_string())?
            }
            Content::Text(_) => return Err("Nur für Bilder".to_string()),
        }
    };
    // Direct engine read: option sweeps showed preprocessing stages scoring
    // no better than the plain path, so none run here.
    let text = tauri::async_runtime::spawn_blocking(move || crate::ocr::ocr_png(&png)).await.map_err(|e| e.to_string())??;
    {
        let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
        clipboard.set_text(text.clone()).map_err(|e| e.to_string())?;
        *state.last_seq.lock().unwrap() = unsafe { GetClipboardSequenceNumber() };
        add(&app, &state, Content::Text(text.clone()));
    }
    emit(&app, &state);
    Ok(text)
}

/// Ctrl+V in Shelf/Converter: files from the clipboard as paths. A copied image
/// (screenshot) is saved as PNG under Pictures/Notch and that path is returned.
#[tauri::command]
pub async fn clipboard_paste_files() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
        if let Ok(files) = clipboard.get().file_list() {
            if !files.is_empty() {
                return Ok(files.iter().map(|p| p.display().to_string()).collect());
            }
        }
        let Ok(img) = clipboard.get_image() else { return Ok(vec![]) };
        let rgba = image::RgbaImage::from_raw(img.width as u32, img.height as u32, img.bytes.into_owned()).ok_or("Bild unlesbar")?;
        let dir = pictures_dir().join("Notch");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join(format!("Eingefügt {}.png", local_stamp()));
        rgba.save(&path).map_err(|e| e.to_string())?;
        Ok(vec![path.display().to_string()])
    })
    .await
    .map_err(|e| e.to_string())?
}

fn pictures_dir() -> PathBuf {
    let home = std::env::var_os("USERPROFILE").map(PathBuf::from).unwrap_or_else(std::env::temp_dir);
    home.join("Pictures")
}

/// "2026-10-04 22-41-03" in local time (for file names).
fn local_stamp() -> String {
    use windows::Win32::System::SystemInformation::GetLocalTime;
    let t = unsafe { GetLocalTime() };
    format!("{:04}-{:02}-{:02} {:02}-{:02}-{:02}", t.wYear, t.wMonth, t.wDay, t.wHour, t.wMinute, t.wSecond)
}

pub fn spawn(app: AppHandle) {
    let state = app.state::<ClipboardState>();
    load_from_disk(&app, &state);

    let app_poll = app.clone();
    thread::spawn(move || {
        let app = app_poll;
        let formats = PrivateFormats::register();
        let state = app.state::<ClipboardState>();
        // Ignore whatever is already in the clipboard at startup.
        *state.last_seq.lock().unwrap() = unsafe { GetClipboardSequenceNumber() };

        loop {
            thread::sleep(POLL);
            let seq = unsafe { GetClipboardSequenceNumber() };
            if seq == *state.last_seq.lock().unwrap() {
                continue;
            }

            let mode = state.mode.load(Ordering::Relaxed);
            // Another app may hold the clipboard briefly; try again next round.
            let content = if mode == MODE_OFF || formats.is_private() {
                Some(None)
            } else if mode == MODE_TEXT {
                read_text()
            } else {
                read_content()
            };
            let Some(content) = content else { continue };
            *state.last_seq.lock().unwrap() = seq;

            if let Some(content) = content {
                add(&app, &state, content);
                emit(&app, &state);
            }
        }
    });
}

/// Formats password managers (KeePass, 1Password, Bitwarden …) use to mark content
/// as "don't record".
struct PrivateFormats {
    /// Presence alone means: don't record.
    exclude: [u32; 2],
    /// Only a DWORD value of 0 means: keep out of history.
    can_include: u32,
}

impl PrivateFormats {
    fn register() -> Self {
        unsafe {
            Self {
                exclude: [
                    RegisterClipboardFormatW(w!("ExcludeClipboardContentFromMonitorProcessing")),
                    RegisterClipboardFormatW(w!("Clipboard Viewer Ignore")),
                ],
                can_include: RegisterClipboardFormatW(w!("CanIncludeInClipboardHistory")),
            }
        }
    }

    fn is_private(&self) -> bool {
        let available = |f: u32| f != 0 && unsafe { IsClipboardFormatAvailable(f) }.is_ok();
        if self.exclude.iter().any(|&f| available(f)) {
            return true;
        }
        available(self.can_include) && read_dword(self.can_include) == Some(0)
    }
}

fn read_dword(format: u32) -> Option<u32> {
    unsafe {
        OpenClipboard(None).ok()?;
        let value = GetClipboardData(format).ok().and_then(|handle| {
            let global = HGLOBAL(handle.0);
            let ptr = GlobalLock(global) as *const u32;
            let value = (!ptr.is_null() && GlobalSize(global) >= 4).then(|| *ptr);
            let _ = GlobalUnlock(global);
            value
        });
        let _ = CloseClipboard();
        value
    }
}

/// `None` = not readable right now (retry), `Some(None)` = nothing useful.
fn read_content() -> Option<Option<Content>> {
    let mut clipboard = Clipboard::new().ok()?;
    if let Ok(files) = clipboard.get().file_list() {
        if !files.is_empty() {
            return Some(Some(Content::Files(files)));
        }
    }
    let text = clipboard.get_text().ok().filter(|t| !t.trim().is_empty());
    let image = clipboard.get_image().ok();

    Some(match (text, image) {
        // Browsers often add the image URL as text on "Copy image", so the image wins.
        // Office adds an image of the cells to text, so text wins there.
        (Some(t), Some(img)) if is_url(t.trim()) => StoredImage::new(img).map(Content::Image),
        (Some(t), _) => Some(Content::Text(t)),
        (None, Some(img)) => StoredImage::new(img).map(Content::Image),
        (None, None) => None,
    })
}

/// Text only (no files, no image is read or encoded).
fn read_text() -> Option<Option<Content>> {
    let mut clipboard = Clipboard::new().ok()?;
    Some(clipboard.get_text().ok().filter(|t| !t.trim().is_empty()).map(Content::Text))
}

fn is_url(text: &str) -> bool {
    !text.contains(char::is_whitespace)
        && (text.starts_with("http://") || text.starts_with("https://") || text.starts_with("www."))
}

fn add(app: &AppHandle, state: &ClipboardState, content: Content) {
    {
        let mut entries = state.entries.lock().unwrap();

        // Deduplicate against existing entries
        match &content {
            Content::Text(new_text) => {
                if let Some(i) = entries.iter().position(|e| matches!(&e.content, Content::Text(t) if t == new_text)) {
                    if i == 0 {
                        // Already at the top, ignore redundant sequence bump
                        return;
                    }
                    let mut entry = entries.remove(i);
                    entry.item.copied_at = now_ms();
                    entries.insert(0, entry);
                    drop(entries);
                    save_to_disk(app, state);
                    return;
                }
            }
            Content::Image(new_img) => {
                if let Some(i) = entries.iter().position(|e| match &e.content {
                    Content::Image(img) => {
                        img.width == new_img.width
                            && img.height == new_img.height
                            && (img.thumbnail == new_img.thumbnail || img.png == new_img.png)
                    }
                    _ => false,
                }) {
                    if i == 0 {
                        // Already at the top (e.g. Snipping tool double-flush / multiple format writes), ignore!
                        return;
                    }
                    let mut entry = entries.remove(i);
                    entry.item.copied_at = now_ms();
                    entries.insert(0, entry);
                    drop(entries);
                    save_to_disk(app, state);
                    return;
                }
            }
            Content::Files(new_files) => {
                if let Some(i) = entries.iter().position(|e| matches!(&e.content, Content::Files(f) if f == new_files)) {
                    if i == 0 {
                        return;
                    }
                    let mut entry = entries.remove(i);
                    entry.item.copied_at = now_ms();
                    entries.insert(0, entry);
                    drop(entries);
                    save_to_disk(app, state);
                    return;
                }
            }
        }

        let id = {
            let mut next = state.next_id.lock().unwrap();
            *next += 1;
            *next
        };
        let Some(item) = describe(id, &content) else { return };
        entries.insert(0, Entry { id, content, item });

        let max_items = *state.max_items.lock().unwrap();
        let max_images = *state.max_images.lock().unwrap();

        let mut images = 0;
        entries.retain(|e| {
            if matches!(e.content, Content::Image(_)) {
                images += 1;
                images <= max_images
            } else {
                true
            }
        });
        entries.truncate(max_items);
    }
    save_to_disk(app, state);
}

fn describe(id: u64, content: &Content) -> Option<ClipItem> {
    let copied_at = now_ms();
    Some(match content {
        Content::Text(t) => {
            let trimmed = t.trim();
            ClipItem {
                id,
                kind: if is_url(trimmed) { "link" } else { "text" },
                text: trimmed.chars().take(PREVIEW_CHARS).collect(),
                thumbnail: None,
                folders: 0,
                copied_at,
            }
        }
        Content::Image(img) => {
            ClipItem {
                id,
                kind: "image",
                text: format!("{} × {}", img.width, img.height),
                thumbnail: Some(img.thumbnail.clone()),
                folders: 0,
                copied_at,
            }
        }
        Content::Files(files) => {
            let names: Vec<String> = files
                .iter()
                .map(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| p.display().to_string()))
                .collect();
            // First image file as preview, so copied photos look like photos.
            let thumbnail = files.iter().find(|p| is_image_file(p)).and_then(|p| file_thumbnail(p));
            let folders = files.iter().filter(|p| p.is_dir()).count();
            ClipItem { id, kind: "files", text: names.join("\n"), thumbnail, folders, copied_at }
        }
    })
}

pub fn is_image_file(path: &Path) -> bool {
    path.extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .is_some_and(|e| IMAGE_EXTENSIONS.contains(&e.as_str()))
}

pub fn file_thumbnail(path: &Path) -> Option<String> {
    if std::fs::metadata(path).ok()?.len() > MAX_THUMB_FILE_BYTES {
        return None;
    }
    thumbnail(&image::open(path).ok()?.to_rgba8())
}

fn thumbnail(rgba: &image::RgbaImage) -> Option<String> {
    let scale = (THUMB_SIZE as f32 / rgba.width().max(rgba.height()) as f32).min(1.0);
    let (w, h) = (((rgba.width() as f32 * scale) as u32).max(1), ((rgba.height() as f32 * scale) as u32).max(1));
    let small = image::imageops::thumbnail(rgba, w, h);
    let mut png = Vec::new();
    small.write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png).ok()?;
    Some(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png)))
}

fn items(state: &ClipboardState) -> Vec<ClipItem> {
    state.entries.lock().unwrap().iter().map(|e| e.item.clone()).collect()
}

fn emit(app: &AppHandle, state: &ClipboardState) {
    let _ = app.emit("clipboard://update", items(state));
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

#[derive(Serialize, Deserialize)]
enum PersistedContent {
    Text(String),
    Image {
        width: u32,
        height: u32,
        thumbnail: String,
    },
    Files {
        paths: Vec<PathBuf>,
        folders: usize,
        thumbnail: Option<String>,
    },
}

#[derive(Serialize, Deserialize)]
struct PersistedEntry {
    id: u64,
    copied_at: u64,
    content: PersistedContent,
}

fn prune_images_dir(images_dir: &Path, active_image_ids: &HashSet<u64>) {
    if let Ok(dir_entries) = std::fs::read_dir(images_dir) {
        for entry in dir_entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("png")) {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Ok(id) = stem.parse::<u64>() {
                        if !active_image_ids.contains(&id) {
                            let _ = std::fs::remove_file(&path);
                        }
                    }
                }
            }
        }
    }
}

fn save_to_disk(app: &AppHandle, state: &ClipboardState) {
    let (to_save, active_image_ids, new_images): (Vec<PersistedEntry>, HashSet<u64>, Vec<(u64, Vec<u8>)>) = {
        let entries = state.entries.lock().unwrap();
        let mut to_save = Vec::with_capacity(entries.len());
        let mut active_image_ids = HashSet::new();
        let mut new_images = Vec::new();

        for e in entries.iter() {
            match &e.content {
                Content::Text(t) => {
                    to_save.push(PersistedEntry {
                        id: e.id,
                        copied_at: e.item.copied_at,
                        content: PersistedContent::Text(t.clone()),
                    });
                }
                Content::Image(img) => {
                    active_image_ids.insert(e.id);
                    new_images.push((e.id, img.png.clone()));
                    to_save.push(PersistedEntry {
                        id: e.id,
                        copied_at: e.item.copied_at,
                        content: PersistedContent::Image {
                            width: img.width,
                            height: img.height,
                            thumbnail: img.thumbnail.clone(),
                        },
                    });
                }
                Content::Files(paths) => {
                    to_save.push(PersistedEntry {
                        id: e.id,
                        copied_at: e.item.copied_at,
                        content: PersistedContent::Files {
                            paths: paths.clone(),
                            folders: e.item.folders,
                            thumbnail: e.item.thumbnail.clone(),
                        },
                    });
                }
            }
        }
        (to_save, active_image_ids, new_images)
    };

    let Ok(dir) = app.path().app_data_dir() else { return };
    let clipboard_dir = dir.join("clipboard");
    let images_dir = clipboard_dir.join("images");
    let _ = std::fs::create_dir_all(&images_dir);

    for (id, png_bytes) in new_images {
        let img_file = images_dir.join(format!("{id}.png"));
        if !img_file.exists() {
            let _ = std::fs::write(&img_file, png_bytes);
        }
    }

    prune_images_dir(&images_dir, &active_image_ids);

    let history_file = clipboard_dir.join("history.json");
    if let Ok(json) = serde_json::to_string(&to_save) {
        let _ = std::fs::write(history_file, json);
    }
}

fn load_from_disk(app: &AppHandle, state: &ClipboardState) {
    let Ok(dir) = app.path().app_data_dir() else { return };
    let clipboard_dir = dir.join("clipboard");
    let history_file = clipboard_dir.join("history.json");
    let images_dir = clipboard_dir.join("images");

    if !history_file.exists() {
        return;
    }

    let Ok(json) = std::fs::read_to_string(&history_file) else { return };
    let Ok(persisted_entries) = serde_json::from_str::<Vec<PersistedEntry>>(&json) else { return };

    let mut restored_entries: Vec<Entry> = Vec::new();
    let mut active_image_ids = HashSet::new();
    let mut image_count = 0;
    let max_items = *state.max_items.lock().unwrap();
    let max_images = *state.max_images.lock().unwrap();

    for p in persisted_entries {
        if restored_entries.len() >= max_items {
            break;
        }

        match p.content {
            PersistedContent::Text(text) => {
                let trimmed = text.trim();
                let kind = if is_url(trimmed) { "link" } else { "text" };
                let item = ClipItem {
                    id: p.id,
                    kind,
                    text: trimmed.chars().take(PREVIEW_CHARS).collect(),
                    thumbnail: None,
                    folders: 0,
                    copied_at: p.copied_at,
                };
                restored_entries.push(Entry {
                    id: p.id,
                    content: Content::Text(text),
                    item,
                });
            }
            PersistedContent::Image { width, height, thumbnail } => {
                if image_count >= max_images {
                    continue;
                }
                let img_path = images_dir.join(format!("{}.png", p.id));
                if let Ok(png) = std::fs::read(&img_path) {
                    active_image_ids.insert(p.id);
                    image_count += 1;
                    let item = ClipItem {
                        id: p.id,
                        kind: "image",
                        text: format!("{width} × {height}"),
                        thumbnail: Some(thumbnail.clone()),
                        folders: 0,
                        copied_at: p.copied_at,
                    };
                    restored_entries.push(Entry {
                        id: p.id,
                        content: Content::Image(StoredImage {
                            width,
                            height,
                            png,
                            thumbnail,
                        }),
                        item,
                    });
                }
            }
            PersistedContent::Files { paths, folders, thumbnail } => {
                let names: Vec<String> = paths
                    .iter()
                    .map(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| p.display().to_string()))
                    .collect();
                let item = ClipItem {
                    id: p.id,
                    kind: "files",
                    text: names.join("\n"),
                    thumbnail,
                    folders,
                    copied_at: p.copied_at,
                };
                restored_entries.push(Entry {
                    id: p.id,
                    content: Content::Files(paths),
                    item,
                });
            }
        }
    }

    prune_images_dir(&images_dir, &active_image_ids);

    let max_id = restored_entries.iter().map(|e| e.id).max().unwrap_or(0);
    *state.next_id.lock().unwrap() = max_id;
    *state.entries.lock().unwrap() = restored_entries;
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A 4K "screenshot" tiled from a real one: round trip is lossless and far smaller than RGBA.
    #[test]
    fn stored_image_is_lossless_and_compact() {
        let tile = image::open(concat!(env!("CARGO_MANIFEST_DIR"), "/../docs/media/vault-passwords.png")).unwrap().to_rgba8();
        let (w, h) = (3840, 2160);
        let shot = image::RgbaImage::from_fn(w, h, |x, y| *tile.get_pixel(x % tile.width(), y % tile.height()));
        let raw = shot.as_raw().len();

        let started = std::time::Instant::now();
        let stored = StoredImage::new(ImageData { width: w as usize, height: h as usize, bytes: shot.as_raw().clone().into() }).unwrap();
        let encode = started.elapsed();
        let started = std::time::Instant::now();
        let back = stored.rgba().unwrap();
        let decode = started.elapsed();

        println!("raw {} MB → png {:.2} MB, encode {encode:?}, decode {decode:?}", raw / 1_048_576, stored.png.len() as f64 / 1_048_576.0);
        assert_eq!((stored.width, stored.height), (w, h));
        assert!(back == shot, "pixels changed");
        assert!(stored.png.len() * 5 < raw, "not compressed enough");
        assert!(stored.thumbnail.starts_with("data:image/png;base64,"));
    }
}
