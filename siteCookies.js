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

  function makeButton(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
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

      const copy = document.createElement('div');
      copy.className = 'site-cookie-copy';

      const title = document.createElement('h2');
      title.id = 'site-cookie-title';
      title.textContent = 'Cookie Preferences';

      const description = document.createElement('p');
      description.id = 'site-cookie-description';
      description.textContent = 'We use essential cookies for secure login and authentication, and optional preference cookies to remember your time zone, date format, and dashboard preferences across pages. No advertising or tracking cookies are used.';

      copy.append(title, description);

      const actions = document.createElement('div');
      actions.className = 'site-cookie-actions';
      actions.append(
        makeButton('Essential Only', 'site-cookie-button site-cookie-secondary', function() { setConsent(false); }),
        makeButton('Allow Preferences', 'site-cookie-button site-cookie-primary', function() { setConsent(true); })
      );
      banner.append(copy, actions);
    }

    banner.hidden = !show;
    if (show && !banner.isConnected) {
      document.body.appendChild(banner);
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
