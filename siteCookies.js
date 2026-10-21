(function () {
  'use strict';

  const CONSENT_COOKIE = 'criteria-cookie-consent';
  const SETTINGS_COOKIE = 'criteria-settings';
  const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

  // Inject stylesheet if not present
  if (!document.querySelector('link[href*="siteCookies.css"]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/siteCookies.css';
    (document.head || document.documentElement).appendChild(stylesheet);
  }

  function readCookie(name) {
    if (!document.cookie) return null;
    const prefix = name + '=';
    const parts = document.cookie.split(/;\s*/);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith(prefix)) {
        try {
          return decodeURIComponent(part.slice(prefix.length));
        } catch (error) {
          return part.slice(prefix.length);
        }
      }
    }
    return null;
  }

  function writeCookie(name, value, maxAge = COOKIE_MAX_AGE) {
    const attributes = ['Path=/', 'SameSite=Lax'];
    if (maxAge <= 0) {
      attributes.push('Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    } else {
      attributes.push('Max-Age=' + maxAge);
    }
    if (window.location.protocol === 'https:') {
      attributes.push('Secure');
    }
    document.cookie = name + '=' + encodeURIComponent(value) + '; ' + attributes.join('; ');
  }

  function getConsent() {
    const value = readCookie(CONSENT_COOKIE);
    return value === 'preferences' || value === 'essential' ? value : null;
  }

  function readStoredSettings() {
    if (getConsent() === 'preferences') {
      const cookieVal = readCookie(SETTINGS_COOKIE);
      if (cookieVal) {
        try {
          const parsed = JSON.parse(cookieVal);
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (e) {}
      }
    }
    try {
      const ls = localStorage.getItem('criteria-settings');
      if (ls) {
        const parsed = JSON.parse(ls);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return {};
  }

  function writeStoredSettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    try {
      localStorage.setItem('criteria-settings', JSON.stringify(settings));
    } catch (e) {}

    if (getConsent() === 'preferences') {
      try {
        writeCookie(SETTINGS_COOKIE, JSON.stringify(settings));
      } catch (e) {}
    }
  }

  function removeOptionalCookies() {
    const optionalNames = [SETTINGS_COOKIE, 'criteria-theme', 'criteria-accent'];
    for (let i = 0; i < optionalNames.length; i++) {
      writeCookie(optionalNames[i], '', 0);
    }
  }

  function setConsent(allowPreferences) {
    const consent = allowPreferences ? 'preferences' : 'essential';
    writeCookie(CONSENT_COOKIE, consent);

    if (allowPreferences) {
      const current = readStoredSettings();
      writeStoredSettings(current);
    } else {
      removeOptionalCookies();
    }

    renderBanner(false);

    try {
      window.dispatchEvent(new CustomEvent('criteria-cookie-consent-change', {
        detail: { consent, allowed: allowPreferences }
      }));
    } catch (e) {}
  }

  function getPreference(key) {
    if (key === 'theme') {
      const c = readCookie('criteria-theme');
      if (c) return c;
      const s = readStoredSettings();
      return s.theme || 'dark';
    }
    if (key === 'accent') {
      const c = readCookie('criteria-accent');
      if (c) return c;
      const s = readStoredSettings();
      return s.accent || '#f0a500';
    }
    const s = readStoredSettings();
    return s[key] !== undefined ? s[key] : null;
  }

  function setPreference(key, value) {
    const s = readStoredSettings();
    s[key] = value;
    writeStoredSettings(s);
  }

  function saveAllSettings(settingsObj) {
    if (!settingsObj || typeof settingsObj !== 'object') return;
    writeStoredSettings(settingsObj);
  }

  // ── DATE, TIME & CURRENCY FORMATTERS ──
  function formatDate(value) {
    if (!value) return '—';
    const date = value.toDate ? value.toDate() : new Date(value);
    if (isNaN(date.getTime())) return '—';

    const s = readStoredSettings();
    const tz = s.timezone || 'Asia/Kolkata';
    const format = s.dateformat || 'DD/MM/YYYY';

    try {
      // Get formatted parts in selected timezone
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(date);
      let day = '', month = '', year = '';
      parts.forEach(p => {
        if (p.type === 'day') day = p.value;
        if (p.type === 'month') month = p.value;
        if (p.type === 'year') year = p.value;
      });

      if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
      if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
      if (format === 'D MMM YYYY') {
        const mName = date.toLocaleString('en-US', { timeZone: tz, month: 'short' });
        return `${parseInt(day, 10)} ${mName} ${year}`;
      }
      return `${day}/${month}/${year}`;
    } catch (e) {
      return date.toLocaleDateString();
    }
  }

  function formatTime(value) {
    if (!value) return '';
    const date = value.toDate ? value.toDate() : new Date(value);
    if (isNaN(date.getTime())) return '';

    const s = readStoredSettings();
    const tz = s.timezone || 'Asia/Kolkata';
    const is24h = s.timeformat === '24h';

    try {
      return date.toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: !is24h
      });
    } catch (e) {
      return date.toLocaleTimeString();
    }
  }

  function formatCurrency(amount) {
    const num = Number(amount) || 0;
    const s = readStoredSettings();
    const cur = s.currency || 'INR';

    const symbols = {
      INR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£',
      AED: 'AED '
    };
    const sym = symbols[cur] || '₹';
    const formatted = num.toLocaleString('en-IN');
    return `${sym}${formatted}`;
  }

  // ── SOUND SYNTHESIS CHIME ──
  function playNotificationSound() {
    const s = readStoredSettings();
    if (s['n-sound'] === false) return; // muted if user unchecked
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc1.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.12); // E6

      osc2.frequency.setValueAtTime(440, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.35);
      osc2.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  }

  // ── GLOBAL APPLICATION OF PREFERENCES ──
  function applyGlobalPreferences() {
    try {
      const s = readStoredSettings();
      // Accessibility: Reduce Motion
      if (s['a-motion']) {
        document.documentElement.style.setProperty('--transition', '0s');
        document.documentElement.setAttribute('data-reduce-motion', 'true');
      } else {
        document.documentElement.style.removeProperty('--transition');
        document.documentElement.removeAttribute('data-reduce-motion');
      }
      // Accessibility: High Contrast
      if (s['a-contrast']) {
        document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.22)');
        document.documentElement.style.setProperty('--border-hover', 'rgba(255,255,255,0.35)');
        document.documentElement.setAttribute('data-high-contrast', 'true');
      } else {
        document.documentElement.style.removeProperty('--border');
        document.documentElement.style.removeProperty('--border-hover');
        document.documentElement.removeAttribute('data-high-contrast');
      }
      // Accessibility: Enhanced Focus
      if (s['a-focus']) {
        document.documentElement.setAttribute('data-enhanced-focus', 'true');
      } else {
        document.documentElement.removeAttribute('data-enhanced-focus');
      }
      // Dashboard: Compact Table View
      if (s['d-compact']) {
        document.documentElement.setAttribute('data-compact-table', 'true');
      } else {
        document.documentElement.removeAttribute('data-compact-table');
      }
    } catch (e) {}
  }
  applyGlobalPreferences();

  let banner = null;

  function dismissBanner(allowPreferences) {
    if (!banner) {
      setConsent(allowPreferences);
      return;
    }
    banner.classList.add('site-cookie-leaving');
    setTimeout(() => {
      setConsent(allowPreferences);
      if (banner) {
        banner.hidden = true;
        banner.classList.remove('site-cookie-leaving');
      }
    }, 240);
  }

  function renderBanner(show) {
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { renderBanner(show); }, { once: true });
      }
      return;
    }

    if (!banner) {
      banner = document.createElement('section');
      banner.className = 'site-cookie-notice';
      banner.id = 'criteria-cookie-banner';
      banner.setAttribute('role', 'dialog');
      banner.setAttribute('aria-labelledby', 'site-cookie-title');
      banner.setAttribute('aria-describedby', 'site-cookie-description');

      // Top glowing edge
      const edge = document.createElement('div');
      edge.className = 'site-cookie-glow-edge';

      // Inner container
      const inner = document.createElement('div');
      inner.className = 'site-cookie-inner';

      // Icon wrap
      const iconWrap = document.createElement('div');
      iconWrap.className = 'site-cookie-icon-wrap';
      iconWrap.setAttribute('aria-hidden', 'true');
      iconWrap.innerHTML = '<svg class="site-cookie-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path><path d="M8.5 8.5v.01"></path><path d="M7 13.5v.01"></path><path d="M12 11.5v.01"></path><path d="M11.5 16.5v.01"></path><path d="M16 15v.01"></path></svg>';

      // Copy Area
      const copy = document.createElement('div');
      copy.className = 'site-cookie-copy';

      const headerRow = document.createElement('div');
      headerRow.className = 'site-cookie-header-row';

      const titleGroup = document.createElement('div');
      titleGroup.className = 'site-cookie-title-group';

      const tag = document.createElement('span');
      tag.className = 'site-cookie-tag';
      tag.innerHTML = '<span class="site-cookie-tag-dot"></span>CRITERIA PRIVACY';

      const title = document.createElement('h2');
      title.id = 'site-cookie-title';
      title.textContent = 'Cookie & Privacy Preferences';

      titleGroup.append(tag, title);

      // Close / dismiss button
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'site-cookie-close-btn';
      closeBtn.id = 'site-cookie-dismiss';
      closeBtn.setAttribute('aria-label', 'Close cookie notice');
      closeBtn.title = 'Dismiss (Keep essential only)';
      closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      closeBtn.addEventListener('click', function() {
        dismissBanner(false);
      });

      headerRow.append(titleGroup, closeBtn);

      const description = document.createElement('p');
      description.id = 'site-cookie-description';
      description.innerHTML = 'We use essential cookies for secure login, and optional preference cookies to remember your workspace settings (timezone, currency, display density). <strong>No ad tracking or third-party data collection.</strong>';

      // Feature chips
      const chips = document.createElement('div');
      chips.className = 'site-cookie-chips';
      chips.innerHTML = '<span class="site-cookie-chip"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Secure Login</span><span class="site-cookie-chip"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> UI Preferences</span><span class="site-cookie-chip shield"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Zero Trackers</span>';

      copy.append(headerRow, description, chips);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'site-cookie-actions';

      const secBtn = document.createElement('button');
      secBtn.type = 'button';
      secBtn.className = 'site-cookie-button site-cookie-secondary';
      secBtn.textContent = 'Essential Only';
      secBtn.addEventListener('click', function() {
        dismissBanner(false);
      });

      const primBtn = document.createElement('button');
      primBtn.type = 'button';
      primBtn.className = 'site-cookie-button site-cookie-primary';
      primBtn.innerHTML = '<span>Allow Preferences</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
      primBtn.addEventListener('click', function() {
        dismissBanner(true);
      });

      actions.append(secBtn, primBtn);

      inner.append(iconWrap, copy, actions);
      banner.append(edge, inner);
    }

    if (show) {
      banner.hidden = false;
      banner.classList.remove('site-cookie-leaving');
      if (!banner.isConnected) {
        document.body.appendChild(banner);
      }
    } else {
      banner.hidden = true;
    }
  }

  window.criteriaCookiePreferences = {
    get: getPreference,
    getAll: readStoredSettings,
    set: setPreference,
    saveSettings: saveAllSettings,
    formatDate: formatDate,
    formatTime: formatTime,
    formatCurrency: formatCurrency,
    playNotificationSound: playNotificationSound,
    applyGlobalPreferences: applyGlobalPreferences,
    openSettings: function() { renderBanner(true); },
    consent: getConsent,
    setConsent: setConsent
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      applyGlobalPreferences();
      if (!getConsent()) renderBanner(true);
    }, { once: true });
  } else {
    applyGlobalPreferences();
    if (!getConsent()) renderBanner(true);
  }
})();
