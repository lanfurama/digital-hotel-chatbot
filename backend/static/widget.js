/**
 * Hotel Chatbot Embed Widget
 * Dùng: <script src="https://your-domain/widget.js" data-key="CLIENT_API_KEY" data-color="#534AB7"></script>
 */
(function () {
  'use strict';

  const script = document.currentScript;
  const API_KEY = script?.getAttribute('data-key') || '';
  const COLOR = script?.getAttribute('data-color') || '#534AB7';
  const API_BASE = (script?.getAttribute('data-api') || script?.src?.replace('/widget.js', '')) + '/api/v1';

  if (!API_KEY) { console.warn('[ChatWidget] data-key is required'); return; }

  // ── Styles ──────────────────────────────────────────────────────────────
  const css = `
    #_hcw-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 99998;
      width: 56px; height: 56px; border-radius: 50%;
      background: ${COLOR}; border: none; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,.25);
      display: flex; align-items: center; justify-content: center;
      transition: transform .15s;
    }
    #_hcw-btn:hover { transform: scale(1.08); }
    #_hcw-btn svg { width: 26px; height: 26px; fill: #fff; }

    #_hcw-panel {
      position: fixed; bottom: 92px; right: 24px; z-index: 99999;
      width: 360px; height: 520px; border-radius: 16px;
      background: #fff; box-shadow: 0 8px 40px rgba(0,0,0,.18);
      display: flex; flex-direction: column; overflow: hidden;
      transform: scale(.92) translateY(12px); opacity: 0;
      pointer-events: none; transition: all .2s ease;
    }
    #_hcw-panel.open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }

    #_hcw-header {
      background: ${COLOR}; color: #fff; padding: 14px 16px;
      font-family: sans-serif; font-size: 14px; font-weight: 600;
      display: flex; justify-content: space-between; align-items: center;
    }
    #_hcw-close {
      background: none; border: none; color: rgba(255,255,255,.75);
      cursor: pointer; font-size: 20px; line-height: 1; padding: 0;
    }
    #_hcw-close:hover { color: #fff; }

    #_hcw-msgs {
      flex: 1; overflow-y: auto; padding: 14px;
      display: flex; flex-direction: column; gap: 10px;
      font-family: sans-serif; font-size: 13px;
    }

    .hcw-msg { display: flex; gap: 8px; }
    .hcw-msg.user { flex-direction: row-reverse; }
    .hcw-bubble {
      max-width: 80%; padding: 9px 13px; border-radius: 14px;
      line-height: 1.5; white-space: pre-wrap; word-break: break-word;
    }
    .hcw-msg.user .hcw-bubble { background: ${COLOR}; color: #fff; border-bottom-right-radius: 4px; }
    .hcw-msg.bot  .hcw-bubble { background: #f1f3f5; color: #222; border-bottom-left-radius: 4px; }
    .hcw-cursor  { display: inline-block; width: 2px; height: 14px; background: #666; margin-left: 2px; animation: blink .7s infinite; vertical-align: middle; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

    #_hcw-form {
      display: flex; gap: 8px; padding: 10px 12px;
      border-top: 1px solid #eee;
    }
    #_hcw-input {
      flex: 1; border: 1px solid #ddd; border-radius: 10px;
      padding: 8px 12px; font-size: 13px; outline: none;
      font-family: sans-serif; resize: none; max-height: 90px;
    }
    #_hcw-input:focus { border-color: ${COLOR}; }
    #_hcw-send {
      width: 36px; height: 36px; border-radius: 10px;
      background: ${COLOR}; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; align-self: flex-end;
    }
    #_hcw-send:disabled { background: #ccc; cursor: not-allowed; }
    #_hcw-send svg { width: 16px; height: 16px; fill: #fff; }

    @media (max-width: 420px) {
      #_hcw-panel { width: calc(100vw - 32px); right: 16px; bottom: 80px; }
      #_hcw-btn { right: 16px; bottom: 16px; }
    }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── HTML ─────────────────────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = '_hcw-btn';
  btn.title = 'Chat với chúng tôi';
  btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;

  const panel = document.createElement('div');
  panel.id = '_hcw-panel';
  panel.innerHTML = `
    <div id="_hcw-header">
      <span>💬 Hỗ trợ trực tuyến</span>
      <button id="_hcw-close" title="Đóng">×</button>
    </div>
    <div id="_hcw-msgs"></div>
    <form id="_hcw-form">
      <textarea id="_hcw-input" rows="1" placeholder="Nhập câu hỏi..."></textarea>
      <button id="_hcw-send" type="submit">
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </form>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  // ── State ─────────────────────────────────────────────────────────────────
  let sessionId = null;
  let sending = false;
  const msgs = document.getElementById('_hcw-msgs');
  const input = document.getElementById('_hcw-input');
  const sendBtn = document.getElementById('_hcw-send');

  // ── Toggle ────────────────────────────────────────────────────────────────
  btn.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && msgs.children.length === 0) {
      addBotMsg('Xin chào! Tôi có thể giúp gì cho bạn?');
    }
    if (panel.classList.contains('open')) input.focus();
  });
  document.getElementById('_hcw-close').addEventListener('click', () => panel.classList.remove('open'));

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 90) + 'px';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });

  // ── Message helpers ───────────────────────────────────────────────────────
  function addUserMsg(text) {
    const div = document.createElement('div');
    div.className = 'hcw-msg user';
    div.innerHTML = `<div class="hcw-bubble">${escHtml(text)}</div>`;
    msgs.appendChild(div);
    scrollBottom();
    return div;
  }

  function addBotMsg(text) {
    const div = document.createElement('div');
    div.className = 'hcw-msg bot';
    div.innerHTML = `<div class="hcw-bubble">${escHtml(text)}</div>`;
    msgs.appendChild(div);
    scrollBottom();
    return div;
  }

  function startBotStream() {
    const div = document.createElement('div');
    div.className = 'hcw-msg bot';
    const bubble = document.createElement('div');
    bubble.className = 'hcw-bubble';
    const cursor = document.createElement('span');
    cursor.className = 'hcw-cursor';
    bubble.appendChild(cursor);
    div.appendChild(bubble);
    msgs.appendChild(div);
    scrollBottom();
    return { bubble, cursor };
  }

  function scrollBottom() {
    msgs.scrollTop = msgs.scrollHeight;
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  document.getElementById('_hcw-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
  });

  async function submit() {
    const text = input.value.trim();
    if (!text || sending) return;

    sending = true;
    sendBtn.disabled = true;
    input.value = '';
    input.style.height = 'auto';

    addUserMsg(text);
    const { bubble, cursor } = startBotStream();
    let fullText = '';

    try {
      const resp = await fetch(`${API_BASE}/widget/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Widget-Key': API_KEY,
        },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      if (!resp.ok || !resp.body) throw new Error('Request thất bại');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'token') {
              fullText += ev.content;
              bubble.textContent = fullText;
              bubble.appendChild(cursor);
              scrollBottom();
            } else if (ev.type === 'done') {
              sessionId = ev.session_id;
            } else if (ev.type === 'error') {
              fullText = 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.';
              bubble.textContent = fullText;
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      bubble.textContent = 'Không thể kết nối. Vui lòng kiểm tra kết nối mạng.';
    } finally {
      cursor.remove();
      sending = false;
      sendBtn.disabled = false;
      input.focus();
      scrollBottom();
    }
  }
})();
