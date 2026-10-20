// CRITERIA Theme, Accent & FullScreen Management
(function() {
  function applyThemeAccent() {
    try {
      const preferences = window.criteriaCookiePreferences;
      const theme = preferences?.get('theme');
      if (theme) {
        document.documentElement.setAttribute('data-theme', theme);
      }
      const accent = preferences?.get('accent');
      if (accent && accent.startsWith('#') && accent.length === 7) {
        document.documentElement.style.setProperty('--gold', accent);
        const r = parseInt(accent.slice(1, 3), 16);
        const g = parseInt(accent.slice(3, 5), 16);
        const b = parseInt(accent.slice(5, 7), 16);
        document.documentElement.style.setProperty('--gold-glow', `rgba(${r},${g},${b},0.12)`);
        document.documentElement.style.setProperty('--gold-border', `rgba(${r},${g},${b},0.25)`);
      }
    } catch(e) {}
  }

  applyThemeAccent();

  // ── CLEAN, RELIABLE FULLSCREEN CONTROLLER ──
  function initFullscreenSystem() {
    // 1. Purge any stale redirect-fullscreen persistence flags immediately
    try {
      sessionStorage.removeItem('crit_fullscreen_persist');
    } catch(e) {}

    // 2. Inject Styles if not already present
    if (!document.getElementById('crit-fullscreen-styles')) {
      const style = document.createElement('style');
      style.id = 'crit-fullscreen-styles';
      style.textContent = `
        @view-transition { navigation: auto; }

        .crit-fullscreen-btn {
          position: fixed !important;
          bottom: 24px !important;
          left: 24px !important;
          z-index: 99990 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 9px !important;
          padding: 8px 16px 8px 14px !important;
          border-radius: 9999px !important;
          background: rgba(14, 14, 18, 0.88) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border: 1px solid rgba(240, 165, 0, 0.3) !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
          color: #f1f5f9 !important;
          font-family: 'DM Sans', system-ui, -apple-system, sans-serif !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          letter-spacing: 0.08em !important;
          text-transform: uppercase !important;
          cursor: pointer !important;
          user-select: none !important;
          -webkit-user-select: none !important;
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.22s ease, box-shadow 0.22s ease, color 0.22s ease, background 0.22s ease !important;
          text-decoration: none !important;
          outline: none !important;
        }

        .crit-fullscreen-btn:hover {
          border-color: #f0a500 !important;
          color: #ffffff !important;
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.75), 0 0 20px rgba(240, 165, 0, 0.35) !important;
          transform: translateY(-2px) !important;
        }

        .crit-fullscreen-btn:active {
          transform: translateY(0) scale(0.96) !important;
        }

        .crit-fs-icon-wrap {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 18px !important;
          height: 18px !important;
          color: #f0a500 !important;
          flex-shrink: 0 !important;
        }

        .crit-fs-label {
          line-height: 1 !important;
          white-space: nowrap !important;
        }

        .crit-fs-kbd {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 2px 6px !important;
          font-size: 9px !important;
          font-weight: 700 !important;
          font-family: 'DM Mono', monospace, monospace !important;
          color: #f0a500 !important;
          background: rgba(240, 165, 0, 0.12) !important;
          border: 1px solid rgba(240, 165, 0, 0.32) !important;
          border-radius: 4px !important;
          letter-spacing: 0.04em !important;
          line-height: 1 !important;
        }

        .crit-fullscreen-btn.is-active {
          background: rgba(22, 18, 12, 0.92) !important;
          border-color: #f0a500 !important;
          box-shadow: 0 0 22px rgba(240, 165, 0, 0.25), 0 10px 30px rgba(0, 0, 0, 0.7) !important;
        }

        .crit-fullscreen-btn.is-active .crit-fs-kbd {
          background: rgba(240, 165, 0, 0.22) !important;
          border-color: #f0a500 !important;
        }

        @media (max-width: 768px) {
          .crit-fullscreen-btn {
            bottom: 16px !important;
            left: 16px !important;
            padding: 7px 12px 7px 10px !important;
            font-size: 10px !important;
          }
          .crit-fs-kbd {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // 3. Render Button or Upgrade existing
    let btn = document.getElementById('crit-fullscreen-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'crit-fullscreen-btn';
      btn.className = 'crit-fullscreen-btn';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Toggle Fullscreen Mode');
      document.body.appendChild(btn);
    }

    const SVG_ENTER = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 3h6v6"></path>
        <path d="M9 21H3v-6"></path>
        <path d="M21 3l-7 7"></path>
        <path d="M3 21l7-7"></path>
      </svg>
    `;

    const SVG_EXIT = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 14h6v6"></path>
        <path d="M20 10h-6V4"></path>
        <path d="M14 10l7-7"></path>
        <path d="M10 14l-7 7"></path>
      </svg>
    `;

    function updateBtnState() {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      if (isFs) {
        btn.classList.add('is-active');
        btn.innerHTML = `
          <span class="crit-fs-icon-wrap">${SVG_EXIT}</span>
          <span class="crit-fs-label">Exit Fullscreen</span>
          <kbd class="crit-fs-kbd">Esc</kbd>
        `;
        btn.title = "Exit Fullscreen (Esc)";
      } else {
        btn.classList.remove('is-active');
        btn.innerHTML = `
          <span class="crit-fs-icon-wrap">${SVG_ENTER}</span>
          <span class="crit-fs-label">Fullscreen</span>
          <kbd class="crit-fs-kbd">F11</kbd>
        `;
        btn.title = "Experience Fullscreen (F11)";
        try { sessionStorage.removeItem('crit_fullscreen_persist'); } catch(e) {}
      }
    }

    window.toggleFullscreen = function() {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      if (!isFs) {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (req) {
          req.call(el).catch(err => {
            console.warn('Fullscreen request notice:', err);
          });
        }
      } else {
        try { sessionStorage.removeItem('crit_fullscreen_persist'); } catch(e) {}
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
        if (exit) {
          exit.call(document).catch(() => {});
        }
      }
    };

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.toggleFullscreen();
    };

    document.addEventListener('fullscreenchange', updateBtnState);
    document.addEventListener('webkitfullscreenchange', updateBtnState);
    document.addEventListener('mozfullscreenchange', updateBtnState);
    document.addEventListener('MSFullscreenChange', updateBtnState);

    // Initial button state
    updateBtnState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFullscreenSystem);
  } else {
    initFullscreenSystem();
  }
})();
