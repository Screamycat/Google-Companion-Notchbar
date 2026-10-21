//! Authenticated Google Gemini Web (`gemini.google.com`) bridge via WebView2.
//!
//! IMPORTANT: All Tauri commands that create or manipulate `WebviewWindow` on Windows
//! MUST be `async fn` so they execute on Tokio's worker pool rather than inside the
//! main UI thread's `WebMessageReceived` callback (which would deadlock WebView2 IPC
//! and freeze `set_hit_rect`).

use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, Position, Url, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
use webview2_com::WebMessageReceivedEventHandler;
use windows::core::PWSTR;

const BRIDGE_LABEL: &str = "gemini_bridge";
const GEMINI_URL: &str = "https://gemini.google.com/app";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiStatus {
    pub initialized: bool,
    pub authenticated: bool,
    pub account: Option<String>,
    pub model: Option<String>,
    pub window_visible: bool,
}

impl Default for GeminiStatus {
    fn default() -> Self {
        Self {
            initialized: false,
            authenticated: false,
            account: None,
            model: None,
            window_visible: false,
        }
    }
}

#[derive(Default)]
pub struct GeminiState(pub Mutex<GeminiStatus>);

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum BridgeIncoming {
    Status {
        authenticated: bool,
        account: Option<String>,
        model: Option<String>,
    },
    Thinking {
        #[serde(rename = "requestId")]
        request_id: String,
    },
    Stream {
        #[serde(rename = "requestId")]
        request_id: String,
        text: String,
        done: bool,
    },
    Error {
        #[serde(rename = "requestId")]
        request_id: Option<String>,
        message: String,
    },
    HideWindow,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum NotchGeminiEvent {
    Status(GeminiStatus),
    Thinking {
        #[serde(rename = "requestId")]
        request_id: String,
    },
    Stream {
        #[serde(rename = "requestId")]
        request_id: String,
        text: String,
        done: bool,
    },
    Error {
        #[serde(rename = "requestId")]
        request_id: Option<String>,
        message: String,
    },
}

const BRIDGE_INIT_SCRIPT: &str = r#"
(function() {
  if (window.__notchGeminiBridgeInstalled) return;
  window.__notchGeminiBridgeInstalled = true;

  function post(payload) {
    try {
      if (window.chrome && window.chrome.webview && window.chrome.webview.postMessage) {
        window.chrome.webview.postMessage(JSON.stringify(payload));
      }
    } catch (_) {}
  }

  function detectAccount() {
    const selectors = [
      'a[aria-label*="Google Account:"]',
      'button[aria-label*="Google Account:"]',
      'a[aria-label*="Google-Konto:"]',
      'button[aria-label*="Google-Konto:"]',
      'a[aria-label*="@"]',
      'button[aria-label*="@"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const label = el.getAttribute('aria-label') || '';
        const emailMatch = label.match(/\(([^)]+@[^)]+)\)/) || label.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) return emailMatch[1];
        const parts = label.split(':');
        if (parts.length > 1) return parts.slice(1).join(':').trim();
      }
    }
    return null;
  }

  function detectModel() {
    const selectors = [
      '[data-test-id="bard-mode-menu-button"]',
      'bard-mode-switcher button',
      '.input-area-switch',
      '[aria-label*="mode" i][aria-haspopup="menu"]',
      '.logo-pill-label-container'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent) {
        const txt = el.textContent.replace(/\s+/g, ' ').trim();
        if (txt && txt.length < 40) return txt;
      }
    }
    return null;
  }

  function findEditor() {
    return (
      document.querySelector('rich-textarea div.ql-editor[contenteditable="true"]') ||
      document.querySelector('rich-textarea div[contenteditable="true"]') ||
      document.querySelector('div.ql-editor[contenteditable="true"]') ||
      document.querySelector('div[contenteditable="true"][role="textbox"]') ||
      document.querySelector('textarea')
    );
  }

  let lastStatusJson = '';
  function checkStatus(force) {
    const host = location.hostname || '';
    if (host.includes('accounts.google.com') || host.includes('workspace.google.com')) {
      const s = { type: 'status', authenticated: false, account: null, model: null };
      const j = JSON.stringify(s);
      if (force || j !== lastStatusJson) {
        lastStatusJson = j;
        post(s);
      }
      return;
    }

    if (!host.includes('gemini.google.com')) return;

    const signInBtn = document.querySelector(
      'a[href*="accounts.google.com/ServiceLogin"], a.gb_Ta, a[aria-label*="Sign in" i], button[aria-label*="Sign in" i], a[aria-label*="Anmelden" i]'
    );
    const account = detectAccount();
    const editor = findEditor();
    const hasProfileAvatar = !!document.querySelector(
      'a[aria-label*="Google Account" i], button[aria-label*="Google Account" i], a[aria-label*="Google-Konto" i], a[href*="SignOutOptions"], img.gb_P, img.gbii'
    );

    const authenticated = (hasProfileAvatar || (!!editor && !signInBtn)) && !location.pathname.startsWith('/faq');
    const model = authenticated ? detectModel() : null;

    const s = {
      type: 'status',
      authenticated: !!authenticated,
      account: account || null,
      model: model || null
    };
    const j = JSON.stringify(s);
    if (force || j !== lastStatusJson) {
      lastStatusJson = j;
      post(s);
    }

    ensureFloatingBanner(!!authenticated, model);
  }

  function ensureFloatingBanner(authenticated, model) {
    if (!document.body) return;
    let banner = document.getElementById('__notch-gemini-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = '__notch-gemini-banner';
      banner.style.cssText = [
        'position:fixed',
        'top:10px',
        'left:50%',
        'transform:translateX(-50%)',
        'z-index:2147483647',
        'display:flex',
        'align-items:center',
        'gap:10px',
        'padding:6px 12px',
        'border-radius:999px',
        'background:rgba(18,18,22,0.92)',
        'border:1px solid rgba(255,255,255,0.16)',
        'box-shadow:0 8px 28px rgba(0,0,0,0.45)',
        'backdrop-filter:blur(12px)',
        'color:#f3f4f6',
        'font-family:system-ui,-apple-system,sans-serif',
        'font-size:12px',
        'line-height:1.2'
      ].join(';');

      const dot = document.createElement('span');
      dot.id = '__notch-gemini-dot';
      dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#34d399;flex-shrink:0;';

      const label = document.createElement('span');
      label.id = '__notch-gemini-label';
      label.style.cssText = 'font-weight:500;';

      const btn = document.createElement('button');
      btn.id = '__notch-gemini-done-btn';
      btn.textContent = 'Done — Back to Notch';
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
      btn.addEventListener('click', function() {
        checkStatus(true);
        post({ type: 'hide_window' });
      });

      banner.appendChild(dot);
      banner.appendChild(label);
      banner.appendChild(btn);
      document.body.appendChild(banner);
    }

    const dot = document.getElementById('__notch-gemini-dot');
    const label = document.getElementById('__notch-gemini-label');
    if (dot && label) {
      if (authenticated) {
        dot.style.background = '#34d399';
        label.textContent = 'Notchbar Connected' + (model ? ' (' + model + ')' : '') + ' — Select your Pro model if desired';
      } else {
        dot.style.background = '#fbbf24';
        label.textContent = 'Sign in with your Google Account to unlock your Gemini plan in Notchbar';
      }
    }
  }

  function getResponseContainers() {
    let list = Array.from(document.querySelectorAll('model-response'));
    if (list.length > 0) return list;
    return Array.from(document.querySelectorAll('.response-container, [data-message-author-role="model"]'));
  }

  function domToMarkdown(root) {
    if (!root) return '';

    function walk(node) {
      if (!node) return '';
      if (node.nodeType === 3) {
        return node.nodeValue || '';
      }
      if (node.nodeType !== 1) return '';

      const tag = (node.tagName || '').toLowerCase();
      if (
        tag === 'script' ||
        tag === 'style' ||
        tag === 'button' ||
        tag === 'mat-icon' ||
        tag === 'svg' ||
        tag === 'model-thoughts' ||
        tag === 'source-footnote' ||
        tag === 'sources-carousel-inline'
      ) {
        return '';
      }

      const cls = typeof node.className === 'string' ? node.className : '';
      if (
        cls.includes('thoughts-') ||
        cls.includes('code-block-decoration') ||
        cls.includes('bottom-container') ||
        cls.includes('response-footer')
      ) {
        return '';
      }

      // Math formulas (KaTeX / MathJax / MathML / Gemini custom elements)
      // Gemini renders math as <math-render> or <span class="katex"> or <div class="katex-display">.
      // KaTeX renders an <annotation encoding="application/x-tex"> containing the exact raw LaTeX formula,
      // plus duplicate visually styled HTML spans (.katex-html) and MathML (.katex-mathml).
      // We extract ONLY the raw LaTeX formula and discard internal render artifacts to prevent duplicate text like 1/x1/x1/x or xxx!
      if (
        tag === 'math-render' ||
        cls.includes('katex-display') ||
        cls.includes('katex') ||
        tag === 'mjx-container'
      ) {
        const annotation = node.querySelector('annotation');
        const isDisplay =
          cls.includes('katex-display') ||
          (node.parentElement && typeof node.parentElement.className === 'string' && node.parentElement.className.includes('katex-display')) ||
          (tag === 'math-render' && (node.getAttribute('display') === 'true' || node.getAttribute('block') === 'true'));

        if (annotation && annotation.textContent) {
          const tex = annotation.textContent.trim();
          return isDisplay ? ('\n$$\n' + tex + '\n$$\n\n') : ('$' + tex + '$');
        }

        const dataTex = node.getAttribute('data-tex') || node.getAttribute('data-math');
        if (dataTex) {
          const tex = dataTex.trim();
          return isDisplay ? ('\n$$\n' + tex + '\n$$\n\n') : ('$' + tex + '$');
        }

        const katexHtml = node.querySelector('.katex-html');
        if (katexHtml) {
          const tex = (katexHtml.textContent || '').trim();
          return isDisplay ? ('\n$$\n' + tex + '\n$$\n\n') : ('$' + tex + '$');
        }
      }

      // Ignore inner math rendering duplicates if walked directly
      if (
        cls.includes('katex-mathml') ||
        cls.includes('katex-html') ||
        tag === 'annotation' ||
        tag === 'math'
      ) {
        return '';
      }

      if (tag === 'code-block' || tag === 'pre') {
        const langEl = node.querySelector('.code-block-decoration span, [data-test-id="code-block-language"]');
        const lang = langEl && langEl.textContent ? langEl.textContent.trim().toLowerCase() : '';
        const codeEl = node.querySelector('code') || node;
        const rawCode = (codeEl.textContent || '').replace(/\n$/, '');
        return '\n```' + lang + '\n' + rawCode + '\n```\n\n';
      }

      if (tag === 'code') {
        if (node.parentElement && node.parentElement.tagName && node.parentElement.tagName.toLowerCase() === 'pre') {
          return node.textContent || '';
        }
        return '`' + (node.textContent || '') + '`';
      }

      if (tag === 'br') return '\n';
      if (tag === 'hr') return '\n---\n';

      let inner = '';
      const children = node.childNodes;
      if (tag === 'ol') {
        let idx = 1;
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          if (c.nodeType === 1 && c.tagName.toLowerCase() === 'li') {
            inner += idx + '. ' + walk(c).trim() + '\n';
            idx++;
          }
        }
        return '\n' + inner + '\n';
      }

      if (tag === 'ul') {
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          if (c.nodeType === 1 && c.tagName.toLowerCase() === 'li') {
            inner += '- ' + walk(c).trim() + '\n';
          }
        }
        return '\n' + inner + '\n';
      }

      for (let i = 0; i < children.length; i++) {
        inner += walk(children[i]);
      }

      if (tag === 'p') return inner.trim() + '\n\n';
      if (tag === 'h1') return '# ' + inner.trim() + '\n\n';
      if (tag === 'h2') return '## ' + inner.trim() + '\n\n';
      if (tag === 'h3' || tag === 'h4') return '### ' + inner.trim() + '\n\n';
      if (tag === 'strong' || tag === 'b') return '**' + inner + '**';
      if (tag === 'em' || tag === 'i') return '*' + inner + '*';
      if (tag === 'blockquote') return '> ' + inner.trim().replace(/\n/g, '\n> ') + '\n\n';
      if (tag === 'li') return inner.trim() + '\n';

      return inner;
    }

    const contentNode =
      root.querySelector('message-content .markdown') ||
      root.querySelector('message-content') ||
      root.querySelector('.model-response-text') ||
      root;

    return walk(contentNode)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function isGenerating() {
    const stopBtn = document.querySelector(
      'button[aria-label*="Stop" i], button.stop-button, .stop-icon, mat-icon[data-mat-icon-name="stop"], [data-test-id="stop-button"]'
    );
    if (stopBtn && stopBtn.offsetParent !== null) return true;
    const busy = document.querySelector('model-response [aria-busy="true"]');
    if (busy) return true;
    return false;
  }

  let activeTimer = null;

  window.__notchGeminiAbort = function() {
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }
    const stopBtn = document.querySelector(
      'button[aria-label*="Stop" i], button.stop-button, [data-test-id="stop-button"]'
    );
    if (stopBtn) {
      try { stopBtn.click(); } catch (_) {}
    }
  };

  window.__notchGeminiNewChat = function() {
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }
    const newChatBtn = document.querySelector(
      'a[aria-label*="New chat" i], button[aria-label*="New chat" i], a[aria-label*="Neuer Chat" i], button[aria-label*="Neuer Chat" i], [data-test-id="new-chat-button"], [aria-label*="Start new chat" i], side-nav a[href="/app"]'
    );
    if (newChatBtn) {
      try { newChatBtn.click(); return; } catch (_) {}
    }
    window.location.href = 'https://gemini.google.com/app';
  };

  window.__notchGeminiSend = function(promptText, requestId) {
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }

    const editor = findEditor();
    if (!editor) {
      post({
        type: 'error',
        requestId: requestId,
        message: 'Gemini prompt input not ready. Please click Google Sign-In above to verify your session.'
      });
      return;
    }

    const beforeContainers = getResponseContainers();
    const beforeCount = beforeContainers.length;
    const lastBefore = beforeContainers[beforeCount - 1] || null;
    const beforeText = lastBefore ? domToMarkdown(lastBefore) : '';

    editor.focus();
    try {
      document.execCommand('selectAll', false, null);
      const ok = document.execCommand('insertText', false, promptText);
      if (!ok || !editor.textContent || editor.textContent.trim().length === 0) {
        editor.textContent = promptText;
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText, inputType: 'insertText' }));
      }
    } catch (_) {
      editor.textContent = promptText;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    setTimeout(function() {
      const sendBtn =
        document.querySelector('button.send-button:not([disabled])') ||
        document.querySelector('button[aria-label*="Send message" i]:not([disabled])') ||
        document.querySelector('button[aria-label*="Send" i]:not([disabled])') ||
        document.querySelector('button[aria-label*="Senden" i]:not([disabled])') ||
        document.querySelector('button[aria-label*="Skicka" i]:not([disabled])');

      if (sendBtn) {
        sendBtn.click();
      } else {
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        editor.dispatchEvent(enterEvent);
      }

      let lastSentText = '';
      let stableTicks = 0;
      let elapsedTicks = 0;
      let sentThinking = false;

      activeTimer = setInterval(function() {
        elapsedTicks++;
        const containers = getResponseContainers();
        let target = null;

        if (containers.length > beforeCount) {
          target = containers[containers.length - 1];
        } else if (containers.length > 0) {
          const candidate = containers[containers.length - 1];
          const candidateText = domToMarkdown(candidate);
          if (candidateText && candidateText !== beforeText) {
            target = candidate;
          }
        }

        if (!target) {
          if (!sentThinking && elapsedTicks >= 3) {
            sentThinking = true;
            post({ type: 'thinking', requestId: requestId });
          }
          if (elapsedTicks > 900) {
            clearInterval(activeTimer);
            activeTimer = null;
            post({
              type: 'error',
              requestId: requestId,
              message: 'Timed out waiting for Gemini Web response.'
            });
          }
          return;
        }

        const hasThoughts = !!target.querySelector('model-thoughts, .thoughts-container');
        const currentText = domToMarkdown(target);

        if (!currentText) {
          if (hasThoughts && !sentThinking) {
            sentThinking = true;
            post({ type: 'thinking', requestId: requestId });
          }
          return;
        }

        if (currentText !== lastSentText) {
          lastSentText = currentText;
          stableTicks = 0;
          post({
            type: 'stream',
            requestId: requestId,
            text: currentText,
            done: false
          });
        } else {
          stableTicks++;
          const generating = isGenerating();
          if ((!generating && stableTicks >= 7) || stableTicks >= 28) {
            clearInterval(activeTimer);
            activeTimer = null;
            checkStatus(false);
            post({
              type: 'stream',
              requestId: requestId,
              text: currentText,
              done: true
            });
          }
        }
      }, 85);
    }, 110);
  };

  window.__notchGeminiSetModel = function(targetKey) {
    try {
      const selectors = [
        '[data-test-id="bard-mode-menu-button"]',
        'bard-mode-switcher button',
        'button.input-area-switch',
        '[aria-label*="mode" i][aria-haspopup="menu"]',
        'button[aria-haspopup="menu"]'
      ];
      let btn = null;
      for (const sel of selectors) {
        const els = Array.from(document.querySelectorAll(sel));
        const found = els.find(function(el) {
          const txt = (el.textContent || '').toLowerCase();
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          return /gemini|flash|pro|advanced|argon|lite|model|mode/i.test(txt + ' ' + aria);
        });
        if (found) { btn = found; break; }
        if (els.length > 0 && sel !== 'button[aria-haspopup="menu"]') { btn = els[0]; break; }
      }

      if (!btn) return;

      btn.click();

      setTimeout(function() {
        try {
          const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], .mat-mdc-menu-item, mat-list-item, [role="option"], button'));
          const key = (targetKey || '').toLowerCase().trim();

          const match = menuItems.find(function(item) {
            const t = (item.textContent || '').toLowerCase();
            if (key === 'lite' || key === 'flash-lite' || key === 'flash lite') {
              return t.includes('lite');
            }
            if (key === 'flash') {
              return t.includes('flash') && !t.includes('lite');
            }
            if (key === 'pro' || key === 'advanced') {
              return t.includes('pro') || t.includes('advanced');
            }
            if (key === 'argon') {
              return t.includes('argon');
            }
            return t.includes(key);
          });

          if (match) {
            match.click();
          } else {
            document.body.click();
          }

          setTimeout(function() {
            checkStatus(true);
          }, 400);
        } catch (_) {}
      }, 200);
    } catch (_) {}
  };

  setInterval(function() { checkStatus(false); }, 1200);
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', function() { checkStatus(true); });
  } else {
    setTimeout(function() { checkStatus(true); }, 300);
  }
})();
"#;

fn emit_status(app: &AppHandle) {
    let state = app.state::<GeminiState>();
    let status = state.0.lock().unwrap().clone();
    let _ = app.emit("notch://gemini", NotchGeminiEvent::Status(status));
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

fn ensure_bridge_window(app: &AppHandle, show: bool) -> Result<WebviewWindow, String> {
    if let Some(existing) = app.get_webview_window(BRIDGE_LABEL) {
        if show {
            show_bridge_window_safely(&existing);
        }
        {
            let state = app.state::<GeminiState>();
            let mut s = state.0.lock().unwrap();
            s.initialized = true;
            if show {
                s.window_visible = true;
            }
        }
        emit_status(app);
        return Ok(existing);
    }

    let url: Url = GEMINI_URL.parse().map_err(|e| format!("{e}"))?;
    let data_dir = app
        .path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("notch-gemini"))
        .join("gemini-web-profile");
    let _ = std::fs::create_dir_all(&data_dir);

    let mut builder = WebviewWindowBuilder::new(app, BRIDGE_LABEL, WebviewUrl::External(url))
        .title("Google Gemini — Account & Model Setup")
        .inner_size(940.0, 720.0)
        .min_inner_size(520.0, 480.0)
        .visible(show)
        .focused(show)
        .data_directory(data_dir)
        .additional_browser_args(
            "--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows",
        )
        .initialization_script(BRIDGE_INIT_SCRIPT);

    if show {
        builder = builder.center();
    } else {
        builder = builder.position(-32000.0, -32000.0);
    }

    let window = builder.build().map_err(|e| {
        eprintln!("[gemini_bridge] Failed to build WebviewWindow: {e}");
        e.to_string()
    })?;

    if show {
        show_bridge_window_safely(&window);
    }

    // Intercept window close (X button): move off-screen and hide to keep session alive.
    let app_for_close = app.clone();
    let win_for_close = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            hide_bridge_window_safely(&win_for_close);
            {
                let state = app_for_close.state::<GeminiState>();
                let mut s = state.0.lock().unwrap();
                s.window_visible = false;
            }
            emit_status(&app_for_close);
        }
    });

    // Attach WebMessageReceived handler so external origin `gemini.google.com` can message Rust.
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
                    model,
                } => {
                    let state = app_handle.state::<GeminiState>();
                    let mut s = state.0.lock().unwrap();
                    s.initialized = true;
                    s.authenticated = authenticated;
                    if account.is_some() {
                        s.account = account;
                    }
                    if model.is_some() {
                        s.model = model;
                    }
                    drop(s);
                    emit_status(&app_handle);
                }
                BridgeIncoming::Thinking { request_id } => {
                    let _ = app_handle.emit(
                        "notch://gemini",
                        NotchGeminiEvent::Thinking { request_id },
                    );
                }
                BridgeIncoming::Stream {
                    request_id,
                    text,
                    done,
                } => {
                    let _ = app_handle.emit(
                        "notch://gemini",
                        NotchGeminiEvent::Stream {
                            request_id,
                            text,
                            done,
                        },
                    );
                }
                BridgeIncoming::Error {
                    request_id,
                    message,
                } => {
                    let _ = app_handle.emit(
                        "notch://gemini",
                        NotchGeminiEvent::Error {
                            request_id,
                            message,
                        },
                    );
                }
                BridgeIncoming::HideWindow => {
                    hide_bridge_window_safely(&win_handle);
                    {
                        let state = app_handle.state::<GeminiState>();
                        let mut s = state.0.lock().unwrap();
                        s.window_visible = false;
                    }
                    emit_status(&app_handle);
                }
            }
            Ok(())
        }));
        let mut token = Default::default();
        let _ = core.add_WebMessageReceived(&handler, &mut token);
    });

    {
        let state = app.state::<GeminiState>();
        let mut s = state.0.lock().unwrap();
        s.initialized = true;
        s.window_visible = show;
    }
    emit_status(app);

    Ok(window)
}

#[tauri::command]
pub async fn gemini_init(auto_connect: bool, app: AppHandle) -> Result<GeminiStatus, String> {
    if auto_connect || app.get_webview_window(BRIDGE_LABEL).is_some() {
        let _ = ensure_bridge_window(&app, false)?;
    }
    let state = app.state::<GeminiState>();
    let status = state.0.lock().unwrap().clone();
    Ok(status)
}

#[tauri::command]
pub async fn gemini_open_window(app: AppHandle) -> Result<GeminiStatus, String> {
    let _ = ensure_bridge_window(&app, true)?;
    let state = app.state::<GeminiState>();
    let status = state.0.lock().unwrap().clone();
    Ok(status)
}

#[tauri::command]
pub async fn gemini_hide_window(app: AppHandle) -> Result<GeminiStatus, String> {
    if let Some(win) = app.get_webview_window(BRIDGE_LABEL) {
        hide_bridge_window_safely(&win);
    }
    let state = app.state::<GeminiState>();
    let mut s = state.0.lock().unwrap();
    s.window_visible = false;
    let out = s.clone();
    drop(s);
    emit_status(&app);
    Ok(out)
}

#[tauri::command]
pub async fn gemini_send(prompt: String, request_id: String, app: AppHandle) -> Result<(), String> {
    let win = ensure_bridge_window(&app, false)?;
    let prompt_json = serde_json::to_string(&prompt).map_err(|e| e.to_string())?;
    let req_json = serde_json::to_string(&request_id).map_err(|e| e.to_string())?;
    let js = format!(
        "if (window.__notchGeminiSend) {{ window.__notchGeminiSend({prompt_json}, {req_json}); }}"
    );
    win.eval(&js).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gemini_abort(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(BRIDGE_LABEL) {
        let _ = win.eval("if (window.__notchGeminiAbort) { window.__notchGeminiAbort(); }");
    }
    Ok(())
}

#[tauri::command]
pub async fn gemini_new_chat(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(BRIDGE_LABEL) {
        let _ = win.eval("if (window.__notchGeminiNewChat) { window.__notchGeminiNewChat(); }");
    }
    Ok(())
}

#[tauri::command]
pub async fn gemini_set_model(model: String, app: AppHandle) -> Result<(), String> {
    let win = ensure_bridge_window(&app, false)?;
    let model_json = serde_json::to_string(&model).map_err(|e| e.to_string())?;
    let js = format!(
        "if (window.__notchGeminiSetModel) {{ window.__notchGeminiSetModel({model_json}); }}"
    );
    win.eval(&js).map_err(|e| e.to_string())
}
