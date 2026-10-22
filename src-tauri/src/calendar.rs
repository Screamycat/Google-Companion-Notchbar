//! Authenticated Google Calendar (`calendar.google.com`) bridge via WebView2.
//!
//! Shares the exact same `gemini-web-profile` WebView2 user data directory as `gemini.rs`
//! so signing in once on either tab authenticates both Gemini and Google Calendar.
//!
//! Fetches full calendar data via two complementary channels:
//! 1. Same-origin authenticated `exporticalzip` fetch inside `calendar.google.com`,
//!    parsed in Rust via `zip` + RFC 5545 `.ics` / `RRULE` expansion.
//! 2. Live DOM Agenda scraper on `calendar.google.com/calendar/u/0/r/agenda` for shared
//!    calendars and immediate visual updates.

use std::collections::HashMap;
use std::io::{Cursor, Read};
use std::path::PathBuf;
use std::sync::Mutex;
use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, Position, Url, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
use webview2_com::WebMessageReceivedEventHandler;
use windows::core::PWSTR;

const CALENDAR_BRIDGE_LABEL: &str = "calendar_bridge";
const CALENDAR_URL: &str = "https://calendar.google.com/calendar/u/0/r";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEventItem {
    pub id: String,
    pub title: String,
    /// Unix epoch milliseconds
    pub start_ms: i64,
    /// Unix epoch milliseconds
    pub end_ms: i64,
    pub all_day: bool,
    pub calendar_name: String,
    pub color: String,
    pub location: Option<String>,
    pub meet_url: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarStatus {
    pub initialized: bool,
    pub authenticated: bool,
    pub syncing: bool,
    pub account: Option<String>,
    pub last_synced_ms: Option<i64>,
    pub error: Option<String>,
}

impl Default for CalendarStatus {
    fn default() -> Self {
        Self {
            initialized: false,
            authenticated: false,
            syncing: false,
            account: None,
            last_synced_ms: None,
            error: None,
        }
    }
}

#[derive(Default)]
pub struct CalendarState {
    pub status: Mutex<CalendarStatus>,
    pub events: Mutex<Vec<CalendarEventItem>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum BridgeIncoming {
    Status {
        authenticated: bool,
        account: Option<String>,
    },
    IcalZip {
        data: String,
    },
    DomEvents {
        events: Vec<DomScrapedEvent>,
    },
    DiscoveredFeeds {
        feeds: Vec<DiscoveredFeed>,
    },
    Error {
        message: String,
    },
    DebugLog {
        text: String,
    },
    HideWindow,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiscoveredFeed {
    #[allow(dead_code)]
    id: String,
    name: String,
    url: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DomScrapedEvent {
    id: String,
    title: String,
    start_ms: i64,
    end_ms: i64,
    all_day: bool,
    color: Option<String>,
    location: Option<String>,
    meet_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum NotchCalendarPayload {
    Status(CalendarStatus),
    Events { events: Vec<CalendarEventItem> },
}

const CALENDAR_BRIDGE_INIT_SCRIPT: &str = r#"
(function() {
  if (window.__notchCalendarBridgeInstalled) return;
  window.__notchCalendarBridgeInstalled = true;

  function post(payload) {
    try {
      if (window.chrome && window.chrome.webview && window.chrome.webview.postMessage) {
        window.chrome.webview.postMessage(JSON.stringify(payload));
      }
    } catch (_) {}
  }

  let lastAuth = null;
  let lastAccount = null;
  let zipFetchedAt = 0;
  let feedsFetchedAt = 0;

  function isSignInPage() {
    const host = location.hostname || '';
    if (host.includes('accounts.google.com') || host.includes('workspace.google.com')) return true;
    const signInLink = document.querySelector('a[href*="accounts.google.com/ServiceLogin"]');
    if (signInLink) return true;
    return false;
  }

  function detectAccount() {
    const acctEl = document.querySelector('a[aria-label*="@"], button[aria-label*="@"], [data-email*="@"]');
    if (acctEl) {
      const emailAttr = acctEl.getAttribute('data-email');
      if (emailAttr && emailAttr.includes('@')) return emailAttr.trim();
      const label = acctEl.getAttribute('aria-label') || '';
      const m = label.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
      if (m) return m[0];
    }
    return null;
  }

  function ensureTopHelperBar(authenticated, account) {
    if (!document.body) return;
    let bar = document.getElementById('__notch-calendar-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = '__notch-calendar-bar';
      bar.style.cssText = [
        'position:fixed',
        'bottom:14px',
        'right:18px',
        'z-index:2147483647',
        'display:flex',
        'align-items:center',
        'gap:10px',
        'padding:8px 14px',
        'border-radius:999px',
        'background:rgba(15,18,26,0.94)',
        'border:1px solid rgba(255,255,255,0.16)',
        'box-shadow:0 10px 28px rgba(0,0,0,0.45)',
        'color:#f3f4f6',
        'font-family:system-ui,-apple-system,sans-serif',
        'font-size:12px'
      ].join(';');

      const dot = document.createElement('span');
      dot.id = '__notch-calendar-dot';
      dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#10b981;';

      const label = document.createElement('span');
      label.id = '__notch-calendar-label';
      label.style.cssText = 'font-weight:500;';

      const btn = document.createElement('button');
      btn.textContent = 'Done - Back to Notch';
      btn.style.cssText = [
        'padding:4px 10px',
        'border-radius:999px',
        'border:none',
        'background:#4285f4',
        'color:#fff',
        'font-size:11px',
        'font-weight:600',
        'cursor:pointer'
      ].join(';');
      btn.onclick = function() {
        post({ type: 'hide_window' });
      };

      bar.appendChild(dot);
      bar.appendChild(label);
      bar.appendChild(btn);
      document.body.appendChild(bar);
    }

    const dot = document.getElementById('__notch-calendar-dot');
    const label = document.getElementById('__notch-calendar-label');
    if (dot && label) {
      if (authenticated) {
        dot.style.background = '#34d399';
        label.textContent = 'Google Calendar Connected' + (account ? ' (' + account + ')' : '');
      } else {
        dot.style.background = '#fbbf24';
        label.textContent = 'Sign in with your Google Account to sync your Calendar';
      }
    }
  }

  async function fetchIcalZip() {
    if (!location.hostname.includes('calendar.google.com')) return;
    if (isSignInPage()) return;
    const now = Date.now();
    if (now - zipFetchedAt < 25000) return;
    zipFetchedAt = now;

    try {
      const resp = await fetch('https://calendar.google.com/calendar/u/0/exporticalzip', {
        credentials: 'include'
      });
      if (!resp.ok) return;
      const buf = await resp.arrayBuffer();
      if (!buf || buf.byteLength < 30) return;
      const bytes = new Uint8Array(buf);
      // Verify PK zip header (0x50, 0x4B)
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) return;

      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      const b64 = btoa(binary);
      post({ type: 'ical_zip', data: b64 });
      fetchSubscribedFeeds();
    } catch (e) {
      // Fallback to DOM scraping
    }
  }

  async function fetchSubscribedFeeds() {
    if (!location.hostname.includes('calendar.google.com')) return;
    if (isSignInPage()) return;
    const now = Date.now();
    if (now - feedsFetchedAt < 25000) return;
    feedsFetchedAt = now;

    try {
      const sResp = await fetch('https://calendar.google.com/calendar/u/0/r/settings', {
        credentials: 'include'
      });
      if (!sResp.ok) return;
      const sHtml = await sResp.text();

      const feeds = [];
      const seenUrls = new Set();
      // Match each ["<id>@import.calendar.google.com", ["<name>", ..., "<url>"]]
      const re = /"([a-zA-Z0-9._%+-]+@import\.calendar\.google\.com)",\s*\["([^"]+)"[\s\S]*?"((?:https?|webcal):\/[^"]+)"/g;
      let m;
      while ((m = re.exec(sHtml)) !== null) {
        const id = m[1];
        let name = m[2];
        try {
          name = JSON.parse('"' + name + '"');
        } catch (_) {}

        let url = m[3];
        if (url.startsWith('webcal://')) {
          url = 'https://' + url.slice(9);
        }
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          feeds.push({ id: id, name: name, url: url });
        }
      }
      if (feeds.length > 0) {
        post({ type: 'discovered_feeds', feeds: feeds });
      }
    } catch (_) {}
  }

  function scrapeAgendaDom() {
    if (!location.hostname.includes('calendar.google.com')) return;
    if (isSignInPage()) return;

    try {
      const results = [];
      // Look for event elements with data-eventid in Google Calendar
      const chips = Array.from(document.querySelectorAll('[data-eventid]'));
      for (let i = 0; i < chips.length; i++) {
        const el = chips[i];
        const eventId = el.getAttribute('data-eventid') || ('dom-' + i);
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;

        // Check aria-label or child text for structured date/time info
        const aria = el.getAttribute('aria-label') || (el.querySelector('[aria-label]') && el.querySelector('[aria-label]').getAttribute('aria-label')) || '';
        const info = aria || text;
        if (info.length < 2) continue;

        let color = null;
        const styleBg = el.style && (el.style.backgroundColor || el.style.borderColor);
        if (styleBg) color = styleBg;

        let meetUrl = null;
        const meetAnchor = el.querySelector('a[href*="meet.google.com"], a[href*="zoom.us"], a[href*="teams.microsoft.com"], a[href^="http"]');
        if (meetAnchor) meetUrl = meetAnchor.getAttribute('href');

        results.push({
          id: eventId,
          title: text.slice(0, 120),
          aria: info,
          color: color,
          meetUrl: meetUrl
        });
      }
      if (results.length > 0) {
        post({ type: 'dom_events', events: results });
      }
    } catch (_) {}
  }

  function checkStatus(force) {
    const signIn = isSignInPage();
    const hasCalendarUi =
      location.hostname.includes('calendar.google.com') &&
      !signIn &&
      Boolean(document.querySelector('[role="main"], [data-viewfamily], header, [aria-label*="Calendar" i], [aria-label*="Kalender" i]'));

    const authenticated = !signIn && hasCalendarUi;
    const account = authenticated ? detectAccount() : null;

    ensureTopHelperBar(authenticated, account);

    if (force || authenticated !== lastAuth || account !== lastAccount) {
      lastAuth = authenticated;
      lastAccount = account;
      post({
        type: 'status',
        authenticated: authenticated,
        account: account
      });
      if (authenticated) {
        fetchIcalZip();
        fetchSubscribedFeeds();
      }
    }
  }

  async function runDebugProbe() {
    try {
      let lines = [];
      lines.push('URL: ' + location.href);
      lines.push('Title: ' + document.title);

      // Try clicking hamburger menu to open sidebar if collapsed
      const hamburger = document.querySelector('button[aria-label*="huvudmeny" i], button[aria-label*="main menu" i], button[aria-label*="meny" i], button[aria-label*="menu" i]');
      if (hamburger && hamburger.getAttribute('aria-expanded') !== 'true') {
        lines.push('Clicked hamburger: ' + (hamburger.getAttribute('aria-label') || 'btn'));
        hamburger.click();
        await new Promise(r => setTimeout(r, 800));
      }

      const cbs = Array.from(document.querySelectorAll('[role="checkbox"]'));
      lines.push('Checkboxes count: ' + cbs.length);
      for (const c of cbs) {
        lines.push('  CB: ' + (c.getAttribute('aria-label') || c.innerText || '').replace(/\n/g, ' ') + ' | checked=' + c.getAttribute('aria-checked') + ' | data-id=' + c.getAttribute('data-id'));
      }

      const links = Array.from(document.querySelectorAll('a[href*="calendar"]'));
      lines.push('Calendar links count: ' + links.length);
      for (const a of links.slice(0, 30)) {
        lines.push('  A: ' + a.href + ' | ' + (a.innerText || ''));
      }

      // Check window keys of interest
      try {
        const wKeys = Object.keys(window).filter(k => k.startsWith('_') || k.includes('WIZ') || k.includes('data') || k.includes('calendar') || k.includes('cl'));
        lines.push('Window special keys: ' + wKeys.slice(0, 20).join(', '));
      } catch (_) {}

      // Try fetching settings page HTML to extract all subscribed/other calendar IDs
      try {
        const sResp = await fetch('https://calendar.google.com/calendar/u/0/r/settings');
        const sHtml = await sResp.text();
        lines.push('Settings HTML length: ' + sHtml.length);

        const idMatches = sHtml.match(/[a-zA-Z0-9._%+-]+@(?:group\.calendar\.google\.com|import\.calendar\.google\.com)/g);
        if (idMatches) lines.push('Calendar ID matches: ' + JSON.stringify([...new Set(idMatches)]));

        // Find context around @import.calendar.google.com
        const importRegex = /"([^"]+@import\.calendar\.google\.com)"/g;
        let match;
        while ((match = importRegex.exec(sHtml)) !== null) {
          const start = Math.max(0, match.index - 50);
          const end = Math.min(sHtml.length, match.index + 450);
          lines.push('Imported cal snippet: ' + JSON.stringify(sHtml.slice(start, end)));
        }

        const icsMatches = sHtml.match(/(?:https?|webcal):\/\/[^\s"'\\]+?(?:\.ics|timeedit)[^\s"'\\]*/g);
        if (icsMatches) lines.push('ICS matches: ' + JSON.stringify([...new Set(icsMatches)]));

        const timeeditMatches = sHtml.match(/.{0,50}timeedit.{0,50}/gi);
        if (timeeditMatches) lines.push('TimeEdit mentions: ' + JSON.stringify(timeeditMatches.slice(0, 5)));
      } catch (e) {
        lines.push('Settings fetch error: ' + e);
      }

      post({ type: 'debug_log', text: lines.join('\n') });
    } catch (e) {
      post({ type: 'debug_log', text: 'Probe error: ' + e });
    }
  }

  window.__notchCalendarSync = function() {
    zipFetchedAt = 0;
    feedsFetchedAt = 0;
    checkStatus(true);
    fetchIcalZip();
    fetchSubscribedFeeds();
    scrapeAgendaDom();
    runDebugProbe();
  };

  setInterval(function() { checkStatus(false); }, 2000);
  // Refresh iCal zip and subscribed feeds every 5 minutes while bridge is alive
  setInterval(function() {
    if (lastAuth) {
      fetchIcalZip();
      fetchSubscribedFeeds();
    }
  }, 300000);

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() { checkStatus(true); runDebugProbe(); }, 500);
      setTimeout(runDebugProbe, 4000);
    });
  } else {
    setTimeout(function() { checkStatus(true); runDebugProbe(); }, 500);
    setTimeout(runDebugProbe, 4000);
  }
})();
"#;

fn cache_file_path(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("notch-calendar"));
    let _ = std::fs::create_dir_all(&dir);
    dir.join("calendar-events-cache.json")
}

pub fn load_cached_events(app: &AppHandle) {
    let path = cache_file_path(app);
    if let Ok(raw) = std::fs::read_to_string(&path) {
        if let Ok(cached) = serde_json::from_str::<Vec<CalendarEventItem>>(&raw) {
            let state = app.state::<CalendarState>();
            let mut ev = state.events.lock().unwrap();
            if ev.is_empty() && !cached.is_empty() {
                *ev = cached;
            }
        }
    }
}

fn save_cached_events(app: &AppHandle, events: &[CalendarEventItem]) {
    let path = cache_file_path(app);
    if let Ok(json) = serde_json::to_string(events) {
        let _ = std::fs::write(path, json);
    }
}

fn emit_status(app: &AppHandle) {
    let state = app.state::<CalendarState>();
    let status = state.status.lock().unwrap().clone();
    let _ = app.emit("notch://calendar", NotchCalendarPayload::Status(status));
}

fn emit_events(app: &AppHandle) {
    let state = app.state::<CalendarState>();
    let events = state.events.lock().unwrap().clone();
    let _ = app.emit("notch://calendar", NotchCalendarPayload::Events { events });
}

fn hide_bridge_window_safely(win: &WebviewWindow) {
    let _ = win.set_position(Position::Physical(PhysicalPosition::new(-32000, -32000)));
    let _ = win.hide();
}

fn show_bridge_window_safely(win: &WebviewWindow) {
    let _ = win.unminimize();
    let _ = win.center();
    let _ = win.show();
    let _ = win.set_always_on_top(true);
    let _ = win.set_focus();
    let _ = win.set_always_on_top(false);
}

fn ensure_calendar_bridge(app: &AppHandle, show: bool) -> Result<WebviewWindow, String> {
    if let Some(existing) = app.get_webview_window(CALENDAR_BRIDGE_LABEL) {
        if show {
            show_bridge_window_safely(&existing);
        }
        {
            let state = app.state::<CalendarState>();
            let mut s = state.status.lock().unwrap();
            s.initialized = true;
        }
        emit_status(app);
        return Ok(existing);
    }

    let url: Url = CALENDAR_URL.parse().map_err(|e| format!("{e}"))?;
    // Share the exact same `gemini-web-profile` directory so Google sign-in is unified!
    let data_dir = app
        .path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("notch-gemini"))
        .join("gemini-web-profile");
    let _ = std::fs::create_dir_all(&data_dir);

    let mut builder = WebviewWindowBuilder::new(app, CALENDAR_BRIDGE_LABEL, WebviewUrl::External(url))
        .title("Google Calendar — Account Setup")
        .inner_size(960.0, 720.0)
        .min_inner_size(520.0, 480.0)
        .visible(show)
        .focused(show)
        .data_directory(data_dir)
        .additional_browser_args(
            "--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows",
        )
        .initialization_script(CALENDAR_BRIDGE_INIT_SCRIPT);

    if show {
        builder = builder.center();
    } else {
        builder = builder.position(-32000.0, -32000.0);
    }

    let window = builder.build().map_err(|e| {
        eprintln!("[calendar_bridge] Failed to build WebviewWindow: {e}");
        e.to_string()
    })?;

    if show {
        show_bridge_window_safely(&window);
    }

    let app_for_close = app.clone();
    let win_for_close = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            hide_bridge_window_safely(&win_for_close);
            emit_status(&app_for_close);
        }
    });

    let app_for_msg = app.clone();
    let win_for_msg = window.clone();
    let _ = window.with_webview(move |webview| unsafe {
        let Ok(core) = webview.controller().CoreWebView2() else { return };
        let app_handle = app_for_msg.clone();
        let win_handle = win_for_msg.clone();
        let handler = WebMessageReceivedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else { return Ok(()) };
            let mut text = PWSTR::null();
            if args.TryGetWebMessageAsString(&mut text).is_err() || text.is_null() {
                return Ok(());
            }
            let raw = text.to_string().ok();
            windows::Win32::System::Com::CoTaskMemFree(Some(text.0 as _));
            let Some(json_str) = raw else { return Ok(()) };

            let Ok(incoming) = serde_json::from_str::<BridgeIncoming>(&json_str) else {
                return Ok(());
            };

            match incoming {
                BridgeIncoming::Status {
                    authenticated,
                    account,
                } => {
                    let state = app_handle.state::<CalendarState>();
                    let mut s = state.status.lock().unwrap();
                    s.initialized = true;
                    s.authenticated = authenticated;
                    if account.is_some() {
                        s.account = account;
                    }
                    drop(s);
                    emit_status(&app_handle);
                }
                BridgeIncoming::IcalZip { data } => {
                    let app_clone = app_handle.clone();
                    tauri::async_runtime::spawn_blocking(move || {
                        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(&data) {
                            let parsed = parse_ical_zip_bytes(&bytes);
                            let now_ms = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .map(|d| d.as_millis() as i64)
                                .unwrap_or(0);
                            let combined = {
                                let state = app_clone.state::<CalendarState>();
                                let mut ev = state.events.lock().unwrap();
                                // Retain any existing events from external feeds (not present in zip)
                                let zip_cal_names: std::collections::HashSet<String> =
                                    parsed.iter().map(|e| e.calendar_name.clone()).collect();
                                let external: Vec<CalendarEventItem> = ev
                                    .iter()
                                    .filter(|e| !zip_cal_names.contains(&e.calendar_name))
                                    .cloned()
                                    .collect();
                                let merged = merge_calendar_events(&parsed, &external);
                                *ev = merged.clone();
                                {
                                    let mut s = state.status.lock().unwrap();
                                    s.syncing = false;
                                    s.authenticated = true;
                                    s.last_synced_ms = Some(now_ms);
                                    s.error = None;
                                }
                                merged
                            };
                            save_cached_events(&app_clone, &combined);
                            emit_status(&app_clone);
                            emit_events(&app_clone);
                        }
                    });
                }
                BridgeIncoming::DiscoveredFeeds { feeds } => {
                    let app_clone = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let mut new_events = Vec::new();
                        let now_ms = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_millis() as i64)
                            .unwrap_or(0);
                        let window_start_ms = now_ms - 90 * 86_400_000;
                        let window_end_ms = now_ms + 180 * 86_400_000;

                        let client = reqwest::Client::builder()
                            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
                            .timeout(std::time::Duration::from_secs(15))
                            .build()
                            .unwrap_or_default();

                        for (idx, feed) in feeds.iter().enumerate() {
                            let color = CALENDAR_PALETTE[(idx + 4) % CALENDAR_PALETTE.len()].to_string();
                            if let Ok(resp) = client.get(&feed.url).send().await {
                                if resp.status().is_success() {
                                    if let Ok(raw) = resp.text().await {
                                        if raw.contains("BEGIN:VCALENDAR") {
                                            let mut parsed = parse_ics_string(&raw, &color, window_start_ms, window_end_ms);
                                            let feed_name = feed.name.trim();
                                            for ev in &mut parsed {
                                                if !feed_name.is_empty() && (ev.calendar_name == "Calendar" || ev.calendar_name.is_empty()) {
                                                    ev.calendar_name = feed_name.to_string();
                                                }
                                            }
                                            new_events.append(&mut parsed);
                                        }
                                    }
                                }
                            }
                        }

                        if !new_events.is_empty() {
                            let state = app_clone.state::<CalendarState>();
                            let mut ev = state.events.lock().unwrap();
                            let combined = merge_calendar_events(&ev, &new_events);
                            *ev = combined.clone();
                            drop(ev);

                            save_cached_events(&app_clone, &combined);
                            emit_events(&app_clone);
                        }
                    });
                }
                BridgeIncoming::DomEvents { events } => {
                    if events.is_empty() {
                        return Ok(());
                    }
                    let state = app_handle.state::<CalendarState>();
                    let existing_empty = state.events.lock().unwrap().is_empty();
                    // Use DOM events immediately if iCal zip hasn't populated events yet
                    if existing_empty {
                        let mapped: Vec<CalendarEventItem> = events
                            .into_iter()
                            .map(|d| CalendarEventItem {
                                id: d.id,
                                title: d.title,
                                start_ms: d.start_ms,
                                end_ms: d.end_ms,
                                all_day: d.all_day,
                                calendar_name: "Calendar".to_string(),
                                color: d.color.unwrap_or_else(|| "#4285f4".to_string()),
                                location: d.location,
                                meet_url: d.meet_url,
                                description: None,
                            })
                            .collect();
                        {
                            let mut ev = state.events.lock().unwrap();
                            *ev = mapped.clone();
                        }
                        {
                            let mut s = state.status.lock().unwrap();
                            s.syncing = false;
                            s.authenticated = true;
                        }
                        save_cached_events(&app_handle, &mapped);
                        emit_status(&app_handle);
                        emit_events(&app_handle);
                    }
                }
                BridgeIncoming::Error { message } => {
                    let state = app_handle.state::<CalendarState>();
                    let mut s = state.status.lock().unwrap();
                    s.syncing = false;
                    s.error = Some(message);
                    drop(s);
                    emit_status(&app_handle);
                }
                BridgeIncoming::DebugLog { text } => {
                    let dir = app_handle.path().app_local_data_dir().unwrap_or_else(|_| std::env::temp_dir());
                    let _ = std::fs::write(dir.join("calendar-debug.log"), &text);
                }
                BridgeIncoming::HideWindow => {
                    hide_bridge_window_safely(&win_handle);
                    emit_status(&app_handle);
                }
            }
            Ok(())
        }));
        let mut token = Default::default();
        let _ = core.add_WebMessageReceived(&handler, &mut token);
    });

    {
        let state = app.state::<CalendarState>();
        let mut s = state.status.lock().unwrap();
        s.initialized = true;
    }
    emit_status(app);

    Ok(window)
}

const CALENDAR_PALETTE: &[&str] = &[
    "#4285f4", // Google Blue
    "#34a853", // Google Green
    "#a855f7", // Grape Purple
    "#f59e0b", // Tangerine
    "#ec4899", // Flamingo Pink
    "#06b6d4", // Peacock Cyan
    "#eab308", // Banana Yellow
];

fn merge_calendar_events(
    primary: &[CalendarEventItem],
    secondary: &[CalendarEventItem],
) -> Vec<CalendarEventItem> {
    let mut merged = primary.to_vec();
    merged.extend_from_slice(secondary);
    let mut seen = std::collections::HashSet::new();
    merged.retain(|e| seen.insert((e.title.clone(), e.start_ms, e.calendar_name.clone())));
    merged.sort_by(|a, b| {
        a.start_ms
            .cmp(&b.start_ms)
            .then_with(|| b.all_day.cmp(&a.all_day))
            .then_with(|| a.title.cmp(&b.title))
    });
    merged
}

fn parse_ical_zip_bytes(bytes: &[u8]) -> Vec<CalendarEventItem> {
    let cursor = Cursor::new(bytes);
    let Ok(mut archive) = zip::ZipArchive::new(cursor) else {
        return Vec::new();
    };

    let mut all_events = Vec::new();
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    // Window: 90 days in the past to 180 days in the future
    let window_start_ms = now_ms - 90 * 86_400_000;
    let window_end_ms = now_ms + 180 * 86_400_000;

    for idx in 0..archive.len() {
        let Ok(mut file) = archive.by_index(idx) else { continue };
        if !file.name().to_lowercase().ends_with(".ics") {
            continue;
        }
        let mut content = String::new();
        if file.read_to_string(&mut content).is_err() {
            continue;
        }
        let color = CALENDAR_PALETTE[idx % CALENDAR_PALETTE.len()].to_string();
        let mut cal_events = parse_ics_string(&content, &color, window_start_ms, window_end_ms);
        all_events.append(&mut cal_events);
    }

    // Sort chronologically: start_ms ascending, then all_day first
    all_events.sort_by(|a, b| {
        a.start_ms
            .cmp(&b.start_ms)
            .then_with(|| b.all_day.cmp(&a.all_day))
            .then_with(|| a.title.cmp(&b.title))
    });

    // Deduplicate identical (uid/title + start_ms)
    let mut seen = std::collections::HashSet::new();
    all_events.retain(|e| seen.insert((e.title.clone(), e.start_ms)));

    all_events
}

fn parse_ics_string(
    raw: &str,
    default_color: &str,
    window_start_ms: i64,
    window_end_ms: i64,
) -> Vec<CalendarEventItem> {
    // 1. Unfold RFC 5545 folded lines (lines starting with ' ' or '\t')
    let mut lines: Vec<String> = Vec::new();
    for line in raw.lines() {
        let line = line.trim_end_matches('\r');
        if let Some(stripped) = line.strip_prefix(' ').or_else(|| line.strip_prefix('\t')) {
            if let Some(last) = lines.last_mut() {
                last.push_str(stripped);
                continue;
            }
        }
        lines.push(line.to_string());
    }

    let mut calendar_name = "Calendar".to_string();
    let mut calendar_color = default_color.to_string();
    let mut results = Vec::new();

    let mut in_event = false;
    let mut props: Vec<(String, String, String)> = Vec::new(); // (key, params, value)

    for line in &lines {
        if !in_event {
            if let Some(val) = line.strip_prefix("X-WR-CALNAME:") {
                let clean = unescape_ics_text(val.trim());
                if !clean.is_empty() {
                    calendar_name = clean;
                }
            } else if let Some(val) = line.strip_prefix("X-APPLE-CALENDAR-COLOR:").or_else(|| line.strip_prefix("COLOR:")) {
                let c = val.trim();
                if c.starts_with('#') && (c.len() == 7 || c.len() == 4) {
                    calendar_color = c.to_string();
                }
            } else if *line == "BEGIN:VEVENT" {
                in_event = true;
                props.clear();
            }
            continue;
        }

        if *line == "END:VEVENT" {
            in_event = false;
            expand_vevent(
                &props,
                &calendar_name,
                &calendar_color,
                window_start_ms,
                window_end_ms,
                &mut results,
            );
            continue;
        }

        if let Some(colon_idx) = line.find(':') {
            let left = &line[..colon_idx];
            let value = &line[colon_idx + 1..];
            let (key, params) = if let Some(semi_idx) = left.find(';') {
                (left[..semi_idx].to_uppercase(), left[semi_idx + 1..].to_string())
            } else {
                (left.to_uppercase(), String::new())
            };
            props.push((key, params, value.to_string()));
        }
    }

    results
}

fn expand_vevent(
    props: &[(String, String, String)],
    calendar_name: &str,
    calendar_color: &str,
    window_start_ms: i64,
    window_end_ms: i64,
    out: &mut Vec<CalendarEventItem>,
) {
    let mut uid = String::new();
    let mut summary = String::new();
    let mut description: Option<String> = None;
    let mut location: Option<String> = None;
    let mut url_prop: Option<String> = None;
    let mut status = String::new();
    let mut dtstart_raw: Option<(&str, &str)> = None;
    let mut dtend_raw: Option<(&str, &str)> = None;
    let mut rrule_raw: Option<&str> = None;
    let mut exdates_ms: Vec<i64> = Vec::new();

    for (key, params, val) in props {
        match key.as_str() {
            "UID" => uid = val.trim().to_string(),
            "SUMMARY" => summary = unescape_ics_text(val.trim()),
            "DESCRIPTION" => {
                let d = unescape_ics_text(val.trim());
                if !d.is_empty() {
                    description = Some(d);
                }
            }
            "LOCATION" => {
                let l = unescape_ics_text(val.trim());
                if !l.is_empty() {
                    location = Some(l);
                }
            }
            "URL" | "X-GOOGLE-CONFERENCE" => {
                let u = val.trim();
                if u.starts_with("http://") || u.starts_with("https://") {
                    url_prop = Some(u.to_string());
                }
            }
            "STATUS" => status = val.trim().to_uppercase(),
            "DTSTART" => dtstart_raw = Some((params.as_str(), val.trim())),
            "DTEND" => dtend_raw = Some((params.as_str(), val.trim())),
            "RRULE" => rrule_raw = Some(val.trim()),
            "EXDATE" => {
                for part in val.split(',') {
                    if let Some((ms, _)) = parse_ics_datetime(params, part.trim()) {
                        exdates_ms.push(ms);
                    }
                }
            }
            _ => {}
        }
    }

    if status == "CANCELLED" {
        return;
    }

    let Some((start_params, start_val)) = dtstart_raw else { return };
    let Some((start_ms, all_day)) = parse_ics_datetime(start_params, start_val) else { return };

    let duration_ms = if let Some((end_params, end_val)) = dtend_raw {
        if let Some((end_ms, _)) = parse_ics_datetime(end_params, end_val) {
            let diff = end_ms - start_ms;
            if all_day {
                // Exclusive end date in RFC 5545: a single all-day event has diff == 86_400_000
                (diff - 1000).max(3_600_000)
            } else {
                diff.max(900_000)
            }
        } else {
            3_600_000
        }
    } else if all_day {
        86_400_000 - 1000
    } else {
        3_600_000
    };

    if summary.is_empty() {
        summary = "(No title)".to_string();
    }

    let meet_url = url_prop
        .filter(|u| is_web_url(u))
        .or_else(|| extract_event_url(location.as_deref()))
        .or_else(|| extract_event_url(description.as_deref()));

    if let Some(rrule) = rrule_raw {
        let occurrences = expand_rrule(start_ms, rrule, &exdates_ms, window_start_ms, window_end_ms);
        for (idx, occ_start) in occurrences.into_iter().enumerate() {
            let occ_end = occ_start + duration_ms;
            if occ_end < window_start_ms || occ_start > window_end_ms {
                continue;
            }
            out.push(CalendarEventItem {
                id: format!("{uid}-{idx}"),
                title: summary.clone(),
                start_ms: occ_start,
                end_ms: occ_end,
                all_day,
                calendar_name: calendar_name.to_string(),
                color: calendar_color.to_string(),
                location: location.clone(),
                meet_url: meet_url.clone(),
                description: description.clone(),
            });
        }
    } else {
        let end_ms = start_ms + duration_ms;
        if end_ms >= window_start_ms && start_ms <= window_end_ms {
            out.push(CalendarEventItem {
                id: if uid.is_empty() { format!("ev-{start_ms}") } else { uid },
                title: summary,
                start_ms,
                end_ms,
                all_day,
                calendar_name: calendar_name.to_string(),
                color: calendar_color.to_string(),
                location,
                meet_url,
                description,
            });
        }
    }
}

fn is_web_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    lower.starts_with("https://") || lower.starts_with("http://")
}

fn is_conference_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    lower.starts_with("https://meet.google.com/")
        || lower.starts_with("https://zoom.us/")
        || lower.contains(".zoom.us/j/")
        || lower.starts_with("https://teams.microsoft.com/l/meetup-join")
        || lower.starts_with("https://teams.live.com/meet/")
        || lower.starts_with("https://meet.jit.si/")
        || lower.starts_with("https://whereby.com/")
        || lower.starts_with("https://discord.gg/")
        || lower.contains("webex.com/meet/")
}

fn extract_event_url(text: Option<&str>) -> Option<String> {
    let text = text?;
    // Prioritize video conference links if present in the text
    for token in text.split_whitespace() {
        let clean = token.trim_matches(|c: char| c == '<' || c == '>' || c == '(' || c == ')' || c == ',' || c == ';' || c == '"' || c == '\'');
        if is_conference_url(clean) {
            return Some(clean.to_string());
        }
    }
    // Otherwise look for any valid web URL
    for token in text.split_whitespace() {
        let clean = token.trim_matches(|c: char| c == '<' || c == '>' || c == '(' || c == ')' || c == ',' || c == ';' || c == '"' || c == '\'');
        if is_web_url(clean) {
            return Some(clean.to_string());
        }
    }
    None
}

fn unescape_ics_text(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('n') | Some('N') => out.push('\n'),
                Some(',') => out.push(','),
                Some(';') => out.push(';'),
                Some('\\') => out.push('\\'),
                Some(other) => {
                    out.push('\\');
                    out.push(other);
                }
                None => out.push('\\'),
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// Returns local timezone offset in milliseconds (local - UTC) using Windows Win32 API.
fn local_tz_offset_ms() -> i64 {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows::Win32::System::Time::{GetTimeZoneInformation, TIME_ZONE_INFORMATION};
        let mut tzi = TIME_ZONE_INFORMATION::default();
        let res = GetTimeZoneInformation(&mut tzi);
        // Bias is in minutes: UTC = local + bias => local - UTC = -bias
        let mut total_bias_min = tzi.Bias;
        if res == 2 {
            // TIME_ZONE_ID_DAYLIGHT
            total_bias_min += tzi.DaylightBias;
        } else if res == 1 {
            // TIME_ZONE_ID_STANDARD
            total_bias_min += tzi.StandardBias;
        }
        -(total_bias_min as i64) * 60_000
    }
    #[cfg(not(target_os = "windows"))]
    {
        0
    }
}

/// Converts civil (year, month 1..12, day 1..31) to days since 1970-01-01 (Howard Hinnant algorithm).
fn days_from_civil(y: i32, m: u32, d: u32) -> i64 {
    let y = y - if m <= 2 { 1 } else { 0 };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as u32;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    (era as i64) * 146097 + (doe as i64) - 719468
}

/// Converts days since 1970-01-01 back to civil (year, month 1..12, day 1..31).
fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = y + if m <= 2 { 1 } else { 0 };
    (y as i32, m, d)
}

fn is_leap_year(y: i32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0)
}

fn days_in_month(y: i32, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => if is_leap_year(y) { 29 } else { 28 },
        _ => 30,
    }
}

/// Parses RFC 5545 date (`YYYYMMDD`) or datetime (`YYYYMMDDTHHMMSS` / `YYYYMMDDTHHMMSSZ`).
/// Returns `(unix_epoch_ms, is_all_day)`.
fn parse_ics_datetime(params: &str, val: &str) -> Option<(i64, bool)> {
    let clean = val.trim();
    if clean.len() < 8 {
        return None;
    }
    let year: i32 = clean[0..4].parse().ok()?;
    let month: u32 = clean[4..6].parse().ok()?;
    let day: u32 = clean[6..8].parse().ok()?;

    let days = days_from_civil(year, month, day);
    let tz_offset = local_tz_offset_ms();

    let is_date_only = !clean.contains('T') || params.to_uppercase().contains("VALUE=DATE");
    if is_date_only {
        // Local midnight of that date
        let utc_midnight_ms = days * 86_400_000;
        return Some((utc_midnight_ms - tz_offset, true));
    }

    let t_idx = clean.find('T')?;
    let time_part = &clean[t_idx + 1..];
    if time_part.len() < 6 {
        return None;
    }
    let hour: i64 = time_part[0..2].parse().ok()?;
    let min: i64 = time_part[2..4].parse().ok()?;
    let sec: i64 = time_part[4..6].parse().ok()?;

    let ms_in_day = (hour * 3600 + min * 60 + sec) * 1000;
    let raw_ms = days * 86_400_000 + ms_in_day;

    if time_part.ends_with('Z') {
        Some((raw_ms, false))
    } else {
        // Local / TZID datetime -> convert from local wall clock to UTC epoch ms
        Some((raw_ms - tz_offset, false))
    }
}

/// Expands basic RFC 5545 RRULEs (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`) into start_ms occurrences.
fn expand_rrule(
    start_ms: i64,
    rrule: &str,
    exdates_ms: &[i64],
    window_start_ms: i64,
    window_end_ms: i64,
) -> Vec<i64> {
    let mut parts: HashMap<String, String> = HashMap::new();
    for kv in rrule.split(';') {
        if let Some(eq) = kv.find('=') {
            parts.insert(kv[..eq].to_uppercase(), kv[eq + 1..].to_uppercase());
        }
    }

    let Some(freq) = parts.get("FREQ").map(|s| s.as_str()) else {
        return vec![start_ms];
    };
    let interval: i64 = parts
        .get("INTERVAL")
        .and_then(|v| v.parse().ok())
        .unwrap_or(1)
        .max(1);
    let max_count: usize = parts
        .get("COUNT")
        .and_then(|v| v.parse().ok())
        .unwrap_or(500);
    let until_ms: i64 = parts
        .get("UNTIL")
        .and_then(|v| parse_ics_datetime("", v).map(|(ms, _)| ms))
        .unwrap_or(window_end_ms);

    let effective_end = until_ms.min(window_end_ms);
    let tz_offset = local_tz_offset_ms();
    let local_start_ms = start_ms + tz_offset;
    let start_days = local_start_ms.div_euclid(86_400_000);
    let time_of_day_ms = local_start_ms.rem_euclid(86_400_000);
    let (start_y, start_m, start_d) = civil_from_days(start_days);

    let is_excluded = |candidate_ms: i64| -> bool {
        exdates_ms.iter().any(|&ex| (ex - candidate_ms).abs() < 60_000)
    };

    let mut out = Vec::new();
    let mut count = 0usize;

    match freq {
        "DAILY" => {
            let mut step = 0i64;
            loop {
                let d = start_days + step * interval;
                let occ_ms = d * 86_400_000 + time_of_day_ms - tz_offset;
                if occ_ms > effective_end || count >= max_count || step > 2000 {
                    break;
                }
                count += 1;
                if occ_ms >= window_start_ms - 86_400_000 && !is_excluded(occ_ms) {
                    out.push(occ_ms);
                }
                step += 1;
            }
        }
        "WEEKLY" => {
            let byday_codes: Vec<i64> = if let Some(byday) = parts.get("BYDAY") {
                byday
                    .split(',')
                    .filter_map(|code| {
                        let tail = if code.len() >= 2 { &code[code.len() - 2..] } else { code };
                        // 1970-01-01 was a Thursday (day 0).
                        // Weekday (d + 3).rem_euclid(7): 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
                        match tail {
                            "MO" => Some(0),
                            "TU" => Some(1),
                            "WE" => Some(2),
                            "TH" => Some(3),
                            "FR" => Some(4),
                            "SA" => Some(5),
                            "SU" => Some(6),
                            _ => None,
                        }
                    })
                    .collect()
            } else {
                vec![(start_days + 3).rem_euclid(7)]
            };

            let start_monday = start_days - (start_days + 3).rem_euclid(7);
            let mut week_step = 0i64;
            loop {
                let week_monday = start_monday + week_step * interval * 7;
                let mut any_in_range = false;
                for &wd in &byday_codes {
                    let d = week_monday + wd;
                    if d < start_days {
                        continue;
                    }
                    let occ_ms = d * 86_400_000 + time_of_day_ms - tz_offset;
                    if occ_ms <= effective_end && count < max_count {
                        any_in_range = true;
                        count += 1;
                        if occ_ms >= window_start_ms - 86_400_000 && !is_excluded(occ_ms) {
                            out.push(occ_ms);
                        }
                    }
                }
                if !any_in_range || count >= max_count || week_step > 600 {
                    break;
                }
                week_step += 1;
            }
        }
        "MONTHLY" => {
            let mut step = 0i64;
            loop {
                let total_months = (start_y as i64) * 12 + (start_m as i64 - 1) + step * interval;
                let y = (total_months.div_euclid(12)) as i32;
                let m = (total_months.rem_euclid(12) + 1) as u32;
                let max_d = days_in_month(y, m);
                let d_val = start_d.min(max_d);
                let d = days_from_civil(y, m, d_val);
                let occ_ms = d * 86_400_000 + time_of_day_ms - tz_offset;
                if occ_ms > effective_end || count >= max_count || step > 240 {
                    break;
                }
                count += 1;
                if occ_ms >= window_start_ms - 86_400_000 && !is_excluded(occ_ms) {
                    out.push(occ_ms);
                }
                step += 1;
            }
        }
        "YEARLY" => {
            let mut step = 0i64;
            loop {
                let y = start_y + (step * interval) as i32;
                let max_d = days_in_month(y, start_m);
                let d_val = start_d.min(max_d);
                let d = days_from_civil(y, start_m, d_val);
                let occ_ms = d * 86_400_000 + time_of_day_ms - tz_offset;
                if occ_ms > effective_end || count >= max_count || step > 50 {
                    break;
                }
                count += 1;
                if occ_ms >= window_start_ms - 86_400_000 && !is_excluded(occ_ms) {
                    out.push(occ_ms);
                }
                step += 1;
            }
        }
        _ => {
            out.push(start_ms);
        }
    }

    out
}

#[tauri::command]
pub async fn calendar_init(app: AppHandle) -> Result<CalendarStatus, String> {
    load_cached_events(&app);
    let _ = ensure_calendar_bridge(&app, false)?;
    emit_events(&app);
    let state = app.state::<CalendarState>();
    let status = state.status.lock().unwrap().clone();
    Ok(status)
}

#[tauri::command]
pub async fn calendar_get_events(app: AppHandle) -> Result<Vec<CalendarEventItem>, String> {
    load_cached_events(&app);
    let state = app.state::<CalendarState>();
    let ev = state.events.lock().unwrap().clone();
    Ok(ev)
}

#[tauri::command]
pub async fn calendar_sync(app: AppHandle) -> Result<(), String> {
    {
        let state = app.state::<CalendarState>();
        let mut s = state.status.lock().unwrap();
        s.syncing = true;
    }
    emit_status(&app);

    let win = ensure_calendar_bridge(&app, false)?;
    let _ = win.eval("if (window.__notchCalendarSync) { window.__notchCalendarSync(); }");
    Ok(())
}

#[tauri::command]
pub async fn calendar_open_auth(app: AppHandle) -> Result<CalendarStatus, String> {
    let win = ensure_calendar_bridge(&app, true)?;
    show_bridge_window_safely(&win);
    let state = app.state::<CalendarState>();
    let status = state.status.lock().unwrap().clone();
    Ok(status)
}

#[tauri::command]
pub async fn calendar_fetch_url(
    url: String,
    default_name: Option<String>,
    default_color: Option<String>,
) -> Result<Vec<CalendarEventItem>, String> {
    let mut clean_url = url.trim().to_string();
    if clean_url.starts_with("webcal://") {
        clean_url = format!("https://{}", &clean_url[9..]);
    } else if clean_url.starts_with("webcals://") {
        clean_url = format!("https://{}", &clean_url[10..]);
    } else if !clean_url.starts_with("http://") && !clean_url.starts_with("https://") {
        clean_url = format!("https://{}", clean_url);
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let resp = client
        .get(&clean_url)
        .send()
        .await
        .map_err(|e| format!("Network request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Server returned HTTP status {}", resp.status()));
    }

    let raw = resp.text().await.map_err(|e| format!("Failed to read response: {e}"))?;
    if !raw.contains("BEGIN:VCALENDAR") {
        return Err("URL does not return a valid iCalendar (.ics) stream".to_string());
    }

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let window_start_ms = now_ms - 90 * 86_400_000;
    let window_end_ms = now_ms + 180 * 86_400_000;

    let color = default_color.unwrap_or_else(|| "#8b5cf6".to_string());
    let mut events = parse_ics_string(&raw, &color, window_start_ms, window_end_ms);

    if let Some(name) = default_name {
        let name = name.trim();
        if !name.is_empty() {
            for ev in &mut events {
                if ev.calendar_name == "Calendar" || ev.calendar_name.is_empty() {
                    ev.calendar_name = name.to_string();
                }
            }
        }
    }

    Ok(events)
}

#[tauri::command]
pub fn calendar_open_url(url: String) -> Result<(), String> {
    let clean = url.trim();
    if clean.starts_with("http://") || clean.starts_with("https://") {
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            Command::new("rundll32")
                .args(["url.dll,FileProtocolHandler", clean])
                .spawn()
                .map(|_| ())
                .map_err(|e| e.to_string())
        }
        #[cfg(not(target_os = "windows"))]
        {
            Err("Unsupported platform".into())
        }
    } else {
        Err("Invalid URL protocol".into())
    }
}
