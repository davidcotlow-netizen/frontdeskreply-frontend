/**
 * FrontdeskReply — Embeddable Live Chat Widget
 *
 * Usage: Add this single line to any client website:
 * <script src="https://app.frontdeskreply.com/widget.js"
 *   data-business-id="YOUR_BUSINESS_ID"
 *   data-agent-name="Alex"
 *   data-color="#E8714A">
 * </script>
 */
(function () {
  "use strict";

  // ── Read config from script tag ───────────────────────────────────────────
  var scriptTag = document.currentScript;
  var CONFIG = {
    businessId: scriptTag.getAttribute("data-business-id") || "",
    agentName: scriptTag.getAttribute("data-agent-name") || "Assistant",
    color: scriptTag.getAttribute("data-color") || "#E8714A",
    wsUrl: scriptTag.getAttribute("data-ws-url") || "wss://api.frontdeskreply.com",
    webhookUrl: scriptTag.getAttribute("data-webhook-url") || "https://api.frontdeskreply.com/api/v1/webhooks/form",
    channelId: scriptTag.getAttribute("data-channel-id") || "",
    position: scriptTag.getAttribute("data-position") || "right",
    greeting: scriptTag.getAttribute("data-greeting") || "",
  };

  if (!CONFIG.businessId) {
    console.error("FrontdeskReply widget: data-business-id is required.");
    return;
  }

  // ── Fetch branding config from API ────────────────────────────────────────
  var brandingLoaded = false;
  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://api.frontdeskreply.com/api/v1/settings/widget-config?business_id=" + CONFIG.businessId, false);
    xhr.send();
    if (xhr.status === 200) {
      var branding = JSON.parse(xhr.responseText);
      if (branding.chatbot_name) CONFIG.agentName = branding.chatbot_name;
      if (branding.brand_color) CONFIG.color = branding.brand_color;
      if (branding.show_powered_by === false) CONFIG.hidePoweredBy = true;
      brandingLoaded = true;
    }
  } catch (e) {}

  // ── State ─────────────────────────────────────────────────────────────────
  var ws = null;
  var sessionId = null;
  var isOpen = false;
  var isConnected = false;
  var aiExchangeCount = 0;
  var currentAiEl = null;
  var reconnectAttempts = 0;
  var reconnectTimer = null;
  var visitorName = "";
  var visitorEmail = "";
  var visitorPhone = "";
  var businessName = CONFIG.agentName;

  // Restore session from localStorage (expire after 24 hours)
  try {
    var saved = JSON.parse(localStorage.getItem("fdr_chat_" + CONFIG.businessId) || "{}");
    var savedAt = saved.savedAt || 0;
    var hoursSinceSave = (Date.now() - savedAt) / (1000 * 60 * 60);
    if (hoursSinceSave < 24) {
      sessionId = saved.sessionId || null;
      visitorName = saved.visitorName || "";
      visitorEmail = saved.visitorEmail || "";
      visitorPhone = saved.visitorPhone || "";
    } else {
      // Session expired — clear it
      localStorage.removeItem("fdr_chat_" + CONFIG.businessId);
    }
  } catch (e) {}

  // ── Color utilities ───────────────────────────────────────────────────────
  function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function darkenHex(hex, amount) {
    var r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
    var g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
    var b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
    return "#" + [r, g, b].map(function (c) { return c.toString(16).padStart(2, "0"); }).join("");
  }

  var colorDk = darkenHex(CONFIG.color, 30);

  // ── Create Shadow DOM container ───────────────────────────────────────────
  var host = document.createElement("div");
  host.id = "fdr-chat-widget-host";
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: "closed" });

  // ── Styles ────────────────────────────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .fdr-fab {
      position: fixed;
      bottom: 28px;
      ${CONFIG.position === "left" ? "left: 28px;" : "right: 28px;"}
      z-index: 999998;
      display: flex;
      align-items: center;
      gap: 10px;
      background: ${CONFIG.color};
      color: #fff;
      border: none;
      border-radius: 50px;
      padding: 14px 22px 14px 18px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 8px 32px ${hexToRgba(CONFIG.color, 0.3)};
      transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
    }
    .fdr-fab:hover {
      background: ${colorDk};
      transform: translateY(-2px);
      box-shadow: 0 12px 36px ${hexToRgba(CONFIG.color, 0.4)};
    }
    .fdr-fab.fdr-open {
      border-radius: 50%;
      padding: 14px 16px;
      gap: 0;
    }
    .fdr-fab .fdr-icon { font-size: 20px; line-height: 1; }
    .fdr-fab .fdr-label { white-space: nowrap; }
    .fdr-fab.fdr-open .fdr-label { display: none; }

    .fdr-window {
      position: fixed;
      bottom: 100px;
      ${CONFIG.position === "left" ? "left: 28px;" : "right: 28px;"}
      z-index: 999999;
      width: 380px;
      max-width: calc(100vw - 40px);
      height: 520px;
      max-height: calc(100vh - 140px);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.18);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: translateY(16px) scale(0.97);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .fdr-window.fdr-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }

    /* Header */
    .fdr-header {
      background: ${CONFIG.color};
      padding: 16px 18px;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .fdr-avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; flex-shrink: 0;
    }
    .fdr-header-info { flex: 1; }
    .fdr-header-name {
      font-weight: 700; font-size: 15px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .fdr-header-status {
      font-size: 12px; opacity: 0.85; margin-top: 2px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .fdr-close {
      background: rgba(255,255,255,0.2);
      border: none; color: #fff;
      width: 30px; height: 30px;
      border-radius: 50%; font-size: 16px;
      cursor: pointer; display: flex;
      align-items: center; justify-content: center;
      transition: background 0.15s;
    }
    .fdr-close:hover { background: rgba(255,255,255,0.35); }

    /* Pre-chat form */
    .fdr-prechat {
      flex: 1; padding: 24px 18px;
      background: #FDF6F0;
      display: flex; flex-direction: column; gap: 14px;
    }
    .fdr-prechat h4 {
      font-size: 16px; font-weight: 700; color: #1C1C1C;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .fdr-prechat p {
      font-size: 13px; color: #666; line-height: 1.5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .fdr-input {
      width: 100%; padding: 11px 14px;
      border: 1.5px solid #E8D8CE;
      border-radius: 10px; font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1C1C1C; background: #fff;
      outline: none; transition: border-color 0.2s;
    }
    .fdr-input:focus { border-color: ${CONFIG.color}; }
    .fdr-input::placeholder { color: #aaa; }
    .fdr-start-btn {
      width: 100%; padding: 13px;
      background: ${CONFIG.color}; color: #fff;
      border: none; border-radius: 10px;
      font-size: 15px; font-weight: 700;
      cursor: pointer; transition: background 0.2s, transform 0.15s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin-top: 4px;
    }
    .fdr-start-btn:hover { background: ${colorDk}; transform: translateY(-1px); }
    .fdr-start-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

    /* Messages area */
    .fdr-messages {
      flex: 1; overflow-y: auto; padding: 16px 14px;
      background: #FDF6F0;
      display: flex; flex-direction: column; gap: 8px;
    }
    .fdr-msg {
      max-width: 82%; padding: 10px 14px;
      border-radius: 14px; font-size: 14px;
      line-height: 1.5; word-wrap: break-word;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: fdr-fadein 0.2s ease;
    }
    @keyframes fdr-fadein {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .fdr-msg-visitor {
      background: ${CONFIG.color}; color: #fff;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .fdr-msg-ai {
      background: #fff; color: #1C1C1C;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .fdr-msg-human {
      background: #e8f5e9; color: #1C1C1C;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .fdr-msg-system {
      background: #f0f0f0; color: #666;
      align-self: center; font-size: 12px;
      font-style: italic; border-radius: 8px;
      padding: 6px 12px;
    }
    .fdr-typing {
      align-self: flex-start;
      padding: 10px 18px;
      background: #fff;
      border-radius: 14px;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      display: flex; gap: 5px; align-items: center;
    }
    .fdr-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #bbb;
      animation: fdr-bounce 1.4s infinite;
    }
    .fdr-dot:nth-child(2) { animation-delay: 0.2s; }
    .fdr-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes fdr-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    /* Input bar */
    .fdr-input-bar {
      display: flex; gap: 8px;
      padding: 12px 14px;
      background: #fff;
      border-top: 1px solid #eee;
      flex-shrink: 0;
    }
    .fdr-input-bar input {
      flex: 1; padding: 10px 14px;
      border: 1.5px solid #E8D8CE;
      border-radius: 10px; font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1C1C1C; background: #fff;
      outline: none; transition: border-color 0.2s;
    }
    .fdr-input-bar input:focus { border-color: ${CONFIG.color}; }
    .fdr-input-bar input::placeholder { color: #aaa; }
    .fdr-send-btn {
      padding: 10px 18px;
      background: ${CONFIG.color}; color: #fff;
      border: none; border-radius: 10px;
      font-size: 14px; font-weight: 700;
      cursor: pointer; transition: background 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .fdr-send-btn:hover { background: ${colorDk}; }
    .fdr-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Reconnecting banner */
    .fdr-reconnecting {
      padding: 6px 12px;
      background: rgba(245,158,11,0.15);
      color: #f59e0b;
      font-size: 11px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      flex-shrink: 0;
    }

    /* Powered by */
    .fdr-powered {
      text-align: center; padding: 6px;
      font-size: 10px; color: #bbb;
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .fdr-powered a { color: #999; text-decoration: none; }
    .fdr-powered a:hover { color: #666; }

    /* Mobile responsive */
    @media (max-width: 480px) {
      .fdr-fab { bottom: 20px; right: 16px; left: auto; padding: 13px 18px 13px 15px; font-size: 14px; }
      .fdr-window {
        right: 0; left: 0; bottom: 0; top: 0;
        width: 100%; max-width: 100%;
        height: 100%; max-height: 100%;
        border-radius: 0;
      }
    }
  `;
  shadow.appendChild(style);

  // ── Build DOM ─────────────────────────────────────────────────────────────

  // Floating button
  var fab = document.createElement("button");
  fab.className = "fdr-fab";
  fab.setAttribute("aria-label", "Open chat");
  fab.innerHTML = '<span class="fdr-icon">💬</span><span class="fdr-label">Chat with us</span>';
  fab.addEventListener("click", toggleWidget);
  shadow.appendChild(fab);

  // Chat window
  var win = document.createElement("div");
  win.className = "fdr-window";
  win.innerHTML = `
    <div class="fdr-header">
      <div class="fdr-avatar">💬</div>
      <div class="fdr-header-info">
        <div class="fdr-header-name">${escapeHtml(CONFIG.agentName)}</div>
        <div class="fdr-header-status">We typically reply instantly</div>
      </div>
      <button class="fdr-close" aria-label="Close chat">✕</button>
    </div>
    <div class="fdr-prechat" id="fdr-prechat">
      <h4>Start a conversation</h4>
      <p>Enter your info below and we'll respond right away!</p>
      <input class="fdr-input" id="fdr-pre-name" type="text" placeholder="Your name *" autocomplete="name" />
      <input class="fdr-input" id="fdr-pre-email" type="email" placeholder="Your email *" autocomplete="email" />
      <input class="fdr-input" id="fdr-pre-phone" type="tel" placeholder="Phone number (optional)" autocomplete="tel" />
      <button class="fdr-start-btn" id="fdr-start-btn">Start Chat</button>
    </div>
    <div class="fdr-reconnecting" id="fdr-reconnecting" style="display:none;">Reconnecting...</div>
    <div class="fdr-messages" id="fdr-messages" style="display:none;"></div>
    <div class="fdr-input-bar" id="fdr-input-bar" style="display:none;">
      <input type="text" id="fdr-msg-input" placeholder="Type a message..." autocomplete="off" />
      <button class="fdr-send-btn" id="fdr-send-btn">Send</button>
    </div>
    <div class="fdr-powered" id="fdr-powered" style="display:none;">
      ${CONFIG.hidePoweredBy ? "" : "Powered by <a href=\"https://frontdeskreply.com\" target=\"_blank\" rel=\"noopener\">FrontdeskReply</a>"}
    </div>
  `;
  shadow.appendChild(win);

  // Element references
  var closeBtn = win.querySelector(".fdr-close");
  var prechat = win.querySelector("#fdr-prechat");
  var preNameInput = win.querySelector("#fdr-pre-name");
  var preEmailInput = win.querySelector("#fdr-pre-email");
  var prePhoneInput = win.querySelector("#fdr-pre-phone");
  var startBtn = win.querySelector("#fdr-start-btn");
  var messagesEl = win.querySelector("#fdr-messages");
  var inputBar = win.querySelector("#fdr-input-bar");
  var msgInput = win.querySelector("#fdr-msg-input");
  var sendBtn = win.querySelector("#fdr-send-btn");
  var poweredBy = win.querySelector("#fdr-powered");
  var reconnectBanner = win.querySelector("#fdr-reconnecting");
  var headerStatus = win.querySelector(".fdr-header-status");
  var headerName = win.querySelector(".fdr-header-name");

  // ── Event listeners ───────────────────────────────────────────────────────
  closeBtn.addEventListener("click", toggleWidget);
  startBtn.addEventListener("click", startChat);
  sendBtn.addEventListener("click", sendMessage);
  msgInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  preNameInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") startChat();
  });
  preEmailInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") startChat();
  });
  prePhoneInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") startChat();
  });

  // Close on outside click
  document.addEventListener("click", function (e) {
    if (isOpen && !host.contains(e.target)) {
      toggleWidget();
    }
  });

  // ── Toggle widget ─────────────────────────────────────────────────────────
  function toggleWidget() {
    isOpen = !isOpen;
    if (isOpen) {
      win.classList.add("fdr-visible");
      fab.classList.add("fdr-open");
      fab.querySelector(".fdr-icon").textContent = "✕";
      // If already chatting, focus input
      if (isConnected) {
        msgInput.focus();
      } else if (visitorName) {
        // Returning visitor — skip prechat
        showChatUI();
        connectWebSocket();
      } else {
        preNameInput.focus();
      }
    } else {
      win.classList.remove("fdr-visible");
      fab.classList.remove("fdr-open");
      fab.querySelector(".fdr-icon").textContent = "💬";
    }
  }

  // ── Start chat (from prechat form) ────────────────────────────────────────
  function startChat() {
    var name = preNameInput.value.trim();
    var email = preEmailInput.value.trim();

    // Reset border colors
    preNameInput.style.borderColor = "#E8D8CE";
    preEmailInput.style.borderColor = "#E8D8CE";

    // Validate name (required)
    if (!name) {
      preNameInput.style.borderColor = "#e74c3c";
      preNameInput.focus();
      return;
    }
    // Validate email (required)
    if (!email || !email.includes("@")) {
      preEmailInput.style.borderColor = "#e74c3c";
      preEmailInput.focus();
      return;
    }

    visitorName = name;
    visitorEmail = email;
    visitorPhone = prePhoneInput.value.trim();

    // Save to localStorage
    saveState();

    showChatUI();
    connectWebSocket();
  }

  function showChatUI() {
    prechat.style.display = "none";
    messagesEl.style.display = "flex";
    inputBar.style.display = "flex";
    poweredBy.style.display = "block";
    msgInput.focus();
  }

  // ── WebSocket connection ──────────────────────────────────────────────────
  function connectWebSocket() {
    if (ws && ws.readyState <= 1) return; // already open or connecting

    headerStatus.textContent = "Connecting...";
    var url = CONFIG.wsUrl + "/ws/chat/" + CONFIG.businessId;
    ws = new WebSocket(url);

    ws.onopen = function () {
      isConnected = true;
      reconnectAttempts = 0;
      headerStatus.textContent = "Online";
      reconnectBanner.style.display = "none";

      // Send init frame
      var init = {
        type: "init",
        visitor_name: visitorName,
        visitor_email: visitorEmail || undefined,
        visitor_phone: visitorPhone || undefined,
      };
      if (sessionId) init.session_id = sessionId;
      ws.send(JSON.stringify(init));
    };

    ws.onmessage = function (event) {
      var data = JSON.parse(event.data);
      handleFrame(data);
    };

    ws.onclose = function (e) {
      isConnected = false;
      headerStatus.textContent = "Offline";

      // If closed with plan-not-eligible, fall back to form mode
      if (e.code === 4403) {
        fallbackToForm();
        return;
      }

      // Auto-reconnect with exponential backoff
      if (isOpen || sessionId) {
        scheduleReconnect();
      }
    };

    ws.onerror = function () {
      // onclose will fire after this
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectAttempts++;
    var delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
    headerStatus.textContent = "Reconnecting...";
    reconnectBanner.style.display = "block";
    reconnectBanner.textContent = "Connection lost. Reconnecting...";
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      connectWebSocket();
    }, delay);
  }

  // ── Handle incoming frames ────────────────────────────────────────────────
  function handleFrame(data) {
    switch (data.type) {
      case "session_created":
        sessionId = data.session_id;
        if (data.business_name) {
          businessName = data.business_name;
          headerName.textContent = data.business_name;
        }
        saveState();
        break;

      case "greeting":
        addMessage(data.content, "ai");
        break;

      case "typing":
        showTyping();
        break;

      case "ai_chunk":
        removeTyping();
        if (!currentAiEl) {
          currentAiEl = addMessage("", "ai");
        }
        currentAiEl.textContent += data.content;
        scrollToBottom();
        break;

      case "ai_done":
        currentAiEl = null;
        break;

      case "human_message":
        addMessage(data.content, "human");
        break;

      case "human_takeover":
        addMessage(data.content, "system");
        headerStatus.textContent = "Chatting with a team member";
        break;

      case "human_handback":
        addMessage(data.content, "system");
        headerStatus.textContent = "Online";
        break;

      case "system":
        addMessage(data.content, "system");
        break;

      case "error":
        addMessage(data.content, "system");
        break;

      case "session_ended":
        addMessage(data.content, "system");
        sessionId = null;
        saveState();
        break;

      case "ping":
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "pong" }));
        }
        break;
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────
  function sendMessage() {
    var text = msgInput.value.trim();
    if (!text || !ws || ws.readyState !== 1) return;

    ws.send(JSON.stringify({ type: "message", content: text }));
    addMessage(text, "visitor");
    msgInput.value = "";
    msgInput.focus();

  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function addMessage(text, role) {
    removeTyping();
    var div = document.createElement("div");
    div.className = "fdr-msg fdr-msg-" + role;
    div.textContent = text;
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function showTyping() {
    if (messagesEl.querySelector(".fdr-typing")) return;
    var div = document.createElement("div");
    div.className = "fdr-typing";
    div.innerHTML = '<div class="fdr-dot"></div><div class="fdr-dot"></div><div class="fdr-dot"></div>';
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function removeTyping() {
    var t = messagesEl.querySelector(".fdr-typing");
    if (t) t.remove();
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function saveState() {
    try {
      localStorage.setItem("fdr_chat_" + CONFIG.businessId, JSON.stringify({
        sessionId: sessionId,
        visitorName: visitorName,
        visitorEmail: visitorEmail,
        visitorPhone: visitorPhone,
        savedAt: Date.now(),
      }));
    } catch (e) {}
  }

  // ── Fallback to async form ────────────────────────────────────────────────
  function fallbackToForm() {
    // Replace chat UI with a simple form if WebSocket isn't available
    messagesEl.style.display = "none";
    inputBar.style.display = "none";
    poweredBy.style.display = "none";

    prechat.style.display = "flex";
    prechat.innerHTML = `
      <h4>Send us a message</h4>
      <p>We'll get back to you shortly via email.</p>
      <input class="fdr-input" id="fdr-fb-name" type="text" placeholder="Your name" value="${escapeHtml(visitorName)}" />
      <input class="fdr-input" id="fdr-fb-email" type="email" placeholder="Your email" value="${escapeHtml(visitorEmail)}" />
      <textarea class="fdr-input" id="fdr-fb-message" placeholder="How can we help?" style="height:80px;resize:none;"></textarea>
      <button class="fdr-start-btn" id="fdr-fb-send">Send Message</button>
    `;

    var fbSendBtn = prechat.querySelector("#fdr-fb-send");
    fbSendBtn.addEventListener("click", function () {
      var name = prechat.querySelector("#fdr-fb-name").value.trim();
      var email = prechat.querySelector("#fdr-fb-email").value.trim();
      var msg = prechat.querySelector("#fdr-fb-message").value.trim();
      if (!name || !email || !msg) return;

      fbSendBtn.disabled = true;
      fbSendBtn.textContent = "Sending...";

      var payload = {
        channel_id: CONFIG.channelId || CONFIG.businessId,
        sender_name: name,
        sender_email: email,
        body: msg,
        contact_preference: "email",
      };

      fetch(CONFIG.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(function () {
        prechat.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:40px;margin-bottom:12px;">✅</div><h4 style="color:' + CONFIG.color + ';font-size:18px;">Message sent!</h4><p style="color:#666;font-size:13px;margin-top:8px;">We\'ll get back to you soon.</p></div>';
      }).catch(function () {
        fbSendBtn.disabled = false;
        fbSendBtn.textContent = "Send Message";
      });
    });
  }

  // ── Proactive greeting — auto-open after 18 seconds ───────────────────────
  // Only triggers if visitor hasn't opened the widget yet and has no existing session
  if (!sessionId && !visitorName) {
    setTimeout(function () {
      if (!isOpen && !isConnected) {
        // Gently pulse the button to draw attention
        fab.style.animation = "fdr-pulse 1.5s ease 3";
        // Add pulse keyframes if not already present
        var pulseStyle = document.createElement("style");
        pulseStyle.textContent = "@keyframes fdr-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }";
        shadow.appendChild(pulseStyle);
      }
    }, 18000);
  }

})();
