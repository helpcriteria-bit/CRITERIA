/*
  CRITERIA AI CHAT WIDGET — AI + Local Q&A fallback
  ==================================================
  1. Tries the Render backend (Groq AI) first, waiting up to 50 seconds
     (Render free servers sleep and need time to wake up).
  2. If the backend fails or takes longer than 50s, it switches to the
     built-in local Q&A (keyword matching) so the chat always answers.
  3. After a cooldown the widget tries the AI backend again.
  4. Fully knows every public section, tool, mode, and feature of the website,
     including CRITSPACE, pages, tools, shortcuts, policies, and pricing.
  5. Strictly protects internal admin/agent portals, credentials, and security secrets.
  6. If an off-topic question is asked, CRIT answers it first, then
     smoothly kicks off the subject back to CRITERIA/CRITSPACE!
*/

(function () {

  // Start waking up Groq backend early in background on page load & track status
  let isGroqAwake = false;
  let isGroqWaking = true;
  let hasWebsiteLoaded = false;

  function updateBubbleWakingState() {
    const toggle = document.getElementById('crit-toggle');
    const bubble = document.getElementById('crit-bubble');
    if (!toggle) return;

    if (hasWebsiteLoaded && !isGroqAwake) {
      toggle.classList.add('crit-bubble-waking');
      toggle.setAttribute('title', 'Waking Groq AI assistant…');
      if (bubble) bubble.classList.add('crit-bubble-waking');
    } else {
      toggle.classList.remove('crit-bubble-waking');
      toggle.removeAttribute('title');
      if (bubble) bubble.classList.remove('crit-bubble-waking');
    }
  }

  function pingGroqBackend() {
    isGroqWaking = true;
    updateBubbleWakingState();

    fetch('https://crit-bot-1.onrender.com/health', { cache: 'no-store' })
      .then(res => {
        if (res.ok) {
          isGroqAwake = true;
          isGroqWaking = false;
          updateBubbleWakingState();
          if (typeof leaveQaMode === 'function') leaveQaMode();
        } else {
          throw new Error('Not ok');
        }
      })
      .catch(() => {
        if (!isGroqAwake) {
          setTimeout(pingGroqBackend, 3500);
        }
      });
  }

  // Start pinging immediately while website loads
  try { pingGroqBackend(); } catch (e) { }

  function onWebsiteLoaded() {
    if (hasWebsiteLoaded) return;
    hasWebsiteLoaded = true;
    updateBubbleWakingState();
  }

  if (document.readyState === 'complete') {
    onWebsiteLoaded();
  } else {
    window.addEventListener('load', onWebsiteLoaded);
    document.addEventListener('DOMContentLoaded', () => {
      const ls = document.getElementById('loading-screen');
      if (ls) {
        const obs = new MutationObserver(() => {
          if (ls.classList.contains('hidden') || ls.style.display === 'none') {
            onWebsiteLoaded();
            obs.disconnect();
          }
        });
        obs.observe(ls, { attributes: true, attributeFilter: ['class', 'style'] });
      }
      setTimeout(onWebsiteLoaded, 1200);
    });
  }

  /* ============================================================
     STYLES
  ============================================================ */
  const css = `
    #crit-backdrop {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    #crit-bubble.open #crit-backdrop {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    body.submit-page #crit-backdrop,
    .submit-page #crit-backdrop,
    html[data-page="submit"] #crit-backdrop,
    #crit-bubble.no-backdrop #crit-backdrop {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    #crit-bubble {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 99995;
      font-family: 'DM Sans', 'Segoe UI', sans-serif;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }
    body.mobile-menu-open #crit-bubble,
    body.mobile-menu-open #crit-toggle,
    #crit-bubble.loading-hidden,
    #crit-bubble.crit-tour-hidden,
    body.crit-tour-active #crit-bubble {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    #crit-toggle {
      width: 58px; height: 58px;
      border-radius: 50%;
      background: #f0a500;
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 24px rgba(240,165,0,0.45);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      margin-left: auto; position: relative;
    }
    #crit-toggle:hover {
      transform: scale(1.08);
      box-shadow: 0 8px 32px rgba(240,165,0,0.55);
    }
    #crit-toggle svg { width: 26px; height: 26px; fill: #000; transition: opacity 0.2s; }
    #crit-toggle .crit-icon-chat  { display: block; }
    #crit-toggle .crit-icon-close { display: none;  }
    #crit-bubble.open #crit-toggle .crit-icon-chat  { display: none;  }
    #crit-bubble.open #crit-toggle .crit-icon-close { display: block; }

    /* Waking state on bubble button when AI is asleep */
    #crit-toggle.crit-bubble-waking {
      box-shadow: 0 0 0 0 rgba(240, 165, 0, 0.7);
      animation: crit-bubble-wake-glow 2s infinite cubic-bezier(0.66, 0, 0, 1);
    }
    #crit-toggle.crit-bubble-waking::after {
      content: '';
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      border: 2.5px solid transparent;
      border-top-color: #f0a500;
      border-right-color: rgba(240, 165, 0, 0.5);
      animation: crit-bubble-wake-spin 1.1s linear infinite;
      pointer-events: none;
    }
    #crit-toggle.crit-bubble-waking::before {
      content: '';
      position: absolute;
      inset: -11px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(240, 165, 0, 0.28) 0%, transparent 70%);
      animation: crit-bubble-wake-pulse 1.8s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes crit-bubble-wake-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes crit-bubble-wake-pulse {
      0%, 100% { transform: scale(0.92); opacity: 0.4; }
      50% { transform: scale(1.18); opacity: 0.95; }
    }
    @keyframes crit-bubble-wake-glow {
      0% { box-shadow: 0 0 0 0 rgba(240, 165, 0, 0.75), 0 6px 24px rgba(240,165,0,0.45); }
      70% { box-shadow: 0 0 0 14px rgba(240, 165, 0, 0), 0 6px 24px rgba(240,165,0,0.45); }
      100% { box-shadow: 0 0 0 0 rgba(240, 165, 0, 0), 0 6px 24px rgba(240,165,0,0.45); }
    }

    #crit-unread {
      position: absolute; top: -2px; right: -2px;
      width: 18px; height: 18px;
      background: #ef4444; color: #fff;
      font-size: 10px; font-weight: 700;
      border-radius: 50%;
      display: none; align-items: center; justify-content: center;
      border: 2px solid #080808;
    }

    #crit-window {
      position: absolute;
      bottom: 74px; right: 0;
      width: 375px;
      height: 540px;
      max-height: calc(100vh - 110px);
      background: rgba(14, 14, 18, 0.95);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 22px;
      overflow: hidden;
      display: flex; flex-direction: column;
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.8), 0 0 35px rgba(240, 165, 0, 0.08);
      transform: scale(0.92) translateY(14px);
      transform-origin: bottom right;
      opacity: 0; pointer-events: none;
      transition: transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.25s ease;
      overscroll-behavior: contain;
    }
    #crit-bubble.open #crit-window {
      transform: scale(1) translateY(0);
      opacity: 1; pointer-events: all;
    }

    #crit-header {
      padding: 14px 16px;
      background: rgba(22, 22, 28, 0.9);
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
      display: flex; align-items: center; gap: 11px;
      flex-shrink: 0;
    }
    .crit-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, rgba(240,165,0,0.25), rgba(240,165,0,0.08));
      border: 1.5px solid rgba(240,165,0,0.5);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Syne', sans-serif;
      font-weight: 800; font-size: 14px; color: #f0a500;
      flex-shrink: 0; position: relative;
    }
    .crit-avatar-pulse {
      position: absolute; inset: -3px; border-radius: 50%;
      border: 1px solid rgba(240, 165, 0, 0.35);
      animation: crit-pulse-ring 2.8s ease-out infinite;
    }
    @keyframes crit-pulse-ring {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.15); opacity: 0; }
      100% { transform: scale(1.15); opacity: 0; }
    }
    .crit-header-text { flex: 1; min-width: 0; }
    .crit-header-name {
      font-family: 'Syne', sans-serif;
      font-weight: 700; font-size: 13.5px; color: #ffffff;
      letter-spacing: 0.2px;
    }
    .crit-header-sub {
      font-size: 11px; color: #10b981;
      display: flex; align-items: center; gap: 5px; margin-top: 2px;
      font-weight: 500;
    }
    .crit-online-dot {
      width: 6.5px; height: 6.5px; border-radius: 50%;
      background: #10b981; flex-shrink: 0;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
    }
    .crit-header-actions {
      display: flex; gap: 6px; align-items: center;
      flex-shrink: 0;
    }
    #crit-clear {
      padding: 5px 9px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05);
      color: #e4e4e7;
      border-radius: 8px;
      font-size: 11px;
      font-family: 'DM Sans', sans-serif;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    #crit-clear:hover {
      background: rgba(240,165,0,0.15);
      border-color: rgba(240,165,0,0.4);
      color: #f0a500;
    }
    #crit-header-close {
      width: 28px; height: 28px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.6);
      font-size: 13px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s ease;
    }
    #crit-header-close:hover {
      background: rgba(255,255,255,0.12);
      color: #fff;
      border-color: rgba(255,255,255,0.25);
    }
    .crit-mobile-bar {
      display: none;
    }
    #crit-header-close .crit-close-txt {
      display: none;
    }
    #crit-header-close .crit-close-x {
      display: inline-block;
    }

    #crit-messages {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto !important;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      scroll-behavior: smooth;
      padding: 16px 14px 12px;
      display: flex; flex-direction: column; gap: 12px;
      scrollbar-width: thin;
      scrollbar-color: rgba(240,165,0,0.35) transparent;
    }
    #crit-messages::-webkit-scrollbar { width: 5px; }
    #crit-messages::-webkit-scrollbar-track { background: transparent; }
    #crit-messages::-webkit-scrollbar-thumb {
      background: rgba(240,165,0,0.3);
      border-radius: 999px;
    }
    #crit-messages::-webkit-scrollbar-thumb:hover {
      background: rgba(240,165,0,0.6);
    }

    .crit-msg {
      max-width: 88%;
      padding: 11px 14px;
      border-radius: 16px;
      font-size: 13.5px;
      line-height: 1.58;
      word-break: break-word;
      animation: crit-pop 0.22s ease-out;
    }
    @keyframes crit-pop {
      from { opacity:0; transform:translateY(6px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .crit-msg.bot {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      color: #ececec;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }
    .crit-msg.user {
      background: linear-gradient(135deg, rgba(240,165,0,0.22), rgba(240,165,0,0.12));
      border: 1px solid rgba(240,165,0,0.32);
      color: #ffffff;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .crit-msg.bot a { color: #f0a500; text-decoration: underline; font-weight: 500; }
    .crit-msg.error {
      background: rgba(239,68,68,0.08);
      border-color: rgba(239,68,68,0.25);
      color: #fca5a5;
    }

    .crit-typing {
      display: flex; align-items: center; gap: 4px;
      padding: 10px 14px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 14px; border-bottom-left-radius: 4px;
      align-self: flex-start; width: fit-content;
    }
    .crit-typing span {
      width: 6px; height: 6px; border-radius: 50%;
      background: rgba(255,255,255,0.4);
      animation: crit-bounce 1.3s ease-in-out infinite;
    }
    .crit-typing span:nth-child(2) { animation-delay: .18s; }
    .crit-typing span:nth-child(3) { animation-delay: .36s; }
    @keyframes crit-bounce {
      0%,60%,100% { transform:translateY(0); opacity:.4; }
      30%          { transform:translateY(-5px); opacity:1; }
    }

    #crit-input-row {
      padding: 10px 12px 12px;
      display: flex; gap: 8px; align-items: flex-end;
      background: rgba(18, 18, 22, 0.95);
      border-top: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    .crit-input-container {
      flex: 1;
      display: flex;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      transition: border-color 0.2s ease, background 0.2s ease;
    }
    .crit-input-container:focus-within {
      border-color: rgba(240,165,0,0.45);
      background: rgba(255,255,255,0.06);
    }
    #crit-input {
      width: 100%;
      background: transparent;
      border: none;
      padding: 9px 12px;
      color: #ffffff;
      font-family: 'DM Sans', sans-serif;
      font-size: 13.5px;
      outline: none; resize: none;
      min-height: 38px; max-height: 100px;
      line-height: 1.45;
    }
    #crit-input::placeholder { color: rgba(255,255,255,0.3); }

    #crit-send {
      width: 38px; height: 38px; border-radius: 11px;
      background: #f0a500; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
      box-shadow: 0 4px 14px rgba(240,165,0,0.3);
    }
    #crit-send:hover:not(:disabled) {
      background: #ffb703;
      transform: scale(1.05);
      box-shadow: 0 6px 18px rgba(240,165,0,0.45);
    }
    #crit-send:disabled {
      opacity: 0.35; cursor: not-allowed; transform: none; box-shadow: none;
    }
    #crit-send svg { width: 17px; height: 17px; fill: #000; }

    #crit-footer {
      text-align: center; font-size: 10px;
      color: rgba(255,255,255,0.25);
      padding: 0 0 7px;
      background: rgba(18, 18, 22, 0.95);
      flex-shrink: 0;
      letter-spacing: 0.4px;
      font-weight: 500;
    }    @media (max-width: 600px) {
      /* Simulated Mobile Touch Circle */
      .crit-bot-pointer-svg {
        display: none !important;
      }
      .crit-bot-mobile-circle {
        display: block !important;
      }

      /* Compact, Contained Mobile Chat Modal */
      #crit-toggle {
        width: 46px !important;
        height: 46px !important;
      }
      #crit-toggle svg {
        width: 20px !important;
        height: 20px !important;
      }
      #crit-bubble {
        bottom: 12px !important;
        right: 12px !important;
      }
      #crit-bubble.open #crit-toggle {
        display: none !important; /* Hide floating toggle while chat modal is open */
      }
      #crit-window {
        position: fixed !important;
        inset: 0 !important;
        top: 0 !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        width: 100vw !important;
        width: 100dvw !important;
        height: 100vh !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        border-radius: 0 !important;
        border: none !important;
        margin: 0 !important;
        z-index: 1000000 !important;
        display: flex !important;
        flex-direction: column !important;
        box-shadow: none !important;
        background: #0e0e12 !important;
        transform: none !important;
        overscroll-behavior: contain !important;
      }
      #crit-bubble.open #crit-window {
        transform: none !important;
        opacity: 1 !important;
        pointer-events: all !important;
      }
      .crit-mobile-bar {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-direction: column !important;
        gap: 4px !important;
        padding: max(10px, env(safe-area-inset-top, 10px)) 16px 6px !important;
        background: rgba(18, 18, 24, 0.98) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        cursor: pointer !important;
        user-select: none !important;
        -webkit-tap-highlight-color: transparent !important;
        flex-shrink: 0 !important;
      }
      .crit-mobile-handle {
        width: 44px !important;
        height: 4.5px !important;
        background: rgba(255, 255, 255, 0.4) !important;
        border-radius: 10px !important;
        transition: background 0.2s, transform 0.2s !important;
      }
      .crit-mobile-bar:hover .crit-mobile-handle,
      .crit-mobile-bar:active .crit-mobile-handle {
        background: #f0a500 !important;
        transform: scaleX(1.15) !important;
      }
      .crit-mobile-close-label {
        font-size: 10px !important;
        font-family: 'Syne', sans-serif !important;
        font-weight: 700 !important;
        letter-spacing: 0.08em !important;
        text-transform: uppercase !important;
        color: rgba(255, 255, 255, 0.5) !important;
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
      }
      .crit-mobile-bar:hover .crit-mobile-close-label,
      .crit-mobile-bar:active .crit-mobile-close-label {
        color: #f0a500 !important;
      }

      #crit-header {
        height: auto !important;
        min-height: 48px !important;
        padding: 8px 14px !important;
        flex-shrink: 0 !important;
      }
      #crit-header-close {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 5px !important;
        min-width: 36px !important;
        height: 34px !important;
        padding: 0 10px !important;
        border-radius: 100px !important;
        background: rgba(240, 165, 0, 0.18) !important;
        border: 1px solid #f0a500 !important;
        color: #f0a500 !important;
        font-family: 'Syne', sans-serif !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        box-shadow: 0 0 12px rgba(240, 165, 0, 0.25) !important;
        touch-action: manipulation !important;
        flex-shrink: 0 !important;
      }
      #crit-header-close:active {
        background: #f0a500 !important;
        color: #000 !important;
        transform: scale(0.94) !important;
      }
      #crit-header-close .crit-close-txt {
        display: inline-block !important;
        font-size: 10.5px !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
      }
      #crit-header-close .crit-close-x {
        font-size: 13px !important;
        line-height: 1 !important;
      }
      #crit-messages {
        flex: 1 1 auto !important;
        max-height: none !important;
        padding: 10px 10px 6px !important;
      }
      #crit-input-row {
        padding: 5px 8px !important;
        margin: 2px 8px 4px !important;
        border-radius: 10px !important;
        flex-shrink: 0 !important;
      }
      #crit-input {
        font-size: 14px !important;
        min-height: 34px !important;
      }
      #crit-send {
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
      }
      #crit-footer {
        font-size: 8.5px !important;
        padding: 0 0 4px !important;
        flex-shrink: 0 !important;
      }

      /* Well-Aligned & Proportional Mobile Tour Card */
      #crit-tour-card:not(.is-displaced):not(.is-dragged) {
        bottom: 8px !important;
        left: 0 !important;
        right: 0 !important;
        margin: 0 auto !important;
        transform: none !important;
      }
      #crit-tour-card {
        width: min(calc(100vw - 16px), 330px) !important;
        max-width: calc(100vw - 16px) !important;
        padding: 8px 12px 8px !important;
        border-radius: 13px !important;
        box-sizing: border-box !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
      }
      .crit-tour-drag-handle {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
        height: 16px !important;
        margin-top: -3px !important;
        margin-bottom: 3px !important;
        cursor: grab !important;
        touch-action: none !important;
        user-select: none !important;
        -webkit-user-select: none !important;
      }
      .crit-tour-drag-bar {
        width: 40px !important;
        height: 4px !important;
        background: rgba(255, 255, 255, 0.48) !important;
        border-radius: 999px !important;
        transition: width 0.22s ease, background 0.22s ease, box-shadow 0.22s ease !important;
        pointer-events: none !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5) !important;
      }
      .crit-tour-drag-handle:hover .crit-tour-drag-bar,
      #crit-tour-card:hover .crit-tour-drag-bar {
        background: #f0a500 !important;
        width: 50px !important;
        box-shadow: 0 0 10px rgba(240, 165, 0, 0.7) !important;
      }
      #crit-tour-card.is-dragged .crit-tour-drag-bar {
        background: #f0a500 !important;
        width: 54px !important;
        box-shadow: 0 0 14px rgba(240, 165, 0, 0.85) !important;
      }
      .crit-tour-header {
        margin-bottom: 3px !important;
        gap: 5px !important;
      }
      .crit-tour-avatar {
        width: 15px !important;
        height: 15px !important;
        font-size: 8px !important;
      }
      .crit-tour-badge-name {
        font-size: 9.5px !important;
      }
      .crit-tour-step-pill {
        font-size: 8.5px !important;
        padding: 1px 5px !important;
      }
      .crit-tour-title {
        font-size: 11.5px !important;
        margin-bottom: 2px !important;
        font-weight: 700 !important;
        line-height: 1.28 !important;
      }
      .crit-tour-body {
        font-size: 10.5px !important;
        line-height: 1.35 !important;
        margin-bottom: 5px !important;
      }
      .crit-tour-footer {
        padding-top: 5px !important;
        margin-top: 3px !important;
        gap: 6px !important;
      }
      .crit-tour-btn-skip,
      .crit-tour-btn-prev,
      .crit-tour-btn-next {
        height: 29px !important;
        min-height: 29px !important;
        font-size: 10.5px !important;
        border-radius: 6px !important;
      }
      .crit-tour-btn-skip {
        padding: 0 9px !important;
      }
      .crit-tour-btn-prev {
        padding: 0 9px !important;
      }
      .crit-tour-btn-next {
        padding: 0 12px !important;
        font-size: 11px !important;
      }
    }

    @media (min-width: 601px) and (max-width: 768px) {
      #crit-tour-card {
        width: clamp(250px, 48vw, 320px) !important;
        max-width: 320px !important;
        padding: 9px 13px 8px !important;
        border-radius: 13px !important;
        box-sizing: border-box !important;
      }
      .crit-tour-title {
        font-size: 12px !important;
      }
      .crit-tour-body {
        font-size: 10.5px !important;
      }
    }

    @media (max-width: 390px) {
      #crit-toggle {
        width: 40px !important;
        height: 40px !important;
      }
      #crit-toggle svg {
        width: 18px !important;
        height: 18px !important;
      }
      #crit-bubble {
        bottom: 8px !important;
        right: 8px !important;
      }
      /* #crit-window handled by 600px full sheet */
      #crit-tour-card:not(.is-displaced):not(.is-dragged) {
        bottom: 8px !important;
        left: 0 !important;
        right: 0 !important;
        margin: 0 auto !important;
        transform: none !important;
      }
      #crit-tour-card {
        width: min(calc(100vw - 16px), 360px) !important;
        max-width: calc(100vw - 16px) !important;
        padding: 8px 12px 8px !important;
        border-radius: 13px !important;
      }
      .crit-tour-drag-handle {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
        height: 15px !important;
        margin: -2px auto 3px !important;
        cursor: grab !important;
        touch-action: none !important;
      }
      .crit-tour-drag-bar {
        width: 38px !important;
        height: 3.5px !important;
        background: rgba(255, 255, 255, 0.45) !important;
        border-radius: 999px !important;
        transition: width 0.22s ease, background 0.22s ease, box-shadow 0.22s ease !important;
        pointer-events: none !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5) !important;
      }
      .crit-tour-drag-handle:hover .crit-tour-drag-bar,
      #crit-tour-card:hover .crit-tour-drag-bar {
        background: #f0a500 !important;
        width: 48px !important;
        box-shadow: 0 0 10px rgba(240, 165, 0, 0.7) !important;
      }
      #crit-tour-card.is-dragged .crit-tour-drag-bar {
        background: #f0a500 !important;
        width: 52px !important;
        box-shadow: 0 0 14px rgba(240, 165, 0, 0.85) !important;
      }
      .crit-tour-avatar {
        width: 12px !important;
        height: 12px !important;
        font-size: 7px !important;
      }
      .crit-tour-badge-name {
        font-size: 8px !important;
      }
      .crit-tour-step-pill {
        font-size: 7.5px !important;
        padding: 0 3px !important;
      }
      .crit-tour-title {
        font-size: 9.5px !important;
        line-height: 1.2 !important;
        margin-bottom: 1.5px !important;
      }
      .crit-tour-body {
        font-size: 8.2px !important;
        line-height: 1.2 !important;
        margin-bottom: 3px !important;
      }
      .crit-tour-btn-next, .crit-tour-btn-prev {
        padding: 2px 5px !important;
        font-size: 8px !important;
        border-radius: 5px !important;
      }
      .crit-tour-btn-skip {
        padding: 1.5px 4px !important;
        font-size: 7.5px !important;
        border-radius: 5px !important;
      }
    }

    @media (max-width: 320px) {
      #crit-tour-card:not(.is-displaced):not(.is-dragged) {
        bottom: 8px !important;
        left: 0 !important;
        right: 0 !important;
        margin: 0 auto !important;
        transform: none !important;
      }
      #crit-tour-card {
        width: calc(100vw - 16px) !important;
        max-width: calc(100vw - 16px) !important;
        padding: 9px 11px 9px !important;
        border-radius: 13px !important;
        bottom: 8px !important;
        box-sizing: border-box !important;
      }
      .crit-tour-drag-handle {
        height: 14px !important;
        margin-top: -3px !important;
        margin-bottom: 2px !important;
      }
      .crit-tour-drag-bar {
        width: 36px !important;
        height: 3.5px !important;
      }
      .crit-tour-header {
        margin-bottom: 3px !important;
        gap: 4px !important;
      }
      .crit-tour-avatar {
        width: 15px !important;
        height: 15px !important;
        font-size: 8px !important;
      }
      .crit-tour-badge-name {
        font-size: 9px !important;
      }
      .crit-tour-step-pill {
        font-size: 8px !important;
        padding: 1px 5px !important;
      }
      .crit-tour-title {
        font-size: 11.5px !important;
        font-weight: 700 !important;
        line-height: 1.25 !important;
        margin-bottom: 2px !important;
      }
      .crit-tour-body {
        font-size: 10.5px !important;
        line-height: 1.35 !important;
        margin-bottom: 6px !important;
      }
      .crit-tour-footer {
        padding-top: 5px !important;
        margin-top: 2px !important;
        gap: 5px !important;
      }
      .crit-tour-btn-next, .crit-tour-btn-prev {
        padding: 4px 9px !important;
        font-size: 10px !important;
        min-height: 28px !important;
        border-radius: 6px !important;
      }
      .crit-tour-btn-skip {
        padding: 4px 7px !important;
        font-size: 9.5px !important;
        min-height: 28px !important;
        border-radius: 6px !important;
      }
    }

    #crit-spotlight-overlay {
      display: none !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    body.crit-tour-active {
      overflow-y: scroll !important;
    }
    #crit-spotlight-svg {
      position: fixed !important;
      inset: 0 !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 99991 !important;
      pointer-events: none !important;
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      overflow: hidden !important;
    }
    #crit-spotlight-svg.active {
      display: block !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    #crit-spotlight-svg:not(.active) {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    #crit-spotlight-svg,
    #crit-spotlight-svg * {
      pointer-events: none !important;
    }
    #crit-mask-core,
    #crit-mask-fade,
    #crit-mask-shadow {
      pointer-events: none !important;
    }

    /* Full-screen impenetrable interaction blocker when bot takes over */
    #crit-interaction-blocker {
      position: fixed !important;
      inset: 0 !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483640 !important;
      pointer-events: all !important;
      cursor: wait !important;
      background: transparent !important;
      display: none;
      user-select: none !important;
      -webkit-user-select: none !important;
      touch-action: none !important;
    }
    body.crit-tour-blocking #crit-interaction-blocker,
    body.crit-tour-transitioning #crit-interaction-blocker {
      display: block !important;
      pointer-events: all !important;
    }

    /* Completely eliminate all legacy glow containers, borders, and halos */
    #crit-spotlight-container,
    #crit-spotlight-aperture {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      box-shadow: none !important;
      border: none !important;
      background: none !important;
    }

    /* Virtual Sleek Bot Pointer Cursor (Modern Vector Mouse Arrow on PC / Glowing Touch Circle on Mobile) */
    #crit-bot-cursor {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 34px !important;
      height: 34px !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      display: none;
      opacity: 0;
      margin: 0 !important;
      transform: translate3d(-100px, -100px, 0);
      will-change: transform;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.75)) drop-shadow(0 0 6px rgba(240, 165, 0, 0.65));
      transition: none;
    }
    #crit-bot-cursor.active,
    #crit-bot-cursor.visible {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 2147483647 !important;
    }
    #crit-bot-cursor,
    #crit-bot-cursor * {
      pointer-events: none !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      cursor: default !important;
    }

    /* PC Desktop Mouse Pointer Cursor (Arrow) */
    .crit-bot-pointer-svg {
      display: block;
      width: 34px;
      height: 34px;
      pointer-events: none !important;
      transform-origin: 5px 4px;
      transition: transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #crit-bot-cursor.clicking .crit-bot-pointer-svg {
      transform: scale(0.8) translate(1px, 2px);
    }

    /* Mobile Tactile Touch Circle Cursor */
    .crit-bot-mobile-circle {
      display: none;
      position: relative;
      width: 32px;
      height: 32px;
      pointer-events: none !important;
    }
    .crit-bot-touch-ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2.4px solid #f0a500;
      background: radial-gradient(circle, rgba(240, 165, 0, 0.35) 0%, rgba(240, 165, 0, 0.12) 65%, transparent 100%);
      box-shadow: 0 0 14px rgba(240, 165, 0, 0.8), inset 0 0 6px rgba(240, 165, 0, 0.45);
      transition: transform 0.14s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.14s ease;
    }
    .crit-bot-touch-core {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 8px;
      height: 8px;
      margin: -4px 0 0 -4px;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 0 8px #ffffff, 0 0 4px #f0a500;
    }
    .crit-bot-touch-ripple {
      position: absolute;
      inset: -6px;
      border-radius: 50%;
      border: 1.8px solid rgba(240, 165, 0, 0.7);
      opacity: 0;
      transform: scale(0.6);
      pointer-events: none !important;
    }
    #crit-bot-cursor.clicking .crit-bot-mobile-circle .crit-bot-touch-ring {
      transform: scale(0.76);
      background: rgba(240, 165, 0, 0.65);
    }
    #crit-bot-cursor.clicking .crit-bot-mobile-circle .crit-bot-touch-ripple {
      animation: crit-mobile-tap-wave 0.38s ease-out forwards;
    }
    @keyframes crit-mobile-tap-wave {
      0% { opacity: 0.95; transform: scale(0.7); }
      100% { opacity: 0; transform: scale(1.65); }
    }

    @media (max-width: 768px) {
      .crit-bot-pointer-svg {
        display: none !important;
      }
      .crit-bot-mobile-circle {
        display: block !important;
      }
    }
    #crit-bot-cursor.is-mobile-cursor .crit-bot-pointer-svg {
      display: none !important;
    }
    #crit-bot-cursor.is-mobile-cursor .crit-bot-mobile-circle {
      display: block !important;
    }
    #crit-bot-cursor.is-desktop-cursor .crit-bot-pointer-svg {
      display: block !important;
    }
    #crit-bot-cursor.is-desktop-cursor .crit-bot-mobile-circle {
      display: none !important;
    }
    body.crit-scrolling #crit-bot-cursor {
      transition: none !important;
    }

    /* Target Element Mouse & Keyboard Control - Pure High Contrast Spotlight Focus */
    .crit-tour-target-active {
      position: relative !important;
      z-index: 99994 !important;
      pointer-events: auto !important;
    }
    body.crit-tour-active #hero-start-btn {
      display: inline-flex !important;
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
    }
    body.crit-tour-active #hero-signup-btn {
      display: none !important;
    }
    body.crit-tour-transitioning,
    body.crit-tour-transitioning *,
    body.crit-tour-blocking,
    body.crit-tour-blocking * {
      cursor: wait !important;
      user-select: none !important;
    }
    .crit-tour-target-active input,
    .crit-tour-target-active #project-name,
    .crit-tour-target-active textarea,
    .crit-tour-target-active select,
    .crit-tour-target-active .form-input,
    input.crit-tour-target-active,
    textarea.crit-tour-target-active,
    select.crit-tour-target-active,
    .form-input.crit-tour-target-active,
    .form-textarea.crit-tour-target-active,
    .country-select.crit-tour-target-active,
    .date-input.crit-tour-target-active,
    #tnc-wrap.crit-tour-target-active,
    .upload-zone.crit-tour-target-active {
      box-shadow: none !important;
      outline: none !important;
      pointer-events: auto !important;
    }
    .crit-tour-target-active:focus,
    .crit-tour-target-active:focus-within {
      box-shadow: none !important;
      outline: none !important;
    }
    .crit-tour-target-active.type-card,
    .type-card.crit-tour-target-active {
      box-shadow: none !important;
      outline: none !important;
    }
    .crit-tour-target-active input,
    .crit-tour-target-active textarea,
    .crit-tour-target-active select,
    .crit-tour-target-active button,
    .crit-tour-target-active a,
    .crit-tour-target-active .type-card {
      pointer-events: auto !important;
      user-select: text !important;
      -webkit-user-select: text !important;
    }
    .step-container.active .type-card {
      pointer-events: auto !important;
    }
    /* Web buttons on page should be de-functioned and stayed dull during demo */
    body.crit-tour-active .form-actions button:not(.crit-tour-target-active),
    body.crit-tour-active #step-1 .btn-primary:not(.crit-tour-target-active),
    body.crit-tour-active #step-2 .btn-primary:not(.crit-tour-target-active),
    body.crit-tour-active .repo-section-wrap,
    body.crit-tour-active .repo-section-wrap * {
      pointer-events: auto !important;
    }
    body.crit-tour-active #step-3 .btn-primary:not(.crit-tour-target-active),
    body.crit-tour-active #step-4 .btn-primary:not(.crit-tour-target-active),
    body.crit-tour-active .step-container .btn-secondary:not(.crit-tour-target-active) {
      pointer-events: none !important;
      cursor: not-allowed !important;
    }
    /* Non-target buttons (like "See How It Works" on home page) must stay dull and unclickable */
    body.crit-tour-active .hero-actions a:not(.crit-tour-target-active),
    body.crit-tour-active .hero-actions button:not(.crit-tour-target-active),
    body.crit-tour-active a.btn-secondary:not(.crit-tour-target-active),
    body.crit-tour-active button.btn-secondary:not(.crit-tour-target-active),
    body.crit-tour-active a[href="#how"],
    body.crit-tour-active [href*="#how"],
    body.crit-tour-active .form-actions button:not(.crit-tour-target-active),
    body.crit-tour-active .step-container .btn-secondary:not(.crit-tour-target-active),
    body.crit-tour-active nav a:not(.crit-tour-target-active),
    body.crit-tour-active nav button:not(.crit-tour-target-active),
    body.crit-tour-active .site-cookie-notice {
      opacity: 0.22 !important;
      filter: grayscale(100%) brightness(0.55) !important;
      pointer-events: none !important;
      cursor: not-allowed !important;
      transition: opacity 0.2s ease, filter 0.2s ease !important;
    }
    /* When a button is targeted by the tour, it illuminates in its 100% normal vibrant gold color with black text */
    body.crit-tour-active .btn-primary.crit-tour-target-active,
    body.crit-tour-active .crit-tour-target-active.btn-primary,
    body.crit-tour-active #hero-start-btn.crit-tour-target-active,
    body.crit-tour-active #hero-signup-btn.crit-tour-target-active,
    body.crit-tour-active .crit-tour-target-active#hero-start-btn,
    body.crit-tour-active .crit-tour-target-active#hero-signup-btn,
    body.crit-tour-active #step-1 .btn-primary.crit-tour-target-active,
    body.crit-tour-active #step-2 .btn-primary.crit-tour-target-active,
    body.crit-tour-active #step-3 .btn-primary.crit-tour-target-active,
    body.crit-tour-active #step-4 .btn-primary.crit-tour-target-active,
    body.crit-tour-active #submit-btn.crit-tour-target-active {
      opacity: 1 !important;
      filter: none !important;
      background: #f0a500 !important;
      background-color: #f0a500 !important;
      color: #000000 !important;
      box-shadow: none !important;
      cursor: pointer !important;
      pointer-events: auto !important;
      transform: none !important;
      transition: background-color 0.15s ease, box-shadow 0.15s ease !important;
    }
    body.crit-tour-active .btn-primary.crit-tour-target-active:hover,
    body.crit-tour-active .crit-tour-target-active.btn-primary:hover,
    body.crit-tour-active #hero-start-btn.crit-tour-target-active:hover,
    body.crit-tour-active #hero-signup-btn.crit-tour-target-active:hover,
    body.crit-tour-active .crit-tour-target-active#hero-start-btn:hover,
    body.crit-tour-active .crit-tour-target-active#hero-signup-btn:hover {
      background: #ffb703 !important;
      background-color: #ffb703 !important;
      color: #000000 !important;
      transform: none !important;
      box-shadow: 0 4px 18px rgba(240, 165, 0, 0.45) !important;
      cursor: pointer !important;
    }
    .crit-btn-tactile-click {
      transform: scale(0.94) !important;
      filter: brightness(1.22) !important;
      box-shadow: 0 0 25px rgba(240, 165, 0, 0.85) !important;
      transition: transform 0.12s ease, filter 0.12s ease, box-shadow 0.12s ease !important;
    }
    .crit-tour-target-active input,
    .crit-tour-target-active textarea,
    .crit-tour-target-active select {
      pointer-events: auto !important;
      user-select: text !important;
      -webkit-user-select: text !important;
    }
    body.crit-tour-active nav,
    body.crit-tour-active nav * {
      pointer-events: none !important;
      cursor: default !important;
    }
    .crit-tour-btn-done {
      background: #f0a500;
      color: #000;
      border: none;
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: 12px;
      padding: 7px 18px;
      border-radius: 100px;
      cursor: pointer;
      transition: background 0.18s ease, box-shadow 0.18s ease;
      box-shadow: 0 4px 14px rgba(240, 165, 0, 0.35);
    }
    .crit-tour-btn-done:hover {
      background: #ffb703;
      box-shadow: 0 6px 18px rgba(240, 165, 0, 0.5);
    }

    /* High Contrast & Clean Commentary Tooltip - Bottom Center or User Dragged */
    #crit-tour-card {
      position: fixed !important;
      width: 440px !important;
      max-width: calc(100vw - 28px) !important;
      background: rgba(14, 14, 18, 0.98) !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      border: 1px solid rgba(240, 165, 0, 0.35) !important;
      border-radius: 18px !important;
      padding: 14px 18px 12px !important;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.95), 0 0 1px rgba(255, 255, 255, 0.15) !important;
      color: #f5f5f5 !important;
      font-family: 'DM Sans', sans-serif !important;
      opacity: 0;
      pointer-events: none;
      z-index: 100003 !important;
      transition: opacity 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease !important;
      touch-action: pan-x pan-y;
      isolation: isolate !important;
      contain: layout paint !important;
      cursor: default !important;
    }
    #crit-tour-card:not(.is-displaced):not(.is-dragged) {
      bottom: 24px !important;
      left: 0 !important;
      right: 0 !important;
      margin: 0 auto !important;
      transform: none !important;
    }
    #crit-tour-card.is-displaced,
    #crit-tour-card.is-dragged {
      bottom: auto !important;
      right: auto !important;
      margin: 0 !important;
      transform: none !important;
      transition: none !important;
    }
    #crit-tour-card.is-dragged {
      user-select: none !important;
      -webkit-user-select: none !important;
      cursor: grabbing !important;
    }
    .crit-tour-drag-handle {
      cursor: grab !important;
      touch-action: none !important;
    }
    #crit-tour-card.is-magnetic {
      border-color: #f0a500 !important;
      box-shadow: 0 0 32px rgba(240, 165, 0, 0.45), 0 20px 60px rgba(0, 0, 0, 0.95) !important;
    }
    #crit-tour-card.is-magnetic .crit-tour-drag-bar {
      background: #f0a500 !important;
      box-shadow: 0 0 16px rgba(240, 165, 0, 0.9) !important;
    }

        #crit-tour-card:not(.active) {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    #crit-tour-card.active {
      display: block !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      visibility: visible !important;
    }
    #crit-tour-card * {
      box-sizing: border-box !important;
    }
    #crit-tour-card .crit-tour-footer,
    #crit-tour-card .crit-tour-nav-btns {
      cursor: default !important;
      pointer-events: auto !important;
    }
    #crit-tour-card button,
    #crit-tour-card a,
    #crit-tour-card .crit-tour-btn-skip,
    #crit-tour-card .crit-tour-btn-prev,
    #crit-tour-card .crit-tour-btn-next,
    #crit-tour-card .crit-tour-btn-done {
      pointer-events: auto !important;
      cursor: pointer !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      outline: none !important;
      -webkit-font-smoothing: antialiased !important;
    }
    .crit-tour-btn-next,
    .crit-tour-btn-skip,
    .crit-tour-btn-prev {
      cursor: pointer !important;
      pointer-events: auto !important;
      user-select: none !important;
      -webkit-user-select: none !important;
    }
    .crit-tour-btn-next *,
    .crit-tour-btn-skip *,
    .crit-tour-btn-prev * {
      cursor: pointer !important;
      pointer-events: none !important;
      user-select: none !important;
      -webkit-user-select: none !important;
    }
    /* Drag indicator bar for commentary box indicating mobility */
    .crit-tour-drag-handle {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      height: 18px !important;
      margin-top: -6px !important;
      margin-bottom: 5px !important;
      cursor: grab !important;
      touch-action: none !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      position: relative !important;
      z-index: 5 !important;
      padding: 4px 0 !important;
    }
    .crit-tour-drag-handle:active,
    #crit-tour-card.is-dragged .crit-tour-drag-handle {
      cursor: grabbing !important;
    }
    .crit-tour-drag-bar {
      width: 48px !important;
      height: 4.5px !important;
      background: rgba(255, 255, 255, 0.4) !important;
      border-radius: 999px !important;
      transition: width 0.22s ease, background 0.22s ease, box-shadow 0.22s ease !important;
      pointer-events: none !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5) !important;
      animation: crit-drag-bar-cue 2.4s ease-in-out !important;
    }
    .crit-tour-drag-handle:hover .crit-tour-drag-bar,
    #crit-tour-card:hover .crit-tour-drag-bar {
      background: #f0a500 !important;
      width: 62px !important;
      box-shadow: 0 0 10px rgba(240, 165, 0, 0.7), 0 1px 4px rgba(0, 0, 0, 0.6) !important;
    }
    #crit-tour-card.is-dragged .crit-tour-drag-bar {
      background: #f0a500 !important;
      width: 68px !important;
      box-shadow: 0 0 14px rgba(240, 165, 0, 0.85) !important;
    }
    @keyframes crit-drag-bar-cue {
      0% {
        width: 64px;
        background: #f0a500;
        box-shadow: 0 0 14px rgba(240, 165, 0, 0.85);
      }
      40% {
        width: 64px;
        background: #f0a500;
        box-shadow: 0 0 10px rgba(240, 165, 0, 0.7);
      }
      100% {
        width: 48px;
        background: rgba(255, 255, 255, 0.4);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      }
    }

    .crit-tour-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 6px; gap: 6px;
    }
    .crit-tour-badge-group {
      display: flex; align-items: center; gap: 6px;
    }
    .crit-tour-avatar {
      width: 18px; height: 18px; border-radius: 50%;
      background: rgba(240, 165, 0, 0.22);
      border: 1px solid rgba(240, 165, 0, 0.5);
      color: #f0a500; display: flex; align-items: center; justify-content: center;
      font-size: 9.5px; font-family: 'Syne', sans-serif; font-weight: 800;
    }
    .crit-tour-badge-name {
      font-size: 10.5px; font-weight: 700; color: #f0a500;
      letter-spacing: 0.4px; text-transform: uppercase;
    }
    .crit-tour-step-pill {
      background: rgba(255, 255, 255, 0.08); color: #e4e4e7;
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 1px 7px; border-radius: 100px;
      font-size: 10px; font-weight: 600;
    }
    .crit-tour-close-btn {
      display: none !important;
    }
    .crit-tour-title {
      font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
      color: #ffffff; margin: 0 0 4px; line-height: 1.3;
    }
    .crit-tour-body {
      font-size: 12.5px; line-height: 1.48; color: rgba(245, 245, 245, 0.9);
      margin-bottom: 8px;
    }
    .crit-tour-body p { margin: 0 0 4px; }
    .crit-tour-body p:last-child { margin-bottom: 0; }
    .crit-tour-body strong { color: #fff; }
    .crit-tour-footer {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
      padding-top: 8px !important;
      border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
      margin-top: 6px !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .crit-tour-nav-btns {
      display: flex !important;
      gap: 6px !important;
      align-items: center !important;
      margin-left: auto !important;
      flex-shrink: 0 !important;
    }
    .crit-tour-btn-skip,
    .crit-tour-btn-prev,
    .crit-tour-btn-next {
      height: 32px !important;
      min-height: 32px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
      border-radius: 8px !important;
      font-family: 'DM Sans', sans-serif !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      white-space: nowrap !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      outline: none !important;
      transform: none !important;
    }
    .crit-tour-btn-skip {
      background: rgba(255, 255, 255, 0.08) !important;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      color: rgba(255, 255, 255, 0.85) !important;
      font-size: 11px !important;
      padding: 0 12px !important;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease !important;
    }
    .crit-tour-btn-skip:hover {
      background: rgba(239, 68, 68, 0.28) !important;
      border-color: rgba(239, 68, 68, 0.6) !important;
      color: #fca5a5 !important;
    }
    .crit-typing-cursor {
      display: inline-block;
      width: 2px;
      height: 1.05em;
      background: #f0a500;
      margin-left: 3px;
      vertical-align: -2px;
      animation: crit-cursor-blink 0.65s infinite;
      box-shadow: 0 0 8px rgba(240, 165, 0, 0.8);
    }
    @keyframes crit-cursor-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    .crit-actions-fade-in {
      animation: crit-fade-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes crit-fade-up {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .crit-tour-nav-btns {
      display: flex; gap: 8px; margin-left: auto; align-items: center;
    }
    .crit-tour-btn-prev {
      background: rgba(255, 255, 255, 0.08) !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      color: #e4e4e7 !important;
      padding: 0 12px !important;
      font-size: 11.5px !important;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease !important;
    }
    .crit-tour-btn-prev:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.22) !important;
    }
    .crit-tour-btn-prev:disabled { opacity: 0.3 !important; cursor: not-allowed !important; }
    .crit-tour-btn-next {
      background: #f0a500 !important;
      border: 1px solid #f0a500 !important;
      color: #000000 !important;
      font-family: 'Syne', sans-serif !important;
      font-weight: 700 !important;
      padding: 0 16px !important;
      font-size: 12px !important;
      letter-spacing: 0.2px !important;
      box-shadow: 0 2px 8px rgba(240, 165, 0, 0.3) !important;
      transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease !important;
    }
    .crit-tour-btn-next:hover {
      background: #ffb703 !important;
      border-color: #ffb703 !important;
      box-shadow: 0 4px 14px rgba(240, 165, 0, 0.5) !important;
      cursor: pointer !important;
      transform: none !important;
    }
    .crit-tour-btn-next:active {
      transform: scale(0.97) !important;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4) !important;
    }
    .crit-tour-btn-next.crit-btn-clicked {
      pointer-events: none !important;
      opacity: 0.8 !important;
      transform: scale(0.96) !important;
    }
    .crit-tour-btn-action {
      background: #22c55e; color: #000;
      font-family: 'Syne', sans-serif; font-weight: 800;
      padding: 4px 10px; border-radius: 6px; font-size: 11px;
      border: none; cursor: pointer; text-decoration: none;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .crit-tour-btn-action:hover { background: #4ade80; }

    #crit-tour-dock {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    .crit-tour-prompt-wrap {
      margin-top: 8px; padding: 10px 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .crit-tour-prompt-label {
      font-size: 11.5px; color: rgba(240, 240, 248, 0.9); display: flex; align-items: center; gap: 6px; font-weight: 500;
    }
    .crit-tour-sparkle { color: #f0a500; font-size: 12px; }
    .crit-tour-action-btn {
      background: rgba(240, 165, 0, 0.12);
      border: 1px solid rgba(240, 165, 0, 0.22);
      border-radius: 9px;
      padding: 7px 12px; color: #f0a500;
      font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 12px;
      cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px;
      transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      box-shadow: none;
    }
    .crit-tour-action-btn:hover {
      background: rgba(240, 165, 0, 0.22);
      border-color: rgba(240, 165, 0, 0.38);
      color: #fff;
    }
    .crit-tour-btn-icon { font-size: 13px; }
    .crit-tour-btn-text { flex: 1; text-align: left; }
    .crit-tour-btn-arrow { font-weight: 700; transition: transform 0.15s; }
    .crit-tour-action-btn:hover .crit-tour-btn-arrow { transform: translateX(2px); }
  
  `;

  /* Quick reply presets removed as per user request */
  const QUICK_REPLIES = [];

  /* ============================================================
     LOCAL Q&A DATABASE
  ============================================================ */
  const QA = [
    {
      "keywords": [
        "take me to view the complete website",
        "view the complete website",
        "take me to view the website",
        "take me on a tour",
        "show me the website",
        "show me around",
        "guided tour",
        "website tour",
        "walk me through",
        "give me a tour",
        "tour the website"
      ],
      "answer": "I'd love to! 🧭\n\nI can take full control of the website and walk you through every section in real time—dimming the lights, spotlighting each area, and explaining what everything does step-by-step.\n\n[TOUR:full-website]"
    },
    {
      "keywords": [
        "show me how",
        "show me",
        "yes show me",
        "start tour",
        "show how",
        "start the tour",
        "yes please",
        "guide me"
      ],
      "answer": "Starting your interactive walkthrough right now! Sit back while I dim the lights and guide you through the website. 🚀\n\n[TOUR:start-project]"
    },
    {
      "keywords": [
        "hi",
        "hello",
        "hey",
        "hiya",
        "howdy",
        "sup",
        "what's up",
        "whats up",
        "good morning",
        "good evening",
        "good afternoon",
        "greetings",
        "yo",
        "helo",
        "hii",
        "heya",
        "wassup",
        "wazzup"
      ],
      "answer": "👋 Hey there! I'm **CRIT**, the intelligent assistant for CRITERIA studio.\n\nI know everything about the website, our 6 creative services, pricing, preview-first model, and our in-browser design suite **CRITSPACE**! What's on your mind?"
    },
    {
      "keywords": [
        "how are you",
        "how r u",
        "you okay",
        "you good",
        "hows it going",
        "how's it going",
        "how are u",
        "u okay",
        "you alright",
        "how ya doing"
      ],
      "answer": "Doing great, thanks for asking! 😊 Ready to help you explore our design studio, tools, or get your next project off the ground.\n\nGot a project in mind, or want to check out CRITSPACE?"
    },
    {
      "keywords": [
        "thanks",
        "thank you",
        "thank u",
        "thx",
        "ty",
        "appreciate",
        "thnks",
        "thankyou",
        "thankx",
        "thnx",
        "tysm",
        "ty so much"
      ],
      "answer": "You're very welcome! 🙌 Feel free to ask anything anytime. Ready to create some work worth keeping whenever you are!"
    },
    {
      "keywords": [
        "bye",
        "goodbye",
        "see you",
        "later",
        "cya",
        "take care",
        "ttyl",
        "see ya",
        "adios"
      ],
      "answer": "Take care! 👋 Visit anytime to check on your projects, try out CRITSPACE, or start a new brief. Have a great day!"
    },
    {
      "keywords": [
        "ok",
        "okay",
        "alright",
        "got it",
        "sure",
        "cool",
        "nice",
        "gotcha",
        "understood"
      ],
      "answer": "Awesome! 😊 Let me know if you want to explore any website tools, ask about pricing, or submit a design brief."
    },
    {
      "keywords": [
        "who are you",
        "what are you",
        "you a bot",
        "are you ai",
        "are you a robot",
        "are you human",
        "are you real",
        "chatbot",
        "bot"
      ],
      "answer": "I'm **CRIT** 🤖 — CRITERIA's official AI assistant!\n\nI know every section, tool, and feature of this website inside out — from our 6 core design services and preview-first workflow to all the tools, modes, and shortcut keys in **CRITSPACE**. How can I help you today?"
    },
    {
      "keywords": [
        "your name",
        "what's your name",
        "whats your name",
        "what do i call you"
      ],
      "answer": "I'm **CRIT** — named after CRITERIA! 🎨\n\nYour guide to our creative studio and tools. What can I help you find or create today?"
    },
    {
      "keywords": [
        "what can you do",
        "what can you answer",
        "what do you know",
        "capabilities",
        "what can you help with",
        "studio capabilities"
      ],
      "answer": "I know everything about CRITERIA and this website! Here's a taste of what I can help you with:\n\n✨ **Design Services & Pricing** (Graphics, Logos, Thumbnails, Websites, Video, UI)\n👁 **Preview-First Model** (See watermarked work before paying a single rupee)\n🛠 **CRITSPACE Tool Suite** (Modes, toolbar shortcuts, 3D Lookup, device toggles)\n📑 **Website Pages & Sections** (Hero, Services, Sandbox, Submit wizard, Dashboard, Profile, Settings)\n⚖️ **Policies & Rights** (2 free revisions, 100% IP ownership handover, no hidden fees)\n\nAsk me anything!"
    },
    {
      "keywords": [
        "critspace",
        "what is critspace",
        "about critspace",
        "crit space",
        "open workspace",
        "workspace app",
        "design tool"
      ],
      "answer": "**CRITSPACE** (/critspace) is CRITERIA's powerful in-browser creative suite and interactive open design workspace! 🚀\n\n**3 Specialized Modes**:\n🎨 **UI / Picture Editing** — Design flyers, posters, logos, vector art; includes a 3D Lookup space mode.\n🌐 **Web Modeling** — Build responsive mock websites, link pages dynamically, preview across devices (Laptop/Tablet/Mobile), and run keyframe animation prototypes.\n🎬 **Video Editing** *(Coming Soon)* — Full video keyframing, timeline tracks, and motion graphic workflows.\n\n**Top Features**:\n• 9 left-toolbar design tools with quick keyboard shortcuts\n• Device View Toggles (Laptop, Tablet, Mobile)\n• Interactive 3D Lookup Mode (Three.js powered)\n• Live Preview Mode (Start/Exit)\n• Multi-format Export (PNG, JPG, multi-page vector PDF via jsPDF)\n• Layers & Properties inspector panels + Brochure fold guidelines"
    },
    {
      "keywords": [
        "critspace modes",
        "workspace modes",
        "modes in critspace",
        "ui picture editing",
        "web modeling",
        "video editing mode"
      ],
      "answer": "CRITSPACE has **3 specialized workspace modes**:\n\n1. 🎨 **UI / Picture Editing**: Built for vector design, posters, logos, social graphics, and flyers. Comes with an interactive 3D Lookup mode.\n2. 🌐 **Web Modeling**: Built for responsive mock web design. Lets you toggle between Laptop, Tablet, and Mobile views, link multi-page mockups, and simulate keyframe prototypes.\n3. 🎬 **Video Editing** *(Coming Soon)*: Designed for timeline tracks, motion graphics, and video keyframe workflows."
    },
    {
      "keywords": [
        "critspace tools",
        "tools in critspace",
        "tools are in critspace",
        "critspace tool list",
        "what tools",
        "sidebar tools",
        "toolbar tools",
        "all tools",
        "list of tools"
      ],
      "answer": "Here are all **9 tools on the CRITSPACE left toolbar**:\n\n1. ↖️ **Select (`V`)** — Select, move, scale, rotate, and transform canvas objects.\n2. 📐 **Paper Size / Resize (`S`)** — Adjust canvas dimensions and select preset sizes (Instagram, YouTube, A4, Poster, Devices).\n3. 🎨 **Background (`O`)** — Choose solid colors, linear/radial gradients, and custom themes.\n4. 🔷 **Shapes (`P`)** — Add rectangles, circles, triangles, stars, polygons, and flowcharts.\n5. 🔤 **Text (`T`)** — Drag and draw custom typography frames with font, weight, and spacing controls.\n6. ✏️ **AI Pen (`N`)** — Draw smooth freehand curves, strokes, and lines.\n7. 🪣 **Paint Bucket (`K`)** — Fill closed shapes with solid colors, gradients, or pattern styles.\n8. 📋 **Templates (`L`)** — Load pre-designed, ready-to-edit creative layouts.\n9. 📤 **Upload (`U`)** — Upload or drag images directly onto your workspace."
    },
    {
      "keywords": [
        "critspace shortcuts",
        "shortcuts",
        "keyboard shortcuts",
        "hotkeys",
        "keybinds",
        "shortcut keys",
        "keys in critspace"
      ],
      "answer": "Here is the complete **CRITSPACE Keyboard Shortcut Reference**:\n\n• `V` — **Select Tool** (move, rotate, scale)\n• `S` — **Paper Size / Resize** (canvas dimensions & presets)\n• `O` — **Background** (colors, gradients, themes)\n• `P` — **Shapes** (rectangles, circles, stars, polygons)\n• `T` — **Text Tool** (custom text frames & fonts)\n• `N` — **AI Pen** (freehand drawing & smooth curves)\n• `K` — **Paint Bucket** (fills & pattern styling)\n• `L` — **Templates** (layout templates)\n• `U` — **Upload** (import images onto canvas)\n\n💡 *Tip: Toggle **Fullscreen** in the top navbar to unlock all shortcuts without browser hotkey conflicts!*"
    },
    {
      "keywords": [
        "select tool",
        "shortcut v",
        "press v",
        "move object",
        "transform tool"
      ],
      "answer": "The **Select Tool (`V`)** in CRITSPACE is your primary pointer. Use it to click, drag, rotate, scale, and transform any object or layer on the canvas."
    },
    {
      "keywords": [
        "paper size",
        "resize tool",
        "shortcut s",
        "press s",
        "s key",
        "key s",
        "what does shortcut s do",
        "canvas size",
        "canvas dimensions"
      ],
      "answer": "The **Paper Size / Resize Tool (`S`)** in CRITSPACE allows you to resize the canvas freely or pick one-click presets like Instagram Post, YouTube Thumbnail, A4, Poster, Laptop (1440x900), Tablet (768x1024), and Mobile (375x812)."
    },
    {
      "keywords": [
        "background tool",
        "shortcut o",
        "press o",
        "change background",
        "gradient background",
        "canvas background"
      ],
      "answer": "The **Background Tool (`O`)** in CRITSPACE opens the canvas background panel where you can choose solid hex colors, smooth linear gradients, radial gradients, or custom studio themes."
    },
    {
      "keywords": [
        "shapes tool",
        "shortcut p",
        "press p",
        "add shape",
        "rectangle",
        "star shape",
        "circle shape",
        "polygon"
      ],
      "answer": "The **Shapes Tool (`P`)** in CRITSPACE lets you insert clean vector elements including rectangles, circles/ellipses, triangles, stars, polygons, and flowchart elements."
    },
    {
      "keywords": [
        "text tool",
        "shortcut t",
        "press t",
        "add text",
        "typography",
        "fonts in critspace"
      ],
      "answer": "The **Text Tool (`T`)** in CRITSPACE allows you to drag and draw text frames, customize font family (Syne, Inter, DM Sans, etc.), adjust font size, weight, line-height, alignment, and letter spacing."
    },
    {
      "keywords": [
        "ai pen",
        "pen tool",
        "shortcut n",
        "press n",
        "draw tool",
        "freehand drawing"
      ],
      "answer": "The **AI Pen Tool (`N`)** in CRITSPACE is a smart freehand drawing tool that automatically smoothens your mouse/stylus strokes into crisp, elegant vector curves."
    },
    {
      "keywords": [
        "paint bucket",
        "shortcut k",
        "press k",
        "fill color",
        "bucket tool"
      ],
      "answer": "The **Paint Bucket Tool (`K`)** in CRITSPACE quickly fills closed paths and shapes with your chosen solid colors, gradient blends, or patterned textures."
    },
    {
      "keywords": [
        "templates tool",
        "template tool",
        "shortcut l",
        "press l",
        "load template"
      ],
      "answer": "The **Templates Tool (`L`)** in CRITSPACE opens a library of ready-to-use, professionally crafted design layouts for quick turnaround on posters, social posts, and UI mockups."
    },
    {
      "keywords": [
        "upload tool",
        "shortcut u",
        "press u",
        "upload image",
        "add picture to canvas"
      ],
      "answer": "The **Upload Tool (`U`)** in CRITSPACE allows you to import external image assets (PNG, JPG, SVG) into your project by choosing a file or dragging it directly onto the canvas."
    },
    {
      "keywords": [
        "3d lookup",
        "lookup mode",
        "3d mode",
        "threejs",
        "3d space",
        "orbit"
      ],
      "answer": "CRITSPACE's **3D Lookup Mode** (button in top navbar) activates an interactive Three.js 3D space scene with smooth camera rotation and orbit controls, offering a futuristic 3D perspective of your creative space!"
    },
    {
      "keywords": [
        "device toggles",
        "laptop view",
        "tablet view",
        "mobile view",
        "responsive preview",
        "navbar device"
      ],
      "answer": "In CRITSPACE's top navbar, **Device View Toggles** let you switch canvas viewports with a single click:\n\n💻 **Laptop** — Standard desktop viewport (1440px)\n📟 **Tablet** — Tablet viewport (768px)\n📱 **Mobile** — Smartphone viewport (375px)\n\nEssential for testing responsive mockups in Web Modeling mode!"
    },
    {
      "keywords": [
        "live preview",
        "start preview",
        "exit preview",
        "critspace preview",
        "test design"
      ],
      "answer": "CRITSPACE includes a **Live Preview** toggle! Click **START Preview** in the top navbar to hide editing guides and experience your layout cleanly in real time. Click **Exit Preview** in the top-right corner to return to editing mode."
    },
    {
      "keywords": [
        "download critspace",
        "export critspace",
        "export formats",
        "download png",
        "download jpg",
        "download pdf"
      ],
      "answer": "You can download your finished design from CRITSPACE in 3 formats:\n\n🖼 **Download PNG** — High-res raster image with transparency\n📸 **Download JPG** — Compressed image ideal for web/social sharing\n📑 **Download PDF** — High-resolution multi-page vector PDF (via jsPDF)\n\nJust click **Download** in the top-right navbar!"
    },
    {
      "keywords": [
        "layers",
        "layers panel",
        "layers list",
        "reorder layers",
        "hide layer",
        "lock layer"
      ],
      "answer": "The **Layers Panel** (bottom of right sidebar) displays every element on your canvas. You can reorder object stacking (front/back), lock layers to prevent accidental edits, and toggle visibility on or off."
    },
    {
      "keywords": [
        "properties panel",
        "properties",
        "object inspector",
        "stroke",
        "fill",
        "opacity",
        "shadow",
        "radius"
      ],
      "answer": "The **Properties Panel** (top of right sidebar) gives fine-grained control over any selected object: fill color, stroke color & width, opacity slider, drop shadows, rounded corner radius, alignment, and horizontal/vertical flipping."
    },
    {
      "keywords": [
        "brochure guides",
        "brochure overlay",
        "fold guides",
        "print guides"
      ],
      "answer": "CRITSPACE features **Brochure Guidelines**! When working on tri-fold or bi-fold print collateral, toggling brochure guides displays accurate folding division lines across the canvas."
    },
    {
      "keywords": [
        "fullscreen",
        "full screen",
        "critspace fullscreen"
      ],
      "answer": "Clicking **⛶ Full Screen** in CRITSPACE expands your canvas to fill the entire monitor, providing a distraction-free design workspace and unlocking all keyboard shortcuts without browser hotkey conflicts."
    },
    {
      "keywords": [
        "sections",
        "website sections",
        "sections of the website",
        "sections on the website",
        "parts of website",
        "pages",
        "what pages",
        "pages of the website",
        "site map",
        "navigation",
        "website parts"
      ],
      "answer": "Here is a complete map of all sections and pages on the CRITERIA website:\n\n🏠 **Homepage (`/`)**:\n• **#hero** — Studio banner, tagline *\"We create work worth keeping\"*, and quick CTAs\n• **#services** — 6 core offerings with prices and turnaround\n• **#how** — 4-step preview-first workflow\n• **#trust** — 100% IP rights, no hidden fees, portfolio privacy\n• **#sandbox** — Interactive live preview simulator\n• **#faq** — Instant answers to common questions\n\n🛠 **CRITSPACE (`/critspace`)** — In-browser creative suite (UI editing, Web modeling, 3D lookup, 9 tools)\n📝 **Submit a Project (`/submit`)** — Guided 5-step project submission wizard\n📊 **Client Dashboard (`/dashboard`)** — Project stats, live watermarked preview cards, and Cloudinary deliverable downloads\n👤 **Profile Settings (`/profile`)** — Avatar, name, bio, DOB, gender, email verification, and phone\n⚙️ **Preferences (`/settings`)** — Dark/Light themes, custom accent color picker, language, timezone, and portfolio privacy\n🍪 **Cookie Preferences** — Manage essential, functional, and analytics privacy options.\n*(Note: Administrative, agent, and security systems are strictly private and confidential.)*"
    },
    {
      "keywords": [
        "hero section",
        "hero banner",
        "hero",
        "work worth keeping",
        "tagline"
      ],
      "answer": "The **Hero Section (`#hero`)** at the top of the homepage highlights our studio philosophy:\n\n✨ Tagline: **\"We Create Work Worth Keeping.\"**\n💡 Introduces our **preview-first model** — you see the watermarked design before paying a single rupee.\n🔘 Action buttons: **\"Start a Project\"** (takes you to /submit) and **\"Explore Services\"** (jumps to #services)."
    },
    {
      "keywords": [
        "sandbox",
        "sandbox demo",
        "about the sandbox",
        "about sandbox",
        "interactive demo",
        "preview demo",
        "simulator",
        "sunder"
      ],
      "answer": "The **Sandbox Section (`#sandbox`)** on the homepage is an interactive preview demo! 🕹️\n\nIt simulates the exact client experience of reviewing a watermarked design, testing live controls, and approving work (*\"Preview Approved!\"*) so you can experience our risk-free model before submitting a brief."
    },
    {
      "keywords": [
        "trust section",
        "trust",
        "guarantees",
        "no hidden fees",
        "ownership"
      ],
      "answer": "The **Trust Section (`#trust`)** outlines our client guarantees:\n\n✅ **Zero Blind Payments** — You always see a preview first.\n✅ **100% Full IP Ownership** — Complete copyright handover upon payment.\n✅ **Zero Hidden Fees** — What we quote is what you pay.\n✅ **Portfolio Opt-Out** — You can choose whether we feature your completed project publicly or keep it 100% confidential."
    },
    {
      "keywords": [
        "start a project",
        "how to start",
        "how do i start a project",
        "how to submit",
        "submit page",
        "submission form",
        "begin project",
        "new project",
        "5 steps",
        "submit project"
      ],
      "answer": "To start a project with CRITERIA, head to our 5-step wizard at `/submit` (service category, scope, budget, and deadline). You pay zero upfront until you review and approve your watermarked preview!\n\n[TOUR:interactive-build]"
    },
    {
      "keywords": [
        "dashboard",
        "client dashboard",
        "my dashboard",
        "previews section",
        "deliverables",
        "active projects"
      ],
      "answer": "The **Client Dashboard (`/dashboard`)** is your project control center:\n\n📈 **Overview Stats** — Briefs submitted, active projects, completed works, and total spent.\n👁 **Live Previews Section (`#previews-section`)** — Review incoming watermarked drafts; approve with one click or submit revision requests with feedback notes.\n📦 **Secure Deliverables Download** — Unlocked clean files hosted on Cloudinary with automated expiry countdown.\n🔔 **Notification Center** — Real-time alerts for project progress and preview readiness."
    },
    {
      "keywords": [
        "profile page",
        "profile settings",
        "avatar upload",
        "edit profile",
        "my profile"
      ],
      "answer": "The **Profile page (`/profile`)** lets you manage your account identity:\n\n• Upload a custom profile picture (or display auto-generated initials)\n• Update First Name, Last Name, Display Name, and Bio\n• Set Date of Birth and Gender\n• Check email verification badge (with resend link)\n• Save your phone number with country dialing code"
    },
    {
      "keywords": [
        "settings page",
        "preferences",
        "custom accent",
        "change theme",
        "accent color",
        "dark mode",
        "light mode",
        "accessibility"
      ],
      "answer": "On the **Preferences & Settings page (`/settings`)**, you can customize:\n\n🎨 **Appearance** — Switch between **Dark Mode** and **Light Mode**, and pick a custom **Accent Color** that dynamically styles borders, buttons, and glow effects across the entire site.\n🌍 **Localization** — Set your preferred language, timezone, and date format.\n🔔 **Notifications** — Toggle email/push alerts for project status, preview readiness, delivery, and promos.\n🛡 **Privacy** — Opt-in or opt-out of featuring your work in CRITERIA's public portfolio.\n♿ **Accessibility** — Enable reduced motion, high contrast mode, and adjustable base font sizing."
    },
    {
      "keywords": [
        "admin",
        "admin portal",
        "admin studio",
        "admin page",
        "admin login",
        "agent",
        "agent portal",
        "agent page",
        "designer portal",
        "internal portal",
        "agent login",
        "security secrets",
        "internal secrets",
        "api key",
        "api keys",
        "secret",
        "secrets",
        "credentials",
        "backend secrets"
      ],
      "answer": "Administrative, agent, and security systems are strictly internal and confidential to CRITERIA studio. 🔒\n\nI can only assist with public studio services, website features, project briefs, and our design suite **CRITSPACE**! How can I help you with your creative work today?"
    },
    {
      "keywords": [
        "cookies",
        "cookie banner",
        "cookie policy",
        "cookie preferences",
        "tracking",
        "privacy cookies",
        "sitecookies"
      ],
      "answer": "CRITERIA respects your privacy! 🍪\n\nOur cookie banner (powered by `siteCookies.js`) lets you customize preferences:\n• **Essential Cookies** — Always active for secure sessions, authentication, and core functionality.\n• **Functional Cookies** — Saves your custom theme, accent color, and site settings.\n• **Analytics Cookies** — Anonymous performance insights to help us optimize your experience."
    },
    {
      "keywords": [
        "theme accent",
        "accent color",
        "custom color",
        "change accent",
        "themeaccent",
        "gold accent",
        "color picker"
      ],
      "answer": "CRITERIA lets you personalize the website's look via **Settings** (/settings) or the header color picker! 🎨\n\nPowered by `themeAccent.js`, you can choose presets (Gold, Electric Blue, Emerald, Purple, Rose, Cyan) or input any **custom hex color**. The entire site dynamically recalculates glowing borders, buttons, and ambient lighting in real time!"
    },
    {
      "keywords": [
        "what is criteria",
        "about criteria",
        "about studio",
        "tell me about criteria",
        "tell me about studio",
        "who are you",
        "what do you do",
        "what is this",
        "about you",
        "your company"
      ],
      "answer": "**CRITERIA** is a premium creative studio based in India 🇮🇳 serving clients worldwide.\n\nOur tagline says it all — *\"We create work worth keeping.\"*\n\nWe design graphics, logos, websites, videos, and UI presentations. Our superpower is our **preview-first model** — you review a watermarked preview of your project *before* paying a single rupee. No risk, no blind orders."
    },
    {
      "keywords": [
        "preview",
        "watermark",
        "watermarked",
        "see before",
        "before paying",
        "how does preview",
        "demo",
        "sample"
      ],
      "answer": "The **CRITERIA Preview-First Model** has 4 simple steps:\n\n1️⃣ **Submit Brief** via the website (/submit)\n2️⃣ **Free Preview** — We build your design and send a watermarked preview for FREE (24-48 hrs for graphics, 3-5 days for web/video)\n3️⃣ **Review & Revise** — Request changes with **up to 2 free revisions** included\n4️⃣ **Approve & Pay** — Once you're 100% happy, pay and instantly download your clean, unwatermarked final files!\n\nYou never pay for creative work you haven't seen and loved. 🙌"
    },
    {
      "keywords": [
        "revision",
        "revisions",
        "changes",
        "edit request",
        "modify",
        "update work",
        "redo",
        "2 free revisions"
      ],
      "answer": "You get **up to 2 free revisions** on your preview before paying! 🔄\n\nIf you want tweaks, color adjustments, or layout changes, submit your feedback via your Dashboard and our designers will revise the preview free of charge."
    },
    {
      "keywords": [
        "service",
        "services",
        "offer",
        "what can you make",
        "what do you make",
        "what can you do",
        "what you offer",
        "list of services"
      ],
      "answer": "Here is CRITERIA's complete service lineup:\n\n🎨 **Poster & Graphics** — ₹80 to ₹500 (Turnaround 24–48h)\n🔤 **Logo & Branding** — ₹100 to ₹2,500 (Turnaround 24–48h)\n🖼 **Thumbnails** — ₹80 to ₹500 (Turnaround 24–48h)\n🌐 **Websites** — ₹5,000 to ₹20,000 (Turnaround 3–7 days)\n🎬 **Video Editing** — ₹200 to ₹3,000 (Turnaround 1–3 days)\n📱 **UI / Presentations** — ₹200 to ₹2,500 (Turnaround 1–3 days)\n\nAll services include a free watermarked preview before payment! Want details on any specific one?"
    },
    {
      "keywords": [
        "poster",
        "graphic",
        "social post",
        "event poster",
        "flyer",
        "banner",
        "brand creative"
      ],
      "answer": "**Poster & Graphics** — ₹80 to ₹500 🎨\n\nCovers social media posts, event flyers, promotional banners, and marketing creatives.\n\n✅ Watermarked preview first\n✅ 24–48 hour turnaround\n✅ 2 free revisions before payment"
    },
    {
      "keywords": [
        "logo",
        "branding",
        "brand",
        "identity",
        "wordmark",
        "icon",
        "brand kit"
      ],
      "answer": "**Logo & Branding** — ₹100 to ₹2,500 🔤\n\nFull brand identity systems, wordmarks, icons, and color palettes.\n\n✅ Concept preview before paying\n✅ 2 free revisions included\n✅ 100% copyright ownership transferred upon payment"
    },
    {
      "keywords": [
        "thumbnail",
        "youtube thumbnail",
        "podcast cover",
        "content artwork",
        "yt thumbnail"
      ],
      "answer": "**Thumbnails** — ₹80 to ₹500 🖼\n\nHigh-CTR YouTube thumbnails, podcast covers, and content artwork designed to stand out in feeds.\n\n✅ Watermarked preview first\n✅ 24–48 hour turnaround"
    },
    {
      "keywords": [
        "website",
        "web",
        "landing page",
        "portfolio site",
        "business site",
        "webpage",
        "web design"
      ],
      "answer": "**Websites** — ₹5,000 to ₹20,000 🌐\n\nCustom landing pages, portfolio websites, and small business sites.\n\n✅ Live interactive preview link before paying\n✅ 3–7 day turnaround\n✅ Fully responsive across desktop, tablet, and mobile"
    },
    {
      "keywords": [
        "video",
        "video editing",
        "reel",
        "reels",
        "youtube video",
        "short form",
        "short video"
      ],
      "answer": "**Video Editing** — ₹200 to ₹3,000 🎬\n\nReels, YouTube shorts, long-form videos, and promo clips.\n\n✅ Watermarked preview video first so you can inspect cuts and pacing before paying\n✅ 1–3 day turnaround"
    },
    {
      "keywords": [
        "ui",
        "presentation",
        "mockup",
        "pitch deck",
        "slide",
        "app design",
        "figma"
      ],
      "answer": "**UI / Presentations** — ₹200 to ₹2,500 📱\n\nApp mockups, pitch decks, and Figma presentation slides.\n\n✅ Live preview before paying\n✅ Clean, modern typography and layouts\n✅ 1–3 day turnaround"
    },
    {
      "keywords": [
        "price",
        "pricing",
        "cost",
        "how much",
        "what are your prices",
        "your prices",
        "rates",
        "rupee",
        "inr",
        "charges",
        "fee",
        "pricing overview"
      ],
      "answer": "Here is our complete pricing overview (in ₹):\n\n🎨 Posters & Graphics — ₹80–₹500\n🔤 Logo & Branding — ₹100–₹2,500\n🖼 Thumbnails — ₹80–₹500\n🌐 Websites — ₹5,000–₹20,000\n🎬 Video Editing — ₹200–₹3,000\n📱 UI / Presentations — ₹200–₹2,500\n\nAll prices depend on complexity, and **you only pay after you've reviewed and approved your preview.**"
    },
    {
      "keywords": [
        "payment",
        "pay",
        "how to pay",
        "payment method",
        "upi",
        "razorpay",
        "bank transfer",
        "card"
      ],
      "answer": "We support multiple secure payment channels:\n\n💸 **UPI** (GPay, PhonePe, Paytm)\n💳 **Razorpay**\n🏦 **Bank Transfer (NEFT/IMPS)**\n🌍 **International Cards** (Visa, Mastercard for global clients)\n\nRemember: You **never pay upfront** — only after approving your watermarked preview!"
    },
    {
      "keywords": [
        "refund",
        "money back",
        "return",
        "cancellation"
      ],
      "answer": "Because CRITERIA uses a **preview-first model**, you see and approve the work *before* paying a single rupee. Once approved and final unwatermarked files are delivered, we do not offer refunds because you have already confirmed satisfaction."
    },
    {
      "keywords": [
        "rights",
        "ownership",
        "copyright",
        "my work",
        "intellectual property",
        "license"
      ],
      "answer": "Upon payment, **you own 100% full intellectual property and commercial copyright ownership** to your deliverables. ✅\n\nYou can use them however and wherever you want. We may feature work in our portfolio, but you can opt out anytime in your Settings."
    },
    {
      "keywords": [
        "formats",
        "file formats",
        "files delivered",
        "deliverable formats",
        "png",
        "svg",
        "pdf",
        "mp4"
      ],
      "answer": "Deliverables are supplied in industry-standard formats:\n\n🎨 **Graphics & Logos**: High-res PNG, vector SVG, print-ready PDF\n🎬 **Videos**: MP4 in 1080p or 4K\n🌐 **Websites**: Clean HTML/CSS/JS source code or deployed live links\n📱 **UI & Decks**: Figma files, PDF, PPTX"
    },
    {
      "keywords": [
        "contact",
        "email",
        "reach",
        "support",
        "help",
        "talk to human"
      ],
      "answer": "Need to reach the studio team directly?\n\n📧 **mhpk2010@gmail.com** or **help.criteria@gmail.com**\n\nFor new briefs, the fastest way is using the **Submit a Project** wizard on the site!"
    },
    {
      "keywords": [
        "capital of france",
        "capital france",
        "paris"
      ],
      "answer": "The capital of France is **Paris**! 🗼\n\n...Anyway, enough about geography! Let's kick off that subject and get back to your creative projects. Are you looking to design a website, logo, poster, or try out CRITSPACE today?"
    },
    {
      "keywords": [
        "capital of",
        "capital city",
        "geography question"
      ],
      "answer": "Paris is the capital of France, Tokyo is the capital of Japan, Washington D.C. is the capital of the USA, and New Delhi is the capital of India! 🌍\n\n...Anyway, let's kick off that subject and get back to your design work! How can CRITERIA help bring your brand or web ideas to life today?"
    },
    {
      "keywords": [
        "tell me a joke",
        "say something funny",
        "make me laugh",
        "joke"
      ],
      "answer": "Why do graphic designers love coffee? Because it helps them stay focused on kerning! ☕😄\n\n...Anyway, let's kick off the jokes and channel that energy into a killer creative project! Want to start a design brief or explore CRITSPACE?"
    },
    {
      "keywords": [
        "weather",
        "temperature",
        "forecast",
        "is it raining"
      ],
      "answer": "I can't check your local weather from inside the studio server, but it's always clear skies for creating great work! ☀️\n\n...That said, let's kick off the forecast and get back to business! Are you looking to start a new design project or try out CRITSPACE today?"
    },
    {
      "keywords": [
        "albert einstein",
        "einstein",
        "theory of relativity"
      ],
      "answer": "Albert Einstein was the legendary physicist who formulated the theory of relativity (E=mc²), permanently changing our understanding of space and time! 🌌\n\n...Anyway, enough about physics! Let's kick off that subject and get back to your creative ideas. Are you looking to design a website, branding, or try our tools in CRITSPACE?"
    },
    {
      "keywords": [
        "math",
        "calculate",
        "solve equation",
        "what is 2+2",
        "2+2",
        "square root"
      ],
      "answer": "Math is clean and precise — just like our responsive design grids! (And 2 + 2 = 4 😉) 📐\n\n...Anyway, let's kick off the arithmetic and focus on your design goals! What can CRITERIA build for you today?"
    },
    {
      "keywords": [
        "recipe",
        "how to cook",
        "how to make pasta",
        "cooking",
        "pasta"
      ],
      "answer": "A great pasta dish needs quality ingredients, good timing, and great presentation — just like a great website or brand identity! 🍝\n\n...That said, let's kick off the kitchen and get back to your design work! Are you looking for a new website, logo, or graphics?"
    },
    {
      "keywords": [
        "python",
        "javascript code",
        "binary search",
        "algorithm",
        "programming",
        "write code"
      ],
      "answer": "Clean code powers the web! In fact, all our custom websites are engineered with semantic, mobile-responsive HTML, CSS, and modern JavaScript. 💻\n\n...That said, let's kick off that subject and talk about what we can build for you. Looking for a custom landing page or website mockup?"
    },
    {
      "keywords": [
        "photosynthesis",
        "what is photosynthesis",
        "how do plants make food"
      ],
      "answer": "**Photosynthesis** is the process where green plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of glucose! 🌿☀️\n\n...Anyway, let's kick off that subject and get back to your creative work! Are you looking to design a website, logo, poster, or try out CRITSPACE today?"
    },
    {
      "keywords": [
        "world cup",
        "football",
        "messi",
        "ronaldo",
        "fifa",
        "cricket",
        "sports"
      ],
      "answer": "Argentina won the 2022 FIFA World Cup led by Lionel Messi in an unforgettable final! ⚽🏆 Sports unite the world with incredible energy and passion.\n\n...Anyway, let's kick off that subject and channel that champion energy into your design projects! What can CRITERIA create for you today?"
    },
    {
      "keywords": [
        "solar system",
        "planets",
        "space",
        "mars",
        "moon"
      ],
      "answer": "Our solar system has 8 planets orbiting the Sun, from Mercury to Neptune! 🪐✨ If you love cosmic visuals, check out CRITSPACE's **3D Lookup Mode** which projects an interactive 3D planetary space scene!\n\n...Anyway, let's kick off that subject and focus on your designs! Ready to explore CRITSPACE or start a design brief?"
    },
    {
      "keywords": [
        "movie",
        "movies",
        "cinema",
        "film",
        "favorite movie"
      ],
      "answer": "Cinema is storytelling in motion — captivating visuals, sound design, and color grading make magic on screen! 🎬🍿 In fact, our **Video Editing service** crafts cinematic Reels, Shorts, and promo videos.\n\n...That said, let's kick off that subject and get back to what we can make! Are you looking for video editing, graphics, or web design?"
    },
  ];

  /* ============================================================
     PAGE & SECTION AWARENESS ENGINE
  ============================================================ */
  function getCurrentPageContext() {
    const rawPath = (window.location.pathname || '').toLowerCase();
    const path = rawPath.replace(/\/index\.html$/, '/');

    if (path.includes('profile')) {
      return {
        page: 'profile',
        title: 'Profile Settings',
        description: 'Your CRITERIA Profile page is where you manage your creator identity, personal avatar picture, display name, bio, phone number, and account credentials.',
        howToAddOrEdit: 'To add or update your profile:\n1. Click your profile avatar circle at the top to upload a new profile photo (JPG, PNG).\n2. Fill in or edit your **Display Name**, **Bio**, and **Phone Number** in the input fields.\n3. Click **Save Changes** at the bottom of the card to save your updates to your account.'
      };
    }

    if (path.includes('dashboard')) {
      return {
        page: 'dashboard',
        title: 'Client Dashboard',
        description: 'Your Dashboard tracks all your submitted project briefs, live watermarked design previews, active revisions, completed files, and studio spend analytics.',
        howToAddOrEdit: 'From this dashboard, you can review design previews once delivered, request up to 2 free revisions, approve work to pay and download final unwatermarked files, or click "New Brief" to start another project.'
      };
    }

    if (path.includes('settings')) {
      return {
        page: 'settings',
        title: 'Studio Preferences & Settings',
        description: 'Your Settings page lets you configure your personalized workspace experience, including Dark/Light mode theme, custom studio accent color picker, portfolio privacy, and notifications.',
        howToAddOrEdit: 'Select your preferred theme (Dark or Light), pick an accent color swatch or enter a custom hex code, and your preferences will apply automatically across the entire studio site.'
      };
    }

    if (path.includes('critspace')) {
      return {
        page: 'critspace',
        title: 'CRITSPACE In-Browser Creative Suite',
        description: 'CRITSPACE is our built-in browser design and prototyping studio for vector graphics, posters, responsive web mockups, and 3D scenes.',
        howToAddOrEdit: 'Use the left tool dock (Select V, Resize S, Shapes P, Text T, Pen N, Upload U) to create on canvas, switch responsive viewports (Laptop, Tablet, Mobile), or use 3D Lookup to explore in Three.js.'
      };
    }

    if (path.includes('submit')) {
      let stepNum = 1;
      if (typeof window.currentStep === 'number' && window.currentStep >= 1 && window.currentStep <= 5) {
        stepNum = window.currentStep;
      } else {
        for (let s = 1; s <= 5; s++) {
          const el = document.getElementById(`step-${s}`);
          if (el && el.classList.contains('active')) {
            stepNum = s;
            break;
          }
        }
      }

      const steps = {
        1: {
          title: 'Section 1: Project Name',
          description: 'This section sets the official title of your project brief so our studio designers can identify and organize your project files.',
          guide: 'Type a name for your project (minimum 3 characters, e.g., "Apex Brand Identity" or "Neo Tokyo Poster") and press Enter or click Next to continue.'
        },
        2: {
          title: 'Section 2: Project Type & Service Selection',
          description: 'This section allows you to select which creative service you need from CRITERIA: Websites, Video Editing, UI/Presentations, Posters/Graphics, Logos/Branding, or Thumbnails.',
          guide: 'Click on the service card that best matches what you want designed, then click Next to describe the details.'
        },
        3: {
          title: 'Section 3: Project Details & Attachments',
          description: 'This section captures your creative vision, requirements, colors, themes, target audience, and optional reference files or moodboards.',
          guide: 'Type a description of at least 20 characters explaining what you want created. Optionally drag and drop reference images or video clips, then click Next.'
        },
        4: {
          title: 'Section 4: Budget & Timeline',
          description: 'This section configures your country/currency, delivery deadline (minimum 3 days for standard turnaround), budget range, and optional AI enhancement.',
          guide: 'Select your country, choose a delivery date on the calendar, select your budget tier, and optionally toggle AI acceleration before moving to review.'
        },
        5: {
          title: 'Section 5: Review & Submit',
          description: 'This section provides a complete summary of your project brief for a final check before submission. Zero upfront payment is required.',
          guide: 'Review all your entered details, accept our terms of service, and click Submit Project. Our team will begin drafting your free watermarked preview!'
        }
      };

      const curStep = steps[stepNum] || steps[1];
      return {
        page: 'submit',
        step: stepNum,
        title: curStep.title,
        description: curStep.description,
        howToAddOrEdit: curStep.guide
      };
    }

    // Default: Home page
    return {
      page: 'home',
      title: 'CRITERIA Studio Homepage',
      description: 'This is the main CRITERIA studio hub where you can explore our preview-first creative model, view services, test the interactive preview simulator sandbox, and launch new projects.',
      howToAddOrEdit: 'Click "Start a Project" or ask me in chat to submit a design brief with zero upfront cost.'
    };
  }

  function getPageExplanationReply(userQuery) {
    const q = (userQuery || '').toLowerCase();
    const ctx = getCurrentPageContext();

    // Check if specifically asking about how to add/edit profile
    if (q.includes('profile') && (q.includes('how to add') || q.includes('how do i add') || q.includes('how to edit') || q.includes('how to update') || q.includes('how to set up') || q.includes('how to setup') || q.includes('add my profile') || q.includes('create profile') || q.includes('add the profile'))) {
      if (ctx.page === 'profile') {
        return `Here is how to set up and customize your profile right on this page:\n\n1. **Upload Avatar Photo**: Click the camera icon or your avatar circle at the top to pick an image from your device.\n2. **Display Name**: Type your name or studio handle in the Display Name box.\n3. **Bio**: Write a short bio explaining your creative background or goals.\n4. **Phone / Contact**: Add your phone number so our team can reach you if needed.\n5. **Save**: Click **Save Changes** at the bottom to store everything to your account! ✨`;
      } else {
        return `To add or edit your profile, head over to your [/profile](/profile) page! Once there:\n\n1. Click your avatar circle to upload a profile photo.\n2. Fill in your Display Name, Bio, and contact information.\n3. Click **Save Changes** at the bottom to update your account!`;
      }
    }

    // General question: what does this page/section do?
    if (ctx.page === 'profile') {
      return `You are currently on your **Profile Settings** page! 👤\n\n${ctx.description}\n\n**How to use it:**\n${ctx.howToAddOrEdit}`;
    }

    if (ctx.page === 'submit') {
      return `You are currently on **${ctx.title}** in the project submission wizard! 📝\n\n**What this section does:**\n${ctx.description}\n\n**What to do here:**\n${ctx.howToAddOrEdit}`;
    }

    if (ctx.page === 'dashboard') {
      return `You are currently on your **Client Dashboard**! 📊\n\n${ctx.description}\n\n**How to use it:**\n${ctx.howToAddOrEdit}`;
    }

    if (ctx.page === 'settings') {
      return `You are currently on your **Studio Settings** page! ⚙️\n\n${ctx.description}\n\n**How to use it:**\n${ctx.howToAddOrEdit}`;
    }

    if (ctx.page === 'critspace') {
      return `You are inside **CRITSPACE**, our in-browser creative suite! 🎨\n\n${ctx.description}\n\n**How to use it:**\n${ctx.howToAddOrEdit}`;
    }

    return `You are on the **CRITERIA Studio Homepage**! 🏛️\n\n${ctx.description}\n\nFeel free to ask me to show you around or click **Start a Project** to begin!`;
  }

  /* ============================================================
     SMART Q&A MATCHER (LOCAL FALLBACK)
  ============================================================ */
  function findAnswer(userText) {
    const q = userText.toLowerCase().trim();

    // Check page awareness & profile questions first!
    if (/\b(what does this (page|section) do|what is this (page|section)|what does this section do|what's this (page|section)|what does this do|explain this (page|section)|tell me about this (page|section)|what can i do here|what am i looking at|where am i)\b/i.test(q) ||
      (/\b(how (to|do i) (add|edit|update|set up|setup|create|fill|change) (the |my )?profile)\b/i.test(q)) ||
      (q.includes('profile') && (q.includes('how to add') || q.includes('how do i add') || q.includes('how to edit') || q.includes('how to create')))) {
      return getPageExplanationReply(userText);
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const entry of QA) {
      let score = 0;
      for (const kw of entry.keywords) {
        const lowerKw = kw.toLowerCase();
        if (q === lowerKw) {
          score += 150;
        } else if (q.includes(lowerKw)) {
          if (lowerKw.length >= 10) score += 30;
          else if (lowerKw.length >= 6) score += 12;
          else if (lowerKw.length >= 3) score += 4;
          else score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }

    if (bestMatch && bestScore >= 1) {
      const intros = [
        "",
        "Here's the breakdown: ",
        "Great question! ",
        "Happy to help with that: "
      ];
      const chosenIntro = intros[Math.floor(Math.random() * intros.length)];
      if (chosenIntro && !bestMatch.answer.startsWith('#') && !bestMatch.answer.startsWith('•')) {
        return chosenIntro + bestMatch.answer;
      }
      return bestMatch.answer;
    }

    // Varied dynamic fallback responses
    const fallbacks = [
      "I'm **CRIT**, your CRITERIA studio assistant! 🤖\n\nWhile I can chat about all sorts of creative topics, let's focus on your project! Are you looking to design a website, logo, poster, or try out our in-browser design suite **CRITSPACE** today?",
      "Hey there! **CRIT** here at CRITERIA Studio. 🎨\n\nWhat kind of design or development project are you looking to bring to life? We work on logos, websites, video editing, and custom graphics with a 100% free preview upfront!",
      "Hello! I'm **CRIT**, your creative copilot. 🚀\n\nWhether you need an eye-catching poster, a full custom website, or want to test out **CRITSPACE**, I'm here to guide you. How can I help with your project today?"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  /* ============================================================
     AI SYSTEM PROMPT & KNOWLEDGE INJECTION
     Dense, structured master prompt under 3,300 chars to fit
     well within the backend 4,000 char validation ceiling.
  ============================================================ */
  const CRIT_SYSTEM_PROMPT = `[System Instructions for CRIT:
You are CRIT, official AI assistant for CRITERIA studio (https://criteriaa.web.app). Tagline: "We create work worth keeping." Based in India, serving global clients.

INCOMPLETE & IN-PROGRESS PROJECTS INTELLIGENCE:
When users mention they are stuck, have an unfinished project, or need help completing a build (e.g. "I'm working on a project, but I couldn't complete so would criteria help me to do so"):
- Confidently and enthusiastically answer: YES! CRITERIA specializes in taking over, finishing, debugging, and redesigning in-progress projects (codebases, web apps, UI/UX, branding, graphic design, and video).
- Highlight that they can attach their existing codebases, GitHub repositories, or UI component files directly in Section 3 of our submission wizard (/submit), or upload their existing assets/documents.
- Reassure them with our Preview-First model: ₹0 upfront payment! We deliver a complete watermarked preview with up to 2 free revisions before they spend a single rupee.
- Offer to start or continue the brief walkthrough: if new to the wizard, suggest [TOUR:start-project] ("Ready to start the interactive walkthrough?"); if currently on /submit, suggest [TOUR:interactive-build] ("Ready to proceed with the walkthrough from here?").

CORE KNOWLEDGE:
• Preview-First Model: Submit brief (/submit) -> Free watermarked preview (24-48h graphics, 3-5d web/video) -> 2 free revisions -> Pay (UPI, Cards, NetBanking) & get clean source files with full 100% IP rights. Zero upfront risk.
• Services & Rates: Graphics/Posters (₹80-₹500, 24-48h), Logos/Branding (₹100-₹2,500), Websites (₹5k-₹20k, responsive, 3-7d), Video (₹200-₹3,000), UI/UX (₹200-₹2,500).
• CRITSPACE (/critspace): In-browser creative suite. UI/Picture Editing (vectors, posters, 3D Lookup scene), Web Modeling (responsive mock sites, device toggles Laptop 1440px/Tablet 768px/Mobile 375px), Export (PNG, JPG, multi-page vector PDF via jsPDF).
• Submit (/submit): 5-step wizard (Details -> Scope/Files & GitHub Repos -> Budget & Deadline [min 3 days] -> Terms -> Review).
• Security: Strictly confidential admin/agent portals and keys. Off-topic: answer briefly then steer back to studio projects.

RESPONSE MANDATE:
- Speak naturally with high intelligence, direct understanding, and fresh phrasing. Avoid canned scripts, repetitive catchphrases, or boilerplate lists.
- Keep answers punchy, confident, and actionable (2-3 paragraphs max).]`;

  const DYNAMIC_PERSONAS = [
    "creative design consultant giving direct, fresh, actionable ideas",
    "energetic studio director offering punchy, clear guidance",
    "sharp visual strategist focused on clear value and zero upfront risk",
    "friendly creative collaborator offering tailored recommendations"
  ];

  
  function isProjectNameClear(rawName) {
    const name = (rawName || '').trim();
    if (!name) return { valid: false, reason: 'Please enter a project name.' };
    if (name.length < 5) return { valid: false, reason: 'Project name must be at least 5 characters (' + name.length + '/5).' };
    if (/^(.)\1+$/i.test(name)) return { valid: false, reason: 'Project name cannot consist of repeated characters.' };
    const lower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const spam = ['asdf', 'qwer', 'zxcv', '1234', 'test', 'abcd', 'qwerty', 'hjkl', 'project', 'testing'];
    if (spam.some(p => lower === p || lower === p + p)) {
      return { valid: false, reason: 'Project name appears to be placeholder text. Please enter a real project name.' };
    }
    const letters = name.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= 5) {
      const vowels = letters.match(/[aeiouyAEIOUY]/g);
      if (((vowels ? vowels.length : 0) / letters.length) < 0.15) {
        return { valid: false, reason: 'Project name appears to be random keystrokes. Please enter a clear title.' };
      }
    }
    if (!/[a-zA-Z]/.test(name)) return { valid: false, reason: 'Project name must contain alphabetical letters.' };
    return { valid: true };
  }

  function isDescriptionClear(rawDesc) {
    const desc = (rawDesc || '').trim();
    if (!desc) return { valid: false, reason: 'Please describe your project.' };
    if (desc.length < 25) return { valid: false, reason: 'Description is too brief (' + desc.length + '/25 chars). Please explain your vision or style.' };
    const words = desc.split(/\s+/).filter(w => w.length > 1);
    if (words.length < 5) return { valid: false, reason: 'Please use at least 5 words to describe what you want built.' };
    const unique = new Set(words.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '')));
    if (words.length >= 5 && unique.size <= 2) {
      return { valid: false, reason: 'Description contains repeated words. Please describe your project requirements in detail.' };
    }
    if (/^(.)\1+$/i.test(desc.replace(/\s+/g, ''))) return { valid: false, reason: 'Description cannot be repetitive characters.' };
    const letters = desc.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= 20) {
      const vowels = letters.match(/[aeiouyAEIOUY]/g);
      if (((vowels ? vowels.length : 0) / letters.length) < 0.18) {
        return { valid: false, reason: 'Description appears to be random keystrokes. Please provide a clear description.' };
      }
    }
    return { valid: true };
  }

  function buildAiPrompt(userText) {
    const cleanUser = String(userText).slice(0, 320);
    const pageCtx = getCurrentPageContext();

    let ctxStr = `\n\nUSER LOCATION: ${pageCtx.title} (${pageCtx.page}.html)`;
    if (pageCtx.step) {
      ctxStr += `, Section ${pageCtx.step}`;
    }
    if (pageCtx.description) {
      ctxStr += ` - ${pageCtx.description.slice(0, 160)}`;
    }

    const payload = `${CRIT_SYSTEM_PROMPT}${ctxStr}\n\nUser Question: ${cleanUser}`;
    // Hard ceiling safety: truncate if exceeds 3,700 chars
    return payload.slice(0, 3700);
  }

  /* ---------- Off-Topic Transition Guard ---------- */
  const STUDIO_KEYWORDS = [
    'criteria', 'crit', 'studio', 'critspace', 'service', 'poster', 'graphic',
    'logo', 'brand', 'thumbnail', 'website', 'web', 'video', 'ui', 'ux',
    'presentation', 'pricing', 'price', 'cost', 'rate', 'rupee', 'inr', 'pay',
    'payment', 'preview', 'watermark', 'revision', 'submit', 'order', 'brief',
    'turnaround', 'deadline', 'delivery', 'deliverable', 'dashboard', 'settings',
    'profile', 'theme', 'accent', 'color', 'cookies', 'sitecookies', 'layer', 'properties',
    '3d lookup', 'device', 'laptop', 'tablet', 'mobile', 'download', 'export',
    'pdf', 'png', 'jpg', 'svg', 'canvas', 'shortcut', 'select', 'resize',
    'shapes', 'text', 'pen', 'bucket', 'template', 'upload', 'fullscreen',
    'refund', 'rights', 'copyright', 'portfolio', 'policy', 'policies',
    'sunder', 'sandbox', 'faq', 'hero'
  ];

  function isStudioRelated(text) {
    const lower = text.toLowerCase();
    return STUDIO_KEYWORDS.some(kw => lower.includes(kw));
  }

  function ensureOffTopicPivot(userQuery, botReply) {
    if (isStudioRelated(userQuery)) return botReply;
    const lowerReply = botReply.toLowerCase();
    const hasTransition = lowerReply.includes("kick off") ||
      lowerReply.includes("skip off") ||
      lowerReply.includes("enough about") ||
      lowerReply.includes("let's get back") ||
      lowerReply.includes("let’s get back") ||
      lowerReply.includes("focus back") ||
      lowerReply.includes("back to criteria") ||
      lowerReply.includes("back to your") ||
      lowerReply.includes("pivot back") ||
      lowerReply.includes("steer back") ||
      lowerReply.includes("critspace") ||
      lowerReply.includes("criteria");
    if (!hasTransition) {
      const pivots = [
        "\n\n...Anyway, let's kick off that subject and get back to your creative work! Are you looking to design something or try out CRITSPACE today?",
        "\n\n...That said, let's kick off the tangent and focus on what we create! How can I help you with your next website, logo, or design project?",
        "\n\n...Now that we've cleared that up, let's kick off the subject and dive back into our creative tools. Have any questions about CRITSPACE or our services?"
      ];
      const pivot = pivots[Math.floor(Math.random() * pivots.length)];
      return botReply + pivot;
    }
    return botReply;
  }

  /* ============================================================
     STATE & CONFIG
  ============================================================ */
  const API_URL = 'https://crit-bot-1.onrender.com/api/v1/chat';
  const CLEAR_URL = 'https://crit-bot-1.onrender.com/api/v1/clear-session';
  const HEALTH_URL = 'https://crit-bot-1.onrender.com/health';
  const AI_TIMEOUT_MS = 15000;            // wait up to 50s for Render to wake up
  const QA_COOLDOWN_MS = 20 * 1000;       // 20s cooldown: quickly re-check Groq AI instead of long lockouts
  const QA_UNTIL_KEY = 'criteria-ai-chat-qa-until';
  const STORAGE_KEY = 'criteria-ai-chat-state';
  const SESSION_KEY = 'criteria-ai-chat-session-id';
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC5PXHOl3UYhsWImZBKXYXbikYASWVC-7Y",
    authDomain: "criteria-18e9d.firebaseapp.com",
    projectId: "criteria-18e9d",
    storageBucket: "criteria-18e9d.firebasestorage.app",
    messagingSenderId: "427729441325",
    appId: "1:427729441325:web:43a77167bd1f9fc5c65ea4"
  };

  let isTyping = false;
  let chatState = {
    sessionId: null,
    isOpen: false,
    unread: 0,
    history: []
  };
  let firebaseApp = null;
  let firebaseDb = null;
  let firebaseFns = null;
  let firebaseInitialized = false;

  /* ---------- AI / Q&A mode ---------- */
  function isQaMode() {
    const until = Number(sessionStorage.getItem(QA_UNTIL_KEY) || 0);
    return Date.now() < until;
  }

  function enterQaMode() {
    sessionStorage.setItem(QA_UNTIL_KEY, String(Date.now() + QA_COOLDOWN_MS));
    updateModeLabel();
    CritTour.init();
  }

  function leaveQaMode() {
    sessionStorage.removeItem(QA_UNTIL_KEY);
    updateModeLabel();
  }

  function updateModeLabel() {
    const el = document.getElementById('crit-mode-label');
    if (!el) return;
    if (!isGroqAwake && isGroqWaking) {
      el.textContent = 'Connecting to AI assistant…';
    } else {
      el.textContent = isQaMode()
        ? 'Online · quick-answer mode'
        : 'Online · AI assistant';
    }
  }

  // Ask Render to wake up in the background
  function wakeBackend() {
    try {
      fetch(HEALTH_URL, { mode: 'no-cors', cache: 'no-store' }).catch(() => { });
    } catch (e) { /* ignore */ }
  }

  // Calls the backend. Throws on timeout, network error, CORS error or non-OK status.
  async function askBackend(text) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    const messagePayload = buildAiPrompt(text);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messagePayload, sessionId: chatState.sessionId }),
        signal: controller.signal
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const err = new Error((data && data.error) || ('Server returned ' + res.status));
        err.status = res.status;
        throw err;
      }
      if (!data || typeof data.response !== 'string' || !data.response.trim()) {
        throw new Error('Empty response from server');
      }
      return data.response;
    } finally {
      clearTimeout(timer);
    }
  }

  function getSessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = 'crit-chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  function loadLocalState() {
    chatState.sessionId = getSessionId();
    // Fresh session: remove previous chat memory and start with chat closed
    chatState.history = [];
    chatState.isOpen = false;
    chatState.unread = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.warn('Local storage clear note:', error);
    }
  }

  function saveLocalState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chatState));
    } catch (e) { }
  }

  async function initFirebase() {
    if (firebaseInitialized) return;
    firebaseInitialized = true;

    try {
      const appModule = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      firebaseApp = appModule.initializeApp(FIREBASE_CONFIG);
      firebaseDb = firestoreModule.getFirestore(firebaseApp);
      firebaseFns = {
        doc: firestoreModule.doc,
        getDoc: firestoreModule.getDoc,
        setDoc: firestoreModule.setDoc,
        serverTimestamp: firestoreModule.serverTimestamp
      };
    } catch (error) {
      console.warn('Firebase chat sync unavailable:', error);
      firebaseDb = null;
      firebaseFns = null;
    }
  }

  async function loadFirestoreState() {
    // Fresh session start: do not load old remote chat memory
    return;
  }

  async function saveFirestoreState() {
    if (!firebaseDb || !firebaseFns) return;
    try {
      const ref = firebaseFns.doc(firebaseDb, 'chatSessions', chatState.sessionId);
      await firebaseFns.setDoc(ref, {
        sessionId: chatState.sessionId,
        isOpen: chatState.isOpen,
        unread: chatState.unread,
        history: chatState.history,
        updatedAt: firebaseFns.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      if (error?.code !== 'permission-denied') {
        console.warn('Chat state remote save note:', error?.message || error);
      }
    }
  }

  function restoreMessages() {
    const msgs = document.getElementById('crit-messages');
    if (!msgs) return;
    msgs.innerHTML = '';

    // Welcoming fresh greeting
    const greeting = "👋 Hi! I'm **CRIT**, your CRITERIA studio assistant.\n\nAsk me anything about our services, preview-first model, tools in **CRITSPACE**, or how to start a project!";
    appendMessage('bot', greeting);

    // Never auto-open on startup
    const bubble = document.getElementById('crit-bubble');
    if (bubble) bubble.classList.remove('open');
    chatState.isOpen = false;

    const badge = document.getElementById('crit-unread');
    if (badge) {
      badge.style.display = 'none';
    }
  }

  function addMessageToState(role, text) {
    if (!text) return;
    chatState.history.push({ role, text });
    if (role === 'bot' && !document.getElementById('crit-bubble')?.classList.contains('open')) {
      chatState.unread = Math.min(chatState.unread + 1, 99);
      const badge = document.getElementById('crit-unread');
      if (badge) badge.style.display = 'flex';
    }
    saveLocalState();
    saveFirestoreState();
  }

  loadLocalState();

  /* ============================================================
     BUILD DOM
  ============================================================ */

  /* ============================================================
     CRIT GUIDED TOUR ENGINE (LASER-FOCUSED + OCR + MOUSE/KEYBOARD CONTROL)
  ============================================================ */

  function isUserSignedIn() {
    if (typeof auth !== 'undefined' && auth && auth.currentUser) return true;
    if (window.auth && window.auth.currentUser) return true;
    try {
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) return true;
    } catch (e) { }

    const authGate = document.getElementById('auth-gate');
    if (authGate && authGate.classList.contains('open')) return false;

    const navSignin = document.getElementById('nav-signin-btn');
    if (navSignin && (navSignin.offsetWidth > 0 || window.getComputedStyle(navSignin).display !== 'none')) {
      return false;
    }

    const heroSignup = document.getElementById('hero-signup-btn');
    if (heroSignup && (heroSignup.offsetWidth > 0 || window.getComputedStyle(heroSignup).display !== 'none')) {
      return false;
    }

    const heroStart = document.getElementById('hero-start-btn');
    if (heroStart && heroStart.style.display !== 'none' && heroStart.offsetParent !== null) return true;

    if (localStorage.getItem('criteria_user') || sessionStorage.getItem('criteria_user')) return true;

    const mainContainer = document.getElementById('main-container');
    if (mainContainer && window.getComputedStyle(mainContainer).display === 'block') return true;

    return false;
  }

  function triggerSignUp() {
    if (typeof window.openAuthSignup === 'function') {
      window.openAuthSignup();
      return true;
    }
    const signupBtn = document.getElementById('hero-signup-btn') ||
      document.getElementById('nav-signup-btn') ||
      document.querySelector('[onclick*="openAuthSignup"]');
    if (signupBtn) {
      signupBtn.click();
      return true;
    }
    window.location.href = '/?action=signup';
    return false;
  }

  function guideUserToSignInWithMouse(customMessage) {
    const bubble = document.getElementById('crit-bubble');
    if (bubble) bubble.classList.add('open');
    chatState.isOpen = true;
    saveLocalState();

    const msgText = customMessage || "Please sign in first, then ask me again — I'll be waiting! 🔒✨";
    appendMessage('bot', msgText);
    addMessageToState('bot', msgText);

    // Locate sign-in button
    const signInBtn = document.getElementById('nav-signin-btn') ||
      document.getElementById('hero-signup-btn') ||
      document.getElementById('nav-signup-btn') ||
      document.querySelector('.auth-gate-btn') ||
      document.querySelector('[onclick*="openAuth"]');

    if (signInBtn) {
      // Start cursor from the chat window / bubble
      const chatWin = document.getElementById('crit-window');
      let startPos = null;
      if (chatWin && chatWin.offsetWidth > 0) {
        const wRect = chatWin.getBoundingClientRect();
        startPos = {
          x: Math.round(wRect.left + 50),
          y: Math.round(wRect.top + 30)
        };
      } else {
        startPos = {
          x: window.innerWidth - 60,
          y: window.innerHeight - 60
        };
      }

      CritTour.animateMouseToElement(signInBtn, () => {
        if (typeof window.switchTab === 'function') {
          window.switchTab('signin');
        }
        if (typeof window.openAuth === 'function') {
          window.openAuth();
        } else {
          signInBtn.click();
        }
      }, startPos);
    } else {
      triggerSignUp();
    }
  }

  const CRIT_TOURS = {
    // Focused: Starting a project (Direct to Start/Submit without unrelated fluff!)
    'start-project': {
      title: 'Start a Project',
      steps: [
        {
          target: '#hero-start-btn, #hero-signup-btn, .hero-actions, #hero',
          ocr: ['Start a Project', 'Get Started'],
          title: 'Start a Project',
          text: 'Click **Next →** to begin your project setup. I will guide you step-by-step through the submission brief.',
          page: '/'
        }
      ]
    },
    // The Submit Wizard on submit.html (Step 1 to Step 5)
    'submit-wizard': {
      title: 'Submit Brief Walkthrough',
      steps: [
        {
          target: '#step-1 .step-box, #project-name, #step-1',
          ocr: ["What's the name of your project", "Project Details", "Project Name"],
          title: '1. Project Name',
          text: 'Type a clear title for your creative brief here (e.g. "Summer Brand Logo").',
          page: '/submit.html'
        },
        {
          target: '#step-2 .type-grid, #step-2',
          ocr: ['What type of work do you need', 'Poster & Graphics', 'Logo & Branding'],
          title: '2. Select Service',
          text: 'Pick the creative category you need: Poster, Logo, Website, Video, or UI.',
          page: '/submit.html'
        },
        {
          target: '#step-3 .step-box, #project-description',
          ocr: ['Describe your project', 'vision', 'audience'],
          title: '3. Scope & Uploads',
          text: 'Outline your style preferences, colors, and drag in reference files or moodboards.',
          page: '/submit.html'
        },
        {
          target: '#step-4 .step-box, #country',
          ocr: ['Country', 'Deadline', 'Budget'],
          title: '4. Budget & Timeline',
          text: 'Set your budget range and select your deadline (minimum 3 days for quality craft).',
          page: '/submit.html'
        },
        {
          target: '#step-5 .step-box, .tnc-scroll',
          ocr: ['Terms & Conditions', 'Preview Before Payment'],
          title: '5. Terms & 100% IP',
          text: 'Confirm preview-first terms: 2 free revisions & 100% copyright transfer upon payment.',
          page: '/submit.html'
        },
        {
          target: '#step-6 .step-box, #btn-submit, .btn-submit, form',
          ocr: ['Submit', 'Review & Submit'],
          title: '6. Review & Submit',
          text: 'Review your brief summary and submit. Your free preview will arrive on your Dashboard!',
          page: '/submit.html'
        }
      ]
    },
    // Complete Website Overview (only when explicitly asked)
    'full-website': {
      title: 'Website Overview',
      steps: [
        {
          target: '#hero',
          ocr: ['We Create Work Worth Keeping', 'Hero'],
          title: 'Studio Showcase',
          text: 'CRITERIA is a creative studio delivering graphics, websites, videos, and UI with zero upfront payment risk.',
          page: '/'
        },
        {
          target: '#services',
          ocr: ['What we do', 'Every creative need'],
          title: '6 Core Services',
          text: 'Posters (₹80-₹500), Logos (₹100-₹2,500), Thumbnails (₹80-₹500), Websites (₹5k-₹20k), Videos, and UI.',
          page: '/'
        },
        {
          target: '#how',
          ocr: ['The Process', 'Designed for trust'],
          title: 'Preview-First Model',
          text: 'Submit a brief, receive a free watermarked preview, get 2 free revisions, and only pay when 100% satisfied.',
          page: '/'
        },
        {
          target: '#trust',
          ocr: ['Why Criteria', 'You see the work before you pay'],
          title: '100% IP Ownership',
          text: 'Full commercial copyright transferred upon payment. Zero hidden fees and complete portfolio privacy.',
          page: '/'
        },
        {
          target: '#sandbox',
          ocr: ['Interactive Playground', 'See the process in action'],
          title: 'Preview Simulator',
          text: 'Test customizing logos, switching accent colors, and testing viewports before submitting a brief.',
          page: '/'
        },
        {
          target: '#faq',
          ocr: ['FAQ', 'Frequently Asked Questions'],
          title: 'Studio FAQs',
          text: 'Quick answers on turnaround times, deliverables (PNG/SVG/PDF/MP4), and payment methods.',
          page: '/'
        }
      ]
    },
    'services': {
      title: 'Services & Rates',
      steps: [
        {
          target: '#services',
          ocr: ['What we do', 'Every creative need'],
          title: 'All Services',
          text: 'Transparent pricing with zero blind payments. Every project includes a free preview and 2 free revisions.',
          page: '/'
        }
      ]
    },
    'sandbox': {
      title: 'Preview Simulator',
      steps: [
        {
          target: '#sandbox',
          ocr: ['Interactive Playground', 'See the process in action'],
          title: 'Live Simulator',
          text: 'Customize mock designs, test viewports, and see how the watermark dissolves when approved.',
          page: '/'
        }
      ]
    }
  };

  function getVisibleHeroButton() {
    const heroSignup = document.getElementById('hero-signup-btn');
    const heroStart = document.getElementById('hero-start-btn');
    if (heroStart && heroStart.offsetParent !== null && heroStart.getBoundingClientRect().width > 10) {
      return heroStart;
    }
    if (heroSignup && heroSignup.offsetParent !== null && heroSignup.getBoundingClientRect().width > 10) {
      return heroSignup;
    }
    if (heroSignup) {
      heroSignup.style.display = 'inline-block';
      return heroSignup;
    }
    if (heroStart) {
      heroStart.style.display = 'inline-block';
      return heroStart;
    }
    return document.querySelector('.hero-actions .btn-primary, .hero-actions a, a[href*="/submit"]');
  }

  const CritTour = {
    activeTour: null,
    cursorDuration: 1450, // Reduced speed: smooth, natural, relaxed cursor movement (in ms)
    currentStepIndex: 0,
    currentInteractiveStep: null,
    overlayEl: null,
    cutoutEl: null,
    glowEl: null,
    cardEl: null,
    dockEl: null,
    isListeningScroll: false,
    activeTargetEl: null,
    isClickingNextWithMouse: false,
    isTransitioning: false,
    _customNav: null,
    _isNavigating: false,

    _triggerNext(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (this._isNavigating) return;
      this._isNavigating = true;
      setTimeout(() => { this._isNavigating = false; }, 600);

      const nextBtn = document.getElementById('crit-tour-next-btn');
      if (nextBtn) {
        nextBtn.classList.add('crit-btn-clicked');
      }

      if (this._customNav && typeof this._customNav.onNext === 'function') {
        this._customNav.onNext();
      } else {
        this.next();
      }
    },

    _triggerPrev(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (this._isNavigating) return;
      this._isNavigating = true;
      setTimeout(() => { this._isNavigating = false; }, 600);

      if (this._customNav && typeof this._customNav.onPrev === 'function') {
        this._customNav.onPrev();
      } else {
        this.prev();
      }
    },

    lockScroll() {
      document.body.style.touchAction = 'none';
      if (window.lenis && typeof window.lenis.stop === 'function') {
        try { window.lenis.stop(); } catch (e) { }
      }
    },

    unlockScroll() {
      document.body.style.touchAction = '';
      if (window.lenis && typeof window.lenis.start === 'function') {
        try { window.lenis.start(); } catch (e) { }
      }
    },

    init() {
      let overlay = document.getElementById('crit-spotlight-overlay');
      if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.remove('active');
        overlay.style.webkitMaskImage = 'none';
        overlay.style.maskImage = 'none';
      }

      document.getElementById('crit-spotlight-shadow-sweep')?.remove();
      this.sweepEl = null;
      document.getElementById('crit-spotlight-subtle-glow')?.remove();
      this.spotlightGlow = null;

      let svgOverlay = document.getElementById('crit-spotlight-svg');
      if (!svgOverlay) {
        svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgOverlay.id = 'crit-spotlight-svg';
        svgOverlay.setAttribute('width', '100%');
        svgOverlay.setAttribute('height', '100%');
        svgOverlay.setAttribute('preserveAspectRatio', 'none');
        svgOverlay.style.cssText = 'pointer-events:none; position:fixed; top:0; left:0; width:100%; height:100%; z-index:99990; transform:translateZ(0); will-change:opacity; contain:strict;';
        svgOverlay.innerHTML = `
          <defs pointer-events="none">
            <filter id="crit-spotlight-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" />
            </filter>
            <mask id="crit-spotlight-mask" pointer-events="none">
              <rect width="100%" height="100%" fill="white" pointer-events="none" />
              <rect id="crit-mask-fade" x="0" y="0" width="0" height="0" rx="18" ry="18" fill="black" filter="url(#crit-spotlight-blur)" pointer-events="none" />
              <rect id="crit-mask-core" x="0" y="0" width="0" height="0" rx="16" ry="16" fill="black" pointer-events="none" />
            </mask>
          </defs>
          <rect id="crit-spotlight-backdrop" width="100%" height="100%" fill="rgba(4, 4, 8, 0.85)" mask="url(#crit-spotlight-mask)" pointer-events="none" style="pointer-events:none !important;" />
        `;
        document.body.appendChild(svgOverlay);
      }
      this.svgEl = svgOverlay;
      this.maskCore = document.getElementById('crit-mask-core');
      this.maskFade = document.getElementById('crit-mask-fade');
      this.maskShadow = null;

      // Pre-create and ready the bot pointer cursor so there is zero delay when invoked
      let cursor = document.getElementById('crit-bot-cursor');
      if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'crit-bot-cursor';
        cursor.innerHTML = `
          <svg class="crit-bot-pointer-svg" width="34" height="34" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 5 4 L 22.5 15.5 L 14.5 17 L 9 24 Z" 
                  fill="rgba(240, 165, 0, 0.35)" 
                  stroke="#f0a500" 
                  stroke-width="2.6" 
                  stroke-linecap="round" 
                  stroke-linejoin="round" />
            <path d="M 7 6.5 L 17 13.5 L 12.8 14.3 L 9.5 18.5 Z" 
                  fill="#ffffff" 
                  opacity="0.9" />
          </svg>
          <div class="crit-bot-mobile-circle">
            <div class="crit-bot-touch-ripple"></div>
            <div class="crit-bot-touch-ring"></div>
            <div class="crit-bot-touch-core"></div>
          </div>
        `;
        document.body.appendChild(cursor);
      }

      let blocker = document.getElementById('crit-interaction-blocker');
      if (!blocker) {
        blocker = document.createElement('div');
        blocker.id = 'crit-interaction-blocker';
        document.body.appendChild(blocker);
      }
      this.blockerEl = blocker;
      this.spotlightGlow = null;
      this.maskFrame = null;
      this.overlayEl = svgOverlay;
      this.overlayDiv = overlay;

      // Always remove any glowing spotlight box container
      document.getElementById('crit-spotlight-container')?.remove();
      document.getElementById('crit-spotlight-subtle-glow')?.remove();

      let card = document.getElementById('crit-tour-card');
      if (!card) {
        card = document.createElement('div');
        card.id = 'crit-tour-card';
        card.style.display = 'none';
        card.innerHTML = `
          <div class="crit-tour-drag-handle" title="Drag to move"><div class="crit-tour-drag-bar"></div></div>
          <div class="crit-tour-header">
            <div class="crit-tour-badge-group">
              <div class="crit-tour-avatar">C</div>
              <div class="crit-tour-badge-name">CRIT</div>
              <span class="crit-tour-step-pill" id="crit-tour-step-pill">1/1</span>
            </div>
          </div>
          <div class="crit-tour-title" id="crit-tour-title">Step Title</div>
          <div class="crit-tour-body" id="crit-tour-body"></div>
          <div class="crit-tour-footer">
            <button type="button" class="crit-tour-btn-skip" id="crit-tour-skip-btn">Skip Demo</button>
            <div class="crit-tour-nav-btns" id="crit-tour-nav-btns">
              <button type="button" class="crit-tour-btn-prev" id="crit-tour-prev-btn">←</button>
              <button type="button" class="crit-tour-btn-next" id="crit-tour-next-btn">Next →</button>
            </div>
          </div>
        `;
        document.body.appendChild(card);
      }

      document.getElementById('crit-tour-dock')?.remove();

      this.cardEl = card || document.getElementById('crit-tour-card');
      this.dockEl = null;

      // Single, robust delegated click listener for all card buttons
      if (this.cardEl && !this.cardEl._tourClickBound) {
        this.cardEl._tourClickBound = true;
        this.cardEl.addEventListener('click', (e) => {
          const skipBtn = e.target.closest('#crit-tour-skip-btn');
          if (skipBtn) {
            e.preventDefault();
            e.stopPropagation();
            this.end(false);
            return;
          }
          const prevBtn = e.target.closest('#crit-tour-prev-btn');
          if (prevBtn) {
            e.preventDefault();
            e.stopPropagation();
            this._triggerPrev(e);
            return;
          }
          const nextBtn = e.target.closest('#crit-tour-next-btn');
          if (nextBtn) {
            e.preventDefault();
            e.stopPropagation();
            this._triggerNext(e);
            return;
          }
        });
      }

      this.makeCardDraggable();

      if (!this.isListeningScroll) {
        this.isListeningScroll = true;
        let rafId = null;
        this._scrollHandler = () => {
          if (!this.activeTour) return;
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            this.repositionCurrentStep(true);
          });
        };
        window.addEventListener('scroll', this._scrollHandler, { passive: true });
        window.addEventListener('resize', this._scrollHandler, { passive: true });
      }

      window.addEventListener('keydown', (e) => {
        if (!this.activeTour) return;
        if (e.key === 'Escape') {
          this.end(false);
        } else if (e.key === 'ArrowRight' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          this._triggerNext(e);
        } else if (e.key === 'ArrowLeft' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          this._triggerPrev(e);
        }
      });

      if (!this._hasClickBlocker) {
        this._hasClickBlocker = true;
        window.addEventListener('click', (e) => {
          if (!this.activeTour) return;
          const clickable = e.target.closest('a, button');
          if (!clickable) return;
          if (clickable.closest('.crit-tour-target-active') || clickable.closest('#crit-tour-card') || clickable.closest('#crit-bubble')) {
            return;
          }
          // Dull non-target buttons stay unclickable during tour
          e.preventDefault();
          e.stopPropagation();
        }, true);
      }

      if (!this._hasTransitionBlocker) {
        this._hasTransitionBlocker = true;
        ['click', 'pointerdown', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchmove', 'keydown', 'keypress', 'wheel', 'submit', 'contextmenu'].forEach(type => {
          window.addEventListener(type, (e) => {
            if (this.isTransitioning || document.body.classList.contains('crit-tour-blocking') || document.body.classList.contains('crit-tour-transitioning')) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              return false;
            }
          }, { capture: true, passive: false });
        });
      }

      // Handle URL action / tour params (?action=signup or ?tour=submit-wizard or ?tour=interactive-build)
      const urlParams = new URLSearchParams(window.location.search);
      const action = urlParams.get('action');
      if (action === 'signup') {
        setTimeout(() => triggerSignUp(), 500);
      }
      const urlTour = urlParams.get('tour');
      let pendingBuild = false;
      try {
        pendingBuild = sessionStorage.getItem('crit_pending_interactive_build') === 'true';
        if (pendingBuild) sessionStorage.removeItem('crit_pending_interactive_build');
      } catch (e) { }

      let activeTask = null;
      try {
        const rawTask = sessionStorage.getItem('crit_active_task');
        if (rawTask) {
          const parsed = JSON.parse(rawTask);
          if (parsed && parsed.tourId === 'interactive-build') {
            if (!parsed.timestamp || (Date.now() - parsed.timestamp < 86400000)) {
              activeTask = parsed;
            } else {
              sessionStorage.removeItem('crit_active_task');
            }
          }
        }
      } catch (e) { }

      if (!this._checkedPendingTour) {
        this._checkedPendingTour = true;
        if (this.activeTour) return;
        const currentPath = window.location.pathname.toLowerCase().replace(/\/index\.html$/, '/');
        const isSubmitPage = currentPath.includes('submit');
        if (urlTour === 'interactive-build' || pendingBuild) {
          // Strip ?tour from address bar immediately so address bar is clean
          try {
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', cleanUrl);
            sessionStorage.removeItem('crit_pending_interactive_build');
            sessionStorage.removeItem('crit_from_home_start');
          } catch (e) { }
          const resumeStepId = (activeTask && activeTask.stepId) ? activeTask.stepId : null;
          this._pendingTourTimer = setTimeout(() => {
            this._pendingTourTimer = null;
            if (!this.activeTour) this.startInteractiveBuild(resumeStepId);
          }, 350);
        } else if (urlTour && CRIT_TOURS[urlTour]) {
          this._pendingTourTimer = setTimeout(() => {
            this._pendingTourTimer = null;
            if (!this.activeTour) this.start(urlTour);
          }, 350);
        } else {
          // User did NOT ask for demo: keep tour completely idle & clear lingering session tasks
          try {
            sessionStorage.removeItem('crit_active_task');
            sessionStorage.removeItem('crit_pending_interactive_build');
          } catch (e) { }
        }
      }
    },

    blockUserInteraction(enable = true) {
      this.isTransitioning = enable;
      let blocker = document.getElementById('crit-interaction-blocker');
      if (!blocker) {
        blocker = document.createElement('div');
        blocker.id = 'crit-interaction-blocker';
        document.body.appendChild(blocker);
      }
      this.blockerEl = blocker;
      if (enable) {
        document.body.classList.add('crit-tour-transitioning', 'crit-tour-blocking');
        blocker.style.display = 'block';
        blocker.style.pointerEvents = 'all';
        this.lockScroll();
      } else {
        document.body.classList.remove('crit-tour-transitioning', 'crit-tour-blocking');
        blocker.style.display = 'none';
        blocker.style.pointerEvents = 'none';
        this.unlockScroll();
      }
    },

    animateSpotlightEntrance(targetEl, onComplete, customPad = null, customRadius = null) {
      if (!this.svgEl) this.init();
      if (!targetEl) {
        if (onComplete) onComplete();
        return;
      }

      let rect = null;
      if (Array.isArray(targetEl)) {
        const valid = targetEl.map(el => (el && el.offsetParent !== null ? el.getBoundingClientRect() : null)).filter(Boolean);
        if (valid.length > 0) rect = valid[0];
      } else if (targetEl.getBoundingClientRect) {
        rect = targetEl.getBoundingClientRect();
      }

      if (!rect || rect.width <= 0 || rect.height <= 0) {
        if (onComplete) onComplete();
        return;
      }

      const centerX = Math.round(rect.left + rect.width / 2);
      const centerY = Math.round(rect.top + rect.height / 2);

      const padX = typeof customPad === 'number' ? customPad : 14;
      const padY = typeof customPad === 'number' ? customPad : 8;
      const finalW = Math.round(rect.width + padX * 2);
      const finalH = Math.round(rect.height + padY * 2);
      const finalR = typeof customRadius === 'number' ? customRadius : Math.max(14, Math.min(24, Math.round(finalH * 0.36)));
      const finalX = Math.round(rect.left - padX);
      const finalY = Math.round(rect.top - padY);

      const svg = this.svgEl || document.getElementById('crit-spotlight-svg');
      const core = this.maskCore || document.getElementById('crit-mask-core');
      const fade = this.maskFade || document.getElementById('crit-mask-fade');

      if (!svg || !core || !fade) {
        if (onComplete) onComplete();
        return;
      }

      if (this._entranceRaf) {
        cancelAnimationFrame(this._entranceRaf);
        this._entranceRaf = null;
      }
      this.isEntranceAnimating = true;

      // Smooth scale capped to prevent massive offscreen texture memory
      const maxDx = Math.max(centerX, window.innerWidth - centerX);
      const maxDy = Math.max(centerY, window.innerHeight - centerY);
      const scaleX = (maxDx * 2.2) / finalW;
      const scaleY = (maxDy * 2.2) / finalH;
      const startScale = Math.min(3.6, Math.max(scaleX, scaleY, 2.2));

      const initW = finalW * startScale;
      const initH = finalH * startScale;
      const initX = centerX - initW / 2;
      const initY = centerY - initH / 2;
      const initR = finalR * 2.2;

      core.setAttribute('x', initX.toFixed(1));
      core.setAttribute('y', initY.toFixed(1));
      core.setAttribute('width', initW.toFixed(1));
      core.setAttribute('height', initH.toFixed(1));
      core.setAttribute('rx', initR.toFixed(1));
      core.setAttribute('ry', initR.toFixed(1));

      const initFadePad = 8;
      fade.setAttribute('x', (initX - initFadePad).toFixed(1));
      fade.setAttribute('y', (initY - initFadePad).toFixed(1));
      fade.setAttribute('width', (initW + initFadePad * 2).toFixed(1));
      fade.setAttribute('height', (initH + initFadePad * 2).toFixed(1));
      fade.setAttribute('rx', (initR + 2).toFixed(1));
      fade.setAttribute('ry', (initR + 2).toFixed(1));

      svg.style.transition = 'none';
      svg.classList.add('active');
      svg.style.visibility = 'visible';
      svg.style.opacity = '1';

      const animDuration = 420;
      const startTime = performance.now();

      const stepAnim = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / animDuration);
        const ease = 1 - Math.pow(1 - progress, 3);
        const scale = startScale * (1 - ease) + 1.0 * ease;

        const curW = finalW * scale;
        const curH = finalH * scale;
        const curX = centerX - curW / 2;
        const curY = centerY - curH / 2;
        const curR = finalR * (1 + (1.2 * (1 - ease)));

        core.setAttribute('x', curX.toFixed(1));
        core.setAttribute('y', curY.toFixed(1));
        core.setAttribute('width', curW.toFixed(1));
        core.setAttribute('height', curH.toFixed(1));
        core.setAttribute('rx', curR.toFixed(1));
        core.setAttribute('ry', curR.toFixed(1));

        const fadePad = 5 + (3 * (1 - ease));
        fade.setAttribute('x', (curX - fadePad).toFixed(1));
        fade.setAttribute('y', (curY - fadePad).toFixed(1));
        fade.setAttribute('width', (curW + fadePad * 2).toFixed(1));
        fade.setAttribute('height', (curH + fadePad * 2).toFixed(1));
        fade.setAttribute('rx', (curR + 2).toFixed(1));
        fade.setAttribute('ry', (curR + 2).toFixed(1));

        if (progress < 1) {
          this._entranceRaf = requestAnimationFrame(stepAnim);
        } else {
          this._entranceRaf = null;
          this.isEntranceAnimating = false;

          // Fresh rect measurement at animation completion to eliminate scroll/layout shifts
          let freshRect = null;
          if (Array.isArray(targetEl)) {
            const valid = targetEl.map(el => (el && el.offsetParent !== null ? el.getBoundingClientRect() : null)).filter(Boolean);
            if (valid.length > 0) freshRect = valid[0];
          } else if (targetEl && targetEl.getBoundingClientRect) {
            freshRect = targetEl.getBoundingClientRect();
          }
          const actualRect = (freshRect && freshRect.width > 0 && freshRect.height > 0) ? freshRect : rect;
          const freshX = Math.round(actualRect.left - padX);
          const freshY = Math.round(actualRect.top - padY);
          const freshW = Math.round(actualRect.width + padX * 2);
          const freshH = Math.round(actualRect.height + padY * 2);

          core.setAttribute('x', freshX);
          core.setAttribute('y', freshY);
          core.setAttribute('width', freshW);
          core.setAttribute('height', freshH);
          core.setAttribute('rx', finalR);
          core.setAttribute('ry', finalR);

          fade.setAttribute('x', freshX - 5);
          fade.setAttribute('y', freshY - 5);
          fade.setAttribute('width', freshW + 10);
          fade.setAttribute('height', freshH + 10);
          fade.setAttribute('rx', finalR + 2);
          fade.setAttribute('ry', finalR + 2);

          if (onComplete) onComplete();
          requestAnimationFrame(() => this.repositionCurrentStep(true));
          setTimeout(() => this.repositionCurrentStep(true), 120);
        }
      };

      this._entranceRaf = requestAnimationFrame(stepAnim);
    },

    pointMouseAt(targetEl, options = {}) {
      if (!targetEl || !this.activeTour) {
        if (options.callback) options.callback();
        return;
      }
      let cursor = document.getElementById('crit-bot-cursor');
      if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'crit-bot-cursor';
        document.body.appendChild(cursor);
      } else if (cursor.parentElement !== document.body) {
        document.body.appendChild(cursor);
      }

      // Render sleek vector cursor for desktop, and luminous touch circle indicator for mobile
      if (!cursor.querySelector('.crit-bot-pointer-svg') || !cursor.querySelector('.crit-bot-mobile-circle')) {
        cursor.innerHTML = `
          <svg class="crit-bot-pointer-svg" width="34" height="34" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 5 4 L 22.5 15.5 L 14.5 17 L 9 24 Z" 
                  fill="rgba(240, 165, 0, 0.35)" 
                  stroke="#f0a500" 
                  stroke-width="2.6" 
                  stroke-linecap="round" 
                  stroke-linejoin="round" />
            <path d="M 7 6.5 L 17 13.5 L 12.8 14.3 L 9.5 18.5 Z" 
                  fill="#ffffff" 
                  opacity="0.9" />
          </svg>
          <div class="crit-bot-mobile-circle">
            <div class="crit-bot-touch-ripple"></div>
            <div class="crit-bot-touch-ring"></div>
            <div class="crit-bot-touch-core"></div>
          </div>
        `;
      }

      const isMobile = window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      if (isMobile) {
        cursor.classList.add('is-mobile-cursor');
        cursor.classList.remove('is-desktop-cursor');
      } else {
        cursor.classList.add('is-desktop-cursor');
        cursor.classList.remove('is-mobile-cursor');
      }

      let rect = null;
      if (Array.isArray(targetEl)) {
        const valid = targetEl.map(el => (el && el.offsetParent !== null ? el.getBoundingClientRect() : null)).filter(Boolean);
        if (valid.length > 0) rect = valid[0];
      } else if (targetEl.getBoundingClientRect) {
        rect = targetEl.getBoundingClientRect();
      }

      if (!rect || rect.width <= 0 || rect.height <= 0) {
        if (options.callback) options.callback();
        return;
      }

      const isInput = targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA' || targetEl.tagName === 'SELECT';
      let targetX, targetY;
      if (isInput) {
        targetX = Math.round(rect.left + Math.min(28, Math.max(12, rect.width * 0.15)));
        targetY = Math.round(rect.top + (rect.height / 2));
      } else {
        targetX = Math.round(rect.left + (rect.width / 2));
        targetY = Math.round(rect.top + (rect.height / 2));
      }

      // Hotspot offset:
      // PC Desktop mouse cursor: apex tip is at (5, 4)
      // Mobile touch circle cursor: center of 32x32 circle is at (16, 16)
      const tipOffsetX = isMobile ? 16 : 5;
      const tipOffsetY = isMobile ? 16 : 4;

      // Ensure cursor is strictly at the top-most z-index and GPU-positioned at top:0, left:0
      cursor.style.setProperty('z-index', '2147483647', 'important');
      cursor.style.setProperty('position', 'fixed', 'important');
      cursor.style.setProperty('top', '0', 'important');
      cursor.style.setProperty('left', '0', 'important');
      cursor.style.setProperty('margin', '0', 'important');
      cursor.style.setProperty('pointer-events', 'none', 'important');

      const targetXFinal = targetX - tipOffsetX;
      const targetYFinal = targetY - tipOffsetY;

      if (options.instant) {
        cursor.style.transition = 'none';
        cursor.style.transform = `translate3d(${targetXFinal.toFixed(1)}px, ${targetYFinal.toFixed(1)}px, 0)`;
        cursor.style.display = 'block';
        cursor.style.visibility = 'visible';
        cursor.style.opacity = '1';
        cursor.classList.add('active', 'visible');
        this._cursorPos = { x: targetX, y: targetY };
        if (options.callback) options.callback();
        return;
      }

      let startX = targetX;
      let startY = targetY;
      if (options.startPos && typeof options.startPos.x === 'number') {
        startX = options.startPos.x;
        startY = options.startPos.y;
      } else if (this._cursorPos) {
        startX = this._cursorPos.x;
        startY = this._cursorPos.y;
      } else {
        startX = Math.round(window.innerWidth * 0.5);
        startY = Math.round(window.innerHeight * 0.4);
      }

      const startXFinal = startX - tipOffsetX;
      const startYFinal = startY - tipOffsetY;

      // Cancel any prior animation or timers
      if (cursor._anim) {
        try { cursor._anim.cancel(); } catch (e) { }
        cursor._anim = null;
      }
      if (cursor._spawnTimer) {
        clearTimeout(cursor._spawnTimer);
        cursor._spawnTimer = null;
      }

      // Cursor is made visible immediately at start position
      cursor.style.transition = 'none';
      cursor.style.transform = `translate3d(${startXFinal.toFixed(1)}px, ${startYFinal.toFixed(1)}px, 0)`;
      cursor.style.display = 'block';
      cursor.style.visibility = 'visible';
      cursor.style.opacity = '1';
      cursor.classList.add('active', 'visible');
      cursor.classList.remove('clicking');

      const duration = options.duration || this.cursorDuration || 1150;

      // Web Animations API: executes on compositor thread on frame 0 with zero delay
      if (typeof cursor.animate === 'function') {
        cursor.style.transform = `translate3d(${targetXFinal.toFixed(1)}px, ${targetYFinal.toFixed(1)}px, 0)`;
        const anim = cursor.animate([
          { transform: `translate3d(${startXFinal.toFixed(1)}px, ${startYFinal.toFixed(1)}px, 0)` },
          { transform: `translate3d(${targetXFinal.toFixed(1)}px, ${targetYFinal.toFixed(1)}px, 0)` }
        ], {
          duration: duration,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards'
        });

        cursor._anim = anim;
        this._cursorPos = { x: targetX, y: targetY };

        anim.onfinish = () => {
          cursor._anim = null;
          cursor.style.transform = `translate3d(${targetXFinal.toFixed(1)}px, ${targetYFinal.toFixed(1)}px, 0)`;
          if (typeof options.callback === 'function') {
            options.callback();
          }
        };
      } else {
        cursor.style.transition = `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        cursor.style.transform = `translate3d(${targetXFinal.toFixed(1)}px, ${targetYFinal.toFixed(1)}px, 0)`;
        this._cursorPos = { x: targetX, y: targetY };
        cursor._spawnTimer = setTimeout(() => {
          cursor._spawnTimer = null;
          if (typeof options.callback === 'function') {
            options.callback();
          }
        }, duration);
      }
    },

    animateMouseToElement(targetEl, callback, customStartPos = null, options = {}) {
      if (!targetEl) {
        if (callback) callback();
        return;
      }
      let startPos = customStartPos;
      if (!startPos) {
        const tRect = targetEl.getBoundingClientRect();
        const targetCenterX = tRect.left + tRect.width / 2;
        const targetCenterY = tRect.top + tRect.height / 2;
        let randX, randY, dist;
        let attempts = 0;
        do {
          randX = Math.round(window.innerWidth * (0.15 + Math.random() * 0.7));
          randY = Math.round(window.innerHeight * (0.18 + Math.random() * 0.6));
          dist = Math.hypot(randX - targetCenterX, randY - targetCenterY);
          attempts++;
        } while (dist < 260 && attempts < 12);
        startPos = { x: randX, y: randY };
      }

      // Smooth natural speed: 1150ms
      const duration = options.duration || this.cursorDuration || 1150;

      this.pointMouseAt(targetEl, {
        startPos: startPos,
        duration: duration,
        callback: () => {
          const cursor = document.getElementById('crit-bot-cursor');
          if (cursor) cursor.classList.add('clicking');
          targetEl.classList.add('crit-btn-tactile-click');

          // Tactile click down for 150ms then callback
          setTimeout(() => {
            targetEl.classList.remove('crit-btn-tactile-click');
            if (cursor) {
              cursor.classList.remove('clicking', 'active', 'visible');
              cursor.style.opacity = '0';
              cursor.style.display = 'none';
              cursor.style.visibility = 'hidden';
            }
            if (callback) callback();
          }, 150);
        }
      });
    },

    clickRealNextWithMouse(nextBtnSelector, callback, customStartPos = null) {
      const realNextBtn = document.querySelector(nextBtnSelector);
      if (!realNextBtn) {
        if (callback) callback();
        return;
      }

      this.isClickingNextWithMouse = true;

      // Bring button cleanly into view if near boundary without smooth-scroll lag
      const bRectInitial = realNextBtn.getBoundingClientRect();
      const inView = bRectInitial.top >= 20 && bRectInitial.bottom <= (window.innerHeight - 20);
      if (!inView) {
        try { realNextBtn.scrollIntoView({ behavior: 'auto', block: 'nearest' }); } catch (e) { }
      }

      // Preserve previous styles to restore cleanly after click
      const origPointerEvents = realNextBtn.style.pointerEvents;
      const origBoxShadow = realNextBtn.style.boxShadow;
      const origOpacity = realNextBtn.style.opacity;
      const origBackground = realNextBtn.style.background;
      const origColor = realNextBtn.style.color;

      // Color the Next button with normal color (#f0a500, black text, opacity 1, no glow)
      realNextBtn.disabled = false;
      realNextBtn.style.pointerEvents = 'none'; // Unclickable by manual user clicks during bot glide!
      realNextBtn.style.cursor = 'default';
      realNextBtn.style.opacity = '1';
      realNextBtn.style.background = '#f0a500';
      realNextBtn.style.backgroundColor = '#f0a500';
      realNextBtn.style.color = '#000000';
      realNextBtn.style.filter = 'none';
      realNextBtn.style.boxShadow = 'none';

      // Hide commentary card while bot-mouse clicks
      if (this.cardEl) {
        this.cardEl.classList.remove('active');
        this.cardEl.style.opacity = '0';
        this.cardEl.style.pointerEvents = 'none';
      }

      // Small focus cutout on the Next button itself
      if (this.activeTargetEl) {
        if (Array.isArray(this.activeTargetEl)) {
          this.activeTargetEl.forEach(el => el?.classList?.remove('crit-tour-target-active'));
        } else {
          this.activeTargetEl?.classList?.remove('crit-tour-target-active');
        }
      }
      this.activeTargetEl = realNextBtn;
      realNextBtn.classList.add('crit-tour-target-active');

      const bRect = realNextBtn.getBoundingClientRect();
      if (bRect && bRect.width > 0) {
        const padX = 14;
        const padY = 8;

        const coreX = Math.round(bRect.left - padX);
        const coreY = Math.round(bRect.top - padY);
        const coreW = Math.round(bRect.width + (padX * 2));
        const coreH = Math.round(bRect.height + (padY * 2));

        // Rectangular container with deeply curved corners
        const coreR = Math.max(14, Math.min(24, Math.round(coreH * 0.36)));

        const fadePad = 5;
        const fadeX = Math.round(coreX - fadePad);
        const fadeY = Math.round(coreY - fadePad);
        const fadeW = Math.round(coreW + (fadePad * 2));
        const fadeH = Math.round(coreH + (fadePad * 2));
        const fadeR = Math.round(coreR + 2);

        const core = this.maskCore || document.getElementById('crit-mask-core');
        if (core) {
          core.setAttribute('x', coreX);
          core.setAttribute('y', coreY);
          core.setAttribute('width', coreW);
          core.setAttribute('height', coreH);
          core.setAttribute('rx', coreR);
          core.setAttribute('ry', coreR);
        }
        const fade = this.maskFade || document.getElementById('crit-mask-fade');
        if (fade) {
          fade.setAttribute('x', fadeX);
          fade.setAttribute('y', fadeY);
          fade.setAttribute('width', fadeW);
          fade.setAttribute('height', fadeH);
          fade.setAttribute('rx', fadeR);
          fade.setAttribute('ry', fadeR);
        }
      }

      document.getElementById('crit-spotlight-container')?.remove();

      if (this.overlayEl) {
        this.overlayEl.classList.add('active');
        this.overlayEl.style.opacity = '1';
        this.overlayEl.style.visibility = 'visible';
      }

      let startPos = customStartPos;
      if (!startPos) {
        const nextBtn = document.getElementById('crit-tour-next-btn');
        if (nextBtn) {
          const nbRect = nextBtn.getBoundingClientRect();
          startPos = { x: Math.round(nbRect.left + nbRect.width / 2), y: Math.round(nbRect.top + nbRect.height / 2) };
        }
      }

      // Glide crit-mouse directly to realNextBtn and click it smoothly at relaxed elegant speed
      this.pointMouseAt(realNextBtn, {
        startPos: startPos,
        duration: this.cursorDuration || 1150,
        callback: () => {
          const cursor = document.getElementById('crit-bot-cursor');
          if (cursor) cursor.classList.add('clicking');
          realNextBtn.classList.add('crit-btn-tactile-click');
          realNextBtn.style.transform = 'scale(0.93)';
          realNextBtn.style.filter = 'brightness(1.2)';
          realNextBtn.style.boxShadow = '0 0 25px rgba(240, 165, 0, 0.85)';
          realNextBtn.style.transition = 'transform 0.08s ease, filter 0.08s ease, box-shadow 0.08s ease';

          setTimeout(() => {
            realNextBtn.classList.remove('crit-btn-tactile-click');
            realNextBtn.style.transform = '';
            realNextBtn.style.filter = '';
            realNextBtn.style.boxShadow = '';
            if (cursor) {
              cursor.classList.remove('clicking', 'active', 'visible');
              cursor.style.opacity = '0';
              cursor.style.display = 'none';
              cursor.style.visibility = 'hidden';
            }

            const isSubmit = realNextBtn.id === 'submit-btn' || (nextBtnSelector && nextBtnSelector.includes('submit'));
            if (isSubmit) {
              this.hideTooltipAndOverlay();
              if (this.overlayEl) {
                this.overlayEl.style.display = 'none';
                this.overlayEl.classList.remove('active');
              }
              const svg = document.getElementById('crit-spotlight-svg');
              if (svg) {
                svg.style.display = 'none';
                svg.classList.remove('active');
              }
              if (typeof window.submitProject === 'function') {
                window.submitProject();
              } else {
                realNextBtn.click();
              }
            } else if (typeof window.nextStep === 'function') {
              window.nextStep(true);
            } else {
              realNextBtn.click();
            }

            setTimeout(() => {
              this.isClickingNextWithMouse = false;
              realNextBtn.classList.remove('crit-tour-target-active');
              realNextBtn.style.pointerEvents = origPointerEvents;
              realNextBtn.style.boxShadow = origBoxShadow;
              realNextBtn.style.opacity = origOpacity;
              realNextBtn.style.background = origBackground;
              realNextBtn.style.color = origColor;
              if (callback) callback();
            }, 80);
          }, 70);
        }
      });
    },

    smoothScrollToTarget(targetEl, callback, block = 'center') {
      if (!targetEl) {
        if (callback) callback();
        return;
      }

      this.unlockScroll();

      let layoutAttempts = 0;
      const executeScroll = () => {
        const isMobile = window.innerWidth <= 600;
        const cardHeight = isMobile ? 155 : 180;
        let rect = targetEl.getBoundingClientRect();

        // If target element is not yet measured (container just became visible), wait up to 8 animation frames
        if ((rect.width === 0 || rect.height === 0) && layoutAttempts < 8) {
          layoutAttempts++;
          requestAnimationFrame(executeScroll);
          return;
        }

        const isAlreadyVisible = (block === 'progress-visible')
          ? (rect.top >= 180 && rect.bottom <= window.innerHeight - 40)
          : (rect.top >= 50 && rect.bottom <= window.innerHeight - cardHeight - 14);

        if (isAlreadyVisible) {
          this.lockScroll();
          if (callback) callback();
          requestAnimationFrame(() => this.repositionCurrentStep(true));
          setTimeout(() => this.repositionCurrentStep(true), 80);
          return;
        }

        // Check if Lenis is active on window (e.g. index.html)
        if (window.lenis && typeof window.lenis.scrollTo === 'function') {
          let offset;
          if (block === 'progress-visible') {
            offset = -250;
          } else if (block === 'start') {
            offset = -95;
          } else {
            offset = -Math.max(60, Math.round((window.innerHeight - rect.height - 180) / 2));
          }
          let completed = false;
          const done = () => {
            if (completed) return;
            completed = true;
            this.lockScroll();
            if (callback) callback();
            requestAnimationFrame(() => this.repositionCurrentStep(true));
          };
          setTimeout(done, 520);
          window.lenis.scrollTo(targetEl, {
            offset: offset,
            duration: 0.45,
            lock: false,
            onComplete: done
          });
          return;
        }

        // Native smooth scroll fallback for pages without Lenis (e.g. submit.html)
        let targetY;
        if (isMobile) {
          targetY = window.pageYOffset + rect.top - 58;
        } else if (block === 'progress-visible') {
          targetY = window.pageYOffset + rect.top - 250;
        } else if (block === 'start') {
          targetY = window.pageYOffset + rect.top - 95;
        } else {
          targetY = window.pageYOffset + rect.top - Math.max(60, Math.round((window.innerHeight - rect.height - 180) / 2));
        }

        const clampedTargetY = Math.max(0, targetY);
        if (Math.abs(window.pageYOffset - clampedTargetY) <= 3) {
          this.lockScroll();
          if (callback) callback();
          requestAnimationFrame(() => this.repositionCurrentStep(true));
          setTimeout(() => this.repositionCurrentStep(true), 120);
          return;
        }

        window.scrollTo({
          top: clampedTargetY,
          behavior: 'smooth'
        });

        let checkCount = 0;
        let stationaryCount = 0;
        let lastY = window.pageYOffset;
        const startTime = performance.now();

        const checkScroll = () => {
          checkCount++;
          const currentY = window.pageYOffset;
          const distFromTarget = Math.abs(currentY - clampedTargetY);
          const delta = Math.abs(currentY - lastY);

          if (this.activeTargetEl) {
            this.repositionCurrentStep(true);
          }

          if (delta < 2) {
            stationaryCount++;
          } else {
            stationaryCount = 0;
          }

          const elapsed = performance.now() - startTime;
          if ((distFromTarget <= 4 && checkCount >= 2) || (stationaryCount >= 3 && elapsed > 120) || elapsed > 650) {
            this.lockScroll();
            if (callback) callback();
            requestAnimationFrame(() => this.repositionCurrentStep(true));
            setTimeout(() => this.repositionCurrentStep(true), 80);
            setTimeout(() => this.repositionCurrentStep(true), 320);
            return;
          }

          lastY = currentY;
          requestAnimationFrame(checkScroll);
        };

        requestAnimationFrame(checkScroll);
      };

      executeScroll();
    },

    setStep4FieldsDisabled(activeField) {
      const countryGroup = document.getElementById('country')?.closest('.form-group');
      const deadlineGroup = document.getElementById('form-group-deadline') || document.getElementById('deadline')?.closest('.form-group');
      const previewGroup = document.getElementById('form-group-preview') || document.getElementById('preview-chip')?.closest('.form-group');
      const budgetGroup = document.getElementById('form-group-budget') || document.getElementById('budget')?.closest('.form-group');
      const aiGroup = document.getElementById('form-group-ai') || document.querySelector('.ai-section');
      const realNextBtn = document.querySelector('#step-4 .btn-primary');

      const allGroups = [
        { key: 'country', el: countryGroup },
        { key: 'deadline', el: deadlineGroup },
        { key: 'preview', el: previewGroup },
        { key: 'budget', el: budgetGroup },
        { key: 'ai', el: aiGroup }
      ];

      allGroups.forEach(item => {
        if (!item.el) return;
        if (activeField === 'all' || item.key === activeField) {
          item.el.style.pointerEvents = 'auto';
          item.el.style.opacity = '1';
        } else {
          item.el.style.pointerEvents = 'none';
          item.el.style.opacity = '0.35';
        }
      });

      if (realNextBtn) {
        if (activeField === 'all' || activeField === 'finish') {
          realNextBtn.style.pointerEvents = 'auto';
          realNextBtn.style.opacity = '1';
        } else {
          realNextBtn.style.pointerEvents = 'none';
          realNextBtn.style.opacity = '0.35';
        }
      }
    },

    startInteractiveBuild(resumeStepId = null) {
      this._checkedPendingTour = true;
      if (this._pendingTourTimer) {
        clearTimeout(this._pendingTourTimer);
        this._pendingTourTimer = null;
      }
      this.init();
      const currentPath = window.location.pathname.toLowerCase().replace(/\/index\.html$/, '/');
      const isHome = currentPath === '/' || currentPath === '' || currentPath.endsWith('index.html') || currentPath === '/index' || currentPath.endsWith('/index');
      const isSubmit = currentPath.includes('submit');

      // If user is outside the task (e.g. in profile.html, dashboard.html, settings.html, critspace.html, etc.), redirect to home or submit
      if (!isHome && !isSubmit) {
        try {
          sessionStorage.setItem('crit_pending_interactive_build', 'true');
          sessionStorage.setItem('crit_active_task', JSON.stringify({
            tourId: 'interactive-build',
            stepId: resumeStepId || 'home-start',
            timestamp: Date.now()
          }));
        } catch (e) { }
        window.location.href = '/?tour=interactive-build';
        return;
      }

      if (isHome) {
        if (resumeStepId && resumeStepId !== 'home-start') {
          window.location.href = '/submit?tour=interactive-build';
          return;
        }

        const bubble = document.getElementById('crit-bubble');
        if (bubble) {
          bubble.classList.remove('open');
          bubble.classList.add('crit-tour-hidden');
          bubble.style.display = 'none';
        }
        chatState.isOpen = false;
        saveLocalState();

        this.unlockScroll();
        this.runInteractiveStep('home-start');
        return;
      }

      // We are on submit page inside the task: continue from current or saved section!
      const bubble = document.getElementById('crit-bubble');
      if (bubble) {
        bubble.classList.remove('open');
        bubble.classList.add('crit-tour-hidden');
        bubble.style.display = 'none';
      }
      chatState.isOpen = false;
      saveLocalState();

      // Ensure submit page is accessible (guest bypass if auth-gate is open during demo)
      const authGate = document.getElementById('auth-gate');
      const main = document.getElementById('main-container');
      if (authGate && authGate.classList.contains('open')) {
        if (typeof window.continueAsGuest === 'function') {
          try { window.continueAsGuest(); } catch (e) { }
        }
        authGate.classList.remove('open');
        if (main) main.style.display = 'block';
      }

      // Check which section is active on submit page to continue from there
      let activeStep = 1;
      if (isSubmit) {
        // ALWAYS prioritize the currently visible section on submit page
        if (typeof window.currentStep === 'number' && window.currentStep >= 1 && window.currentStep <= 5) {
          activeStep = window.currentStep;
        } else {
          for (let s = 1; s <= 5; s++) {
            const el = document.getElementById(`step-${s}`);
            if (el && el.classList.contains('active')) {
              activeStep = s;
              break;
            }
          }
        }
      } else if (resumeStepId) {
        if (typeof resumeStepId === 'number') activeStep = resumeStepId;
        else if (resumeStepId === '3-desc' || resumeStepId === '3-files' || resumeStepId === '3-github') activeStep = 3;
        else if (typeof resumeStepId === 'string' && resumeStepId.startsWith('4-')) activeStep = 4;
        else if (resumeStepId === 5 || resumeStepId === '5-terms' || resumeStepId === '5-submit') activeStep = 5;
      }

      const stepMapping = {
        1: 1,
        2: 2,
        3: '3-desc',
        '3-desc': '3-desc',
        '3-files': '3-files',
        '3-github': '3-github',
        4: '4-country',
        '4-country': '4-country',
        '4-deadline': '4-deadline',
        '4-budget': '4-budget',
        '4-ai': '4-ai',
        '4-preview': '4-preview',
        5: '5-terms',
        '5-terms': '5-terms',
        '5-submit': '5-submit'
      };

      let startStepId = null;
      if (isSubmit) {
        // If resumeStepId matches current section, use it; otherwise start from the active section's first step
        const resumeSection = (typeof resumeStepId === 'number') ? resumeStepId : (
          typeof resumeStepId === 'string' && resumeStepId.startsWith('3-') ? 3 : (
            typeof resumeStepId === 'string' && resumeStepId.startsWith('4-') ? 4 : (
              typeof resumeStepId === 'string' && resumeStepId.startsWith('5-') ? 5 : null
            )
          )
        );
        if (resumeSection === activeStep && resumeStepId && stepMapping[resumeStepId]) {
          startStepId = resumeStepId;
        } else {
          startStepId = stepMapping[activeStep] || 1;
        }
      } else if (isHome) {
        startStepId = 'home-start';
      } else {
        startStepId = resumeStepId || 1;
      }

      try {
        if (isSubmit) sessionStorage.removeItem('crit_from_home_start');
        sessionStorage.setItem('crit_active_task', JSON.stringify({
          tourId: 'interactive-build',
          stepId: startStepId,
          timestamp: Date.now()
        }));
      } catch (e) { }

      let attempts = 0;
      const checkSubmitReady = () => {
        attempts++;
        const mainEl = document.getElementById('main-container');
        const gateEl = document.getElementById('auth-gate');

        if (gateEl && gateEl.classList.contains('open')) {
          if (typeof window.continueAsGuest === 'function') {
            try { window.continueAsGuest(); } catch (e) { }
          }
          gateEl.classList.remove('open');
          if (mainEl) mainEl.style.display = 'block';
        }

        const isMainVisible = mainEl && (window.getComputedStyle(mainEl).display !== 'none' || mainEl.style.display === 'block');

        if (isMainVisible) {
          if (typeof window.goToStep === 'function' && activeStep >= 1 && activeStep <= 5) {
            try {
              window.goToStep(activeStep, true, false);
            } catch (e) { }
          }
          setTimeout(() => this.runInteractiveStep(startStepId), 150);
          return;
        }

        if (attempts < 60) {
          setTimeout(checkSubmitReady, 60);
        } else {
          if (mainEl) mainEl.style.display = 'block';
          if (typeof window.goToStep === 'function' && activeStep >= 1 && activeStep <= 5) {
            try { window.goToStep(activeStep, true); } catch (e) { }
          }
          setTimeout(() => this.runInteractiveStep(startStepId), 220);
        }
      };
      checkSubmitReady();
    },

    runInteractiveStep(stepId) {
      this.init();
      this.activeTour = { id: 'interactive-build', title: 'Interactive Build' };
      document.body.classList.add('crit-tour-active');

      // Guarantee that the page container matching this step is active and rendered
      const stepContainerMap = {
        1: 1,
        2: 2,
        '3-desc': 3,
        '3-files': 3,
        '3-github': 3,
        '4-country': 4,
        '4-deadline': 4,
        '4-budget': 4,
        '4-ai': 4,
        '4-preview': 4,
        '4-finish': 4,
        5: 5,
        '5-terms': 5,
        '5-submit': 5
      };
      const neededSection = stepContainerMap[stepId];
      if (neededSection && typeof window.goToStep === 'function') {
        if (window.currentStep !== neededSection) {
          window.goToStep(neededSection, true, false);
        }
      }
      try {
        sessionStorage.setItem('crit_active_task', JSON.stringify({
          tourId: 'interactive-build',
          stepId: stepId,
          timestamp: Date.now()
        }));
      } catch (e) { }

      // Keep crit-mouse cursor hidden on step start until user triggers movement
      const existingCursor = document.getElementById('crit-bot-cursor');
      if (existingCursor) {
        existingCursor.classList.remove('active', 'visible', 'clicking');
        existingCursor.style.display = 'none';
        existingCursor.style.opacity = '0';
        existingCursor.style.visibility = 'hidden';
      }
      this._cursorPos = null;
      this.isClickingNextWithMouse = false;

      if (stepId === 'home-start') {
        this.currentInteractiveStep = 'home-start';
        const heroStart = document.getElementById('hero-start-btn');
        const heroSignup = document.getElementById('hero-signup-btn');
        let targetEl = heroStart || heroSignup || document.querySelector('.hero-actions .btn-primary');
        if (heroStart) {
          heroStart.style.setProperty('display', 'inline-flex', 'important');
          heroStart.style.setProperty('opacity', '1', 'important');
          heroStart.style.setProperty('visibility', 'visible', 'important');
          heroStart.style.setProperty('pointer-events', 'auto', 'important');
          targetEl = heroStart;
          if (heroSignup) heroSignup.style.setProperty('display', 'none', 'important');
        } else if (heroSignup) {
          heroSignup.style.setProperty('display', 'inline-flex', 'important');
          targetEl = heroSignup;
        }
        this.activeTargetEl = targetEl;

        // Direct click fallback during demo
        const handleDirectHeroClick = (e) => {
          if (this.currentInteractiveStep === 'home-start') {
            e.preventDefault();
            e.stopPropagation();
            try {
              sessionStorage.setItem('crit_pending_interactive_build', 'true');
              sessionStorage.setItem('crit_from_home_start', 'true');
              sessionStorage.setItem('crit_active_task', JSON.stringify({
                tourId: 'interactive-build',
                stepId: 1,
                timestamp: Date.now()
              }));
            } catch (err) { }
            window.location.href = '/submit?tour=interactive-build';
          }
        };
        targetEl?.addEventListener('click', handleDirectHeroClick, true);

        // Auto-scroll so target is centered, then lock scroll and trigger shadow envelope animation
        this.smoothScrollToTarget(targetEl, () => {
          this.lockScroll();
          this.animateSpotlightEntrance(targetEl, () => {
            this.highlightInteractiveTarget(
              targetEl,
              'Start Your Project',
              'Click **Next →** to begin your project setup. I will guide you step-by-step through the submission brief.',
              {
                nextText: 'Next →',
                onNext: () => {
                  if (this.isTransitioning) return;

                  // Capture Next button center coordinate IMMEDIATELY before card styles change
                  const nextButton = document.getElementById('crit-tour-next-btn');
                  const nextRect = nextButton ? nextButton.getBoundingClientRect() : null;
                  const startPos = nextRect && nextRect.width > 0
                    ? { x: Math.round(nextRect.left + nextRect.width / 2), y: Math.round(nextRect.top + nextRect.height / 2) }
                    : null;

                  this.blockUserInteraction(true);

                  // Keep session storage intact so submit.html immediately knows it is part of the demo
                  try {
                    sessionStorage.setItem('criteria_guest_creator', 'true');
                    sessionStorage.setItem('crit_pending_interactive_build', 'true');
                    sessionStorage.setItem('crit_from_home_start', 'true');
                    sessionStorage.setItem('crit_active_task', JSON.stringify({
                      tourId: 'interactive-build',
                      stepId: 1,
                      timestamp: Date.now()
                    }));
                  } catch (e) { }

                  // Smoothly fade out the tour card
                  if (this.cardEl) {
                    this.cardEl.style.transition = 'opacity 0.16s ease';
                    this.cardEl.style.opacity = '0';
                    this.cardEl.style.pointerEvents = 'none';
                  }

                  let navigated = false;
                  const navigateToSubmit = () => {
                    if (navigated) return;
                    navigated = true;
                    try {
                      sessionStorage.setItem('criteria_guest_creator', 'true');
                      sessionStorage.setItem('crit_pending_interactive_build', 'true');
                      sessionStorage.setItem('crit_from_home_start', 'true');
                      sessionStorage.setItem('crit_active_task', JSON.stringify({
                        tourId: 'interactive-build',
                        stepId: 1,
                        timestamp: Date.now()
                      }));
                    } catch (e) { }
                    window.location.href = '/submit.html?tour=interactive-build';
                  };

                  if (targetEl) {
                    this.pointMouseAt(targetEl, {
                      startPos,
                      duration: this.cursorDuration || 1150,
                      callback: () => {
                        const cursor = document.getElementById('crit-bot-cursor');
                        if (cursor) cursor.classList.add('clicking');

                        // Tactile physical button press down
                        targetEl.classList.add('crit-btn-tactile-click');
                        targetEl.style.transform = 'scale(0.94)';
                        targetEl.style.filter = 'brightness(1.2)';
                        targetEl.style.boxShadow = '0 0 25px rgba(240, 165, 0, 0.85)';

                        // Satisfying tactile feedback then seamless redirect
                        setTimeout(() => {
                          if (cursor) {
                            cursor.classList.remove('clicking', 'active', 'visible');
                            cursor.style.display = 'none';
                            cursor.style.opacity = '0';
                            cursor.style.visibility = 'hidden';
                          }
                          navigateToSubmit();
                        }, 150);
                      }
                    });
                  } else {
                    navigateToSubmit();
                  }

                  // Safety fallback timer
                  setTimeout(navigateToSubmit, 4000);
                }
              }
            );
          });
        }, 'center');
      } else if (stepId === 1) {
        // Step 1: Project Name (minimum 4 characters, input focused, Enter triggers crit-mouse to web Next button)
        this.currentInteractiveStep = 1;

        let userName = 'Creator';
        try {
          if (typeof auth !== 'undefined' && auth && auth.currentUser) {
            userName = auth.currentUser.displayName || (auth.currentUser.email ? auth.currentUser.email.split('@')[0] : '') || userName;
          } else if (window.auth && window.auth.currentUser) {
            userName = window.auth.currentUser.displayName || (window.auth.currentUser.email ? window.auth.currentUser.email.split('@')[0] : '') || userName;
          }
        } catch (e) { }

        const inputEl = document.getElementById('project-name');
        const targetEl = inputEl;

        const triggerStep1Next = (source) => {
          const val = inputEl ? inputEl.value.trim() : '';
          const nameCheck = isProjectNameClear(val);
          if (!nameCheck.valid) {
            const bodyEl = document.getElementById('crit-tour-body');
            if (bodyEl) {
              bodyEl.innerHTML = `<span style="color:#ef4444;font-weight:700;">⚠️ Project Name Needs Clarity</span><br><br>${nameCheck.reason}<br><br>Please type a clear, meaningful project name and press <strong>Enter ↵</strong> or tap <strong>Next →</strong>.`;
            }
            if (typeof window.showNotif === 'function') {
              window.showNotif(nameCheck.reason, 'error');
            }
            if (inputEl) {
              inputEl.focus();
              inputEl.classList.add('input-error');
              setTimeout(() => inputEl.classList.remove('input-error'), 2500);
            }
            return; // BLOCKED: User cannot move to next section
          }
          let startPos = null;
          if (source === 'input' && inputEl) {
            const iRect = inputEl.getBoundingClientRect();
            startPos = { x: Math.round(iRect.left + Math.min(100, iRect.width * 0.4)), y: Math.round(iRect.top + iRect.height / 2) };
          } else {
            const nextBtn = document.getElementById('crit-tour-next-btn');
            if (nextBtn) {
              const nbRect = nextBtn.getBoundingClientRect();
              startPos = { x: Math.round(nbRect.left + nbRect.width / 2), y: Math.round(nbRect.top + nbRect.height / 2) };
            }
          }
          cleanupStep1();
          // Crit-mouse appears, glides to web 'Next →' button, clicks it, and advances to step 2
          this.clickRealNextWithMouse('#step-1 .btn-primary, .btn-primary', () => {
            this.runInteractiveStep(2);
          }, startPos);
        };

        const handleNameEnter = (e) => {
          if (e.key === 'Enter' || e.keyCode === 13) {
            e.preventDefault();
            e.stopPropagation();
            triggerStep1Next('input');
          }
        };

        const handleGlobalEnter = (e) => {
          if ((e.key === 'Enter' || e.keyCode === 13) && this.currentInteractiveStep === 1) {
            e.preventDefault();
            e.stopPropagation();
            triggerStep1Next('input');
          }
        };

        const onNameInput = () => {
          // Keep description clean while typing; error is shown only on clicking Next
        };

        const cleanupStep1 = () => {
          this._cleanupStep = null;
          if (inputEl) {
            inputEl.classList.remove('crit-tour-target-active');
            inputEl.removeEventListener('keydown', handleNameEnter, true);
            inputEl.removeEventListener('input', onNameInput);
          }
          window.removeEventListener('keydown', handleGlobalEnter, true);
        };
        this._cleanupStep = cleanupStep1;

        if (inputEl) {
          inputEl.classList.add('crit-tour-target-active');
          inputEl.addEventListener('keydown', handleNameEnter, true);
          inputEl.addEventListener('input', onNameInput);
          setTimeout(() => inputEl.focus(), 50);
        }
        window.addEventListener('keydown', handleGlobalEnter, true);

        this.smoothScrollToTarget(targetEl, () => {
          this.lockScroll();
          // Shadow animation comes at the first with 15px pad near input from all sides
          this.animateSpotlightEntrance(targetEl, () => {
            this.highlightInteractiveTarget(
              targetEl,
              '1. Project Name',
              `👋 Welcome, **${userName}**! Please type a name for your project here (minimum 5 characters).\n\nPress **Enter ↵** on your keyboard or tap **Next →** below to continue.`,
              {
                nextText: 'Next →',
                onNext: () => triggerStep1Next('card')
              }
            );

            if (inputEl) {
              inputEl.classList.add('crit-tour-target-active');
              inputEl.focus();
              setTimeout(() => inputEl.focus(), 60);
              setTimeout(() => inputEl.focus(), 250);
            }
          }, 15, 12);
        }, 'center');
      } else if (stepId === 2) {
        // Step 2: Service Selection (SCROLLING ENABLED, spotlight fixed, shadow animation at entrance)
        this.currentInteractiveStep = 2;

        const typeGrid = document.querySelector('.type-grid');
        const targetEl = typeGrid || document.getElementById('step-2');

        this.smoothScrollToTarget(targetEl, () => {
          this.unlockScroll(); // Scrolling explicitly enabled!
          // Shadow animation at the first of step 2
          this.animateSpotlightEntrance(targetEl, () => {
            const curSelected = document.querySelector('.type-card.selected');
            const hasSelected = !!curSelected;
            const selectedName = curSelected?.dataset?.type || 'Service';

            this.highlightInteractiveTarget(
              targetEl,
              hasSelected ? '2. Service Selected' : '2. Project Type',
              hasSelected
                ? `✓ **${selectedName}** selected! Click **Next →** below to proceed to project description.`
                : `Select any service card below that matches your project (e.g. Websites, Video Editing, UI/Presentations).`,
              {
                prevText: '← Back',
                onPrev: () => {
                  this.unlockScroll();
                  if (typeof window.prevStep === 'function') window.prevStep();
                  this.runInteractiveStep(1);
                },
                nextText: 'Next →',
                hideNext: !hasSelected, // Only show Next if a card is selected!
                onNext: () => {
                  let card = document.querySelector('.type-card.selected');
                  if (!card) return;
                  const webNext = document.getElementById('next-btn-2') || document.querySelector('#step-2 .btn-primary');
                  if (webNext) webNext.disabled = false;
                  this.unlockScroll();
                  const nextBtn = document.getElementById('crit-tour-next-btn');
                  let startPos = null;
                  if (nextBtn) {
                    const nbRect = nextBtn.getBoundingClientRect();
                    startPos = { x: Math.round(nbRect.left + nbRect.width / 2), y: Math.round(nbRect.top + nbRect.height / 2) };
                  }
                  // When clicked, crit-mouse appears and clicks 'Next' in web page
                  this.clickRealNextWithMouse('#next-btn-2, #step-2 .btn-primary', () => {
                    const step3 = document.getElementById('step-3');
                    if (step3 && !step3.classList.contains('active')) {
                      if (typeof window.nextStep === 'function') window.nextStep(true);
                    }
                    setTimeout(() => {
                      this.runInteractiveStep('3-desc');
                    }, 120);
                  }, startPos);
                }
              }
            );
          }, 14, 20);
        }, 'start');

        document.querySelectorAll('.type-card').forEach(card => {
          card.style.pointerEvents = 'auto';
          const originalOnClick = card.onclick;
          card.onclick = (e) => {
            if (typeof originalOnClick === 'function') originalOnClick.call(card, e);
            if (typeof window.selectType === 'function') {
              window.selectType(card, card.dataset.type);
            }
            const titleEl = document.getElementById('crit-tour-title');
            const bodyEl = document.getElementById('crit-tour-body');
            if (titleEl) titleEl.textContent = '2. Service Selected';
            if (bodyEl) bodyEl.innerHTML = '<span style="color:#22c55e;font-weight:700;">✓ ' + (card.dataset.type || 'Service') + '</span> selected!<br>Click <strong>Next →</strong> below to describe your project.';
            const webNext = document.getElementById('next-btn-2') || document.querySelector('#step-2 .btn-primary');
            if (webNext) webNext.disabled = false;
            // Reveal Next button in comment box now that a card is selected!
            const tourNext = document.getElementById('crit-tour-next-btn');
            if (tourNext) {
              tourNext.style.display = 'inline-flex';
            }
            setTimeout(() => this.repositionCurrentStep(true), 60);
          };
        });
      } else if (stepId === 3 || stepId === '3-desc') {
        // Step 3A: Description part focused, scroll locked, min 20 chars typed + Enter or comment box Next scrolls to attachments
        this.currentInteractiveStep = '3-desc';

        const descEl = document.getElementById('project-description');
        const targetEl = descEl;

        const triggerStep3Next = async () => {
          const val = descEl ? descEl.value.trim() : '';
          const descCheck = isDescriptionClear(val);
          if (!descCheck.valid) {
            const bodyEl = document.getElementById('crit-tour-body');
            if (bodyEl) {
              bodyEl.innerHTML = `<span style="color:#ef4444;font-weight:700;">⚠️ Description Needs Clarity</span><br><br>${descCheck.reason}<br><br>Please describe your project vision, style, or goals clearly before proceeding.`;
            }
            if (typeof window.showNotif === 'function') {
              window.showNotif(descCheck.reason, 'error');
            }
            if (descEl) {
              descEl.focus();
              descEl.classList.add('input-error');
              setTimeout(() => descEl.focus(), 80);
              setTimeout(() => descEl.classList.remove('input-error'), 2500);
            }
            return; // BLOCKED: User cannot move to next section
          }
          if (typeof window.checkDescriptionWithGroq === 'function') {
            const groqCheck = await window.checkDescriptionWithGroq(val);
            if (!groqCheck.valid) {
              const bodyEl = document.getElementById('crit-tour-body');
              if (bodyEl) {
                bodyEl.innerHTML = `<span style="color:#ef4444;font-weight:700;">⚠️ Description Needs Clarity</span><br><br>${groqCheck.reason}<br><br>Please describe your project vision or deliverables clearly before proceeding.`;
              }
              if (typeof window.showNotif === 'function') {
                window.showNotif(groqCheck.reason, 'error');
              }
              if (descEl) {
                descEl.focus();
                descEl.classList.add('input-error');
                setTimeout(() => descEl.focus(), 80);
                setTimeout(() => descEl.classList.remove('input-error'), 3000);
              }
              return;
            }
          }
          cleanupStep3();
          this.runInteractiveStep('3-files');
        };

        const handleDescEnter = (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            triggerStep3Next();
          }
        };

        const onDescInput = () => {
          if (this.currentInteractiveStep !== '3-desc') return;
          const val = descEl ? descEl.value.trim() : '';
          const bodyEl = document.getElementById('crit-tour-body');
          if (bodyEl) {
            if (val.length >= 20) {
              bodyEl.innerHTML = `<span style="color:#22c55e;font-weight:700;">✓ Description looks great! (${val.length} chars)</span><br><br>Press <strong>Enter ↵</strong> on your keyboard or tap <strong>Next →</strong> below to proceed to attachments.`;
            } else if (val.length > 0) {
              bodyEl.innerHTML = `Please type at least <strong>20 characters</strong> (${val.length}/20).<br><br>Tell us your vision, style, and goals.`;
            }
          }
        };

        const cleanupStep3 = () => {
          this._cleanupStep = null;
          if (descEl) {
            descEl.classList.remove('crit-tour-target-active');
            descEl.removeEventListener('keydown', handleDescEnter, true);
            descEl.removeEventListener('input', onDescInput);
          }
        };
        this._cleanupStep = cleanupStep3;

        if (descEl) {
          descEl.classList.add('crit-tour-target-active');
          descEl.addEventListener('keydown', handleDescEnter, true);
          descEl.addEventListener('input', onDescInput);
          setTimeout(() => descEl.focus(), 50);
        }

        this.smoothScrollToTarget(targetEl, () => {
          this.lockScroll(); // Scrolling disabled!
          this.highlightInteractiveTarget(
            targetEl,
            '3A. Project Description',
            `Please describe your project vision, style, and goals (minimum 20 characters).\n\nType at least 20 characters and press **Enter ↵** or tap **Next →** to proceed to attachments.`,
            {
              prevText: '← Back',
              onPrev: () => {
                cleanupStep3();
                this.unlockScroll();
                if (typeof window.prevStep === 'function') window.prevStep();
                this.runInteractiveStep(2);
              },
              nextText: 'Next →',
              onNext: () => triggerStep3Next()
            }
          );
          if (descEl) {
            descEl.classList.add('crit-tour-target-active');
            descEl.focus();
            setTimeout(() => descEl.focus(), 80);
          }
        }, 'progress-visible');
      } else if (stepId === '3-files') {
        // Step 3B: Reference Files part focused, optional, Next moves to GitHub Repositories
        this.currentInteractiveStep = '3-files';

        const uploadZone = document.getElementById('upload-zone');
        const targetEl = uploadZone;
        if (uploadZone) {
          uploadZone.style.pointerEvents = 'auto';
          uploadZone.style.opacity = '1';
        }

        this.smoothScrollToTarget(targetEl, () => {
          this.lockScroll();
          this.highlightInteractiveTarget(
            targetEl,
            '3B. Reference Files & Moodboards (Optional)',
            `Upload reference images, design assets, or videos to guide the creative direction (optional).\n\nTap **Next →** to explore GitHub repository and UI component attachments.`,
            {
              prevText: '← Back',
              onPrev: () => this.runInteractiveStep('3-desc'),
              nextText: 'Next →',
              onNext: () => this.runInteractiveStep('3-github')
            }
          );
        }, 'center');
      } else if (stepId === '3-github') {
        // Step 3C: GitHub Repository & Component Attachment focused with full spotlight and explanation
        this.currentInteractiveStep = '3-github';

        const repoWrap = document.getElementById('form-group-github-repos');
        const targetEl = repoWrap || document.getElementById('upload-zone');
        if (repoWrap) {
          repoWrap.style.pointerEvents = 'auto';
          repoWrap.style.opacity = '1';
          if (typeof window.initGithubReposUI === 'function') {
            window.initGithubReposUI();
          }
        }

        this.smoothScrollToTarget(targetEl, () => {
          this.lockScroll();
          this.highlightInteractiveTarget(
            targetEl,
                        '3C. GitHub Repositories & UI Components (Optional)',
            `Select any code repository from the dropdown menu, then click **Attach Repo** or **Browse Files** to inspect folders and attach specific UI component files as reference.\n\nEverything is optional—tap **Next ➔** to proceed to budget & timeline.`,
            {
              prevText: '← Back',
              onPrev: () => this.runInteractiveStep('3-files'),
              nextText: 'Next →',
              onNext: () => {
                this.unlockScroll();
                const nextBtn = document.getElementById('crit-tour-next-btn');
                let startPos = null;
                if (nextBtn) {
                  const nbRect = nextBtn.getBoundingClientRect();
                  startPos = { x: Math.round(nbRect.left + nbRect.width / 2), y: Math.round(nbRect.top + nbRect.height / 2) };
                }
                // When clicked next in comment-box, crit-mouse clicks 'Next' in web page
                this.clickRealNextWithMouse('#step-3 .btn-primary', () => {
                  const step4 = document.getElementById('step-4');
                  if (step4 && !step4.classList.contains('active')) {
                    if (typeof window.nextStep === 'function') window.nextStep(true);
                  }
                  setTimeout(() => {
                    this.runInteractiveStep('4-country');
                  }, 120);
                }, startPos);
              }
            }
          );
        }, 'center');
      } else if (stepId === '4-country') {
        // Step 4A: Country focused, others disabled, scroll locked
        this.currentInteractiveStep = '4-country';
        this.setStep4FieldsDisabled('country');

        const countryEl = document.getElementById('country');
        const targetEl = document.getElementById('form-group-country') || countryEl?.closest('.form-group') || countryEl;

        this.smoothScrollToTarget(targetEl, () => {
          this.lockScroll();
          this.highlightInteractiveTarget(
            targetEl,
            '4A. Country & Currency',
            `Country sets your project billing currency (default: India - INR). If default is correct, click **Next →** below.`,
            {
              prevText: '← Back',
              onPrev: () => {
                this.unlockScroll();
                if (typeof window.prevStep === 'function') window.prevStep();
                setTimeout(() => this.runInteractiveStep('3-github'), 350);
              },
              nextText: 'Next →',
              onNext: () => this.runInteractiveStep('4-deadline')
            }
          );
        }, 'center');
      } else if (stepId === '4-deadline') {
        // Step 4B: Target deadline compulsory, minimum 3 days from today
        this.currentInteractiveStep = '4-deadline';
        this.setStep4FieldsDisabled('deadline');

        const deadlineEl = document.getElementById('deadline');
        const targetEl = document.getElementById('form-group-deadline') || deadlineEl?.closest('.form-group') || deadlineEl;

        this.smoothScrollToTarget(targetEl, () => {
          this.lockScroll();
          this.highlightInteractiveTarget(
            targetEl,
            '4B. Target Deadline (Compulsory)',
            `Select your target delivery deadline (required, minimum 3 days from today). Once chosen, click **Next →** below.`,
            {
              prevText: '← Back',
              onPrev: () => this.runInteractiveStep('4-country'),
              nextText: 'Next →',
              onNext: () => {
                const val = deadlineEl?.value;
                if (!val) {
                  const bodyEl = document.getElementById('crit-tour-body');
                  if (bodyEl) bodyEl.innerHTML = `<span style="color:#ef4444;font-weight:600;">⚠️ Please choose a deadline date!</span><br>Deadline is compulsory (minimum 3 days from today).`;
                  if (typeof window.showNotif === 'function') window.showNotif('Please choose a deadline date to proceed', 'error');
                  return;
                }
                const d = new Date(val + 'T00:00:00');
                const key = (typeof getTypeKey === 'function' && typeof projectData !== 'undefined') ? getTypeKey(projectData.type || '') : 'poster';
                const minDays = (key === 'website') ? 28 : 3;
                const min = new Date(); min.setDate(min.getDate() + minDays);
                if (d < min) {
                  const bodyEl = document.getElementById('crit-tour-body');
                  if (bodyEl) bodyEl.innerHTML = `<span style="color:#ef4444;font-weight:600;">⚠️ Deadline must be at least ${minDays} days from today!</span>`;
                  if (typeof window.showNotif === 'function') window.showNotif(`Deadline must be at least ${minDays} days from today`, 'error');
                  return;
                }
                // When given a date >= 3 days, page slightly scrolls up viewing and focusing Value part including presets
                this.runInteractiveStep('4-budget');
              }
            }
          );
        }, 'center');
      } else if (stepId === '4-budget') {
        // Step 4C: Budget & Presets - OPTIONAL, with warning icon "Budget will be decided by Criteria"
        this.currentInteractiveStep = '4-budget';
        this.setStep4FieldsDisabled('budget');

        const budgetBox = document.getElementById('form-group-budget') || document.getElementById('budget')?.closest('.form-group') || document.getElementById('budget');
        const budgetEl = document.getElementById('budget');

        this.smoothScrollToTarget(budgetBox, () => {
          this.lockScroll();
          const country = document.getElementById('country')?.value || 'IN';
          const curr = document.getElementById('currency-code')?.textContent || 'INR';
          const minAllowed = (typeof window.getMinAllowedBudget === 'function') ? window.getMinAllowedBudget() : 100;

          const warningBadge = `<div style="display:inline-flex;align-items:center;gap:6px;margin-bottom:6px;padding:4px 9px;background:rgba(240,165,0,0.12);border:1px solid rgba(240,165,0,0.35);border-radius:8px;"><span style="font-size:14px;cursor:help;" title="Budget will be decided by Criteria">⚠️</span><span style="font-size:11.5px;color:#f0a500;font-weight:700;" title="Budget will be decided by Criteria">Budget will be decided by Criteria</span></div><br>`;

          this.highlightInteractiveTarget(
            budgetBox,
            '4C. Budget / Price (Optional)',
            warningBadge + `Setting a budget is **optional**. If left blank, Criteria will decide the budget. If you choose to enter a budget, the minimum preset rate is **${curr} ${minAllowed.toLocaleString()}**.`,
            {
              prevText: '← Back',
              onPrev: () => this.runInteractiveStep('4-deadline'),
              nextText: 'Next →',
              onNext: () => {
                const rawVal = budgetEl?.value?.trim();
                const bVal = parseFloat(rawVal || '0');
                const currentMin = (typeof window.getMinAllowedBudget === 'function') ? window.getMinAllowedBudget() : 100;
                // If a budget is entered, it must be >= minimum preset option in presets
                if (rawVal && (isNaN(bVal) || bVal < currentMin)) {
                  const bodyEl = document.getElementById('crit-tour-body');
                  if (bodyEl) {
                    bodyEl.innerHTML = `<span style="color:#ef4444;font-weight:700;">⚠️ Minimum preset budget is ${curr} ${currentMin.toLocaleString()}! (you entered ${curr} ${bVal.toLocaleString()})</span><br><br>Please click one of the quick presets below, enter at least ${curr} ${currentMin.toLocaleString()}, or clear the field to let Criteria decide.`;
                  }
                  if (budgetEl) {
                    budgetEl.focus();
                    budgetEl.style.borderColor = '#ef4444';
                    setTimeout(() => { if (budgetEl) budgetEl.style.borderColor = ''; }, 2500);
                  }
                  return;
                }
                // When selected a value at least minimum preset, page scrolls slightly down focusing AI usage part
                this.runInteractiveStep('4-ai');
              }
            }
          );

          if (budgetEl) budgetEl.focus({ preventScroll: true });

          // Update commentary dynamically when preset clicked or budget typed
          if (budgetEl) {
            const onBudgetChange = () => {
              const rawVal = budgetEl.value?.trim();
              const val = parseFloat(rawVal || '0');
              const currentMin = (typeof window.getMinAllowedBudget === 'function') ? window.getMinAllowedBudget() : 100;
              const bodyEl = document.getElementById('crit-tour-body');
              if (bodyEl) {
                if (!rawVal) {
                  bodyEl.innerHTML = warningBadge + `Budget left blank (optional). Criteria will propose a tailored budget. Tap **Next →** below to proceed.`;
                } else if (val >= currentMin) {
                  bodyEl.innerHTML = `Budget set to <strong>${curr} ${val.toLocaleString()}</strong> ✓. Tap **Next →** below to proceed to AI assistance.`;
                } else if (val > 0) {
                  bodyEl.innerHTML = `<span style="color:#ef4444;font-weight:600;">⚠️ Minimum is ${curr} ${currentMin.toLocaleString()} (you entered ${curr} ${val.toLocaleString()}).</span><br>Please select a preset or enter at least ${curr} ${currentMin.toLocaleString()}.`;
                }
              }
            };
            budgetEl.removeEventListener('input', this._budgetTourListener);
            this._budgetTourListener = onBudgetChange;
            budgetEl.addEventListener('input', this._budgetTourListener);
          }
        }, 'center');
      } else if (stepId === '4-ai') {
        // Step 4D: AI assistance level and slide bar focused
        this.currentInteractiveStep = '4-ai';
        this.setStep4FieldsDisabled('ai');

        const aiSlider = document.getElementById('ai-slider');
        if (aiSlider) {
          aiSlider.min = '15';
          if (!aiSlider.value || aiSlider.value === '45' || aiSlider.value === '5') {
            aiSlider.value = '85';
          }
          const aiVal = document.getElementById('ai-val');
          if (aiVal) aiVal.textContent = aiSlider.value + '%';
        }

        const aiSection = document.getElementById('form-group-ai') || document.querySelector('.ai-section') || aiSlider?.closest('.form-group');
        const targetEl = aiSection || aiSlider;

        this.smoothScrollToTarget(targetEl, () => {
          this.lockScroll();
          this.highlightInteractiveTarget(
            targetEl,
            '4D. AI Assistance Level',
            `Select your preferred AI assistance level (default is 85%, minimum 15%). Click **Next →** below to check your work preview.`,
            {
              prevText: '← Back',
              onPrev: () => this.runInteractiveStep('4-budget'),
              nextText: 'Next →',
              onNext: () => this.runInteractiveStep('4-preview')
            }
          );
          if (aiSlider) aiSlider.focus({ preventScroll: true });
        }, 'center');
      } else if (stepId === '4-preview') {
        // Step 4E: Work preview list focused
        this.currentInteractiveStep = '4-preview';
        this.setStep4FieldsDisabled('preview');

        if (typeof window.updatePreviewHoverText === 'function') {
          window.updatePreviewHoverText();
        }
        const tooltip = document.getElementById('preview-tooltip');
        if (tooltip) {
          tooltip.style.display = 'block';
          tooltip.style.position = 'static';
          tooltip.style.marginTop = '12px';
        }

        const previewChip = document.getElementById('preview-chip');
        const targetEl = document.getElementById('form-group-preview') || previewChip?.closest('.form-group') || previewChip;

        this.smoothScrollToTarget(targetEl, () => {
          this.lockScroll();
          this.highlightInteractiveTarget(
            targetEl,
            '4E. Work Preview',
            `Here are your project details auto-listed! When ready, click **Next →** below to continue to the final review.`,
            {
              prevText: '← Back',
              onPrev: () => this.runInteractiveStep('4-ai'),
              nextText: 'Next →',
              onNext: () => {
                this.unlockScroll();
                this.setStep4FieldsDisabled('all');
                const nextBtn = document.getElementById('crit-tour-next-btn');
                let startPos = null;
                if (nextBtn) {
                  const nbRect = nextBtn.getBoundingClientRect();
                  startPos = { x: Math.round(nbRect.left + nbRect.width / 2), y: Math.round(nbRect.top + nbRect.height / 2) };
                }
                // When clicked next button in comment-box, crit-mouse appears, goes and clicks 'Next' button in web
                this.clickRealNextWithMouse('#step-4 .btn-primary', () => {
                  if (typeof window.goToStep === 'function') window.goToStep(5, true, false);
                  setTimeout(() => {
                    this.runInteractiveStep('5-terms');
                  }, 250);
                }, startPos);
              }
            }
          );
        }, 'center');
      } else if (stepId === '4-finish') {
        this.unlockScroll();
        this.setStep4FieldsDisabled('all');
        this.clickRealNextWithMouse('#step-4 .btn-primary', () => {
          if (typeof window.goToStep === 'function') window.goToStep(5, true, false);
          setTimeout(() => this.runInteractiveStep('5-terms'), 250);
        });
      } else if (stepId === 5 || stepId === '5-terms') {
        // Step 5A: Terms & Conditions Checkbox
        this.currentInteractiveStep = '5-terms';
        this.unlockScroll();
        this.setStep4FieldsDisabled('all');

        if (typeof window.goToStep === 'function' && window.currentStep !== 5) {
          window.goToStep(5, true, false);
        }

        const tncWrap = document.getElementById('tnc-wrap');
        const targetEl = tncWrap || document.querySelector('#step-5 .step-box');

        this.smoothScrollToTarget(targetEl, () => {
          this.lockScroll();
          this.highlightInteractiveTarget(
            targetEl,
            '5A. Terms & Conditions',
            `Review our preview-first model: 2 free revisions included, and 100% copyright transfer upon payment. Click the checkbox to agree.`,
            {
              prevText: '? Back',
              onPrev: () => {
                this.unlockScroll();
                if (typeof window.goToStep === 'function') window.goToStep(4, true);
                setTimeout(() => this.runInteractiveStep('4-preview'), 350);
              },
              nextText: 'Next ?',
              onNext: () => {
                const isChecked = tncWrap?.classList.contains('checked') || !!window.tncAccepted;
                if (!isChecked) {
                  this.pointMouseAt(tncWrap, {
                    duration: 750,
                    callback: () => {
                      if (typeof window.toggleTnc === 'function') window.toggleTnc();
                      else if (tncWrap) tncWrap.click();
                      setTimeout(() => this.runInteractiveStep('5-submit'), 300);
                    }
                  });
                } else {
                  this.runInteractiveStep('5-submit');
                }
              }
            }
          );
        }, 'center');
      } else if (stepId === '5-submit') {
        // Step 5B: Submit Project Button
        this.currentInteractiveStep = '5-submit';
        this.unlockScroll();

        if (typeof window.goToStep === 'function' && window.currentStep !== 5) {
          window.goToStep(5, true, false);
        }

        const submitBtn = document.getElementById('submit-btn');
        const targetEl = submitBtn || document.querySelector('#step-5 .form-actions');

        this.smoothScrollToTarget(targetEl, () => {
          this.lockScroll();
          this.highlightInteractiveTarget(
            targetEl,
            '5B. Submit Your Project',
            `Everything is ready! Click **Submit Project ?** to launch your brief and view your preview on the dashboard.`,
            {
              prevText: '? Back',
              onPrev: () => this.runInteractiveStep('5-terms'),
              nextText: 'Submit Project ?',
              onNext: () => {
                this.unlockScroll();
                const nextBtn = document.getElementById('crit-tour-next-btn');
                let startPos = null;
                if (nextBtn) {
                  const nbRect = nextBtn.getBoundingClientRect();
                  startPos = { x: Math.round(nbRect.left + nbRect.width / 2), y: Math.round(nbRect.top + nbRect.height / 2) };
                }
                this.clickRealNextWithMouse('#submit-btn', () => {
                  this.end(false);
                }, startPos);
              }
            }
          );
        }, 'center');
      }
    },

    highlightInteractiveTarget(targetEl, title, text, customNav = null) {
      this.init();
      const overlay = this.overlayDiv || document.getElementById('crit-spotlight-overlay');
      if (overlay) {
        overlay.style.display = 'block';
        overlay.style.opacity = '1';
        overlay.classList.add('active');
      }
      const svg = this.svgEl || document.getElementById('crit-spotlight-svg');
      if (svg) {
        svg.classList.add('active');
        svg.style.opacity = '1';
        svg.style.visibility = 'visible';
      }

      if (!this.cardEl) return;

      this._customNav = customNav;

      const showPrev = !!(customNav && customNav.prevText && customNav.onPrev);
      const showNext = !!(customNav && customNav.nextText && customNav.onNext);
      const prevText = showPrev ? customNav.prevText : '← Back';
      const nextText = showNext ? customNav.nextText : 'Next →';
      let stepPill = 'Step 1 of 5';
      if (typeof this.currentInteractiveStep === 'number') {
        stepPill = `Step ${this.currentInteractiveStep} of 5`;
      } else if (this.currentInteractiveStep === 'home-start') {
        stepPill = 'Start';
      } else if (typeof this.currentInteractiveStep === 'string') {
        if (this.currentInteractiveStep.startsWith('3-')) stepPill = 'Step 3 of 5';
        else if (this.currentInteractiveStep.startsWith('4-')) stepPill = 'Step 4 of 5';
        else if (this.currentInteractiveStep.startsWith('5-')) stepPill = 'Step 5 of 5';
      }

      const bodyHtml = escHtml(text)
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>');

      const isNextHidden = !showNext || !!(customNav && customNav.hideNext);

      // Always render a rock-solid, complete, resilient card DOM (no inline onclick attributes):
      this.cardEl.innerHTML = `
        <div class="crit-tour-drag-handle" title="Drag to move"><div class="crit-tour-drag-bar"></div></div>
        <div class="crit-tour-header">
          <div class="crit-tour-badge-group">
            <div class="crit-tour-avatar">C</div>
            <div class="crit-tour-badge-name">CRIT</div>
            <span class="crit-tour-step-pill" id="crit-tour-step-pill">${stepPill}</span>
          </div>
        </div>
        <div class="crit-tour-title" id="crit-tour-title">${title}</div>
        <div class="crit-tour-body" id="crit-tour-body">${bodyHtml}</div>
        <div class="crit-tour-footer">
          <button type="button" class="crit-tour-btn-skip" id="crit-tour-skip-btn">Skip Demo</button>
          <div class="crit-tour-nav-btns" id="crit-tour-nav-btns">
            <button type="button" class="crit-tour-btn-prev" id="crit-tour-prev-btn" style="${showPrev ? '' : 'display:none;'}">${prevText}</button>
            <button type="button" class="crit-tour-btn-next" id="crit-tour-next-btn" style="${isNextHidden ? 'display:none;' : ''}">${nextText}</button>
          </div>
        </div>
      `;

      // Direct click handlers for guaranteed button response and instant click feedback
      const nextBtn = document.getElementById('crit-tour-next-btn');
      if (nextBtn) {
        nextBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          nextBtn.classList.add('crit-btn-clicked');
          this._triggerNext(e);
        };
      }
      const prevBtn = document.getElementById('crit-tour-prev-btn');
      if (prevBtn) {
        prevBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._triggerPrev(e);
        };
      }
      const skipBtn = document.getElementById('crit-tour-skip-btn');
      if (skipBtn) {
        skipBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.end(false);
        };
      }

      // Enable touch dragging for mobile users
      this.makeCardDraggable();

      this.cardEl.style.display = 'block';
      this.cardEl.classList.add('active');
      this.cardEl.style.opacity = '1';
      this.cardEl.style.pointerEvents = 'auto';

      this.teleportFocusTo(targetEl);
      requestAnimationFrame(() => this.repositionCurrentStep(true));
      setTimeout(() => this.repositionCurrentStep(true), 120);
      setTimeout(() => this.repositionCurrentStep(true), 360);
    },

    makeCardDraggable() {
      const card = this.cardEl || document.getElementById('crit-tour-card');
      if (!card || card._dragBound) return;
      card._dragBound = true;

      // Ensure any legacy dock anchor element is completely removed
      document.getElementById('crit-tour-dock-anchor')?.remove();

      let isDragging = false;
      let startPointerX = 0, startPointerY = 0;
      let initialCardLeft = 0, initialCardTop = 0;
      let currentX = 0, currentY = 0;
      let velocityX = 0, velocityY = 0;
      let lastMoveTime = 0, lastClientX = 0, lastClientY = 0;
      let snapTimer = null;
      let inertiaFrameId = null;

      // Magnetic snap radius: if dropped within this distance of home, it smoothly locks into place
      const MAGNETIC_SNAP_RADIUS = 75;

      const getHomePosition = () => {
        const isSmallMobile = window.innerWidth <= 320;
        const isMobile = window.innerWidth <= 600;
        const w = card.offsetWidth || (isSmallMobile ? window.innerWidth - 16 : (isMobile ? Math.min(window.innerWidth - 16, 360) : 440));
        const h = card.offsetHeight || 96;
        const bottomMargin = (isSmallMobile || isMobile) ? 8 : 24;
        const left = Math.round((window.innerWidth - w) / 2);
        const top = Math.round(window.innerHeight - h - bottomMargin);
        return { left, top, width: w, height: h, bottomMargin };
      };

      const snapToHome = (withAnimation = true) => {
        clearTimeout(snapTimer);
        cancelAnimationFrame(inertiaFrameId);

        const home = getHomePosition();
        if (withAnimation) {
          card.style.setProperty('transition', 'left 0.26s cubic-bezier(0.16, 1, 0.3, 1), top 0.26s cubic-bezier(0.16, 1, 0.3, 1)', 'important');
          card.style.setProperty('left', home.left + 'px', 'important');
          card.style.setProperty('top', home.top + 'px', 'important');
          card.classList.remove('is-magnetic');

          snapTimer = setTimeout(() => {
            if (isDragging) return;
            card.classList.remove('is-dragged', 'is-displaced', 'is-magnetic');
            card.style.removeProperty('left');
            card.style.removeProperty('top');
            card.style.removeProperty('right');
            card.style.removeProperty('bottom');
            card.style.removeProperty('margin');
            card.style.removeProperty('transition');
            card.style.removeProperty('transform');
            card._hasBeenDragged = false;
            card._isDragging = false;
          }, 270);
        } else {
          card.classList.remove('is-dragged', 'is-displaced', 'is-magnetic');
          card.style.removeProperty('left');
          card.style.removeProperty('top');
          card.style.removeProperty('right');
          card.style.removeProperty('bottom');
          card.style.removeProperty('margin');
          card.style.removeProperty('transition');
          card.style.removeProperty('transform');
          card._hasBeenDragged = false;
          card._isDragging = false;
        }
      };

      const startDrag = (clientX, clientY, target) => {
        // Prevent starting drag on interactive elements
        if (target.closest('button, a, input, textarea, select, .crit-tour-footer, .crit-tour-nav-btns')) return false;

        // Verify valid draggable area
        const isHandle = target.closest('.crit-tour-drag-handle, .crit-tour-drag-bar, .crit-tour-header, .crit-tour-badge-group, .crit-tour-title');
        const isCardContainer = target === card || target.classList.contains('crit-tour-card');
        if (!isHandle && !isCardContainer) return false;

        // Cancel any pending animations
        clearTimeout(snapTimer);
        cancelAnimationFrame(inertiaFrameId);

        // 1. Measure exact rendered position FIRST before modifying styles - 100% glitch free
        const rect = card.getBoundingClientRect();
        initialCardLeft = rect.left;
        initialCardTop = rect.top;
        startPointerX = clientX;
        startPointerY = clientY;
        lastClientX = clientX;
        lastClientY = clientY;
        lastMoveTime = performance.now();
        velocityX = 0;
        velocityY = 0;
        currentX = initialCardLeft;
        currentY = initialCardTop;

        isDragging = true;
        card._isDragging = true;

        // 2. Lock to fixed pixel coordinates matching rect exactly - 0px jump!
        card.style.setProperty('transition', 'none', 'important');
        card.style.setProperty('transform', 'none', 'important');
        card.style.setProperty('position', 'fixed', 'important');
        card.style.setProperty('left', Math.round(initialCardLeft) + 'px', 'important');
        card.style.setProperty('top', Math.round(initialCardTop) + 'px', 'important');
        card.style.setProperty('right', 'auto', 'important');
        card.style.setProperty('bottom', 'auto', 'important');
        card.style.setProperty('margin', '0', 'important');

        card.classList.add('is-dragged');
        card.classList.remove('is-magnetic');

        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';

        return true;
      };

      const moveDrag = (clientX, clientY) => {
        if (!isDragging) return;

        const now = performance.now();
        const dt = Math.max(1, now - lastMoveTime);
        velocityX = ((clientX - lastClientX) / dt) * 16;
        velocityY = ((clientY - lastClientY) / dt) * 16;
        lastClientX = clientX;
        lastClientY = clientY;
        lastMoveTime = now;

        const dx = clientX - startPointerX;
        const dy = clientY - startPointerY;

        let targetX = initialCardLeft + dx;
        let targetY = initialCardTop + dy;

        // Viewport boundaries: free movement across full screen, unrestricted from going above
        const cardW = card.offsetWidth || 280;
        const cardH = card.offsetHeight || 96;
        const minLeft = 6;
        const maxLeft = Math.max(minLeft, window.innerWidth - cardW - 6);
        const minTop = 6; // Allow dragging freely to top of screen
        const maxTop = Math.max(minTop, window.innerHeight - cardH - 6);

        targetX = Math.max(minLeft, Math.min(maxLeft, targetX));
        targetY = Math.max(minTop, Math.min(maxTop, targetY));

        // Magnetic attraction: only near home position at bottom
        const home = getHomePosition();
        const homeCenterX = home.left + cardW / 2;
        const homeCenterY = home.top + cardH / 2;
        const cardCenterX = targetX + cardW / 2;
        const cardCenterY = targetY + cardH / 2;
        const distToHome = Math.hypot(cardCenterX - homeCenterX, cardCenterY - homeCenterY);

        if (distToHome < MAGNETIC_SNAP_RADIUS) {
          card.classList.add('is-magnetic');
          const pull = Math.pow(1 - (distToHome / MAGNETIC_SNAP_RADIUS), 2) * 0.22;
          targetX = targetX * (1 - pull) + home.left * pull;
          targetY = targetY * (1 - pull) + home.top * pull;
        } else {
          card.classList.remove('is-magnetic');
        }

        currentX = targetX;
        currentY = targetY;

        card.style.setProperty('left', Math.round(currentX) + 'px', 'important');
        card.style.setProperty('top', Math.round(currentY) + 'px', 'important');
      };

      const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        card._isDragging = false;

        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('-webkit-user-select');

        const cardW = card.offsetWidth || 280;
        const cardH = card.offsetHeight || 96;
        const home = getHomePosition();
        const homeCenterX = home.left + cardW / 2;
        const homeCenterY = home.top + cardH / 2;
        const cardCenterX = currentX + cardW / 2;
        const cardCenterY = currentY + cardH / 2;
        const distToHome = Math.hypot(cardCenterX - homeCenterX, cardCenterY - homeCenterY);

        // Snap home if within snap radius
        if (distToHome < MAGNETIC_SNAP_RADIUS) {
          snapToHome(true);
        } else {
          // Stable displaced position
          card.classList.remove('is-dragged', 'is-magnetic');
          card.classList.add('is-displaced');
          card._hasBeenDragged = true;

          // Smooth glide inertia if user flicked the card
          let vx = Math.max(-14, Math.min(14, velocityX));
          let vy = Math.max(-14, Math.min(14, velocityY));
          if (Math.abs(vx) > 1.2 || Math.abs(vy) > 1.2) {
            const friction = 0.92;
            const glideInertia = () => {
              if (isDragging) return;
              if (Math.abs(vx) < 0.25 && Math.abs(vy) < 0.25) return;
              vx *= friction;
              vy *= friction;
              currentX = Math.max(6, Math.min(window.innerWidth - cardW - 6, currentX + vx));
              currentY = Math.max(6, Math.min(window.innerHeight - cardH - 6, currentY + vy));
              card.style.setProperty('left', Math.round(currentX) + 'px', 'important');
              card.style.setProperty('top', Math.round(currentY) + 'px', 'important');
              inertiaFrameId = requestAnimationFrame(glideInertia);
            };
            inertiaFrameId = requestAnimationFrame(glideInertia);
          }
        }
      };

      // Double clicking drag handle returns comment-box home
      const handle = card.querySelector('.crit-tour-drag-handle');
      if (handle) {
        handle.ondblclick = (e) => {
          e.preventDefault();
          snapToHome(true);
        };
      }

      // Unified Pointer Events (Modern, glitch-free on Desktop Mouse, Touch, & Trackpad)
      if (window.PointerEvent) {
        card.addEventListener('pointerdown', (e) => {
          if (e.button !== 0 && e.button !== undefined) return;
          if (startDrag(e.clientX, e.clientY, e.target)) {
            try { card.setPointerCapture(e.pointerId); } catch (_) {}
            e.preventDefault();
          }
        });

        card.addEventListener('pointermove', (e) => {
          if (!isDragging) return;
          moveDrag(e.clientX, e.clientY);
        });

        const onPointerFinish = (e) => {
          if (!isDragging) return;
          try { if (card.hasPointerCapture(e.pointerId)) card.releasePointerCapture(e.pointerId); } catch (_) {}
          endDrag();
        };

        card.addEventListener('pointerup', onPointerFinish);
        card.addEventListener('pointercancel', onPointerFinish);
      } else {
        // Fallback for older browsers
        card.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          if (startDrag(e.clientX, e.clientY, e.target)) {
            e.preventDefault();
            const onMove = (ev) => moveDrag(ev.clientX, ev.clientY);
            const onUp = () => {
              endDrag();
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }
        });

        card.addEventListener('touchstart', (e) => {
          const t = e.touches[0];
          if (t && startDrag(t.clientX, t.clientY, e.target)) {
            if (e.cancelable) e.preventDefault();
          }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
          if (!isDragging) return;
          const t = e.touches[0];
          if (t) {
            if (e.cancelable) e.preventDefault();
            moveDrag(t.clientX, t.clientY);
          }
        }, { passive: false });

        document.addEventListener('touchend', endDrag, { passive: true });
        document.addEventListener('touchcancel', endDrag, { passive: true });
      }

      // Safety: if window loses focus or user switches tabs during drag, clean up
      window.addEventListener('blur', () => {
        if (isDragging) endDrag();
      });
    },

    hideTooltipAndOverlay(keepOverlay = false) {
      if (this.activeTargetEl) {
        if (Array.isArray(this.activeTargetEl)) {
          this.activeTargetEl.forEach(el => el?.classList?.remove('crit-tour-target-active'));
        } else {
          this.activeTargetEl?.classList?.remove('crit-tour-target-active');
        }
        this.activeTargetEl = null;
      }
      if (this.cardEl) {
        this.cardEl.classList.remove('active');
        this.cardEl.style.opacity = '0';
        this.cardEl.style.display = 'none';
      }
      document.getElementById('crit-tour-dock-anchor')?.remove();
      if (this.apertureEl) {
        this.apertureEl.style.display = 'none';
      }
      if (!keepOverlay) {
        if (this.overlayEl) {
          this.overlayEl.classList.remove('active');
          this.overlayEl.style.opacity = '0';
          this.overlayEl.style.visibility = 'hidden';
        }
        const overlay = this.overlayDiv || document.getElementById('crit-spotlight-overlay');
        if (overlay) {
          overlay.classList.remove('active');
          overlay.style.opacity = '0';
          overlay.style.display = 'none';
          overlay.style.webkitMaskImage = 'none';
          overlay.style.maskImage = 'none';
        }
        const svg = this.svgEl || document.getElementById('crit-spotlight-svg');
        if (svg) {
          svg.classList.remove('active', 'crit-enveloping');
          svg.style.opacity = '0';
          svg.style.visibility = 'hidden';
        }
        const sweep = this.sweepEl || document.getElementById('crit-spotlight-shadow-sweep');
        if (sweep) {
          sweep.classList.remove('enveloping');
          sweep.style.opacity = '0';
          sweep.style.visibility = 'hidden';
        }
        const core = this.maskCore || document.getElementById('crit-mask-core');
        if (core) {
          core.setAttribute('width', '0');
          core.setAttribute('height', '0');
        }
        const fade = this.maskFade || document.getElementById('crit-mask-fade');
        if (fade) {
          fade.setAttribute('width', '0');
          fade.setAttribute('height', '0');
        }
        document.getElementById('crit-spotlight-container')?.remove();
      }
    },

    watchForSubmissionAndGoHome() {
      const modal = document.getElementById('confirmation-modal');
      const triggerHome = () => {
        try {
          sessionStorage.setItem('crit_just_submitted', 'true');
          sessionStorage.setItem('crit_tour_show_done', 'true');
        } catch (e) { }

        // Cleanly dismiss any lingering spotlight or card
        this.hideTooltipAndOverlay();
        if (this.overlayEl) {
          this.overlayEl.style.display = 'none';
          this.overlayEl.classList.remove('active');
        }
        const svg = document.getElementById('crit-spotlight-svg');
        if (svg) {
          svg.style.display = 'none';
          svg.classList.remove('active');
        }

        const confirmHomeBtn = document.getElementById('confirm-home-btn') || document.querySelector('.confirm-yes');
        if (confirmHomeBtn) {
          setTimeout(() => {
            this.animateMouseToElement(confirmHomeBtn, () => {
              confirmHomeBtn.click();
              setTimeout(() => {
                window.location.href = '/?submitted=true';
              }, 250);
            });
          }, 1500);
        } else if (typeof window.goHome === 'function') {
          setTimeout(() => window.goHome(), 1800);
        } else {
          setTimeout(() => { window.location.href = '/?submitted=true'; }, 1800);
        }
      };

      if (modal) {
        const obs = new MutationObserver(() => {
          if (modal.classList.contains('open')) {
            obs.disconnect();
            triggerHome();
          }
        });
        obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
      }

      const submitBtn = document.getElementById('submit-btn');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => {
          let checks = 0;
          const poll = setInterval(() => {
            checks++;
            if (modal && modal.classList.contains('open')) {
              clearInterval(poll);
              triggerHome();
            } else if (checks > 60) {
              clearInterval(poll);
            }
          }, 250);
        });
      }
    },

    checkPostSubmissionNotice() {
      let isSubmitted = false;
      try {
        if (sessionStorage.getItem('crit_just_submitted') === 'true' || sessionStorage.getItem('crit_tour_show_done') === 'true') {
          isSubmitted = true;
          sessionStorage.removeItem('crit_just_submitted');
        }
      } catch (e) { }

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('submitted') === 'true') {
        isSubmitted = true;
        try {
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        } catch (e) { }
      }

      if (isSubmitted) {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.classList.remove('crit-tour-active');
        document.getElementById('crit-bot-cursor')?.remove();
        document.getElementById('crit-spotlight-overlay')?.classList.remove('active');
        document.getElementById('crit-tour-card')?.classList.remove('active');
        document.getElementById('crit-tour-dock')?.remove();

        setTimeout(() => {
          const root = document.getElementById('crit-bubble');
          if (root) root.classList.add('open');
          chatState.isOpen = true;
          saveLocalState();

          const celebrationMsg = `🎉 **Your project has been submitted successfully!**\n\nOur creative team has received your brief. You'll receive your free watermarked preview on your dashboard soon!\n\nRemember: you pay zero upfront until you review and approve the work!\n\n[DONE_BUTTON]`;
          appendMessage('bot', celebrationMsg);
          addMessageToState('bot', celebrationMsg);
          const badge = document.getElementById('crit-unread');
          if (badge) badge.style.display = 'none';
        }, 800);
      }
    },

    finishTourTask() {
      try {
        sessionStorage.removeItem('crit_just_submitted');
        sessionStorage.removeItem('crit_tour_show_done');
        sessionStorage.removeItem('crit_pending_interactive_build');
        sessionStorage.removeItem('crit_project_deadline');
      } catch (e) { }
      const root = document.getElementById('crit-bubble');
      if (root) root.classList.remove('open');
      chatState.isOpen = false;
      chatState.unread = 0;
      const badge = document.getElementById('crit-unread');
      if (badge) badge.style.display = 'none';
      saveLocalState();
      saveFirestoreState();
    },

    openAuth() {
      triggerSignUp();
    },

    start(tourId, stepIndex = 0) {
      this._checkedPendingTour = true;
      if (this._pendingTourTimer) {
        clearTimeout(this._pendingTourTimer);
        this._pendingTourTimer = null;
      }
      this.init();

      if (tourId === 'interactive-build' || tourId === 'start-project' || tourId === 'submit-wizard') {
        this.startInteractiveBuild();
        return;
      }

      const tour = CRIT_TOURS[tourId] || CRIT_TOURS['start-project'];
      if (!tour) return;

      const currentPath = window.location.pathname.replace(/\/index\.html$/, '/');
      const isHome = currentPath === '/' || currentPath === '' || currentPath.endsWith('index.html') || currentPath === '/index' || currentPath.endsWith('/index');
      const targetPage = tour.steps[0].page;

      if (targetPage === '/submit.html' && isHome) {
        window.location.href = '/submit.html?tour=submit-wizard';
        return;
      }
      if ((targetPage === '/' || targetPage === '/index') && !isHome) {
        window.location.href = '/?tour=' + tourId;
        return;
      }

      this.activeTour = tour;
      this.currentStepIndex = stepIndex;

      const bubble = document.getElementById('crit-bubble');
      if (bubble) bubble.classList.remove('open');
      chatState.isOpen = false;
      saveLocalState();

      this.overlayEl?.classList.add('active');
      this.glowEl?.classList.add('active');

      if (!this.isListeningScroll) {
        this.isListeningScroll = true;
        let rafId = null;
        this._scrollHandler = () => {
          if (!this.activeTour) return;
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            this.repositionCurrentStep(true);
          });
        };
        window.addEventListener('scroll', this._scrollHandler, { passive: true });
        window.addEventListener('resize', this._scrollHandler, { passive: true });
      }

      this.showStep(this.currentStepIndex);
    },

    showStep(index) {
      if (!this.activeTour) return;
      if (index >= this.activeTour.steps.length) {
        this.end(true);
        return;
      }
      if (index < 0) index = 0;
      this.currentStepIndex = index;

      const step = this.activeTour.steps[index];
      const total = this.activeTour.steps.length;

      // Update Card
      const stepPill = document.getElementById('crit-tour-step-pill');
      if (stepPill) stepPill.textContent = `${index + 1}/${total}`;

      const titleEl = document.getElementById('crit-tour-title');
      if (titleEl) titleEl.textContent = step.title;

      const bodyEl = document.getElementById('crit-tour-body');
      if (bodyEl) {
        let bodyHtml = escHtml(step.text)
          .replace(/\n/g, '<br>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code>$1</code>');

        if (step.actionText && step.actionUrl) {
          bodyHtml += `<div style="margin-top:8px;"><a href="${step.actionUrl}" class="crit-tour-btn-action">${step.actionText}</a></div>`;
        }
        bodyEl.innerHTML = bodyHtml;
      }

      const prevBtn = document.getElementById('crit-tour-prev-btn');
      if (prevBtn) prevBtn.disabled = index === 0;

      const nextBtn = document.getElementById('crit-tour-next-btn');
      if (nextBtn) {
        if (this.activeTour && (this.activeTour.id === 'start-project' || this.activeTour.title === 'Start a Project')) {
          nextBtn.innerHTML = 'Next →';
        } else {
          nextBtn.innerHTML = index === total - 1 ? 'Done ✓' : 'Next →';
        }
      }

      // OCR & Selector Resolver
      const targetEl = this.findTargetWithOCR(step.target, step.ocr);

      // Clean up previous active element
      if (this.activeTargetEl && this.activeTargetEl !== targetEl) {
        this.activeTargetEl.classList.remove('crit-tour-target-active');
      }

      this.teleportFocusTo(targetEl);
    },

    onPageStepChanged(newPageStep) {
      if (!this.activeTour || this.activeTour.id !== 'interactive-build') return;
      if (this.isTransitioning || this.isClickingNextWithMouse) return;
      const currentSection = (typeof this.currentInteractiveStep === 'number') ? this.currentInteractiveStep : (
        typeof this.currentInteractiveStep === 'string' && this.currentInteractiveStep.startsWith('3-') ? 3 : (
          typeof this.currentInteractiveStep === 'string' && this.currentInteractiveStep.startsWith('4-') ? 4 : (
            typeof this.currentInteractiveStep === 'string' && this.currentInteractiveStep.startsWith('5-') ? 5 : null
          )
        )
      );
      if (currentSection !== newPageStep) {
        const stepMapping = {
          1: 1,
          2: 2,
          3: '3-desc',
          4: '4-country',
          5: '5-terms'
        };
        const nextId = stepMapping[newPageStep];
        if (nextId) {
          this.runInteractiveStep(nextId);
        }
      }
    },

    teleportFocusTo(targetEl, callback) {
      if (this.activeTargetEl && this.activeTargetEl !== targetEl) {
        if (Array.isArray(this.activeTargetEl)) {
          this.activeTargetEl.forEach(el => el?.classList?.remove('crit-tour-target-active'));
        } else {
          this.activeTargetEl?.classList?.remove('crit-tour-target-active');
        }
      }

      this.activeTargetEl = targetEl;

      if (targetEl) {
        if (Array.isArray(targetEl)) {
          targetEl.forEach(el => el?.classList?.add('crit-tour-target-active'));
        } else {
          targetEl.classList?.add('crit-tour-target-active');
          if (typeof targetEl.focus === 'function' && (targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA' || targetEl.tagName === 'SELECT')) {
            try { targetEl.focus({ preventScroll: true }); } catch (e) { }
          } else {
            const innerFocusable = targetEl.querySelector?.('input, textarea, select');
            if (innerFocusable && typeof innerFocusable.focus === 'function') {
              try { innerFocusable.focus({ preventScroll: true }); } catch (e) { }
            }
          }
        }
      }

      // Sudden quick response + smooth morph via #crit-mask-cutout CSS transition (no screen blinking)
      if (this.overlayEl) {
        this.overlayEl.classList.add('active');
        this.overlayEl.style.opacity = '1';
        this.overlayEl.style.visibility = 'visible';
      }
      this.repositionCurrentStep(false);
      // Ensure bot cursor remains hidden while step is presented to the user
      const cursor = document.getElementById('crit-bot-cursor');
      if (cursor && !this.isClickingNextWithMouse) {
        cursor.style.display = 'none';
        cursor.style.opacity = '0';
        cursor.style.visibility = 'hidden';
      }
      if (callback) callback();
    },

    // Visual Text Scanner (OCR) + Multi-Selector Engine
    findTargetWithOCR(targetSelector, ocrKeywords = []) {
      // 1. Selector match
      if (targetSelector) {
        const selectors = targetSelector.split(',').map(s => s.trim()).filter(Boolean);
        for (const sel of selectors) {
          try {
            const el = document.querySelector(sel);
            if (el && (el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0)) {
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) return el;
            }
          } catch (e) { }
        }
      }

      // 2. Optical Character / Text Matcher (OCR)
      if (Array.isArray(ocrKeywords) && ocrKeywords.length) {
        const candidates = Array.from(document.querySelectorAll(
          'h1, h2, h3, h4, button, a, label, .form-label, .step-title, .section-title, input, textarea, .type-card, .service-card, .btn-primary'
        ));

        for (const kw of ocrKeywords) {
          const lowerKw = kw.toLowerCase().trim();
          const match = candidates.find(el => {
            if (!el || el.offsetParent === null) return false;
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return false;
            const text = (el.innerText || el.textContent || el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').toLowerCase();
            return text.includes(lowerKw);
          });

          if (match) {
            const box = match.closest('.step-box, .form-group, .step-container, .hero-actions, .service-card') || match;
            return box;
          }
        }
      }

      return null;
    },

    repositionCurrentStep(instant = false, isTeleport = false) {
      if (!this.activeTour) {
        if (this.cardEl) {
          this.cardEl.classList.remove('active');
          this.cardEl.style.display = 'none';
          this.cardEl.style.opacity = '0';
          this.cardEl.style.pointerEvents = 'none';
        }
        return;
      }


      if (this.isClickingNextWithMouse || this.currentInteractiveStep === '4-finish' || !this.activeTargetEl) {
        if (this.cardEl && (this.isClickingNextWithMouse || this.currentInteractiveStep === '4-finish')) {
          this.cardEl.classList.remove('active');
          this.cardEl.style.opacity = '0';
          this.cardEl.style.display = 'none';
        }
        if (!this.activeTargetEl && this.activeTour?.id === 'interactive-build') {
          return;
        }
        if (this.currentInteractiveStep === '4-finish') {
          return;
        }
      }
      const card = this.cardEl || document.getElementById('crit-tour-card');
      const overlay = this.overlayDiv || document.getElementById('crit-spotlight-overlay');
      const svg = this.svgEl || document.getElementById('crit-spotlight-svg');
      if (!card) return;

      const targetEl = this.activeTargetEl;
      const isMobile = window.innerWidth <= 600;

      if (targetEl) {
        let rect = null;
        if (Array.isArray(targetEl)) {
          const validRects = targetEl
            .map(el => (el && el.offsetParent !== null ? el.getBoundingClientRect() : null))
            .filter(Boolean);
          if (validRects.length > 0) {
            const rLeft = Math.min(...validRects.map(r => r.left));
            const rTop = Math.min(...validRects.map(r => r.top));
            const rRight = Math.max(...validRects.map(r => r.right));
            const rBottom = Math.max(...validRects.map(r => r.bottom));
            rect = { left: rLeft, top: rTop, right: rRight, bottom: rBottom, width: rRight - rLeft, height: rBottom - rTop };
          }
        } else if (targetEl && targetEl.getBoundingClientRect) {
          rect = targetEl.getBoundingClientRect();
        }

        if (rect && rect.width > 0 && rect.height > 0) {
          // Rectangular spotlight geometry hugging target like button's shape with curved corners
          // Leave 15px near input from all sides for Step 1
          const padX = (this.currentInteractiveStep === 1) ? 15 : 14;
          const padY = (this.currentInteractiveStep === 1) ? 15 : 8;

          const coreX = Math.max(4, Math.round(rect.left - padX));
          const coreY = Math.max(4, Math.round(rect.top - padY));
          const coreW = Math.min(window.innerWidth - coreX - 4, Math.round(rect.width + (padX * 2)));
          const coreH = Math.round(rect.height + (padY * 2));

          const coreR = (this.currentInteractiveStep === 1) ? 12 : Math.max(16, Math.min(24, Math.round(coreH * 0.36)));

          // Subtle tight fade perimeter that follows the rectangular rounded contour (NO sphere/circle)
          const fadePad = 5;
          const fadeX = Math.round(coreX - fadePad);
          const fadeY = Math.round(coreY - fadePad);
          const fadeW = Math.round(coreW + (fadePad * 2));
          const fadeH = Math.round(coreH + (fadePad * 2));
          const fadeR = Math.round(coreR + 2);

          const core = this.maskCore || document.getElementById('crit-mask-core');
          if (core) {
            core.setAttribute('x', coreX);
            core.setAttribute('y', coreY);
            core.setAttribute('width', coreW);
            core.setAttribute('height', coreH);
            core.setAttribute('rx', coreR);
            core.setAttribute('ry', coreR);
          }

          const fade = this.maskFade || document.getElementById('crit-mask-fade');
          if (fade) {
            fade.setAttribute('x', fadeX);
            fade.setAttribute('y', fadeY);
            fade.setAttribute('width', fadeW);
            fade.setAttribute('height', fadeH);
            fade.setAttribute('rx', fadeR);
            fade.setAttribute('ry', fadeR);
          }



          const sphere = this.maskSphere || document.getElementById('crit-mask-sphere');
          if (sphere) sphere.setAttribute('r', '0');

          if (svg) {
            svg.classList.add('active');
            svg.style.opacity = '1';
            svg.style.visibility = 'visible';
          }

          // Disable div overlay to ensure SVG rounded-rectangle mask is authoritative
          if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.remove('active');
            overlay.style.webkitMaskImage = 'none';
            overlay.style.maskImage = 'none';
          }

          // Strictly ensure NO glowing container or box is displayed
          const spotBox = document.getElementById('crit-spotlight-container');
          if (spotBox) {
            spotBox.style.display = 'none';
            spotBox.classList.remove('active');
          }

          // Commentary Card: remains rock-solid at fixed bottom-center position unless dragged
          if (card && !this.isClickingNextWithMouse && this.currentInteractiveStep !== '4-finish') {
            if (card._isDragging || card.classList.contains('is-dragged')) {
              return; // Guard: Do NOT touch coordinates while user is dragging
            }
            if (!card.classList.contains('active') || card.style.display !== 'block') {
              card.classList.add('active');
              card.style.display = 'block';
              card.style.opacity = '1';
              card.style.pointerEvents = 'auto';
            }

            if (card._hasBeenDragged) {
              const cRect = card.getBoundingClientRect();
              const maxLeft = Math.max(8, window.innerWidth - (card.offsetWidth || 220) - 8);
              const maxTop = Math.max(8, window.innerHeight - (card.offsetHeight || 90) - 8);
              const clampLeft = Math.max(8, Math.min(maxLeft, cRect.left));
              const clampTop = Math.max(8, Math.min(maxTop, cRect.top));
              card.style.setProperty('left', clampLeft + 'px', 'important');
              card.style.setProperty('top', clampTop + 'px', 'important');
              card.style.setProperty('right', 'auto', 'important');
              card.style.setProperty('bottom', 'auto', 'important');
              card.style.setProperty('margin', '0', 'important');
              card.style.setProperty('transform', 'none', 'important');
            } else {
              card.style.removeProperty('left');
              card.style.removeProperty('top');
              card.style.removeProperty('right');
              card.style.removeProperty('bottom');
              card.style.removeProperty('margin');
              card.style.removeProperty('transform');
            }
          }
          return;
        }
      }

      // Fallback center modal (only for non-interactive tours)
      if (!this.activeTour || this.activeTour?.id === 'interactive-build') return;
      if (overlay) {
        overlay.style.display = 'none';
        overlay.style.webkitMaskImage = 'none';
        overlay.style.maskImage = 'none';
      }
      const core = this.maskCore || document.getElementById('crit-mask-core');
      if (core) {
        core.setAttribute('width', '0');
        core.setAttribute('height', '0');
      }
      const fade = this.maskFade || document.getElementById('crit-mask-fade');
      if (fade) {
        fade.setAttribute('width', '0');
        fade.setAttribute('height', '0');
      }
      const spotlightBox = document.getElementById('crit-spotlight-container');
      if (spotlightBox) {
        spotlightBox.style.display = 'none';
        spotlightBox.classList.remove('active');
      }

      if (card) {
        card.classList.add('active');
        card.style.display = 'block';
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      }
    },

    next() {
      if (!this.activeTour) return;
      if (this.activeTour.id === 'start-project' || this.activeTour.title === 'Start a Project') {
        const targetEl = this.activeTargetEl || getVisibleHeroButton();
        if (targetEl) {
          try { sessionStorage.setItem('crit_pending_interactive_build', 'true'); } catch (e) { }
          this.animateMouseToElement(targetEl, () => {
            try { sessionStorage.setItem('crit_pending_interactive_build', 'true'); } catch (e) { }
            window.location.href = '/submit?tour=interactive-build';
          });
          return;
        }
      }
      this.showStep(this.currentStepIndex + 1);
    },

    prev() {
      if (!this.activeTour) return;
      this.showStep(this.currentStepIndex - 1);
    },

    end(completed = false) {
      if (this._entranceRaf) {
        cancelAnimationFrame(this._entranceRaf);
        this._entranceRaf = null;
      }
      this.isEntranceAnimating = false;
      this.activeTour = null;
      this.currentInteractiveStep = null;
      this.isClickingNextWithMouse = false;
      this._cursorPos = null;
      this.blockUserInteraction(false);
      this.unlockScroll();
      document.body.classList.remove('crit-tour-active', 'crit-scrolling');
      document.getElementById('crit-mask-sphere')?.setAttribute('r', '0');
      document.getElementById('crit-spotlight-shadow-sweep')?.remove();

      if (this._cleanupStep) {
        try { this._cleanupStep(); } catch (e) { }
        this._cleanupStep = null;
      }

      if (this.activeTargetEl) {
        if (Array.isArray(this.activeTargetEl)) {
          this.activeTargetEl.forEach(el => el?.classList?.remove('crit-tour-target-active'));
        } else {
          this.activeTargetEl?.classList?.remove('crit-tour-target-active');
        }
        this.activeTargetEl = null;
      }

      // Remove darkness overlay completely
      if (this.overlayEl) {
        this.overlayEl.classList.remove('active');
        this.overlayEl.style.opacity = '0';
        this.overlayEl.style.display = 'none';
      }
      const svg = document.getElementById('crit-spotlight-svg');
      if (svg) {
        svg.classList.remove('active');
        svg.style.opacity = '0';
        svg.style.display = 'none';
      }
      const oldOverlay = document.getElementById('crit-spotlight-overlay');
      if (oldOverlay) {
        oldOverlay.classList.remove('active');
        oldOverlay.style.opacity = '0';
        oldOverlay.style.display = 'none';
      }

      const core = this.maskCore || document.getElementById('crit-mask-core');
      if (core) {
        core.setAttribute('width', '0');
        core.setAttribute('height', '0');
      }
      const fade = this.maskFade || document.getElementById('crit-mask-fade');
      if (fade) {
        fade.setAttribute('width', '0');
        fade.setAttribute('height', '0');
      }
      const shadow = this.maskShadow || document.getElementById('crit-mask-shadow');
      if (shadow) {
        shadow.setAttribute('width', '0');
        shadow.setAttribute('height', '0');
      }

      const cutout = this.cutoutEl || document.getElementById('crit-mask-cutout');
      if (cutout) {
        cutout.setAttribute('width', '0');
        cutout.setAttribute('height', '0');
      }

      if (this.cardEl) {
        this.cardEl.classList.remove('active');
        this.cardEl.style.opacity = '0';
        this.cardEl.style.display = 'none';
      }
      document.getElementById('crit-tour-dock')?.remove();
      document.getElementById('crit-tour-dock-anchor')?.remove();
      document.getElementById('crit-bot-cursor')?.remove();
      document.getElementById('crit-spotlight-container')?.remove();
      const endSweep = document.getElementById('crit-spotlight-shadow-sweep');
      if (endSweep) {
        endSweep.classList.remove('enveloping');
        endSweep.style.opacity = '0';
        endSweep.style.visibility = 'hidden';
      }

      // Clear any pending tour session storage and URL query so demo does not re-trigger
      try {
        sessionStorage.removeItem('crit_active_task');
        sessionStorage.removeItem('crit_submit_saved_data');
        sessionStorage.removeItem('crit_pending_interactive_build');
        sessionStorage.removeItem('crit_from_home_start');
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
      } catch (e) { }

      // Re-enable ALL inputs, textareas, selects, and buttons across the entire document
      document.querySelectorAll('input, textarea, select, button, a').forEach(el => {
        el.style.pointerEvents = '';
        el.style.cursor = '';
        el.style.opacity = '';
        el.style.filter = '';
        if (el.id !== 'next-btn-2') {
          el.disabled = false;
        }
      });

      // Fully re-enable all form fields on page so user can continue without demo!
      this.setStep4FieldsDisabled('all');

      const webNext2 = document.getElementById('next-btn-2');
      if (webNext2) {
        const hasCard = !!document.querySelector('.type-card.selected');
        webNext2.disabled = !hasCard;
      }

      if (this._scrollHandler) {
        window.removeEventListener('scroll', this._scrollHandler);
        window.removeEventListener('resize', this._scrollHandler);
        this.isListeningScroll = false;
      }

      const root = document.getElementById('crit-bubble');
      if (root) {
        root.classList.remove('crit-tour-hidden');
        root.style.display = '';
        root.style.opacity = '1';
        root.style.visibility = 'visible';
        root.style.pointerEvents = 'auto';
      }

      if (completed) {
        const victoryMsg = "✓ **Ready to build!** You've seen the submission flow. Let me know when you're ready to submit your brief!";
        appendMessage('bot', victoryMsg, '', true);
        addMessageToState('bot', victoryMsg);
      }
    },

    openChatDuringTour() {
      const root = document.getElementById('crit-bubble');
      if (root) {
        root.classList.add('open');
        chatState.isOpen = true;
        saveLocalState();
        setTimeout(() => document.getElementById('crit-input')?.focus(), 300);
      }
    }
  };

  window.CritTour = CritTour;


  function build() {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const root = document.createElement("div");
    root.id = "crit-bubble";
    root.innerHTML = `
      <div id="crit-backdrop"></div>
      <div id="crit-window" role="dialog" aria-label="CRITERIA AI chat" data-lenis-prevent="true">
        <div id="crit-mobile-bar" class="crit-mobile-bar" role="button" aria-label="Close chat" title="Tap to close chat">
          <div class="crit-mobile-handle"></div>
          <span class="crit-mobile-close-label">✕ Tap to Close</span>
        </div>
        <div id="crit-header">
          <div class="crit-avatar">
            <span>C</span>
            <div class="crit-avatar-pulse"></div>
          </div>
          <div class="crit-header-text">
            <div class="crit-header-name">CRIT · Studio Assistant</div>
            <div class="crit-header-sub">
              <div class="crit-online-dot"></div>
              <span id="crit-mode-label">Online · AI Studio Assistant</span>
            </div>
          </div>
          <div class="crit-header-actions">
            <button id="crit-clear" type="button" title="Start a fresh conversation">Clear</button>
            <button id="crit-header-close" type="button" aria-label="Close chat" title="Close chat"><span class="crit-close-txt">Close</span><span class="crit-close-x">✕</span></button>
          </div>
        </div>
        <div id="crit-messages" data-lenis-prevent="true"></div>
        <div id="crit-input-row">
          <div class="crit-input-container">
            <textarea
              id="crit-input"
              placeholder="Ask anything about CRITERIA"
              rows="1"
              aria-label="Message"
            ></textarea>
          </div>
          <button id="crit-send" aria-label="Send" disabled title="Send message">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <div id="crit-footer">CRIT · CRITERIA Studio AI</div>
      </div>

      <button id="crit-toggle" aria-label="Toggle chat" title="Chat with CRIT">
        <span class="crit-icon-chat">
          <svg viewBox="0 0 24 24"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4H20V16Z"/></svg>
        </span>
        <span class="crit-icon-close">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"/></svg>
        </span>
        <div id="crit-unread">1</div>
      </button>
    `;
    document.body.appendChild(root);

    // Hide crit-bubble if page loading screen is active
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
      root.classList.add('loading-hidden');
      const obsLoading = new MutationObserver(() => {
        if (loadingScreen.classList.contains('hidden')) {
          root.classList.remove('loading-hidden');
          obsLoading.disconnect();
        }
      });
      obsLoading.observe(loadingScreen, { attributes: true, attributeFilter: ['class'] });
    }

    restoreMessages();
    CritTour.init();
    initFirebase().then(loadFirestoreState);
    updateModeLabel();
    if (!isQaMode()) wakeBackend();
    CritTour.checkPostSubmissionNotice();

    /* Make crit-window scroll independently without Lenis interference */
    const critWin = root.querySelector("#crit-window");
    if (critWin) {
      critWin.addEventListener('wheel', (e) => {
        e.stopPropagation();
      }, { passive: false });
    }

    /* Toggle & Close buttons */
    const isSubmitPage = window.location.pathname.toLowerCase().includes('submit') || document.body.classList.contains('submit-page') || !!document.getElementById('wizard-form');
    if (isSubmitPage) {
      root.classList.add('no-backdrop');
    }

    /* Document outside click listener to close chat without full-screen dark veil */
    document.addEventListener("click", (e) => {
      if (!chatState.isOpen) return;
      const win = root.querySelector("#crit-window");
      const toggle = root.querySelector("#crit-toggle");
      if (win && !win.contains(e.target) && (!toggle || !toggle.contains(e.target))) {
        root.classList.remove("open");
        chatState.isOpen = false;
        saveLocalState();
      }
    });

    root.querySelector("#crit-toggle").addEventListener("click", toggleChat);
    root.querySelector("#crit-clear").addEventListener("click", clearChat);
    const backdrop = root.querySelector("#crit-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", () => {
        root.classList.remove("open");
        chatState.isOpen = false;
        saveLocalState();
      });
    }

    // Close chat cleanly when clicking outside without needing a dark backdrop
    document.addEventListener("click", (e) => {
      if (chatState.isOpen && root.classList.contains("open")) {
        if (!root.contains(e.target)) {
          root.classList.remove("open");
          chatState.isOpen = false;
          saveLocalState();
        }
      }
    });

    function closeChatModal() {
      root.classList.remove("open");
      chatState.isOpen = false;
      saveLocalState();
    }

    const headerClose = root.querySelector("#crit-header-close");
    if (headerClose) {
      headerClose.addEventListener("click", closeChatModal);
      headerClose.addEventListener("touchend", (e) => {
        e.preventDefault();
        closeChatModal();
      });
    }

    const mobileBar = root.querySelector("#crit-mobile-bar");
    if (mobileBar) {
      mobileBar.addEventListener("click", closeChatModal);
      mobileBar.addEventListener("touchend", (e) => {
        e.preventDefault();
        closeChatModal();
      });
    }

    /* Input */
    const input = root.querySelector("#crit-input");
    const sendBtn = root.querySelector("#crit-send");

    input.addEventListener("input", () => {
      sendBtn.disabled = input.value.trim() === "";
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 100) + "px";
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled && !isTyping) doSend();
      }
    });
    sendBtn.addEventListener("click", () => { if (!isTyping) doSend(); });
  }

  /* ============================================================
     TOGGLE & CLEAR
  ============================================================ */
  function toggleChat() {
    const root = document.getElementById("crit-bubble");
    const badge = document.getElementById("crit-unread");
    root.classList.toggle("open");
    chatState.isOpen = root.classList.contains("open");
    if (chatState.isOpen) {
      chatState.unread = 0;
      if (badge) badge.style.display = "none";
      setTimeout(() => document.getElementById("crit-input").focus(), 300);
    }
    saveLocalState();
    saveFirestoreState();
  }

  function clearChat() {
    if (!isQaMode()) {
      fetch(CLEAR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: chatState.sessionId })
      }).catch(() => { });
    }
    chatState.history = [];
    chatState.unread = 0;
    chatState.isOpen = true;
    saveLocalState();
    saveFirestoreState();

    const root = document.getElementById('crit-bubble');
    const msgs = document.getElementById('crit-messages');
    const badge = document.getElementById('crit-unread');
    if (root) root.classList.add('open');
    if (msgs) msgs.innerHTML = '';
    if (badge) badge.style.display = 'none';

    const greeting = "👋 Hi! I'm **CRIT**, your CRITERIA studio assistant.\n\nAsk me anything — services, pricing, our preview-first model, every section of the website, or tools & shortcuts in **CRITSPACE**!";
    appendMessage('bot', greeting);
    addMessageToState('bot', greeting);
    setTimeout(() => document.getElementById('crit-input')?.focus(), 300);
  }

  /* ============================================================
     MESSAGES DOM HELPERS
  ============================================================ */
  function appendMessage(role, text, extraClass = "", animate = false) {
    const msgs = document.getElementById("crit-messages");
    if (!msgs) return;

    // If previous bot message is still typing, finish it immediately
    const activeStream = msgs.querySelector('.crit-msg.bot._is-typing');
    if (activeStream && typeof activeStream._completeTyping === 'function') {
      activeStream._completeTyping();
    }

    const div = document.createElement("div");
    div.className = `crit-msg ${role}${extraClass ? " " + extraClass : ""}`;

    const renderFullHtml = (rawText) => {
      let html = escHtml(rawText)
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, "<code style='background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:12px'>$1</code>");

      // Replace [TOUR:id] with interactive button
      html = html.replace(/\[TOUR:([a-z0-9_-]+)\]/gi, (match, tourId) => {
        let btnTitle = 'Take Guided Tour';
        let btnIcon = '🧭';
        let promptLabel = 'Want me to show you how directly on the page?';
        const isOnSubmit = typeof window !== 'undefined' && window.location.pathname.includes('submit');
        let activeStep = 1;
        if (typeof window !== 'undefined' && typeof window.currentStep === 'number') {
          activeStep = window.currentStep;
        }

        if (tourId === 'interactive-build' || tourId === 'start-project') {
          if (isOnSubmit && activeStep > 1) {
            btnTitle = 'Continue Demo';
            btnIcon = '⚡';
            promptLabel = "Ready to proceed with the walkthrough from here?";
          } else {
            btnTitle = 'Start Demo';
            btnIcon = '✨';
            promptLabel = "Ready to start the interactive walkthrough?";
          }
        } else if (typeof CRIT_TOURS !== 'undefined' && CRIT_TOURS[tourId]) {
          btnTitle = CRIT_TOURS[tourId].title;
        }
        return `
          <div class="crit-tour-prompt-wrap">
            <div class="crit-tour-prompt-label">
              <span class="crit-tour-sparkle">✨</span>
              <span>${promptLabel}</span>
            </div>
            <button type="button" class="crit-tour-action-btn" data-tour="${tourId}">
              <span class="crit-tour-btn-icon">${btnIcon}</span>
              <span class="crit-tour-btn-text"><strong>${btnTitle}</strong></span>
              <span class="crit-tour-btn-arrow">→</span>
            </button>
          </div>
        `;
      });

      // Replace [DONE_BUTTON] with clean interactive completion button
      html = html.replace(/\[DONE_BUTTON\]/g, () => {
        return `
          <div style="margin-top:14px;display:flex;justify-content:flex-end;">
            <button type="button" class="crit-tour-btn-done" id="crit-finish-tour-btn">Done ✓</button>
          </div>
        `;
      });
      return html;
    };

    const bindButtons = (container) => {
      const doneBtn = container.querySelector('#crit-finish-tour-btn');
      if (doneBtn) {
        doneBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (typeof CritTour !== 'undefined' && CritTour.finishTourTask) {
            CritTour.finishTourTask();
          }
        });
      }
      container.querySelectorAll('.crit-tour-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const tid = btn.getAttribute('data-tour');
          if (typeof CritTour !== 'undefined') {
            CritTour.start(tid);
          }
        });
      });
    };

    if (role === 'bot' && animate) {
      div.classList.add('_is-typing');
      const tourRegex = /\[TOUR:[a-z0-9_-]+\]/gi;
      const doneRegex = /\[DONE_BUTTON\]/g;
      const tourMatches = text.match(tourRegex) || [];
      const hasDone = doneRegex.test(text);

      const pureText = text.replace(tourRegex, '').replace(doneRegex, '').trim();

      const textContainer = document.createElement('span');
      textContainer.className = 'crit-type-stream';
      div.appendChild(textContainer);

      const cursor = document.createElement('span');
      cursor.className = 'crit-typing-cursor';
      div.appendChild(cursor);

      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;

      const tokens = pureText.split(/(\s+)/);
      let tokenIdx = 0;
      let accumulated = "";

      const finalizeTyping = () => {
        clearInterval(typeInterval);
        div.classList.remove('_is-typing');
        cursor.remove();
        div.innerHTML = renderFullHtml(text);
        bindButtons(div);
        msgs.scrollTop = msgs.scrollHeight;
      };

      div._completeTyping = finalizeTyping;

      const typeInterval = setInterval(() => {
        if (tokenIdx < tokens.length) {
          accumulated += tokens[tokenIdx];
          tokenIdx++;
          if (tokenIdx < tokens.length && /^\s+$/.test(tokens[tokenIdx])) {
            accumulated += tokens[tokenIdx];
            tokenIdx++;
          }
          let formattedHtml = escHtml(accumulated)
            .replace(/\n/g, "<br>")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/`(.*?)`/g, "<code style='background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:12px'>$1</code>");

          textContainer.innerHTML = formattedHtml;
          msgs.scrollTop = msgs.scrollHeight;
        } else {
          clearInterval(typeInterval);
          div.classList.remove('_is-typing');
          cursor.remove();

          if (tourMatches.length > 0 || hasDone) {
            let actionsRaw = tourMatches.join(' ') + (hasDone ? ' [DONE_BUTTON]' : '');
            const actionsWrap = document.createElement('div');
            actionsWrap.className = 'crit-actions-fade-in';
            actionsWrap.innerHTML = renderFullHtml(actionsRaw);
            div.appendChild(actionsWrap);
            bindButtons(actionsWrap);
            msgs.scrollTop = msgs.scrollHeight;
          }
        }
      }, 20);
    } else {
      div.innerHTML = renderFullHtml(text);
      bindButtons(div);
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    }
  }

  function showTyping() {
    const msgs = document.getElementById("crit-messages");
    if (!msgs) return;
    const dot = document.createElement("div");
    dot.className = "crit-typing";
    dot.id = "crit-typing-ind";
    dot.innerHTML = "<span></span><span></span><span></span>";
    msgs.appendChild(dot);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() {
    document.getElementById("crit-typing-ind")?.remove();
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ============================================================
     SEND & REPLY FLOW
  ============================================================ */
  function doSend() {
    const input = document.getElementById("crit-input");
    const text = input.value.trim();
    if (!text || isTyping) return;

    // Check direct walkthrough, build-it-for-me & project start intents
    const lower = text.toLowerCase();

    // Direct demo / interactive build commands
    if (/\b(build it for me|build it|build for me|help me build|build project|start project for me|interactive build|start project demo|startup project demo|start demo|project demo|demo)\b/.test(lower) ||
      (/\b(demo|walkthrough|interactive)\b/.test(lower) && /\b(start|project|startup|submit|build)\b/.test(lower))) {
      input.value = "";
      input.style.height = "auto";
      document.getElementById("crit-send").disabled = true;
      appendMessage("user", text);
      addMessageToState("user", text);

      setTimeout(() => {
        const currentPath = window.location.pathname.toLowerCase().replace(/\/index\.html$/, '/');
        const isHome = currentPath === '/' || currentPath === '' || currentPath.endsWith('index.html') || currentPath === '/index' || currentPath.endsWith('/index');
        const isSubmit = currentPath.includes('submit');

        const demoReplies = [
          "Let's build your project together! 🚀 Launching your guided interactive brief now...",
          "On it! 🎨 Taking control to walk you step-by-step through setting up your project brief...",
          "Exciting! Let's get your vision into production right away. Starting the walkthrough now! 💡",
          "Ready when you are! 🧭 Let's breeze through the submission steps together..."
        ];
        const reply = demoReplies[Math.floor(Math.random() * demoReplies.length)];

        if (!isHome && !isSubmit) {
          const replyText = "Let's set up your project together! 🚀\n\nI can take full control of the site and walk you through every step of crafting your brief.\n\n[TOUR:interactive-build]";
          appendMessage("bot", replyText, "", true);
          addMessageToState("bot", replyText);
        } else if (isSubmit) {
          // Detect current step on submit page to explain what to do from here!
          let activeStepNum = 1;
          if (typeof window.currentStep === 'number' && window.currentStep >= 1 && window.currentStep <= 5) {
            activeStepNum = window.currentStep;
          } else {
            for (let s = 1; s <= 5; s++) {
              const el = document.getElementById(`step-${s}`);
              if (el && el.classList.contains('active')) {
                activeStepNum = s;
                break;
              }
            }
          }

          const stepGuidance = {
            1: {
              step: 'Step 1: Project Name',
              desc: 'Here you give your creative project a distinct name (e.g. *Nexus Brand Identity*). When ready, tap **Continue Demo** to spotlight the field and guide you through typing it.'
            },
            2: {
              step: 'Step 2: Service Selection',
              desc: 'Here you choose the exact creative craft you need (Poster & Graphics, Logo & Branding, Website, Video, or UI/UX). When ready, tap **Continue Demo** to spotlight the options.'
            },
            3: {
              step: 'Step 3: Description, Files & GitHub',
              desc: 'Here you outline your vision (minimum 20 characters), upload reference moodboards, and attach GitHub repositories or UI components. When ready, tap **Continue Demo** to walk through each section.'
            },
            4: {
              step: 'Step 4: Budget & Timeline',
              desc: 'Here you confirm your country billing currency, select your turnaround deadline (minimum 3 days), and adjust the budget slider. When ready, tap **Continue Demo** to configure them.'
            },
            5: {
              step: 'Step 5: Terms & Review',
              desc: 'Here you review our preview-first terms (2 free revisions, 100% IP transfer upon payment) and finalize your submission. When ready, tap **Continue Demo** to finish your setup.'
            }
          };

          const currentGuide = stepGuidance[activeStepNum] || stepGuidance[1];
          const submitReply = `Let's continue your project setup! 🚀\n\nYou are currently on **${currentGuide.step}**.\n\n${currentGuide.desc}\n\n[TOUR:interactive-build]`;

          appendMessage("bot", submitReply, "", true);
          addMessageToState("bot", submitReply);
          // Do not force-close chat: the user reads the guidance and clicks Continue Demo to start!
        } else {
          const homeReply = "Let's build your creative brief together! 🚀\n\nI will guide you step-by-step from service selection to brief submission with zero upfront payment.\n\n[TOUR:interactive-build]";
          appendMessage("bot", homeReply, "", true);
          addMessageToState("bot", homeReply);
        }
      }, 300);
      return;
    }

    // Direct command: view full website tour
    if (/\b(take me to view the complete website|view the complete website|take me on a tour|give me a tour|tour the website|walk me through the website|show me the whole website|show me the website)\b/.test(lower)) {
      input.value = "";
      input.style.height = "auto";
      document.getElementById("crit-send").disabled = true;
      appendMessage("user", text);
      addMessageToState("user", text);
      setTimeout(() => {
        const tourReplies = [
          "I'd love to! 🧭 Dimming the lights now for a brief tour of the website!",
          "Right away! 💡 Let's dim the lights and explore every section step-by-step.",
          "Here we go! 🚀 Dimming the lights for a guided showcase of CRITERIA studio..."
        ];
        const reply = tourReplies[Math.floor(Math.random() * tourReplies.length)];
        appendMessage("bot", reply, "", true);
        addMessageToState("bot", reply);
        setTimeout(() => CritTour.start('full-website'), 500);
      }, 300);
      return;
    }

    // Direct command: start project tour
    if (/\b(show me how|yes show me|start tour|show how|start the tour)\b/.test(lower)) {
      input.value = "";
      input.style.height = "auto";
      document.getElementById("crit-send").disabled = true;
      appendMessage("user", text);
      addMessageToState("user", text);
      setTimeout(() => {
        if (!isUserSignedIn()) {
          guideUserToSignInWithMouse("Please sign in first, then ask me again — I'll be waiting! 🔒✨");
        } else {
          const walkReplies = [
            "Starting your interactive walkthrough right now! 🚀",
            "Here we go! Walking you through the setup live... 🎨",
            "Let's do this! Taking you into the interactive brief... ✨"
          ];
          const reply = walkReplies[Math.floor(Math.random() * walkReplies.length)];
          appendMessage("bot", reply, "", true);
          addMessageToState("bot", reply);
          setTimeout(() => CritTour.start('start-project'), 500);
        }
      }, 300);
      return;
    }
    input.value = "";
    input.style.height = "auto";
    document.getElementById("crit-send").disabled = true;
    sendMessage(text);
  }

  function sendMessage(text) {
    const quicks = document.getElementById("crit-quicks");
    if (quicks) quicks.style.display = "none";
    appendMessage("user", text);
    addMessageToState("user", text);
    isTyping = true;
    showTyping();

    // Check if user specifically requested a standard page explanation before calling backend
    const lower = text.toLowerCase().trim();
    if (/\b(what does this (page|section) do|explain this (page|section)|what can i do here)\b/i.test(lower)) {
      setTimeout(() => finishReply(findAnswer(text)), 400);
      return;
    }

    // AI mode: show note if Render backend is waking up
    const slowTimer = setTimeout(() => {
      const ind = document.getElementById("crit-typing-ind");
      if (ind && !document.getElementById("crit-wake-note")) {
        const note = document.createElement("div");
        note.id = "crit-wake-note";
        note.style.cssText = "font-size:11px;color:rgba(255,255,255,0.45);align-self:flex-start;margin:-4px 4px 0";
        note.textContent = "Waking up the AI server… this can take up to a minute.";
        ind.after(note);
        const msgs = document.getElementById("crit-messages");
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
      }
    }, 6000);

    askBackend(text)
      .then(rawAnswer => {
        clearTimeout(slowTimer);
        leaveQaMode();
        const safeAnswer = ensureOffTopicPivot(text, rawAnswer);
        finishReply(safeAnswer);
      })
      .catch(err => {
        clearTimeout(slowTimer);
        console.warn('CRIT AI backend failed, using Q&A mode:', err);
        if (!(err && (err.status === 429 || err.status === 400))) enterQaMode();
        finishReply(findAnswer(text));
      });
  }

  function finishReply(answer) {
    hideTyping();
    document.getElementById("crit-wake-note")?.remove();
    appendMessage("bot", answer, "", true);
    addMessageToState("bot", answer);
    isTyping = false;
  }

  /* ============================================================
     INIT
  ============================================================ */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }

})();
